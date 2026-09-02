// ============================================================
//  L.A.B — Install Wizard brain
//  The desktop installer analyses the user's PC (file types, apps, usage) and
//  POSTs a report here. An agent turns that into a PERSONALIZATION PROFILE:
//    - the device archetype (work / creative / gaming / multitask / everything)
//    - which modules to enable + the personalized tab + a fitting theme
//    - a short human "usage report" the person actually sees
//  The native app pulls this profile on first run — no per-user recompile.
// ============================================================
const crypto = require('crypto');
const { spawn } = require('child_process');
const db = require('./db');
const ledgers = require('./ledgers');

const CLAUDE = process.env.LAB_CLAUDE || '/home/tao/.local/bin/claude';
const uid = () => crypto.randomBytes(6).toString('hex');

function askClaude(prompt, timeout = 150000) {
  return new Promise((resolve, reject) => {
    let child; try { child = spawn(CLAUDE, ['-p', prompt, '--output-format', 'text'], { cwd: '/srv/lab/manager' }); } catch (e) { return reject(e); }
    let out = '', err = ''; const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} reject(new Error('timeout')); }, timeout);
    child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d);
    child.on('error', e => { clearTimeout(t); reject(e); });
    child.on('close', () => { clearTimeout(t); out.trim() ? resolve(out.trim()) : reject(new Error(err.trim() || 'no output')); });
  });
}
function parseJSON(text) { const c = text.replace(/```json/gi, '').replace(/```/g, '').trim(); const s = c.indexOf('{'), e = c.lastIndexOf('}'); if (s === -1) throw new Error('no json'); return JSON.parse(c.slice(s, e + 1)); }

const MODULES = ['dashboard', 'profile', 'calendar', 'sauce', 'appstore', 'personalized', 'device', 'stats', 'settings'];

// Cheap fallback so the wizard never blocks even if the brain is busy.
function heuristic(report) {
  const a = report.apps || [], ext = report.fileTypes || {};
  const has = re => a.some(x => re.test(String(x).toLowerCase()));
  let archetype = 'everything';
  if (has(/steam|epic|riot|xbox|game/)) archetype = 'gaming';
  else if (has(/photoshop|blender|premiere|davinci|figma|ableton|affinity/)) archetype = 'creative';
  else if (has(/excel|word|outlook|teams|slack|sap|quickbooks/)) archetype = 'work';
  else archetype = 'multitask';
  return { archetype, statsKind: archetype === 'gaming' ? 'Game stats' : archetype === 'creative' ? 'Creativity stats' : 'Work stats',
    theme: null, personalizedTab: archetype === 'gaming' ? 'Play' : archetype === 'creative' ? 'Studio' : 'Focus',
    modules: MODULES, report: `Detected a ${archetype} machine. Tuning your Hub around that.` };
}

async function personalize(report) {
  try {
    const skins = await db.pool.query("SELECT title,payload FROM generations WHERE kind='skin' AND status='published' ORDER BY created_at DESC LIMIT 8").then(r => r.rows).catch(() => []);
    const prompt =
`You are the L.A.B onboarding agent. A new device just ran the install wizard's PC analysis. Turn it into a personalization profile for that person's Hub app.

Device report (JSON):
${JSON.stringify(report).slice(0, 3000)}

Available themes (pick one title or null): ${skins.map(s => s.title).join(', ') || '(none)'}
Available modules: ${JSON.stringify(MODULES)}

Decide the archetype (work | creative | gaming | multitask | everything), which stats tab fits (Game stats / Work stats / Creativity stats), a good name for their personalized tab, a fitting theme, and write a short, warm 2-sentence usage report they'll actually read.

Return ONLY JSON: {"archetype":"...","statsKind":"...","personalizedTab":"...","theme":"title-or-null","modules":[...],"report":"2 sentences"}`;
    const out = parseJSON(await askClaude(prompt));
    out.modules = Array.isArray(out.modules) && out.modules.length ? out.modules.filter(m => MODULES.includes(m)) : MODULES;
    return out;
  } catch (e) { return heuristic(report); }
}

// Store the profile + feed the client ledger so the build team learns the fleet.
async function register({ account_id, report }) {
  const id = uid();
  const personalization = await personalize(report || {});
  await db.pool.query(
    `INSERT INTO device_profiles(id,account_id,os,hostname,archetype,report,personalization)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [id, account_id || null, report.os || null, report.hostname || null, personalization.archetype,
     JSON.stringify(report || {}), JSON.stringify(personalization)]);
  ledgers.write('client', { scope: String(account_id || 'anon'), kind: 'profile', key: 'device:' + (report.hostname || id),
    value: { statement: `${personalization.archetype} device (${report.os || '?'})`, archetype: personalization.archetype }, weight: 3, source: 'agent' }).catch(() => {});
  db.audit('wizard', 'device.profiled', { id, archetype: personalization.archetype, os: report.os }).catch(() => {});
  return { id, personalization };
}
const get = (id) => db.pool.query('SELECT id,account_id,os,hostname,archetype,personalization,created_at FROM device_profiles WHERE id=$1', [id]).then(r => r.rows[0] || null);
const list = () => db.pool.query('SELECT id,account_id,os,hostname,archetype,created_at FROM device_profiles ORDER BY created_at DESC LIMIT 100').then(r => r.rows);

module.exports = { register, get, list, MODULES };
