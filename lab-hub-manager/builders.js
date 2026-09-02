// ============================================================
//  L.A.B — Builders / Precursive Generations
//  The AI team doesn't just file changelog rows any more — it produces REAL
//  artifacts, grounded in the ledgers, and stages/publishes them:
//    • skins   — full Hub colour themes (safe: CSS variables only)
//    • widgets — structured dashboard cards rendered by trusted templates
//  Each is validated ("tested") before it can auto-publish. Bigger, riskier
//  kinds (apps / overhauls) are proposed to the admin rather than auto-shipped.
// ============================================================
const crypto = require('crypto');
const { spawn } = require('child_process');
const db = require('./db');
const ledgers = require('./ledgers');

const CLAUDE = process.env.LAB_CLAUDE || '/home/tao/.local/bin/claude';
const uid = () => crypto.randomBytes(6).toString('hex');

function askClaude(prompt, timeout = 150000) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(CLAUDE, ['-p', prompt, '--output-format', 'text'], { cwd: '/srv/lab/manager' }); }
    catch (e) { return reject(e); }
    let out = '', err = '';
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} reject(new Error('timeout')); }, timeout);
    child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d);
    child.on('error', e => { clearTimeout(t); reject(e); });
    child.on('close', () => { clearTimeout(t); out.trim() ? resolve(out.trim()) : reject(new Error(err.trim() || 'no output')); });
  });
}
function parseJSON(text) {
  const c = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const s = c.indexOf('{'), e = c.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('no json object');
  return JSON.parse(c.slice(s, e + 1));
}

const isColor = v => typeof v === 'string' && /^#([0-9a-f]{3,8})$/i.test(v.trim()) || /^rgba?\(/i.test(String(v).trim());

// ---- SKINS -----------------------------------------------------------------
function validateSkin(vars) {
  const need = ['--bg', '--txt', '--a1', '--a2'];
  if (!vars || need.some(k => !isColor(vars[k]))) return false;
  // legibility heuristic: background should be darker than text
  const lum = hex => { const m = String(hex).replace('#', ''); if (m.length < 6) return 128; const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16); return .299 * r + .587 * g + .114 * b; };
  if (/^#/.test(vars['--bg']) && /^#/.test(vars['--txt']) && lum(vars['--txt']) <= lum(vars['--bg'])) return false;
  return true;
}
async function generateSkin({ brief = '', agent = 'Pixel' } = {}) {
  const teamD = await ledgers.digest('team').catch(() => '');
  const existing = await db.pool.query("SELECT title FROM generations WHERE kind='skin' ORDER BY created_at DESC LIMIT 12").then(r => r.rows.map(x => x.title)).catch(() => []);
  const prompt =
`You are ${agent}, the interface designer on the L.A.B build team. Design a NEW Hub skin — a colour theme for the warm, dark, glassy personal dashboard. It must be genuinely tasteful, harmonious, and distinct (never generic, never the default purple/blue).

Ground it in the team's ideology:
${teamD.slice(0, 700)}
${brief ? 'Brief: ' + brief : ''}
Avoid repeating these existing skins: ${existing.join(', ') || '(none yet)'}

Rules: dark background, clearly legible light text, two accent colours that harmonise. Return ONLY JSON:
{"name":"kebab-slug","title":"Evocative Name","summary":"one line on the mood","vars":{"--bg":"#hex","--panel":"rgba(255,255,255,.05)","--panel2":"rgba(255,255,255,.08)","--stroke":"rgba(255,255,255,.10)","--txt":"#hex","--txt2":"#hex","--a1":"#hex","--a2":"#hex"}}`;
  const g = parseJSON(await askClaude(prompt));
  const vars = g.vars || {};
  const tested = validateSkin(vars);
  const id = uid();
  await db.pool.query(
    `INSERT INTO generations(id,kind,name,title,summary,payload,status,tested,agent)
     VALUES($1,'skin',$2,$3,$4,$5,$6,$7,$8)`,
    [id, String(g.name || 'skin-' + id).slice(0, 40), String(g.title || 'New Skin').slice(0, 60),
     String(g.summary || '').slice(0, 160), JSON.stringify({ vars }), tested ? 'published' : 'staged', tested, agent]);
  return { id, kind: 'skin', name: g.name, title: g.title, tested, status: tested ? 'published' : 'staged' };
}

// ---- WIDGETS (structured, rendered by trusted Hub templates) ---------------
const WIDGET_TEMPLATES = ['tips', 'checklist', 'focus'];
function validateWidget(w) {
  return w && WIDGET_TEMPLATES.includes(w.template) && w.title && Array.isArray(w.items) && w.items.length >= 1 && w.items.length <= 8;
}
async function generateWidget({ brief = '', agent = 'Nova' } = {}) {
  const clientTop = await ledgers.read('client', { kind: 'signal', limit: 8 }).then(r => r.map(x => x.key).join(', ')).catch(() => '');
  const prompt =
`You are ${agent} on the L.A.B build team. Design a small, genuinely useful dashboard WIDGET for the family Hub. Pick ONE template that fits:
- "tips": a rotating list of short helpful tips.
- "checklist": a short actionable checklist.
- "focus": one headline focus + up to 3 supporting lines.

What the family actually uses lately: ${clientTop || '(not much yet)'}
${brief ? 'Brief: ' + brief : ''}

Return ONLY JSON: {"template":"tips|checklist|focus","name":"kebab-slug","title":"Card Title","summary":"one line","accent":"#hex","items":["short line","short line", "..."]}. Keep items short and real, 3-6 of them.`;
  const w = parseJSON(await askClaude(prompt));
  const tested = validateWidget(w);
  const id = uid();
  await db.pool.query(
    `INSERT INTO generations(id,kind,name,title,summary,payload,status,tested,agent)
     VALUES($1,'widget',$2,$3,$4,$5,$6,$7,$8)`,
    [id, String(w.name || 'widget-' + id).slice(0, 40), String(w.title || 'New Widget').slice(0, 60),
     String(w.summary || '').slice(0, 160), JSON.stringify({ template: w.template, accent: w.accent, items: (w.items || []).map(s => String(s).slice(0, 120)) }),
     tested ? 'published' : 'staged', tested, agent]);
  return { id, kind: 'widget', name: w.name, title: w.title, tested, status: tested ? 'published' : 'staged' };
}

// ---- store helpers ---------------------------------------------------------
const list = ({ kind, status } = {}) => {
  const cond = [], args = [];
  if (kind) { args.push(kind); cond.push('kind=$' + args.length); }
  if (status) { args.push(status); cond.push('status=$' + args.length); }
  return db.pool.query(
    `SELECT id,kind,name,title,summary,payload,status,tested,agent,created_at FROM generations
     ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 100`, args).then(r => r.rows);
};
const setStatus = (id, status) => db.pool.query('UPDATE generations SET status=$2 WHERE id=$1 RETURNING id,kind,title,status', [id, status]).then(r => r.rows[0]);

module.exports = { generateSkin, generateWidget, list, setStatus };
