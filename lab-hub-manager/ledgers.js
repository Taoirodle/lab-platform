// ============================================================
//  L.A.B — The Ledger System
//  Four ever-evolving SQL knowledge-stores that ground everything the AI
//  build team does:
//    team   — build ideology, north-star, guardrails, plans, evolution log
//    client — who users are, their stack, what they like/dislike, usage signals
//    admin  — how admins interact + what they prefer
//    kiosk  — per-device usage, correlated to a specific always-on kiosk
//  Signals accrue autonomously from telemetry; a periodic `evolve()` pass lets
//  the on-server Claude brain refine each ledger's ideology from what it sees.
//  A monthly `masterSynthesis()` reads everything and writes the big picture.
// ============================================================
const db = require('./db');
const { spawn } = require('child_process');

const CLAUDE = process.env.LAB_CLAUDE || '/home/tao/.local/bin/claude';
const pool = db.pool;

function askClaude(prompt, timeout = 150000) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(CLAUDE, ['-p', prompt, '--output-format', 'text'], { cwd: '/srv/lab/manager' }); }
    catch (e) { return reject(e); }
    let out = '', err = '';
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} reject(new Error('timeout')); }, timeout);
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('error', e => { clearTimeout(t); reject(e); });
    child.on('close', () => { clearTimeout(t); out.trim() ? resolve(out.trim()) : reject(new Error(err.trim() || 'no output')); });
  });
}
function parseJSON(text) {
  const c = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const s = c.search(/[[{]/); if (s === -1) throw new Error('no json');
  const open = c[s], close = open === '[' ? ']' : '}';
  const e = c.lastIndexOf(close);
  return JSON.parse(c.slice(s, e + 1));
}

// ---- core read / write -----------------------------------------------------
// Upsertable fact (has a key): reinforce weight + replace value.
// Append-only log (no key): always insert.
async function write(ledger, { scope = 'global', kind, key = null, value = {}, weight = 1, source = 'system' }) {
  if (key) {
    await pool.query(
      `INSERT INTO ledger_entries(ledger,scope,kind,key,value,weight,source)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (ledger,scope,kind,key) WHERE key IS NOT NULL
       DO UPDATE SET value=$5, weight=ledger_entries.weight+$6, source=$7, updated_at=now()`,
      [ledger, scope, kind, key, JSON.stringify(value), weight, source]);
  } else {
    await pool.query(
      `INSERT INTO ledger_entries(ledger,scope,kind,value,weight,source) VALUES($1,$2,$3,$4,$5,$6)`,
      [ledger, scope, kind, JSON.stringify(value), weight, source]);
  }
}
// A lightweight counter signal (used all over telemetry). Fast, no brain.
async function signal(ledger, scope, key, delta = 1, extra = {}) {
  await pool.query(
    `INSERT INTO ledger_entries(ledger,scope,kind,key,value,weight,source)
     VALUES($1,$2,'signal',$3,$4,$5,'telemetry')
     ON CONFLICT (ledger,scope,kind,key) WHERE key IS NOT NULL
     DO UPDATE SET value = jsonb_set(ledger_entries.value,'{count}',
        to_jsonb(COALESCE((ledger_entries.value->>'count')::int,0)+$5)),
        weight=ledger_entries.weight+$5, updated_at=now()`,
    [ledger, String(scope), key, JSON.stringify({ count: delta, ...extra }), delta]);
}
async function read(ledger, { scope, kind, limit = 60 } = {}) {
  const cond = ['ledger=$1'], args = [ledger];
  if (scope) { args.push(scope); cond.push('scope=$' + args.length); }
  if (kind) { args.push(kind); cond.push('kind=$' + args.length); }
  args.push(limit);
  const r = await pool.query(
    `SELECT id,scope,kind,key,value,weight,source,updated_at FROM ledger_entries
     WHERE ${cond.join(' AND ')} ORDER BY weight DESC, updated_at DESC LIMIT $${args.length}`, args);
  return r.rows;
}
const ideologies = (ledger, scope = 'global') => read(ledger, { scope, kind: 'ideology', limit: 40 });

// Compact text digest of a ledger for feeding the brain.
async function digest(ledger, scope = 'global') {
  const [ideo, north, guard, plans, signals] = await Promise.all([
    read(ledger, { scope, kind: 'ideology', limit: 20 }),
    read(ledger, { scope, kind: 'northstar', limit: 3 }),
    read(ledger, { scope, kind: 'guardrail', limit: 10 }),
    read(ledger, { scope, kind: 'plan', limit: 8 }),
    read(ledger, { scope, kind: 'signal', limit: 20 })
  ]);
  const line = r => `- ${(r.value && (r.value.statement || r.value.text || r.key)) || r.key} (w=${r.weight.toFixed(1)})`;
  const sig = r => `- ${r.key}: ${(r.value && r.value.count) || r.weight}`;
  return [
    north.length ? `NORTH STAR:\n${north.map(line).join('\n')}` : '',
    guard.length ? `GUARDRAILS:\n${guard.map(line).join('\n')}` : '',
    ideo.length ? `IDEOLOGY:\n${ideo.map(line).join('\n')}` : '(no ideology yet)',
    plans.length ? `OPEN PLANS:\n${plans.map(line).join('\n')}` : '',
    signals.length ? `TOP SIGNALS:\n${signals.map(sig).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');
}

// ---- autonomous learning from the telemetry firehose -----------------------
async function learnFromEvent(ev) {
  try {
    const acct = ev.account_id != null ? String(ev.account_id) : 'anon';
    const p = ev.payload || {};
    switch (ev.type) {
      case 'login':   await signal('client', acct, 'logins'); break;
      case 'page':    await signal('client', acct, 'page:' + (p.page || 'home')); break;
      case 'activity':await signal('client', acct, 'active'); break;
      case 'sauce':   await signal('client', acct, 'uses:sauce'); break;
      case 'install': await write('client', { scope: acct, kind: p.remove ? 'dislike' : 'like', key: 'app:' + p.app, value: { app: p.app, statement: `${p.remove ? 'removed' : 'installed'} ${p.app}` }, weight: p.remove ? 0.5 : 1.5, source: 'telemetry' }); break;
      case 'kiosk':   await signal('kiosk', p.kiosk || 'hall', 'room:' + (p.room || '?')); break;
      default: break;
    }
  } catch (e) { /* learning is best-effort */ }
}
// Admin interaction learning (called from admin/approval routes)
async function learnAdmin(action, detail = {}) {
  try { await signal('admin', 'global', 'action:' + action); if (detail.significance) await signal('admin', 'global', 'sig:' + detail.significance); } catch {}
}

// ---- the evolving engine: brain refines a ledger's ideology ----------------
async function evolve(ledger = 'team') {
  const d = await digest(ledger);
  const feedbackNote = ledger === 'client' || ledger === 'team'
    ? await pool.query(`SELECT category, count(*) c FROM feedback GROUP BY category ORDER BY c DESC LIMIT 6`).then(r => r.rows.map(x => `${x.category}:${x.c}`).join(', ')).catch(() => '')
    : '';
  const prompt =
`You are the reflective long-term memory of the "${ledger}" ledger inside L.A.B, a self-hosted family platform whose AI team continuously improves itself. Your job: refine this ledger's IDEOLOGY from what has actually been observed, so future builds are grounded in it.

CURRENT STATE:
${d || '(empty — this is the first pass)'}
${feedbackNote ? '\nRECENT FEEDBACK TALLY: ' + feedbackNote : ''}

Refine. Keep what still holds, sharpen it, add at most 2 genuinely new convictions justified by the signals, and note how the thinking shifted. Be concrete and opinionated — vague platitudes are useless.

Return ONLY JSON:
{"ideologies":[{"key":"short-slug","statement":"one concrete conviction","weight":1-10}],
 "evolution":"one sentence on what changed and why",
 "plans":["a specific next thing to build or learn"]}`;
  let out;
  try { out = parseJSON(await askClaude(prompt)); } catch (e) { return { ok: false, error: String(e.message || e) }; }
  const ideos = Array.isArray(out.ideologies) ? out.ideologies.slice(0, 8) : [];
  for (const it of ideos) {
    if (!it || !it.key) continue;
    await write(ledger, { kind: 'ideology', key: String(it.key).slice(0, 60), value: { statement: String(it.statement || '').slice(0, 400) }, weight: Math.max(1, Math.min(10, Number(it.weight) || 3)), source: 'agent' });
  }
  if (out.evolution) await write(ledger, { kind: 'evolution', value: { text: String(out.evolution).slice(0, 400), at: null }, source: 'agent' });
  for (const pl of (Array.isArray(out.plans) ? out.plans.slice(0, 5) : [])) {
    await write(ledger, { kind: 'plan', key: 'plan:' + String(pl).slice(0, 40).toLowerCase().replace(/\W+/g, '-'), value: { text: String(pl).slice(0, 300) }, weight: 3, source: 'agent' });
  }
  return { ok: true, ledger, ideologies: ideos.length, evolution: out.evolution };
}

// ---- master synthesis: the monthly major-update pass -----------------------
async function masterSynthesis(period = 'monthly') {
  const digs = {};
  for (const l of ['team', 'client', 'admin', 'kiosk']) digs[l] = await digest(l).catch(() => '');
  const counts = await pool.query(
    `SELECT ledger, count(*) c, round(avg(weight)::numeric,1) w FROM ledger_entries GROUP BY ledger`).then(r => r.rows).catch(() => []);
  const prompt =
`You are the master synthesis of L.A.B — you read all four ledgers once and set the big-picture direction for the whole AI build team.

TEAM LEDGER:\n${digs.team}\n\nCLIENT LEDGER:\n${digs.client}\n\nADMIN LEDGER:\n${digs.admin}\n\nKIOSK LEDGER:\n${digs.kiosk}

Write a punchy synthesis (5-8 sentences) of where the platform is, what the family clearly wants, and the single most valuable direction for the next cycle. Then return it.

Return ONLY JSON: {"summary":"...","themes":["..."],"direction":"the one big bet for next cycle"}`;
  let out; try { out = parseJSON(await askClaude(prompt)); } catch (e) { return { ok: false, error: String(e.message || e) }; }
  // build a graph for the 3D viz: root -> ledgers -> their ideologies
  const nodes = [{ id: 'master', label: 'Master Synthesis', ledger: 'master', level: 0 }];
  const edges = [];
  for (const l of ['team', 'client', 'admin', 'kiosk']) {
    nodes.push({ id: l, label: l[0].toUpperCase() + l.slice(1) + ' Ledger', ledger: l, level: 1 });
    edges.push({ from: 'master', to: l });
    const ideo = await read(l, { kind: 'ideology', limit: 6 }).catch(() => []);
    ideo.forEach((it, i) => {
      const id = l + ':' + (it.key || i);
      nodes.push({ id, label: (it.value && it.value.statement || it.key || '').slice(0, 40), ledger: l, level: 2, weight: it.weight });
      edges.push({ from: l, to: id });
    });
  }
  const graph = { nodes, edges, counts };
  await pool.query('INSERT INTO master_synthesis(period,summary,graph) VALUES($1,$2,$3)',
    [period, String(out.summary || '').slice(0, 4000), JSON.stringify(graph)]);
  await write('team', { kind: 'northstar', key: 'direction', value: { statement: String(out.direction || '').slice(0, 400) }, weight: 10, source: 'agent' });
  return { ok: true, summary: out.summary, direction: out.direction, nodes: nodes.length };
}

// Live graph for the Admin 3D neural-network view (doesn't need a synthesis run)
async function graph() {
  const nodes = [{ id: 'lab', label: 'L.A.B', ledger: 'master', level: 0 }];
  const edges = [];
  for (const l of ['team', 'client', 'admin', 'kiosk']) {
    const cnt = await pool.query('SELECT count(*) c FROM ledger_entries WHERE ledger=$1', [l]).then(r => +r.rows[0].c).catch(() => 0);
    nodes.push({ id: l, label: l[0].toUpperCase() + l.slice(1), ledger: l, level: 1, count: cnt });
    edges.push({ from: 'lab', to: l });
    const kinds = await pool.query(
      `SELECT kind, count(*) c FROM ledger_entries WHERE ledger=$1 GROUP BY kind ORDER BY c DESC LIMIT 6`, [l]).then(r => r.rows).catch(() => []);
    for (const k of kinds) {
      const kid = l + ':' + k.kind;
      nodes.push({ id: kid, label: k.kind, ledger: l, level: 2, count: +k.c });
      edges.push({ from: l, to: kid });
      const top = await read(l, { kind: k.kind, limit: 4 }).catch(() => []);
      top.forEach(it => {
        const nid = kid + ':' + it.id;
        nodes.push({ id: nid, label: ((it.value && (it.value.statement || it.value.text)) || it.key || '·').slice(0, 46), ledger: l, level: 3, weight: it.weight });
        edges.push({ from: kid, to: nid });
      });
    }
  }
  return { nodes, edges };
}

// ---- seed the initial ideologies (only runs if team ledger is empty) -------
async function seed() {
  const has = await pool.query(`SELECT 1 FROM ledger_entries WHERE ledger='team' LIMIT 1`).then(r => r.rowCount).catch(() => 1);
  if (has) return;
  const team = [
    ['ship-material', 'Ship changes people can feel. A new widget, a real feature, a genuine overhaul beats ten cosmetic tweaks.', 8],
    ['ground-in-signal', 'Never build blind. Read the ledgers first; let real usage and feedback decide what matters.', 9],
    ['hands-off-by-default', 'Small, safe, additive work ships silently. Only truly major or risky changes ask the admin.', 7],
    ['own-your-look', 'Custom, crafted, distinct. Corporate for control surfaces, warm for personal ones. Never generic.', 6],
    ['privacy-is-the-product', 'It all runs on the family server. Sensitive data is dropped, never stored, never sold.', 8]
  ];
  for (const [k, s, w] of team) await write('team', { kind: 'ideology', key: k, value: { statement: s }, weight: w, source: 'system' });
  await write('team', { kind: 'northstar', key: 'mission', value: { statement: 'Make the household materially calmer, more organised, and more capable — and get visibly better at it every cycle.' }, weight: 10, source: 'system' });
  await write('team', { kind: 'guardrail', key: 'no-break-hub', value: { statement: 'Never break the Hub for real users. Test in isolation before publishing.' }, weight: 10, source: 'system' });
  await write('team', { kind: 'guardrail', key: 'no-silent-major', value: { statement: 'Schema, auth, or data-affecting changes always go to the admin first.' }, weight: 10, source: 'system' });
  await write('team', { kind: 'guardrail', key: 'stay-on-plan', value: { statement: 'Every build must trace to a ledger plan or the north star. No random churn.' }, weight: 9, source: 'system' });
  return true;
}

module.exports = { write, signal, read, ideologies, digest, learnFromEvent, learnAdmin, evolve, masterSynthesis, graph, seed };
