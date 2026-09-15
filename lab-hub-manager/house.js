// ============================================================
//  The House Registry — the household's single source of truth.
//  What the house owns, what it pays, who to call, who we're with.
//  Admin-gated and LAN-only (see SENSITIVE in server.js). Never in git.
//
//  Two ideas run through this file:
//   1. DISCOVER, THEN CONFIRM — the LAN scan fills the asset register in,
//      the human names and corrects it. Nobody types what a machine can find.
//   2. PROVENANCE — every row records whether a person stated it or a machine
//      observed it, so the Hub can later notice when two sources disagree.
// ============================================================
const crypto = require('crypto');
const { execFile } = require('child_process');
const net = require('net');
const db = require('./db');

const uid = () => crypto.randomBytes(8).toString('hex');
const pool = db.pool;

// ---- the registry: one generic CRUD over a whitelist of columns ------------
// Adding a domain later means adding an entry here, nothing else.
const TABLES = {
  providers: { t: 'house_providers', req: ['name'],
    cols: ['name', 'kind', 'account_ref', 'phone', 'email', 'url', 'notes', 'added_by', 'source'] },
  bills: { t: 'house_bills', req: ['label'],
    cols: ['label', 'provider_id', 'category', 'amount', 'currency', 'cadence', 'due_day', 'whole_house', 'account_id', 'active', 'started_on', 'ends_on', 'notes', 'added_by', 'source'] },
  debts: { t: 'house_debts', req: ['label'],
    cols: ['label', 'provider_id', 'kind', 'balance', 'original', 'rate_pct', 'min_payment', 'currency', 'due_day', 'ends_on', 'account_id', 'notes', 'added_by'] },
  assets: { t: 'house_assets', req: ['name'],
    cols: ['name', 'kind', 'make', 'model', 'serial', 'mac', 'ip', 'hostname', 'room', 'owner_account_id', 'purchased_on', 'price', 'warranty_until', 'status', 'confirmed', 'notes', 'added_by', 'source', 'last_seen'] },
  contacts: { t: 'house_contacts', req: ['name'],
    cols: ['name', 'role', 'phone', 'email', 'provider_id', 'last_used_on', 'notes', 'added_by'] },
  facts: { t: 'house_facts', req: ['label'],
    cols: ['category', 'label', 'value', 'confidence', 'added_by', 'source'] }
};
const ORDER = { providers: 'name', bills: 'category, label', debts: 'balance DESC', assets: 'kind, name', contacts: 'role NULLS LAST, name', facts: 'category, label' };

const pick = (domain, body) => {
  const spec = TABLES[domain]; if (!spec) throw new Error('unknown domain');
  const out = {};
  for (const c of spec.cols) if (body[c] !== undefined) out[c] = body[c] === '' ? null : body[c];
  return out;
};

async function list(domain, { limit = 500 } = {}) {
  const spec = TABLES[domain]; if (!spec) throw new Error('unknown domain');
  const r = await pool.query(`SELECT * FROM ${spec.t} ORDER BY ${ORDER[domain]} LIMIT $1`, [Math.min(2000, limit)]);
  return r.rows;
}

async function create(domain, body = {}) {
  const spec = TABLES[domain]; if (!spec) throw new Error('unknown domain');
  const data = pick(domain, body);
  for (const r of spec.req) if (!data[r]) throw new Error(r + ' is required');
  const id = uid(), keys = Object.keys(data);
  const cols = ['id', ...keys], vals = [id, ...keys.map(k => data[k])];
  const r = await pool.query(
    `INSERT INTO ${spec.t} (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, vals);
  db.audit(body.added_by || 'admin', 'house.' + domain + '.add', { id, label: data.name || data.label }).catch(() => {});
  return r.rows[0];
}

async function update(domain, id, body = {}) {
  const spec = TABLES[domain]; if (!spec) throw new Error('unknown domain');
  const data = pick(domain, body), keys = Object.keys(data);
  if (!keys.length) throw new Error('nothing to update');
  const sets = keys.map((k, i) => `${k}=$${i + 2}`).concat('updated_at=now()');
  const r = await pool.query(`UPDATE ${spec.t} SET ${sets.join(',')} WHERE id=$1 RETURNING *`, [id, ...keys.map(k => data[k])]);
  return r.rows[0] || null;
}

async function remove(domain, id) {
  const spec = TABLES[domain]; if (!spec) throw new Error('unknown domain');
  await pool.query(`DELETE FROM ${spec.t} WHERE id=$1`, [id]);
  db.audit('admin', 'house.' + domain + '.remove', { id }).catch(() => {});
  return { ok: true };
}

// ---- what the house actually costs ----------------------------------------
// Everything normalised to a monthly figure so the totals mean something.
const PER_MONTH = { monthly: 1, weekly: 52 / 12, fortnightly: 26 / 12, quarterly: 1 / 3, annual: 1 / 12, yearly: 1 / 12, once: 0 };
const monthly = b => (Number(b.amount) || 0) * (PER_MONTH[b.cadence] ?? 1);

async function summary() {
  const [bills, debts, assets, contacts, providers, facts] = await Promise.all([
    list('bills'), list('debts'), list('assets'), list('contacts'), list('providers'), list('facts')
  ]);
  const live = bills.filter(b => b.active);
  const byCategory = {};
  for (const b of live) byCategory[b.category] = (byCategory[b.category] || 0) + monthly(b);
  const perMonth = live.reduce((a, b) => a + monthly(b), 0);
  const debtTotal = debts.reduce((a, d) => a + (Number(d.balance) || 0), 0);
  const debtMonthly = debts.reduce((a, d) => a + (Number(d.min_payment) || 0), 0);

  // things worth a nudge rather than a dashboard
  const today = new Date(), soon = new Date(Date.now() + 60 * 86400000);
  const flags = [];
  for (const a of assets) if (a.warranty_until && new Date(a.warranty_until) > today && new Date(a.warranty_until) < soon)
    flags.push({ kind: 'warranty', label: `${a.name} warranty ends ${a.warranty_until}`, id: a.id });
  for (const b of live) if (b.ends_on && new Date(b.ends_on) > today && new Date(b.ends_on) < soon)
    flags.push({ kind: 'contract', label: `${b.label} ends ${b.ends_on}`, id: b.id });
  // two services doing the same job is the classic household leak
  const subs = live.filter(b => b.category === 'subscription');
  const dupes = {};
  for (const s of subs) { const k = (s.label || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 6); if (k) (dupes[k] = dupes[k] || []).push(s.label); }

  return {
    counts: { assets: assets.length, unconfirmed: assets.filter(a => !a.confirmed).length, bills: live.length, subscriptions: subs.length, debts: debts.length, contacts: contacts.length, providers: providers.length, facts: facts.length },
    money: {
      currency: (live[0] && live[0].currency) || 'ZAR',
      per_month: +perMonth.toFixed(2), per_year: +(perMonth * 12).toFixed(2),
      by_category: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, +v.toFixed(2)])),
      subscriptions_per_month: +subs.reduce((a, b) => a + monthly(b), 0).toFixed(2),
      debt_total: +debtTotal.toFixed(2), debt_min_per_month: +debtMonthly.toFixed(2)
    },
    flags
  };
}

// ---- discovery: the LAN fills its own inventory in -------------------------
// Vendor from the MAC's OUI. A locally-administered bit (2/6/A/E in the second
// nibble) means a randomised address — almost always a phone hiding itself.
const OUI = {
  'c4:e9:84': 'TP-Link', '50:c7:bf': 'TP-Link', 'a4:2b:b0': 'TP-Link',
  '78:8a:20': 'Ubiquiti', '44:d9:e7': 'Ubiquiti', '24:5a:4c': 'Ubiquiti', 'f4:92:bf': 'Ubiquiti',
  '04:95:e6': 'Tenda', '7c:2f:80': 'Gigaset',
  'bc:e9:2f': 'HP', '3c:d9:2b': 'HP', '70:5a:0f': 'HP',
  '98:f4:ab': 'Espressif', '24:6f:28': 'Espressif', '30:ae:a4': 'Espressif', '7c:9e:bd': 'Espressif', 'a0:b7:65': 'Espressif', 'c8:2b:96': 'Espressif',
  'b8:27:eb': 'Raspberry Pi', 'dc:a6:32': 'Raspberry Pi', 'e4:5f:01': 'Raspberry Pi',
  '00:15:5d': 'Microsoft (Hyper-V)', '00:50:56': 'VMware',
  'a4:83:e7': 'Apple', '88:66:a5': 'Apple', 'ac:bc:32': 'Apple', 'f0:18:98': 'Apple', '3c:07:54': 'Apple', 'd0:81:7a': 'Apple', '70:70:0d': 'Apple',
  '00:17:88': 'Philips Hue', 'd0:73:d5': 'LIFX', '54:2a:1b': 'Sonos', 'b8:e9:37': 'Sonos',
  'fc:a6:67': 'Amazon', '44:65:0d': 'Amazon', 'f4:f5:d8': 'Google', '30:fd:38': 'Google'
};
const vendorOf = mac => {
  if (!mac) return null;
  const m = mac.toLowerCase();
  if (/^[0-9a-f][26ae]:/.test(m)) return 'private address';
  return OUI[m.slice(0, 8)] || null;
};
const kindOf = (vendor, ports) => {
  const has = p => ports.includes(p);
  if (has(554)) return 'camera';            // RTSP — a camera or the recorder
  if (has(9100) || has(631)) return 'printer';
  if (vendor === 'Ubiquiti') return 'ap';
  if (vendor === 'TP-Link' || vendor === 'Tenda') return 'router';
  if (vendor === 'Espressif') return 'sensor';
  if (vendor === 'Gigaset') return 'voip';
  if (has(62078)) return 'phone';
  if (has(3389) || has(445) || has(139)) return 'pc';
  if (vendor === 'Apple' || vendor === 'private address') return 'phone';
  if (has(22)) return 'server';
  return 'other';
};

const sh = (cmd, args) => new Promise(res => execFile(cmd, args, { timeout: 12000 }, (e, out) => res(out || '')));
const probe = (host, port, ms = 500) => new Promise(res => {
  const s = net.connect({ host, port });
  let done = false;
  const end = v => { if (!done) { done = true; try { s.destroy(); } catch {} res(v); } };
  s.setTimeout(ms); s.on('connect', () => end(true)); s.on('timeout', () => end(false)); s.on('error', () => end(false));
});

const SCAN_PORTS = [22, 80, 139, 443, 445, 554, 631, 3389, 9100, 62078];

/// Walk the ARP table, fingerprint each host, and upsert it into the register.
/// Existing rows keep whatever a human typed; only the observed fields refresh.
async function discover({ added_by = 'admin' } = {}) {
  // The ARP table only remembers who spoke recently, so knock on every door
  // first. Without this the scan finds whatever happened to be chatty.
  const addr = await sh('ip', ['-4', 'addr', 'show']);
  // the first private IPv4 the server holds that is not a docker bridge
  const mine = (addr.split('\n').map(l => l.trim())
    .filter(l => l.startsWith('inet ') && !/docker|br-/.test(l))
    .map(l => l.split(/\s+/)[1].split('/')[0])
    .find(ip => ip.startsWith('192.168.') || ip.startsWith('10.')) || '')
    .split('.').slice(0, 3).join('.') || null;
  if (mine) {
    const ips = Array.from({ length: 254 }, (_, i) => mine + '.' + (i + 1));
    for (let i = 0; i < ips.length; i += 64) {
      await Promise.all(ips.slice(i, i + 64).map(ip => sh('ping', ['-c', '1', '-W', '1', ip])));
    }
  }
  const arp = await sh('ip', ['neigh']);
  const hosts = [];
  for (const line of arp.split('\n')) {
    const m = /^(\d+\.\d+\.\d+\.\d+)\s.*?lladdr\s+([0-9a-f:]{17})/i.exec(line.trim());
    if (m && !/FAILED|INCOMPLETE/i.test(line) && (!mine || m[1].startsWith(mine + '.'))) hosts.push({ ip: m[1], mac: m[2].toLowerCase() });
  }
  const seen = new Map();
  for (const h of hosts) if (!seen.has(h.mac)) seen.set(h.mac, h);

  const found = [];
  for (const h of seen.values()) {
    const ports = (await Promise.all(SCAN_PORTS.map(p => probe(h.ip, p).then(ok => (ok ? p : null))))).filter(Boolean);
    const vendor = vendorOf(h.mac);
    found.push({ ...h, ports, vendor, kind: kindOf(vendor, ports) });
  }

  const out = [];
  for (const f of found) {
    const existing = await pool.query('SELECT id, confirmed, name FROM house_assets WHERE lower(mac)=$1', [f.mac]).then(r => r.rows[0]);
    if (existing) {
      await pool.query('UPDATE house_assets SET ip=$2, last_seen=now(), updated_at=now() WHERE id=$1', [existing.id, f.ip]);
      out.push({ ...f, id: existing.id, name: existing.name, status: 'known' });
    } else {
      const name = `${f.vendor || 'Unknown device'} (${f.ip})`;
      const row = await create('assets', {
        name, kind: f.kind, make: f.vendor && f.vendor !== 'private address' ? f.vendor : null,
        mac: f.mac, ip: f.ip, status: 'active', confirmed: false, added_by,
        source: 'network-scan', last_seen: new Date().toISOString(),
        notes: ports_note(f)
      });
      out.push({ ...f, id: row.id, name, status: 'new' });
    }
  }
  db.audit(added_by, 'house.discover', { seen: found.length, added: out.filter(o => o.status === 'new').length }).catch(() => {});
  return { scanned: found.length, added: out.filter(o => o.status === 'new').length, devices: out };
}
const ports_note = f => `Found by the network scan${f.ports.length ? ' · open ports ' + f.ports.join(', ') : ''}${f.vendor === 'private address' ? ' · randomised MAC, so this is probably a phone' : ''}`;

module.exports = { TABLES: Object.keys(TABLES), list, create, update, remove, summary, discover };
