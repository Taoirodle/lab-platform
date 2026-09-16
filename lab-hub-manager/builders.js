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
// ---- THE CRITIC ------------------------------------------------------------
// Everything below this line exists because two days of unattended building
// produced thirty variations of the colour orange, and every one of them passed
// validation. Of course they did: the validators are mechanical. They can tell
// you a colour is a colour and that a list has between one and eight items.
// They cannot tell you this is the thirty-first orange, or that a card recites
// platitudes nobody asked for.
//
// That judgement needs a different model from the one that wrote it, with the
// existing library in front of it, and — the part that actually matters —
// permission to say no. A critic that cannot reject is a rubber stamp.
const engines = require('./engines');

// Generate with whichever engine suits the job, falling back to the old direct
// Claude call if the engine layer has nothing signed in.
async function generate(prompt, role = 'writer') {
  try { return await engines.text(prompt, { role, attach: false, timeout: 240000, actor: 'builders' }); }
  catch (e) {
    if (e.code === 'NO_ENGINE') return askClaude(prompt);
    throw e;
  }
}

async function judge({ kind, artifact, existing = [], author = null }) {
  let critic = null;
  try {
    const up = await engines.available();
    critic = up.find(n => n !== author) || null;
  } catch {}
  // No independent second opinion means no automatic publish. Staged is the
  // honest outcome: a human can still promote it.
  if (!critic) return { verdict: 'stage', why: 'no second engine was available to review this', critic: null };

  const prompt =
`You are the last check before something an AI team built goes onto a real
family's home dashboard. Your job is to keep slop off the screen. You are not
here to be encouraging.

Reject it if any of these are true:
 - it is a minor variation on something already in the library below
 - it recites generic advice or motivational filler instead of showing real
   household information
 - nobody in the house would notice if it quietly disappeared

The bar is simple: it has to be useful, or it has to be fun. Something that is
neither is clutter, and clutter is what we are trying to stop.

KIND: ${kind}
ALREADY IN THE LIBRARY (${existing.length}): ${existing.join(' | ') || '(nothing yet)'}

THE CANDIDATE
${JSON.stringify(artifact).slice(0, 4000)}

Return ONLY JSON: {"verdict":"publish"|"stage"|"reject","why":"one short sentence"}
publish = genuinely earns its place. stage = not embarrassing but not worth
auto-shipping. reject = clutter.`;

  try {
    const raw = await engines.text(prompt, { engine: critic, attach: false, timeout: 240000, actor: 'critic' });
    const v = parseJSON(raw);
    const verdict = ['publish', 'stage', 'reject'].includes(v.verdict) ? v.verdict : 'stage';
    return { verdict, why: String(v.why || '').slice(0, 200), critic };
  } catch (e) {
    return { verdict: 'stage', why: `the reviewer could not be reached (${e.message})`, critic };
  }
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
  const author = await engines.pick('writer').catch(() => null);
  const g = parseJSON(await generate(prompt, 'writer'));
  const vars = g.vars || {};
  const tested = validateSkin(vars);
  // Mechanical check first — no point asking a critic about an illegible theme.
  const verdict = tested
    ? await judge({ kind: 'skin', artifact: { title: g.title, summary: g.summary, vars }, existing, author })
    : { verdict: 'stage', why: 'failed the legibility check', critic: null };
  const status = tested && verdict.verdict === 'publish' ? 'published'
               : verdict.verdict === 'reject' ? 'rejected' : 'staged';
  const id = uid();
  await db.pool.query(
    `INSERT INTO generations(id,kind,name,title,summary,payload,meta,status,tested,agent)
     VALUES($1,'skin',$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, String(g.name || 'skin-' + id).slice(0, 40), String(g.title || 'New Skin').slice(0, 60),
     String(g.summary || '').slice(0, 160), JSON.stringify({ vars }),
     JSON.stringify({ author, ...verdict }), status, tested, agent]);
  return { id, kind: 'skin', name: g.name, title: g.title, tested, status, verdict: verdict.verdict, why: verdict.why, critic: verdict.critic };
}

// ---- WIDGETS (structured, rendered by trusted Hub templates) ---------------
const WIDGET_TEMPLATES = ['tips', 'checklist', 'focus', 'live'];
// The whitelist a 'live' widget may bind to. Must match the LIVE map in
// server.js — the server validates again, so a stale entry here fails closed.
const WIDGET_SOURCES = ['todos_open', 'events_next', 'kit_unconfirmed', 'kit_summary', 'rooms_on', 'usage_today', 'usage_week', 'house_facts'];
function validateWidget(w) {
  if (!w || !WIDGET_TEMPLATES.includes(w.template) || !w.title) return false;
  // A live card carries no prose of its own: it names real data and frames it.
  if (w.template === 'live') return WIDGET_SOURCES.includes(w.source);
  return Array.isArray(w.items) && w.items.length >= 1 && w.items.length <= 8;
}
async function generateWidget({ brief = '', agent = 'Nova' } = {}) {
  const clientTop = await ledgers.read('client', { kind: 'signal', limit: 8 }).then(r => r.map(x => x.key).join(', ')).catch(() => '');
  const prompt =
`You are ${agent} on the L.A.B build team. Design a small dashboard WIDGET for the family Hub.

STRONGLY PREFER "live". A card that recites prose is worthless; a card bound to
real household data earns its place on the screen. Only fall back to a static
template when no live source could possibly answer the need.

- "live": binds to one real data source and frames it. Choose a source:
${WIDGET_SOURCES.map(s => '    ' + s).join('\n')}
  todos_open = open items across the lists · events_next = the next 7 days
  kit_unconfirmed = devices found on the network still needing a name
  kit_summary = what the house owns · rooms_on = lights currently on
  usage_today / usage_week = measured time at this machine
  house_facts = what the house has recorded about itself
- "tips": a rotating list of short helpful tips.
- "checklist": a short actionable checklist.
- "focus": one headline focus + up to 3 supporting lines.

What the family actually uses lately: ${clientTop || '(not much yet)'}
${brief ? 'Brief: ' + brief : ''}

For live: {"template":"live","source":"<one of the above>","name":"kebab-slug","title":"Card Title","summary":"one line on why it matters","accent":"#hex"}
For the others: {"template":"tips|checklist|focus","name":"kebab-slug","title":"Card Title","summary":"one line","accent":"#hex","items":["short line", "..."]} with 3-6 short, real items.
Return ONLY the JSON.`;
  const author = await engines.pick('coder').catch(() => null);
  const w = parseJSON(await generate(prompt, 'coder'));
  const tested = validateWidget(w);
  const priorCards = await db.pool.query("SELECT title FROM generations WHERE kind='widget' AND status='published' ORDER BY created_at DESC LIMIT 20")
    .then(r => r.rows.map(x => x.title)).catch(() => []);
  const verdict = tested
    ? await judge({ kind: 'widget', artifact: w, existing: priorCards, author })
    : { verdict: 'stage', why: 'failed the template check', critic: null };
  const status = tested && verdict.verdict === 'publish' ? 'published'
               : verdict.verdict === 'reject' ? 'rejected' : 'staged';
  const id = uid();
  await db.pool.query(
    `INSERT INTO generations(id,kind,name,title,summary,payload,meta,status,tested,agent)
     VALUES($1,'widget',$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, String(w.name || 'widget-' + id).slice(0, 40), String(w.title || 'New Widget').slice(0, 60),
     String(w.summary || '').slice(0, 160), JSON.stringify({ template: w.template, source: w.source, accent: w.accent, items: (w.items || []).map(s => String(s).slice(0, 120)) }),
     JSON.stringify({ author, ...verdict }), status, tested, agent]);
  return { id, kind: 'widget', name: w.name, title: w.title, tested, status, verdict: verdict.verdict, why: verdict.why, critic: verdict.critic };
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
  const author = await engines.pick('architect').catch(() => null);
  const p = parseJSON(await generate(prompt, 'architect'));
  const id = uid();
  // sanitise first (drop what doesn't fit the templates), then judge what's left
  const payload = { icon: PAGE_ICONS.includes(p.icon) ? p.icon : 'star', sections: sanitizeSections(p.sections, brief) };
  const tested = validatePage({ title: p.title, sections: payload.sections });
  const priorPages = await db.pool.query("SELECT title FROM generations WHERE kind='page' AND status='published' ORDER BY created_at DESC LIMIT 25")
    .then(r => r.rows.map(x => x.title)).catch(() => []);
  const verdict = tested
    ? await judge({ kind: 'page', artifact: { title: p.title, summary: p.summary, ...payload }, existing: priorPages, author })
    : { verdict: 'stage', why: 'failed the section checks', critic: null };
  const status = tested && verdict.verdict === 'publish' ? 'published'
               : verdict.verdict === 'reject' ? 'rejected' : 'staged';
  await db.pool.query(
    `INSERT INTO generations(id,kind,name,title,summary,payload,meta,status,tested,agent)
     VALUES($1,'page',$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, String(p.name || 'page-' + id).slice(0, 40), String(p.title || 'New Page').slice(0, 40),
     String(p.summary || '').slice(0, 160), JSON.stringify(payload),
     JSON.stringify({ author, ...verdict }), status, tested, agent]);
  return { id, kind: 'page', name: p.name, title: p.title, tested, status, verdict: verdict.verdict, why: verdict.why, critic: verdict.critic };
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

// ---- RETROSPECT ------------------------------------------------------------
// The critic above only guards new work. It does nothing about the 362 things
// already published, which is where the actual problem lives. This runs the
// same judgement over the existing library — in batches, so the reviewer can
// see the whole set at once and spot the duplication that is invisible one
// artifact at a time.
//
// It reports by default and changes nothing. Un-publishing hundreds of things
// on a family's live dashboard is not a call an agent should make on its own,
// so `apply` has to be asked for explicitly.
const BATCH = 30;

function compact(kind, r) {
  const p = r.payload || {};
  if (kind === 'skin') {
    const v = p.vars || {};
    return { name: r.name, title: r.title, summary: r.summary, bg: v['--bg'], a1: v['--a1'], a2: v['--a2'] };
  }
  if (kind === 'widget') {
    return { name: r.name, title: r.title, template: p.template, source: p.source || null,
             items: (p.items || []).slice(0, 3) };
  }
  return { name: r.name, title: r.title, summary: r.summary,
           sections: (p.sections || []).map(s => s.heading).slice(0, 5) };
}

async function retrospect({ kind = 'skin', apply = false, limit = 400 } = {}) {
  const rows = await db.pool.query(
    `SELECT id,name,title,summary,payload FROM generations
     WHERE kind=$1 AND status='published' ORDER BY created_at ASC LIMIT $2`, [kind, limit]).then(r => r.rows);
  if (!rows.length) return { kind, reviewed: 0, verdicts: [], applied: false };

  let critic = null;
  try { critic = (await engines.available())[0] || null; } catch {}
  if (!critic) return { kind, reviewed: 0, error: 'no engine is signed in', verdicts: [], applied: false };

  const verdicts = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const prompt =
`You are auditing what an AI build team has already published to a real family's
home dashboard. Nobody reviewed any of it at the time. Two days of unattended
building produced roughly a hundred colour themes and a hundred cards, and the
family's own verdict was that it "doesn't do anything helpful or fun".

Your job is to say which of these earn their place and which are clutter.

Drop it if:
 - it is a near-duplicate of another entry in this list
 - it is decoration with no function
 - it recites generic advice instead of showing real household information
 - it is about domestic chores the family has said they do not want
   (bin day especially — in South Africa it is one fixed day and needs no card)

Keep it only if a person in that house would notice it missing.

Be decisive. If most of this batch is clutter, say so — do not spread your
answers out to seem balanced.

THE BATCH (${batch.length} of ${rows.length} total ${kind}s):
${batch.map((r, n) => `${n + 1}. ${JSON.stringify(compact(kind, r))}`).join('\n')}

Return ONLY a JSON array, one entry per item, same order:
[{"name":"<the name field>","keep":true|false,"why":"a few words"}]`;

    try {
      const raw = await engines.text(prompt, { engine: critic, attach: false, timeout: 300000, actor: 'retrospect' });
      const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const arr = JSON.parse(cleaned.slice(cleaned.indexOf('['), cleaned.lastIndexOf(']') + 1));
      for (const v of arr) {
        const row = batch.find(r => r.name === v.name);
        if (row) verdicts.push({ id: row.id, name: row.name, title: row.title, keep: v.keep !== false, why: String(v.why || '').slice(0, 160) });
      }
    } catch (e) {
      // One card mentioning the word "password" once cost us a review of the
      // other twenty-nine in its batch. Rather than soften the boundary — it was
      // doing its job — narrow the blast radius: re-run the batch one at a time
      // and let only the actual offender fall out, flagged for a human.
      if (e.code === 'BOUNDARY') {
        for (const row of batch) {
          try {
            const one = prompt.replace(/THE BATCH[\s\S]*$/, `THE BATCH (1 item):\n1. ${JSON.stringify(compact(kind, row))}\n\n` +
              `Return ONLY a JSON array: [{"name":"${row.name}","keep":true|false,"why":"a few words"}]`);
            const raw = await engines.text(one, { engine: critic, attach: false, timeout: 120000, actor: 'retrospect' });
            const c = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
            const v = JSON.parse(c.slice(c.indexOf('['), c.lastIndexOf(']') + 1))[0] || {};
            verdicts.push({ id: row.id, name: row.name, title: row.title, keep: v.keep !== false, why: String(v.why || '').slice(0, 160) });
          } catch (inner) {
            verdicts.push({ id: row.id, name: row.name, title: row.title, keep: true, unreviewed: true,
              why: inner.code === 'BOUNDARY' ? `kept unreviewed — its own text tripped the data boundary (${inner.rule})` : `kept unreviewed — ${inner.message}` });
          }
        }
      } else {
        verdicts.push({ error: `batch ${i / BATCH + 1} failed: ${e.message}` });
      }
    }
  }

  const drop = verdicts.filter(v => v.id && !v.keep);
  let applied = false;
  if (apply && drop.length) {
    await db.pool.query(`UPDATE generations SET status='rejected' WHERE id = ANY($1::text[])`, [drop.map(v => v.id)]);
    await db.audit('retrospect', 'generations.retired', { kind, count: drop.length, critic });
    applied = true;
  }
  return { kind, critic, reviewed: verdicts.filter(v => v.id).length,
           keep: verdicts.filter(v => v.keep).length, drop: drop.length,
           applied, verdicts };
}

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

module.exports = { generateSkin, generateWidget, generatePage, validatePage, revalidatePages, retrospect, list, setStatus };
