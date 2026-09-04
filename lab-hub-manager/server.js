// ============================================================
//  L.A.B Hub Manager — first build (M-000001)
//  The Main Server's brain + face. Serves the Manager dashboard on the LAN
//  and streams live server utilisation. Grows into the full Manager
//  (Dev Team, Fleet/MDM, SQL brain, App Store pipeline, Hub distribution).
// ============================================================
require('dotenv').config();
const path = require('path');
const os = require('os');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const si = require('systeminformation');
const db = require('./db');
const devteam = require('./devteam');
const catalog = require('./catalog');
const sauce = require('./sauce');
const ledgers = require('./ledgers');
const builders = require('./builders');
const research = require('./research');
const conductor = require('./conductor');
const wizard = require('./wizard');
const calendar = require('./calendar');

const VERSION = 'M-000025';
const PORT = Number(process.env.LAB_MANAGER_PORT) || 8090;
const DATA_ROOT = process.env.LAB_DATA_ROOT || '/srv/lab';

const app = express();
app.use(express.json());

// ---- Off-network guard (defense-in-depth for the Cloudflare tunnel) --------
// Direct LAN traffic is trusted. Anything arriving THROUGH the tunnel (Cloudflare
// adds cf-connecting-ip / cf-ray) may ONLY touch the family surface — the Hub,
// shared data, the Sauce, the store, the kiosk. The whole control plane (Manager
// dashboard, Admin, Installer, settings, dev-team, ledgers, Conductor writes) is
// refused off-network unless a valid admin key is presented. Belt-and-suspenders
// behind the tunnel's own Hub-only ingress config.
const viaTunnel = req => !!(req.headers['cf-connecting-ip'] || req.headers['cf-ray'] || req.headers['x-forwarded-host']);
const SENSITIVE = [
  /^\/$/, /^\/admin(\/|$)/, /^\/install(\/|$)/, /^\/showcase(\/|$)/,
  /^\/api\/(settings|devteam|ledgers|master|research|generations|conductor|analytics|updates|fleet|admin|wizard\/devices|showcase|usage\/devices|app\/sync|audit)/
];
app.use(async (req, res, next) => {
  if (!viaTunnel(req)) return next();                         // on the home network → trusted
  if (req.method === 'OPTIONS') return next();
  if (!SENSITIVE.some(re => re.test(req.path))) return next(); // family surface → allowed off-network
  const token = req.headers['x-lab-token'], key = req.headers['x-lab-key'];
  if (token && key) {
    try { if (await db.admins.verifyKey(String(token), String(key))) return next(); } catch {}
  }
  return res.status(403).json({ error: 'This part of your L.A.B is only available on the home network.' });
});

app.use(express.static(path.join(__dirname, 'public'), { setHeaders: r => r.setHeader('Cache-Control', 'no-cache') }));
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => { console.error(e.message); if (!res.headersSent) res.status(500).json({ error: e.message }); });
// CORS — the Admin Portal (Electron app) reaches the Manager over the LAN
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const clamp = (v, def) => (typeof v === 'number' ? Math.max(1, Math.min(10, Math.round(v))) : def);
// Live updates: any successful change to shared things is announced over /ws as
// {type:'shared', what} so every open app / hub / kiosk refreshes at once.
const shared = what => { try { broadcast({ type: 'shared', what, t: Date.now() }); } catch { /* ws not up yet */ } };
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'OPTIONS' && req.method !== 'HEAD') {
    const m = /^\/api\/(shared\/(todos|events)|calendar|conductor|kiosk|sauce|store)/.exec(req.path);
    const by = req.body && (req.body.by || req.body.name) ? String(req.body.by || req.body.name).slice(0, 40) : null;
    if (m) res.on('finish', () => { if (res.statusCode < 300 && !res.locals.quiet) { try { broadcast({ type: 'shared', what: m[2] || m[1], by, t: Date.now() }); } catch {} } });
  }
  next();
});

function lanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) for (const n of nets[name] || []) if (n.family === 'IPv4' && !n.internal) return n.address;
  return '127.0.0.1';
}

let lastStats = null;
async function collectStats() {
  const [load, mem, fsSize, netStats, docker] = await Promise.all([
    si.currentLoad().catch(() => ({ currentLoad: 0, cpus: [] })),
    si.mem().catch(() => ({ total: 0, available: 0 })),
    si.fsSize().catch(() => []),
    si.networkStats().catch(() => [{ rx_sec: 0, tx_sec: 0 }]),
    si.dockerInfo().catch(() => null)
  ]);
  const rootFs = fsSize.find(f => f.mount === '/') || {};
  const labFs = fsSize.find(f => f.mount === DATA_ROOT) || {};
  const net = netStats[0] || {};
  lastStats = {
    t: Date.now(),
    cpu: +(load.currentLoad || 0).toFixed(1),
    cores: (load.cpus || []).map(c => Math.round(c.load || 0)),
    mem: { total: mem.total, used: mem.total - mem.available, pct: mem.total ? +(((mem.total - mem.available) / mem.total) * 100).toFixed(1) : 0 },
    load: os.loadavg().map(x => +x.toFixed(2)),
    uptime: os.uptime(),
    disk: {
      root: { size: rootFs.size || 0, used: rootFs.used || 0, pct: +(rootFs.use || 0).toFixed(1) },
      lab: { size: labFs.size || 0, used: labFs.used || 0, pct: +(labFs.use || 0).toFixed(1) }
    },
    net: { rx: net.rx_sec || 0, tx: net.tx_sec || 0 },
    docker: docker ? { containers: docker.containers || 0, running: docker.containersRunning || 0, images: docker.images || 0 } : null
  };
  return lastStats;
}

app.get('/api/identity', (req, res) => res.json({
  app: 'L.A.B Hub Manager', version: VERSION, node: os.hostname(), kind: 'Main Server',
  ip: lanIP(), platform: `${os.type()} ${os.release()}`, cpuModel: (os.cpus()[0] || {}).model || 'unknown',
  cores: os.cpus().length, totalMem: os.totalmem(), dataRoot: DATA_ROOT, started: START
}));
app.get('/api/stats', async (req, res) => res.json(lastStats || await collectStats()));
app.get('/api/health', (req, res) => res.json({ ok: true, version: VERSION }));
// the fuller picture for Admin: database, disk on the data volume, age of the last backup
app.get('/api/health/full', wrap(async (req, res) => {
  const fs = require('fs');
  let dbOk = false; try { await db.pool.query('SELECT 1'); dbOk = true; } catch {}
  let backup = null; try {
    const dir = '/srv/lab/backups', f = fs.readdirSync(dir).filter(x => /^labbrain-.*\.sql\.gz$/.test(x)).sort().pop();
    if (f) { const st = fs.statSync(path.join(dir, f)); backup = { file: f, bytes: st.size, age_h: +((Date.now() - st.mtimeMs) / 3600000).toFixed(1) }; }
  } catch {}
  const disk = (lastStats && lastStats.disk) || null;
  res.json({ ok: dbOk, version: VERSION, db: dbOk, uptime_s: Math.round(process.uptime()), disk, backup, ws_clients: wss ? wss.clients.size : 0 });
}));

// ---- SQL Brain ----
app.get('/api/db/health', wrap(async (req, res) => {
  if (!db.isReady()) return res.json({ ok: false, status: 'connecting' });
  res.json(await db.health());
}));
app.get('/api/updates', wrap(async (req, res) => res.json(await db.updates.list())));
app.get('/api/updates/pending', wrap(async (req, res) => res.json(await db.updates.pending())));
app.post('/api/updates/:id/decision', wrap(async (req, res) => {
  const decision = String((req.body && req.body.decision) || '');
  if (!['approved', 'rejected', 'shipped'].includes(decision)) return res.status(400).json({ error: 'bad decision' });
  const r = await db.updates.decide(req.params.id, decision);
  if (!r) return res.status(404).json({ error: 'not found' });
  db.audit('admin', 'update.' + decision, { id: req.params.id, title: r.title });
  ledgers.learnAdmin('update.' + decision).catch(() => {});   // admin ledger grows
  res.json(r);
}));

// ---- Silent Dev Team ----
app.get('/api/devteam', wrap(async (req, res) => res.json(await devteam.status())));
app.post('/api/devteam/standup', wrap(async (req, res) => res.json(await devteam.standup('manual'))));

// ---- Analytics for the Admin Portal graphs + AI-upgrade feed ----
app.get('/api/analytics', wrap(async (req, res) => {
  const [ships, sig, upgrades, telemetry, totals] = await Promise.all([
    db.analytics.shipsByDay(14), db.analytics.sigHistogram(),
    db.analytics.recentUpgrades(8), db.analytics.telemetry(), db.analytics.totals()
  ]);
  res.json({ ships, sig, upgrades, telemetry, totals });
}));

// ---- App Store ----
app.get('/api/store/apps', wrap(async (req, res) => {
  const counts = await db.installs.countByApp().catch(() => []);
  const cmap = Object.fromEntries(counts.map(c => [c.app_id, c.c]));
  res.json({ categories: catalog.categories(), apps: catalog.list().map(a => ({ ...a, installs: cmap[a.id] || 0 })) });
}));
app.get('/api/store/apps/:id', wrap(async (req, res) => {
  const a = catalog.get(req.params.id);
  if (!a) return res.status(404).json({ error: 'no such app' });
  res.json(a);
}));
app.get('/api/store/installs', wrap(async (req, res) => {
  const acct = Number(req.query.account_id);
  if (!acct) return res.json({ installed: [] });
  const rows = await db.installs.forAccount(acct);
  res.json({ installed: rows.map(r => r.app_id) });
}));
app.post('/api/store/install', wrap(async (req, res) => {
  const acct = Number(req.body.account_id), appId = String(req.body.app_id || '');
  if (!acct || !catalog.get(appId)) return res.status(400).json({ error: 'bad request' });
  if (req.body.remove) await db.installs.remove(acct, appId);
  else await db.installs.add(acct, appId);
  db.events.add({ account_id: acct, type: 'install', payload: { app: appId, remove: !!req.body.remove } }).catch(() => {});
  db.audit('account:' + acct, req.body.remove ? 'app.uninstall' : 'app.install', { app: appId });
  const rows = await db.installs.forAccount(acct);
  res.json({ installed: rows.map(r => r.app_id) });
}));

// ---- Kiosk rooms — now backed by the Conductor (the native device engine).
//      Same response shape as before; toggles are real engine commands.
async function roomsView() {
  const ents = await conductor.listEntities();
  const lights = ents.filter(e => e.kind === 'light' || e.kind === 'led-strip');
  return lights.map(e => ({ id: e.room, name: e.name, on: !!(e.state && e.state.on), entity: e.id, driver: e.driver, online: e.online }));
}
app.get('/api/kiosk/rooms', wrap(async (req, res) => res.json(await roomsView())));
app.post('/api/kiosk/rooms/:id/toggle', wrap(async (req, res) => {
  const ents = await conductor.listEntities();
  const e = ents.find(x => (x.kind === 'light' || x.kind === 'led-strip') && x.room === req.params.id);
  if (!e) return res.status(404).json({ error: 'no such room' });
  await conductor.command(e.id, { toggle: true }, 'kiosk');
  db.events.add({ type: 'kiosk', payload: { kiosk: 'hall', room: e.room } }).catch(() => {});
  res.json(await roomsView());
}));

// ---- Web-facing Hub: the SHARED family surface (global to everyone) ----
// Lists: every to-do belongs to one (Family by default); ?list= filters, GET /api/shared/lists counts them.
const listName = v => { const s = String(v || '').trim().replace(/\s+/g, ' ').slice(0, 30); return s ? s[0].toUpperCase() + s.slice(1) : 'Family'; };
app.get('/api/shared/todos', wrap(async (req, res) => {
  const list = req.query.list ? listName(req.query.list) : null;
  res.json(await db.pool.query(`SELECT id,text,done,by_name,list,created_at FROM shared_todos ${list ? 'WHERE list=$1' : ''} ORDER BY done, created_at DESC LIMIT 300`, list ? [list] : []).then(r => r.rows));
}));
app.get('/api/shared/lists', wrap(async (req, res) => {
  const rows = await db.pool.query(`SELECT list, count(*) FILTER (WHERE NOT done)::int AS open, count(*)::int AS total FROM shared_todos GROUP BY list ORDER BY (list='Family') DESC, list`).then(r => r.rows);
  if (!rows.some(r => r.list === 'Family')) rows.unshift({ list: 'Family', open: 0, total: 0 });
  res.json(rows);
}));
app.post('/api/shared/todos', wrap(async (req, res) => {
  const text = String((req.body && req.body.text) || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'text required' });
  const r = await db.pool.query('INSERT INTO shared_todos(text,by_name,list) VALUES($1,$2,$3) RETURNING id,text,done,by_name,list', [text, String((req.body && req.body.by) || '').slice(0, 40) || null, listName(req.body && req.body.list)]);
  res.json(r.rows[0]);
}));
app.post('/api/shared/todos/:id/toggle', wrap(async (req, res) => res.json((await db.pool.query('UPDATE shared_todos SET done=NOT done WHERE id=$1 RETURNING id,done', [req.params.id])).rows[0] || {})));
app.delete('/api/shared/todos/:id', wrap(async (req, res) => { await db.pool.query('DELETE FROM shared_todos WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));
app.get('/api/shared/events', wrap(async (req, res) => res.json(await db.pool.query('SELECT id,title,to_char(day,\'YYYY-MM-DD\') AS day,at_time,by_name FROM shared_events WHERE day >= current_date - 1 ORDER BY day, at_time LIMIT 200').then(r => r.rows))));
app.post('/api/shared/events', wrap(async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 160); const day = String(b.day || '').slice(0, 10);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'title and day (YYYY-MM-DD) required' });
  const r = await db.pool.query('INSERT INTO shared_events(title,day,at_time,by_name) VALUES($1,$2,$3,$4) RETURNING id,title,to_char(day,\'YYYY-MM-DD\') AS day,at_time,by_name', [title, day, String(b.time || '').slice(0, 10) || null, String(b.by || '').slice(0, 40) || null]);
  res.json(r.rows[0]);
}));
app.delete('/api/shared/events/:id', wrap(async (req, res) => { await db.pool.query('DELETE FROM shared_events WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

// ---- Install wizard: OS installers + PC-analysis → agent personalization ----
const OS_META = {
  win: { label: 'Windows', ext: 'exe', wizard: 'lab-setup-windows.ps1', mime: 'application/octet-stream' },
  mac: { label: 'macOS', ext: 'app', wizard: 'lab-setup-macos.sh', mime: 'application/x-sh' },
  linux: { label: 'Linux', ext: 'AppImage', wizard: 'lab-setup-linux.sh', mime: 'application/x-sh' }
};
// which file in app-builds serves an OS: the canonical extension wins, then anything named after the OS
const buildFor = (files, os, arch) => {
  const m = OS_META[os]; if (!m) return null;
  const byExt = files.filter(f => f.toLowerCase().endsWith('.' + m.ext.toLowerCase()));
  // Macs: Apple silicon (arm64) is the default; an Intel Mac asks with ?arch=x86_64
  if (os === 'mac' && byExt.length > 1) { const intel = /x86_64|x64|intel/i.test(arch || ''); const pick = byExt.find(f => intel ? /x64|x86_64|intel/i.test(f) : /arm64|aarch64|apple/i.test(f)); if (pick) return pick; }
  return byExt[0] || files.find(f => f.toLowerCase().includes(os)) || null;
};
app.get('/api/app/targets', wrap(async (req, res) => {
  // report which native builds actually exist yet (CI releases sync into ./app-builds)
  const dir = path.join(__dirname, 'app-builds');
  let files = []; try { files = require('fs').readdirSync(dir).filter(f => f !== 'version.json'); } catch {}
  res.json(Object.entries(OS_META).map(([os, m]) => ({ os, label: m.label, build: buildFor(files, os), wizard: '/app/wizard/' + os })));
}));

// ---- GitHub Releases → app-builds. The repo is public, so no token is needed. ----
const GH_REPO = process.env.LAB_GH_REPO || 'Taoirodle/lab-platform';
const ASSET_MAP = [
  [/-setup\.exe$/i, 'LAB-Hub-Setup-win-x64.exe', 'win'],
  [/aarch64.*\.dmg$|arm64.*\.dmg$/i, 'LAB-Hub-mac-arm64.dmg', 'mac'],
  [/x64.*\.dmg$|x86_64.*\.dmg$/i, 'LAB-Hub-mac-x64.dmg', 'mac-x64'],
  [/\.AppImage$/i, 'LAB-Hub-linux-x86_64.AppImage', 'linux'],
  [/\.deb$/i, 'LAB-Hub-linux-amd64.deb', 'linux-deb'],
  [/\.rpm$/i, 'LAB-Hub-linux-x86_64.rpm', 'linux-rpm']
];
async function syncReleases() {
  const fs = require('fs'), ua = { 'User-Agent': 'L.A.B-Manager', Accept: 'application/vnd.github+json' };
  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/releases/latest`, { headers: ua });
  if (r.status === 404) return { ok: false, error: 'no release published yet' };
  if (!r.ok) throw new Error('GitHub ' + r.status);
  const rel = await r.json(), dir = path.join(__dirname, 'app-builds'); fs.mkdirSync(dir, { recursive: true });
  const got = [];
  for (const a of rel.assets || []) {
    const m = ASSET_MAP.find(([re]) => re.test(a.name)); if (!m) continue;
    const dest = path.join(dir, m[1]);
    if (fs.existsSync(dest) && fs.statSync(dest).size === a.size) { got.push({ os: m[2], file: m[1], status: 'up-to-date' }); continue; }
    const d = await fetch(a.browser_download_url, { headers: { 'User-Agent': 'L.A.B-Manager' }, redirect: 'follow' });
    if (!d.ok) { got.push({ os: m[2], file: m[1], status: 'HTTP ' + d.status }); continue; }
    fs.writeFileSync(dest + '.part', Buffer.from(await d.arrayBuffer())); fs.renameSync(dest + '.part', dest);
    got.push({ os: m[2], file: m[1], status: 'downloaded', bytes: a.size });
  }
  const version = String(rel.tag_name || '').replace(/^app-v/, '');
  if (version) fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version, notes: String(rel.name || '').slice(0, 200), published_at: rel.published_at, source: rel.html_url }, null, 2));
  db.audit('system', 'app.sync', { version, got });
  return { ok: true, version, assets: got };
}
app.post('/api/app/sync', wrap(async (req, res) => { try { res.json(await syncReleases()); } catch (e) { res.status(502).json({ ok: false, error: e.message }); } }));
setInterval(() => syncReleases().catch(() => {}), 6 * 3600 * 1000);
// Latest published app version (written next to the builds as app-builds/version.json)
app.get('/api/app/version', wrap(async (req, res) => {
  let v = null; try { v = JSON.parse(require('fs').readFileSync(path.join(__dirname, 'app-builds', 'version.json'), 'utf8')); } catch {}
  res.json(v || { version: null });
}));
app.get('/app/wizard/:os', wrap(async (req, res) => {
  const m = OS_META[req.params.os]; if (!m) return res.status(404).send('unknown OS');
  const p = path.join(__dirname, 'wizards', m.wizard);
  if (!require('fs').existsSync(p)) return res.status(404).send('wizard not staged for ' + req.params.os);
  res.setHeader('Content-Type', m.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${m.wizard}"`);
  res.send(require('fs').readFileSync(p));
}));
app.get('/app/download/:os', wrap(async (req, res) => {
  const m = OS_META[req.params.os]; if (!m) return res.status(404).send('unknown OS');
  const dir = path.join(__dirname, 'app-builds');
  let file = null; try { file = buildFor(require('fs').readdirSync(dir).filter(f => f !== 'version.json'), req.params.os, req.query.arch); } catch {}
  if (!file) return res.status(404).json({ error: 'no native build yet for ' + m.label, hint: 'CI releases sync into ./app-builds' });
  res.download(path.join(dir, file));
}));
app.post('/api/wizard/profile', wrap(async (req, res) => {
  const b = req.body || {};
  const out = await wizard.register({ account_id: b.account_id, report: b.report || {} });
  res.json(out);   // { id, personalization }
}));
app.get('/api/wizard/profile/:id', wrap(async (req, res) => {
  const p = await wizard.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'no such profile' });
  res.json(p);
}));
app.get('/api/wizard/devices', wrap(async (req, res) => res.json(await wizard.list())));

// ---- Personal-app usage telemetry → the Stats page ------------------------
// The native app samples what's in front once a minute and posts batches here.
// Summaries are per device (only the app knows its device id) in the caller's tz.
app.post('/api/usage/ingest', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.device_id || !Array.isArray(b.samples)) return res.status(400).json({ error: 'device_id + samples[] required' });
  res.json(await db.usage.ingest({
    device_id: String(b.device_id).slice(0, 80), account_id: b.account_id ? Number(b.account_id) || null : null,
    hostname: b.hostname ? String(b.hostname).slice(0, 80) : null, os: b.os ? String(b.os).slice(0, 40) : null, samples: b.samples
  }));
}));
app.get('/api/usage/summary', wrap(async (req, res) => {
  if (!req.query.device_id) return res.status(400).json({ error: 'device_id required' });
  res.json(await db.usage.summary({ device_id: String(req.query.device_id).slice(0, 80), days: req.query.days, tz: req.query.tz }));
}));
app.get('/api/usage/day', wrap(async (req, res) => {
  if (!req.query.device_id) return res.status(400).json({ error: 'device_id required' });
  res.json(await db.usage.day({ device_id: String(req.query.device_id).slice(0, 80), date: req.query.date, tz: req.query.tz }));
}));
app.get('/api/usage/devices', wrap(async (req, res) => res.json(await db.usage.devices())));   // admin overview (home-network only)
// Retention: measurements older than N days are purged nightly (default 90). Admin-only setting.
app.get('/api/settings/usage', wrap(async (req, res) => res.json(await db.settings.get('usage', { retention_days: 90 }))));
app.post('/api/settings/usage', wrap(async (req, res) => {
  const days = Math.max(7, Math.min(3650, Math.round(Number((req.body || {}).retention_days)) || 90));
  await db.settings.set('usage', { retention_days: days });
  db.audit('admin', 'settings.usage', { retention_days: days });
  res.json({ retention_days: days });
}));
async function purgeUsage() {
  const s = await db.settings.get('usage', { retention_days: 90 });
  const r = await db.pool.query('DELETE FROM usage_samples WHERE ts < now() - make_interval(days => $1::int)', [s.retention_days || 90]);
  if (r.rowCount) db.audit('system', 'usage.purge', { deleted: r.rowCount, retention_days: s.retention_days });
  return r.rowCount;
}
app.post('/api/usage/purge', wrap(async (req, res) => res.json({ deleted: await purgeUsage() })));
setInterval(() => purgeUsage().catch(() => {}), 24 * 3600 * 1000);
// "Delete my data": the app wipes everything its device ever sent
app.delete('/api/usage/device/:id', wrap(async (req, res) => {
  const id = String(req.params.id).slice(0, 80);
  const r = await db.pool.query('DELETE FROM usage_samples WHERE device_id=$1', [id]);
  await db.pool.query("DELETE FROM devices WHERE id=$1 AND kind='hub-app'", [id]).catch(() => {});
  db.audit('device:' + id, 'usage.delete', { rows: r.rowCount });
  res.json({ ok: true, deleted: r.rowCount });
}));

// ---- Calendar: ICS subscriptions (no OAuth) + merged family view ----------
app.get('/api/calendar/feeds', wrap(async (req, res) => res.json(await calendar.listFeeds(req.query.account_id ? Number(req.query.account_id) : null))));
app.post('/api/calendar/feeds', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.url || !/^(https?|webcal):\/\//i.test(String(b.url).trim())) return res.status(400).json({ error: 'Paste an iCal (ICS / webcal) link.' });
  try { res.json(await calendar.addFeed({ account_id: b.account_id ? Number(b.account_id) : null, name: b.name, url: b.url, color: b.color, shared: !!b.shared })); }
  catch (e) { res.status(400).json({ error: 'Could not read that calendar: ' + e.message }); }
}));
app.post('/api/calendar/feeds/:id/refresh', wrap(async (req, res) => res.json(await calendar.refreshById(req.params.id))));
app.delete('/api/calendar/feeds/:id', wrap(async (req, res) => res.json(await calendar.removeFeed(req.params.id, req.query.account_id ? Number(req.query.account_id) : null))));
app.get('/api/calendar/events', wrap(async (req, res) => res.json(await calendar.events({ account_id: req.query.account_id ? Number(req.query.account_id) : null, from: req.query.from, to: req.query.to }))));
// the family calendar as a feed phones can subscribe to (family events + calendars shared with the family)
app.get('/api/calendar/family.ics', wrap(async (req, res) => {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="family.ics"');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(await calendar.familyIcs());
}));

// ---- Showcase: the "L.A.B ONE" keynote — cue channel + real light choreography ----
app.post('/api/showcase/cue', wrap(async (req, res) => {
  const cue = String((req.body && req.body.cue) || '').slice(0, 40);
  const data = (req.body && req.body.data) || {};
  if (!cue) return res.status(400).json({ error: 'cue required' });
  broadcast({ type: 'showcase', cue, data });                 // push to every TV page on /ws
  try {                                                        // fire the matching real-world scene
    if (data.scene) await conductor.runScene(data.scene, 'showcase');
    else if (cue === 'blackout' || cue === 'curtain') await conductor.runScene('all-off', 'showcase');
    else if (cue === 'sauce' || cue === 'motion') await conductor.runScene('movie-night', 'showcase');
  } catch { /* the show goes on even if a bulb is offline */ }
  db.events.add({ type: 'showcase', payload: { cue } }).catch(() => {});
  res.json({ ok: true, cue });
}));
app.use('/showcase', express.static(path.join(__dirname, 'showcase'), { setHeaders: r => r.setHeader('Cache-Control', 'no-cache') }));

// ---- The Conductor — native device engine API ----
app.get('/api/conductor/entities', wrap(async (req, res) => res.json(await conductor.listEntities())));
app.post('/api/conductor/entities', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.driver) return res.status(400).json({ error: 'name and driver required' });
  const e = await conductor.addEntity(b);
  db.audit('admin', 'entity.add', { id: e.id, name: e.name, driver: b.driver });
  res.json(e);   // token returned once — flash it into the sensor firmware
}));
app.delete('/api/conductor/entities/:id', wrap(async (req, res) => { await conductor.removeEntity(req.params.id); res.json({ ok: true }); }));
app.post('/api/conductor/entities/:id/command', wrap(async (req, res) => {
  res.json(await conductor.command(req.params.id, req.body || {}, 'api'));
}));
app.get('/api/conductor/probe', wrap(async (req, res) => res.json(await conductor.probeAll())));
app.get('/api/conductor/scenes', wrap(async (req, res) => res.json(await conductor.listScenes())));
app.post('/api/conductor/scenes', wrap(async (req, res) => res.json(await conductor.saveScene(req.body || {}))));
app.post('/api/conductor/scenes/:id/run', wrap(async (req, res) => res.json(await conductor.runScene(req.params.id, 'api'))));
app.get('/api/conductor/automations', wrap(async (req, res) => res.json(await conductor.listAutomations())));
app.post('/api/conductor/automations', wrap(async (req, res) => {
  const b = req.body || {}, t = b.trigger || {};
  if (t.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t.at || ''))) return res.status(400).json({ error: 'a time trigger needs at: "HH:MM"' });
  if (t.type === 'time') t.days = Array.isArray(t.days) ? t.days.map(Number).filter(d => d >= 0 && d <= 6) : [];
  res.json(await conductor.saveAutomation({ ...b, trigger: t }));
}));
app.delete('/api/conductor/automations/:id', wrap(async (req, res) => { await conductor.removeAutomation(req.params.id); res.json({ ok: true }); }));
app.post('/api/conductor/automations/:id/enable', wrap(async (req, res) => res.json(await conductor.setAutomationEnabled(req.params.id, (req.body || {}).enabled !== false))));
// sensor ingest — our ESP32s POST here (motion, temperature, anything)
app.post('/api/ingest/:token', wrap(async (req, res) => {
  const e = await conductor.ingest(req.params.token, req.body || {});
  if (!e) return res.status(404).json({ error: 'unknown sensor token' });
  res.json({ ok: true });
}));
// ---- The Sauce — household AI assistant (agentic: it can act on the home) ----
async function runSauceAction(a) {
  try {
    if (!a || typeof a !== 'object') return null;
    if (a.tool === 'scene' && a.name) { await conductor.runScene(String(a.name), 'sauce'); return `ran the ${a.name} scene`; }
    if (a.tool === 'light' && a.room) {
      const ents = await conductor.listEntities();
      const e = ents.find(x => (x.kind === 'light' || x.kind === 'led-strip') && x.room === a.room);
      if (!e) return null;
      await conductor.command(e.id, { on: !!a.on }, 'sauce');
      return `turned ${a.on ? 'on' : 'off'} the ${e.name}`;
    }
    if (a.tool === 'todo' && a.text) {
      const list = listName(a.list);
      await db.pool.query('INSERT INTO shared_todos(text,by_name,list) VALUES($1,$2,$3)', [String(a.text).slice(0, 300), 'The Sauce', list]);
      return `added "${String(a.text).slice(0, 60)}" to ${list === 'Family' ? 'the list' : list}`;
    }
    if (a.tool === 'device' && a.name) {
      const ents = await conductor.listEntities(), q = String(a.name).toLowerCase();
      const e = ents.find(x => x.name.toLowerCase() === q) || ents.find(x => x.name.toLowerCase().includes(q)) || ents.find(x => x.room.toLowerCase() === q);
      if (!e || !(e.kind === 'light' || e.kind === 'led-strip' || e.kind === 'switch')) return null;
      await conductor.command(e.id, { on: !!a.on }, 'sauce');
      return `turned ${a.on ? 'on' : 'off'} ${e.name}`;
    }
    if (a.tool === 'todo_done' && a.text) {
      // tick the open item that matches best (all words present, else the longest common word)
      const open = (await db.pool.query('SELECT id,text FROM shared_todos WHERE NOT done ORDER BY created_at DESC LIMIT 100')).rows;
      const words = String(a.text).toLowerCase().split(/\W+/).filter(w => w.length > 2);
      let best = open.find(t => words.length && words.every(w => t.text.toLowerCase().includes(w)))
        || open.map(t => [t, words.filter(w => t.text.toLowerCase().includes(w)).length]).filter(x => x[1] > 0).sort((x, y) => y[1] - x[1]).map(x => x[0])[0];
      if (!best) return null;
      await db.pool.query('UPDATE shared_todos SET done=true WHERE id=$1', [best.id]);
      return `ticked off "${best.text.slice(0, 60)}"`;
    }
    if (a.tool === 'event' && a.title && /^\d{4}-\d{2}-\d{2}$/.test(String(a.day || ''))) {
      const time = /^\d{2}:\d{2}$/.test(String(a.time || '')) ? String(a.time) : null;
      await db.pool.query('INSERT INTO shared_events(title,day,at_time,by_name) VALUES($1,$2,$3,$4)', [String(a.title).slice(0, 160), a.day, time, 'The Sauce']);
      return `put "${String(a.title).slice(0, 50)}" on the calendar for ${a.day}${time ? ' at ' + time : ''}`;
    }
  } catch { /* an action must never break the reply */ }
  return null;
}
app.post('/api/sauce/ask', wrap(async (req, res) => {
  const b = req.body || {};
  const message = String(b.message || '').slice(0, 2000);
  if (!message.trim()) return res.status(400).json({ error: 'empty message' });
  const t0 = Date.now();
  try {
    // give the brain the live state of the house — devices, today's calendar, the open list — so it answers from reality
    const tz = calendar.DEFAULT_TZ, today = new Date().toLocaleDateString('en-CA', { timeZone: tz }), tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: tz });
    const [rooms, scenes, events, todos, ents] = await Promise.all([
      roomsView().catch(() => []), conductor.listScenes().catch(() => []),
      calendar.events({ account_id: b.account_id ? Number(b.account_id) : null, from: today, to: tomorrow }).catch(() => []),
      db.pool.query('SELECT text, list FROM shared_todos WHERE NOT done ORDER BY list, created_at DESC LIMIT 16').then(r => r.rows).catch(() => []),
      conductor.listEntities().catch(() => [])
    ]);
    const devices = ents.filter(e => e.kind === 'light' || e.kind === 'led-strip' || e.kind === 'switch').map(e => ({ name: e.name, room: e.room, on: !!(e.state && e.state.on) }));
    const now = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    const { reply, actions } = await sauce.ask({ name: b.name, message, history: Array.isArray(b.history) ? b.history : [], house: { rooms, scenes, devices, events, todos, today, now } });
    const did = [];
    for (const a of (actions || [])) { const r = await runSauceAction(a); if (r) did.push(r); }
    db.events.add({ account_id: b.account_id || null, type: 'sauce', payload: { ms: Date.now() - t0, q: message.slice(0, 120), acted: did.length } }).catch(() => {});
    if (!did.length) res.locals.quiet = true;   // a plain answer changes nothing — don't wake the other screens
    res.json({ reply, did });
  } catch (e) {
    res.status(503).json({ error: 'The Sauce is thinking too hard — give it another go in a moment.' });
  }
}));

app.get('/api/kiosk/summary', wrap(async (req, res) => {
  const [devices, dt] = await Promise.all([db.devices.list().catch(() => []), devteam.status().catch(() => ({}))]);
  res.json({
    node: os.hostname(), version: VERSION,
    devices: { total: devices.length, online: devices.filter(d => devStatus(d) === 'online').length },
    devteam: { shipped: dt.shipped || 0, pending: dt.pending || 0, crew: (dt.crew || []).length },
    apps: catalog.list().filter(a => a.status !== 'soon').length
  });
}));

// ---- AI control settings (Admin Portal knobs) ----
app.get('/api/settings/ai', wrap(async (req, res) => res.json(await db.settings.get('ai', { activity: 5, aggressiveness: 5, buildingPaused: false }))));
app.post('/api/settings/ai', wrap(async (req, res) => {
  const cur = await db.settings.get('ai', { activity: 5, aggressiveness: 5, buildingPaused: false });
  const next = {
    activity: clamp(req.body.activity, cur.activity),
    aggressiveness: clamp(req.body.aggressiveness, cur.aggressiveness),
    buildingPaused: typeof req.body.buildingPaused === 'boolean' ? req.body.buildingPaused : cur.buildingPaused
  };
  await db.settings.set('ai', next); db.audit('admin', 'settings.ai', next);
  res.json(next);
}));

// ---- who is this admin? (Admin Portal auto-recognises its paired PC by IP) ----
app.get('/api/admin/whoami', wrap(async (req, res) => {
  const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const list = await db.admins.list();
  const me = list.find(a => a.paired && a.pc && a.pc.ip === ip);
  res.json(me ? { recognised: true, name: me.name, role: me.role } : { recognised: false, ip });
}));

// ---- Fleet / MDM ----
const devStatus = d => !d.last_seen ? 'pending' : (Date.now() - new Date(d.last_seen).getTime() < 90000 ? 'online' : 'offline');
app.get('/api/fleet', wrap(async (req, res) => {
  const list = await db.devices.list();
  res.json(list.map(d => ({ id: d.id, name: d.name, kind: d.kind, os: d.os, ip: d.ip, last_seen: d.last_seen, status: devStatus(d) })));
}));
app.get('/api/fleet/summary', wrap(async (req, res) => {
  const list = await db.devices.list();
  res.json({ total: list.length, online: list.filter(d => devStatus(d) === 'online').length,
    byKind: list.reduce((m, d) => ((m[d.kind] = (m[d.kind] || 0) + 1), m), {}) });
}));
app.post('/api/fleet/enroll', wrap(async (req, res) => {
  const name = String((req.body && req.body.name) || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'name required' });
  const d = await db.devices.create({ name, kind: String((req.body && req.body.kind) || 'pc'), os: String((req.body && req.body.os) || '') });
  db.audit('admin', 'fleet.enroll', { id: d.id, name });
  const hubUrl = `http://${lanIP()}:${PORT}`;
  res.json({ id: d.id, name: d.name, token: d.token, hubUrl, checkinUrl: `${hubUrl}/api/fleet/checkin/${d.token}` });
}));
app.post('/api/fleet/checkin/:token', wrap(async (req, res) => {
  const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const d = await db.devices.checkin(req.params.token, { os: (req.body && req.body.os), ip, meta: (req.body && req.body.meta) });
  if (!d) return res.status(404).json({ error: 'unknown token' });
  res.json({ ok: true, device: d.name });
}));
app.delete('/api/fleet/:id', wrap(async (req, res) => { await db.devices.remove(req.params.id); db.audit('admin', 'fleet.remove', { id: req.params.id }); res.json({ ok: true }); }));

// ---- admin onboarding (backed by the SQL Brain) ----
app.get('/api/admin/list', wrap(async (req, res) => res.json(await db.admins.list())));
// Invite a family member: the account is created with a one-time PIN shown to the admin once;
// they log in with it and change it on their Profile.
app.post('/api/admin/invite', wrap(async (req, res) => {
  const name = String((req.body || {}).name || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: 'A name is needed.' });
  if (await db.accounts.exists(name)) return res.status(409).json({ error: 'That name is already taken.' });
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const a = await db.accounts.create(name, pin);
  db.audit('admin', 'account.invite', { id: a.id, name });
  res.json({ id: a.id, name: a.name, pin });
}));
// the audit trail: who/what did what on the platform (home-network only)
app.get('/api/audit', wrap(async (req, res) => {
  const n = Math.max(1, Math.min(200, Number(req.query.limit) || 40));
  res.json(await db.pool.query('SELECT id,ts,actor,action,detail FROM audit ORDER BY ts DESC LIMIT $1', [n]).then(r => r.rows));
}));
// Stats → CSV: one row per active minute of the last N days for one device (the person's own export)
app.get('/api/usage/export.csv', wrap(async (req, res) => {
  if (!req.query.device_id) return res.status(400).json({ error: 'device_id required' });
  const days = Math.max(1, Math.min(365, Number(req.query.days) || 30));
  const tz = /^[A-Za-z0-9_\/+\-]{1,64}$/.test(req.query.tz || '') ? req.query.tz : 'UTC';
  let rows = [];
  try { rows = await db.pool.query(`SELECT to_char(ts AT TIME ZONE $3,'YYYY-MM-DD HH24:MI') AS at, app, category, cpu, mem, idle FROM usage_samples WHERE device_id=$1 AND ts >= now() - make_interval(days => $2::int) ORDER BY ts`, [String(req.query.device_id).slice(0, 80), days, tz]).then(r => r.rows); }
  catch { rows = await db.pool.query(`SELECT to_char(ts,'YYYY-MM-DD HH24:MI') AS at, app, category, cpu, mem, idle FROM usage_samples WHERE device_id=$1 AND ts >= now() - make_interval(days => $2::int) ORDER BY ts`, [String(req.query.device_id).slice(0, 80), days]).then(r => r.rows); }
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="lab-usage.csv"');
  res.send('minute,app,kind,cpu_pct,mem_pct,idle\n' + rows.map(r => [q(r.at), q(r.app), q(r.category), r.cpu ?? '', r.mem ?? '', r.idle ? 1 : 0].join(',')).join('\n') + '\n');
}));
app.post('/api/admin/onboard', wrap(async (req, res) => {
  const name = String((req.body && req.body.name) || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'name required' });
  const admin = await db.admins.create(name);
  db.audit(name, 'admin.onboard', { id: admin.id });
  const hubUrl = `http://${lanIP()}:${PORT}`;
  res.json({ id: admin.id, name: admin.name, token: admin.token, hubUrl, pairCmd: `curl.exe -X POST ${hubUrl}/api/admin/pair/${admin.token}` });
}));
app.get('/api/admin/status/:token', wrap(async (req, res) => {
  const a = await db.admins.byToken(req.params.token);
  if (!a) return res.status(404).json({ error: 'unknown' });
  res.json({ paired: a.paired, pc: a.pc || null });
}));
app.post('/api/admin/pair/:token', wrap(async (req, res) => {
  const pc = { ip: (req.socket.remoteAddress || '').replace(/^::ffff:/, ''), at: Date.now() };
  const r = await db.admins.pair(req.params.token, pc);
  if (!r) return res.status(404).json({ error: 'unknown token' });
  db.audit(r.name, 'admin.pair', pc);
  res.json({ ok: true, admin: r.name });
}));

// ---- USB-key provisioning + unlock (Local Web Installer + web Portal) ----
app.post('/api/admin/issue-key', wrap(async (req, res) => {
  const token = String((req.body && req.body.token) || '');
  const payload = await db.admins.issueKey(token);
  if (!payload) return res.status(404).json({ error: 'unknown admin token' });
  db.audit(payload.name, 'admin.key.issue', { id: payload.adminId });
  res.json({ ok: true, keyfile: { lab: 'admin-key', v: 1, server: os.hostname(), managerUrl: `http://${lanIP()}:${PORT}`, ...payload } });
}));
// downloadable .key file (what the admin saves to their USB key / fob)
app.get('/api/admin/keyfile/:token', wrap(async (req, res) => {
  const payload = await db.admins.issueKey(req.params.token);
  if (!payload) return res.status(404).json({ error: 'unknown admin token' });
  const file = { lab: 'admin-key', v: 1, server: os.hostname(), managerUrl: `http://${lanIP()}:${PORT}`, ...payload };
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="lab-admin-${payload.name.replace(/\W+/g, '-').toLowerCase()}.key"`);
  res.send(JSON.stringify(file, null, 2));
}));
app.post('/api/admin/verify-key', wrap(async (req, res) => {
  const b = req.body || {};
  const admin = await db.admins.verifyKey(String(b.token || ''), String(b.key || ''));
  if (!admin) return res.status(401).json({ ok: false, error: 'This key is not valid for this server.' });
  db.audit(admin.name, 'admin.key.unlock', { ip: (req.socket.remoteAddress || '').replace(/^::ffff:/, '') });
  res.json({ ok: true, admin });
}));

// ---- Hub Distribution: accounts, telemetry ingest, and serving the Hub ----
app.get('/api/accounts', wrap(async (req, res) => res.json(await db.accounts.list())));
app.post('/api/accounts', wrap(async (req, res) => {
  const name = String((req.body && req.body.name) || '').trim().slice(0, 40);
  const pin = String((req.body && req.body.pin) || '').trim();
  if (!name || !/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'A name and a 4–8 digit PIN are required.' });
  if (await db.accounts.exists(name)) return res.status(409).json({ error: 'That name is already taken.' });
  const a = await db.accounts.create(name, pin);
  db.audit(name, 'account.create', { id: a.id });
  res.json(a);
}));
// PINs are short, so guessing must be slow: 10 wrong tries per address per 15 minutes.
const pinFails = new Map();
function pinGuard(req, res) {
  const ip = req.ip || req.socket.remoteAddress || '?', now = Date.now();
  const rec = pinFails.get(ip) || { n: 0, until: 0, first: now };
  if (rec.until > now) { res.set('Retry-After', String(Math.ceil((rec.until - now) / 1000))); res.status(429).json({ error: `Too many wrong PINs — try again in ${Math.ceil((rec.until - now) / 60000)} min.` }); return null; }
  if (now - rec.first > 15 * 60000) { rec.n = 0; rec.first = now; }
  return { fail() { rec.n++; if (rec.n >= 10) { rec.until = now + 15 * 60000; db.audit('security', 'pin.lockout', { ip }); } pinFails.set(ip, rec); }, ok() { pinFails.delete(ip); } };
}
setInterval(() => { const t = Date.now(); for (const [k, v] of pinFails) if (v.until < t && t - v.first > 15 * 60000) pinFails.delete(k); }, 5 * 60000);
app.post('/api/accounts/login', wrap(async (req, res) => {
  const g = pinGuard(req, res); if (!g) return;
  const a = await db.accounts.login(String((req.body && req.body.name) || ''), String((req.body && req.body.pin) || ''));
  if (!a) { g.fail(); return res.status(401).json({ error: 'Wrong name or PIN.' }); }
  g.ok(); res.json(a);
}));
// Profile: public shape, PIN-confirmed edits, linked devices
app.get('/api/accounts/:id', wrap(async (req, res) => {
  const a = await db.accounts.get(Number(req.params.id)); if (!a) return res.status(404).json({ error: 'no such account' });
  res.json(a);
}));
app.get('/api/accounts/:id/devices', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [devices, profiles] = await Promise.all([db.accounts.devices(id), db.accounts.profiles(id)]);
  res.json({ devices, profiles });
}));
app.patch('/api/accounts/:id', wrap(async (req, res) => {
  const id = Number(req.params.id), b = req.body || {};
  const g = pinGuard(req, res); if (!g) return;
  if (!(await db.accounts.checkPin(id, String(b.pin || '')))) { g.fail(); return res.status(401).json({ error: 'Confirm with your PIN.' }); }
  g.ok();
  const avatar = b.avatar && typeof b.avatar === 'object'
    ? { emoji: String(b.avatar.emoji || '').slice(0, 8), color: /^#[0-9a-f]{6}$/i.test(b.avatar.color || '') ? b.avatar.color : '#9a86ff' } : null;
  const privacy = b.privacy && typeof b.privacy === 'object' ? { share_stats: !!b.privacy.share_stats, share_calendar: !!b.privacy.share_calendar } : null;
  let pin = null;
  if (b.new_pin != null) { if (!/^\d{4,8}$/.test(String(b.new_pin))) return res.status(400).json({ error: 'A PIN is 4–8 digits.' }); pin = String(b.new_pin); }
  const a = await db.accounts.update(id, { avatar, privacy, pin });
  db.audit('account:' + id, 'account.update', { avatar: !!avatar, privacy: !!privacy, pin: !!pin });
  res.json(a);
}));
// Family "this week": only members who switched on share_stats in the app; aggregate kinds + top app, nothing finer.
app.get('/api/family/stats', wrap(async (req, res) => {
  const [cats, tops] = await Promise.all([
    db.pool.query(`SELECT a.id, a.name, a.avatar, u.category, count(*)::int AS mins
      FROM accounts a JOIN devices d ON d.account_id=a.id JOIN usage_samples u ON u.device_id=d.id
      WHERE (a.privacy->>'share_stats')='true' AND u.ts > now() - interval '7 days' AND NOT u.idle
      GROUP BY 1,2,3,4`).then(r => r.rows),
    db.pool.query(`SELECT DISTINCT ON (a.id) a.id, u.app, count(*)::int AS mins
      FROM accounts a JOIN devices d ON d.account_id=a.id JOIN usage_samples u ON u.device_id=d.id
      WHERE (a.privacy->>'share_stats')='true' AND u.ts > now() - interval '7 days' AND NOT u.idle AND u.app IS NOT NULL
      GROUP BY a.id, u.app ORDER BY a.id, mins DESC`).then(r => r.rows)
  ]);
  const by = {};
  for (const r of cats) { const m = by[r.id] || (by[r.id] = { id: r.id, name: r.name, avatar: r.avatar, total: 0, cats: {} }); m.cats[r.category || 'Other'] = r.mins; m.total += r.mins; }
  for (const t of tops) if (by[t.id]) by[t.id].top_app = t.app;
  res.json(Object.values(by).sort((a, b) => b.total - a.total));
}));
// App prefs synced across your installs (widgets layout, look, theme). Small, whitelisted keys only.
app.get('/api/accounts/:id/prefs', wrap(async (req, res) => res.json((await db.accounts.getPrefs(Number(req.params.id))) || {})));
app.put('/api/accounts/:id/prefs', wrap(async (req, res) => {
  const b = req.body || {}, out = {};
  if (Array.isArray(b.widgets)) out.widgets = b.widgets.map(String).slice(0, 40);
  if (b.look && typeof b.look === 'object') out.look = { layout: String(b.look.layout || 'default').slice(0, 20), effects: (b.look.effects || []).map(String).slice(0, 10) };
  if ('skin' in b) out.skin = b.skin ? String(b.skin).slice(0, 40) : null;
  if ('skinvars' in b) out.skinvars = b.skinvars && typeof b.skinvars === 'object' ? Object.fromEntries(Object.entries(b.skinvars).filter(([k, v]) => /^--[a-z0-9]+$/.test(k) && typeof v === 'string' && v.length < 40).slice(0, 12)) : null;
  if (!Object.keys(out).length) return res.status(400).json({ error: 'nothing to save' });
  out.updated_at = new Date().toISOString();
  res.json((await db.accounts.setPrefs(Number(req.params.id), out)) || {});
}));
// The app links its device (and its earlier anonymous samples) to the account that signs in on it
app.post('/api/usage/link', wrap(async (req, res) => {
  const b = req.body || {}; const dev = String(b.device_id || '').slice(0, 80), acct = Number(b.account_id);
  if (!dev || !acct) return res.status(400).json({ error: 'device_id + account_id required' });
  await db.pool.query('UPDATE devices SET account_id=$2 WHERE id=$1', [dev, acct]).catch(() => {});
  const r = await db.pool.query('UPDATE usage_samples SET account_id=$2 WHERE device_id=$1 AND account_id IS NULL', [dev, acct]);
  res.json({ ok: true, linked_samples: r.rowCount });
}));
app.post('/api/events', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.type) return res.status(400).json({ error: 'type required' });
  const ev = { account_id: b.account_id, device_id: b.device_id, type: String(b.type).slice(0, 40), payload: b.payload };
  await db.events.add(ev);
  ledgers.learnFromEvent(ev).catch(() => {});   // ledgers grow autonomously from usage
  res.json({ ok: true });
}));

// ---- The Ledger system (team / client / admin / kiosk) ----
app.get('/api/ledgers', wrap(async (req, res) => {
  const out = {};
  for (const l of ['team', 'client', 'admin', 'kiosk']) {
    const rows = await ledgers.read(l, { limit: 200 });
    out[l] = { count: rows.length, entries: rows };
  }
  res.json(out);
}));
app.get('/api/ledgers/graph', wrap(async (req, res) => res.json(await ledgers.graph())));
app.get('/api/ledgers/:ledger', wrap(async (req, res) => {
  const l = req.params.ledger;
  if (!['team', 'client', 'admin', 'kiosk'].includes(l)) return res.status(404).json({ error: 'no such ledger' });
  res.json({ ledger: l, digest: await ledgers.digest(l), entries: await ledgers.read(l, { scope: req.query.scope, kind: req.query.kind, limit: 200 }) });
}));
app.post('/api/ledgers/:ledger/evolve', wrap(async (req, res) => res.json(await ledgers.evolve(req.params.ledger))));
app.post('/api/master/synthesis', wrap(async (req, res) => res.json(await ledgers.masterSynthesis('manual'))));
app.get('/api/master/latest', wrap(async (req, res) => {
  const r = await db.pool.query('SELECT period,summary,graph,created_at FROM master_synthesis ORDER BY created_at DESC LIMIT 1');
  res.json(r.rows[0] || { summary: null });
}));

// ---- In-app feedback (smart categories) ----
app.post('/api/feedback', wrap(async (req, res) => {
  const b = req.body || {};
  const category = String(b.category || 'idea').slice(0, 20);
  const sentiment = ['love'].includes(category) ? 'positive' : ['bug', 'toomuch', 'meh'].includes(category) ? 'negative' : 'neutral';
  await db.pool.query('INSERT INTO feedback(account_id,category,sentiment,text,context) VALUES($1,$2,$3,$4,$5)',
    [b.account_id || null, category, sentiment, String(b.text || '').slice(0, 1000), b.context ? JSON.stringify(b.context) : null]);
  // feed the ledgers
  const acct = b.account_id != null ? String(b.account_id) : 'anon';
  ledgers.write('client', { scope: acct, kind: sentiment === 'negative' ? 'dislike' : sentiment === 'positive' ? 'like' : 'note', key: 'fb:' + category, value: { statement: `feedback: ${category}${b.text ? ' — ' + String(b.text).slice(0, 120) : ''}` }, weight: 2, source: 'feedback' }).catch(() => {});
  ledgers.signal('team', 'global', 'feedback:' + category).catch(() => {});
  // the brake is REAL: "too much" actually turns the AI's activity down
  if (category === 'toomuch') {
    try {
      const ai = await db.settings.get('ai', { activity: 5, aggressiveness: 5, buildingPaused: false });
      ai.activity = Math.max(1, (ai.activity || 5) - 1);
      await db.settings.set('ai', ai);
      db.audit('feedback', 'ai.brake', { activity: ai.activity });
    } catch { /* brake is best-effort */ }
  }
  res.json({ ok: true });
}));
app.get('/api/feedback', wrap(async (req, res) => {
  const r = await db.pool.query('SELECT id,account_id,category,sentiment,text,seen,created_at FROM feedback ORDER BY created_at DESC LIMIT 100');
  res.json(r.rows);
}));

// ---- Precursive Generations (AI-made skins / widgets) ----
app.get('/api/generations', wrap(async (req, res) => res.json(await builders.list({ kind: req.query.kind, status: req.query.status }))));
app.post('/api/generations/skin', wrap(async (req, res) => res.json(await builders.generateSkin({ brief: (req.body && req.body.brief) || '' }))));
app.post('/api/generations/widget', wrap(async (req, res) => res.json(await builders.generateWidget({ brief: (req.body && req.body.brief) || '' }))));
app.post('/api/generations/page', wrap(async (req, res) => res.json(await builders.generatePage({ brief: (req.body && req.body.brief) || '' }))));
app.post('/api/generations/:id/:decision', wrap(async (req, res) => {
  const d = req.params.decision;
  if (!['publish', 'reject', 'stage'].includes(d)) return res.status(400).json({ error: 'bad decision' });
  const r = await builders.setStatus(req.params.id, d === 'publish' ? 'published' : d === 'reject' ? 'rejected' : 'staged');
  if (!r) return res.status(404).json({ error: 'not found' });
  db.audit('admin', 'generation.' + d, { id: req.params.id });
  res.json(r);
}));
// what the Hub reads: published skins + widgets
app.get('/api/hub/generations', wrap(async (req, res) => {
  const [skins, widgets, pages] = await Promise.all([
    builders.list({ kind: 'skin', status: 'published' }),
    builders.list({ kind: 'widget', status: 'published' }),
    builders.list({ kind: 'page', status: 'published' })
  ]);
  res.json({ skins, widgets, pages });
}));

// ---- Research agents ----
app.get('/api/research', wrap(async (req, res) => res.json(await research.list())));
app.post('/api/research/run', wrap(async (req, res) => res.json(await research.run((req.body && req.body.topic) || null))));
// the user-facing Home L.A.B Hub, distributed from this server
app.use('/hub', express.static(path.join(__dirname, 'hub'), { setHeaders: r => r.setHeader('Cache-Control', 'no-cache') }));
app.get('/hub/*', (req, res) => res.sendFile(path.join(__dirname, 'hub', 'index.html')));

// Local Web Installer — how an admin provisions their key + installs the Portal
app.use('/install', express.static(path.join(__dirname, 'install'), { setHeaders: r => r.setHeader('Cache-Control', 'no-cache') }));
app.get('/install/*', (req, res) => res.sendFile(path.join(__dirname, 'install', 'index.html')));

// the Admin Portal as an installable web app (USB-key gated), cross-platform
app.use('/admin', express.static(path.join(__dirname, 'admin-web'), { setHeaders: r => r.setHeader('Cache-Control', 'no-cache') }));
app.get('/admin/*', (req, res) => res.sendFile(path.join(__dirname, 'admin-web', 'index.html')));

// the Kiosk — a glanceable wall display (iPad/tablet), served from the server
app.use('/kiosk', express.static(path.join(__dirname, 'kiosk'), { setHeaders: r => r.setHeader('Cache-Control', 'no-cache') }));
app.get('/kiosk/*', (req, res) => res.sendFile(path.join(__dirname, 'kiosk', 'index.html')));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const START = Date.now();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', ws => { if (lastStats) ws.send(JSON.stringify({ type: 'stats', data: lastStats })); });
function broadcast(msg) { const p = JSON.stringify(msg); for (const c of wss.clients) if (c.readyState === 1) c.send(p); }

setInterval(async () => { try { broadcast({ type: 'stats', data: await collectStats() }); } catch { /* keep looping */ } }, 2000);
collectStats();

// connect the SQL Brain (retry — the Postgres container may still be booting)
(async function initDB() {
  for (let i = 0; i < 40; i++) {
    try {
      await db.init();
      console.log('SQL Brain connected + schema ready.');
      await ledgers.seed().catch(e => console.error('ledger seed:', e.message));
      await conductor.seed().catch(e => console.error('conductor seed:', e.message));
      devteam.startScheduler();
      startLedgerSchedulers();
      calendar.start();
      conductor.startClock();
      return;
    }
    catch (e) { if (i === 0) console.log('waiting for SQL Brain…', e.code || e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
  console.error('SQL Brain unreachable after retries — dashboard still serving.');
})();

// The ledgers evolve themselves on a gentle cadence; master synthesis is rare.
let ledgerTimers = false;
function startLedgerSchedulers() {
  if (ledgerTimers) return; ledgerTimers = true;
  const order = ['client', 'team', 'admin', 'kiosk']; let i = 0;
  // one ledger evolves every ~90 min, rotating — cheap and always fresh
  setInterval(async () => {
    try {
      const ai = await db.settings.get('ai', { buildingPaused: false });
      if (ai.buildingPaused) return;
      const l = order[i++ % order.length];
      await ledgers.evolve(l).catch(() => {});
    } catch { /* keep looping */ }
  }, 90 * 60000);
  // a research agent fires every ~4 h (silent), seeding plans the team builds from
  setInterval(async () => {
    try {
      const ai = await db.settings.get('ai', { buildingPaused: false });
      if (!ai.buildingPaused) await research.run().catch(() => {});
    } catch { /* keep looping */ }
  }, 4 * 3600000);
  // master synthesis roughly monthly (checks daily whether ~30d have passed)
  setInterval(async () => {
    try {
      const last = await db.pool.query('SELECT created_at FROM master_synthesis ORDER BY created_at DESC LIMIT 1').then(r => r.rows[0]);
      const due = !last || (Date.now() - new Date(last.created_at).getTime()) > 30 * 864e5;
      if (due) await ledgers.masterSynthesis('monthly').catch(() => {});
    } catch { /* keep looping */ }
  }, 24 * 3600000);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║      L . A . B   H U B   M A N A G E R     ║');
  console.log(`  ║      first build ${VERSION}                 ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log(`  Manager: http://${lanIP()}:${PORT}   (node: ${os.hostname()})`);
  console.log('');
});
