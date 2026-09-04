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

// ---- PAGES (whole tabs, structured sections rendered by trusted templates) --
// A page is riskier than a widget (it's a sidebar tab), so it is never forced
// on anyone: valid pages publish to the App Store as "made by your builders"
// and each person adds it to their own sidebar.
const PAGE_BLOCKS = ['text', 'list', 'links', 'metric', 'checklist', 'steps'];
const PAGE_ICONS = ['star', 'bolt', 'cal', 'stats', 'home', 'user', 'store', 'device', 'cog', 'sauce'];
function validatePage(p) {
  if (!p || !p.title || !Array.isArray(p.sections) || p.sections.length < 1 || p.sections.length > 6) return false;
  for (const s of p.sections) {
    if (!s || !PAGE_BLOCKS.includes(s.block) || !Array.isArray(s.items) || s.items.length < 1 || s.items.length > 10) return false;
    if (s.block === 'links' && !s.items.every(it => it && typeof it.url === 'string' && /^https?:\/\//i.test(it.url) && it.label)) return false;
    if (s.block === 'metric' && !s.items.every(it => it && it.label != null && it.value != null)) return false;
    if (['text', 'list', 'checklist', 'steps'].includes(s.block) && !s.items.every(it => typeof it === 'string')) return false;
  }
  return true;
}
// Models love to invent "hub.lan", "192.168.1.10:8096"… Anything that looks like a
// network fact and wasn't in the brief is dropped — a page must never state
// things about this family's setup that nobody told it.
const NET_FACT = /\b(\d{1,3}\.){3}\d{1,3}\b|\b[a-z0-9-]+\.(lan|local|home|internal)\b|\blocalhost\b|:\d{4,5}\b/i;
const asText = it => typeof it === 'string' || typeof it === 'number' ? String(it)
  : it && typeof it === 'object' ? String(it.text || it.label || it.title || it.step || it.item || it.name || '') : '';
function sanitizeSections(sections, brief = '') {
  const out = [], invented = t => NET_FACT.test(t) && !(brief && brief.includes((t.match(NET_FACT) || [''])[0]));
  for (const s of Array.isArray(sections) ? sections.slice(0, 6) : []) {
    if (!s || !PAGE_BLOCKS.includes(s.block) || !Array.isArray(s.items)) continue;
    let items;
    if (s.block === 'links') items = s.items.filter(it => it && typeof it === 'object' && /^https?:\/\//i.test(String(it.url || '')) && it.label && !invented(String(it.url) + ' ' + String(it.label))).map(it => ({ label: String(it.label).slice(0, 60), url: String(it.url).slice(0, 300) }));
    else if (s.block === 'metric') items = s.items.filter(it => it && typeof it === 'object' && it.label != null && it.value != null && !invented(String(it.label) + ' ' + String(it.value))).map(it => ({ label: String(it.label).slice(0, 60), value: String(it.value).slice(0, 60) }));
    else items = s.items.map(asText).filter(t => t.trim() && !invented(t)).map(t => t.slice(0, 200));
    items = items.slice(0, 10);
    if (items.length) out.push({ heading: String(s.heading || '').slice(0, 60), block: s.block, items });
  }
  return out;
}
async function generatePage({ brief = '', agent = 'Atlas' } = {}) {
  const clientTop = await ledgers.read('client', { kind: 'signal', limit: 10 }).then(r => r.map(x => x.key).join(', ')).catch(() => '');
  const clientD = await ledgers.digest('client').catch(() => '');
  const existing = await db.pool.query("SELECT title FROM generations WHERE kind='page' ORDER BY created_at DESC LIMIT 12").then(r => r.rows.map(x => x.title)).catch(() => []);
  const prompt =
`You are ${agent}, a product builder on the L.A.B team. Design ONE new PAGE (a sidebar tab) for the family's personal Hub app. It must be genuinely useful for a household running its own home server, specific rather than generic, and buildable from these blocks only:
- "text": short paragraphs (items = strings)
- "list": bullet points (items = strings)
- "links": useful links (items = {label, url} with http(s) urls only)
- "metric": label/value pairs (items = {label, value})
- "checklist": tickable items (items = strings)
- "steps": numbered steps (items = strings)

What the family actually uses lately: ${clientTop || '(not much yet)'}
Client ledger digest: ${clientD.slice(0, 500)}
${brief ? 'Brief: ' + brief : ''}
Avoid repeating these existing pages: ${existing.join(', ') || '(none yet)'}

HARD RULES: never invent facts about this family's setup — no hostnames, IP addresses, ports, device names, service names or numbers you were not given. If a block would need such facts, write it as guidance the person fills in, or leave it out. Links only to real, well-known public sites. Metrics only if the value is genuinely known from the brief.

Return ONLY JSON: {"name":"kebab-slug","title":"Tab Name (1-2 words)","icon":"one of ${PAGE_ICONS.join('|')}","summary":"one line on what it's for","sections":[{"heading":"Section","block":"text|list|links|metric|checklist|steps","items":[...]}]} with 2-5 sections, each 2-8 items, everything short and real.`;
  const p = parseJSON(await askClaude(prompt));
  const id = uid();
  // sanitise first (drop what doesn't fit the templates), then judge what's left
  const payload = { icon: PAGE_ICONS.includes(p.icon) ? p.icon : 'star', sections: sanitizeSections(p.sections, brief) };
  const tested = validatePage({ title: p.title, sections: payload.sections });
  await db.pool.query(
    `INSERT INTO generations(id,kind,name,title,summary,payload,status,tested,agent)
     VALUES($1,'page',$2,$3,$4,$5,$6,$7,$8)`,
    [id, String(p.name || 'page-' + id).slice(0, 40), String(p.title || 'New Page').slice(0, 40),
     String(p.summary || '').slice(0, 160), JSON.stringify(payload), tested ? 'published' : 'staged', tested, agent]);
  return { id, kind: 'page', name: p.name, title: p.title, tested, status: tested ? 'published' : 'staged' };
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

// re-judge a staged page with the current rules (used after validator improvements)
async function revalidatePages() {
  const rows = await db.pool.query("SELECT id,title,payload FROM generations WHERE kind='page' AND status='staged'").then(r => r.rows);
  const out = [];
  for (const r of rows) {
    const sections = sanitizeSections((r.payload || {}).sections);
    const ok = validatePage({ title: r.title, sections });
    if (ok) await db.pool.query("UPDATE generations SET payload=jsonb_set(payload,'{sections}',$2::jsonb), tested=true, status='published' WHERE id=$1", [r.id, JSON.stringify(sections)]);
    out.push({ id: r.id, title: r.title, published: ok });
  }
  return out;
}

module.exports = { generateSkin, generateWidget, generatePage, validatePage, revalidatePages, list, setStatus };
