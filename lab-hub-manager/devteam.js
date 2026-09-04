// ============================================================
//  L.A.B Hub Manager — Silent Dev Team
//  A 5-agent crew that reads what the platform knows and files real
//  improvements into the update pipeline. The tiered-approval model routes
//  them: low significance auto-ships (hands-off), only genuinely major work
//  lands in the Admin Portal for a 1-tap call.
//
//  The brain is REAL: propose() shells out to the Claude Code CLI running on
//  this node, grounded in live telemetry + system state. If the CLI is slow or
//  unavailable, it degrades gracefully to a heuristic pool so the crew never
//  goes dark.
// ============================================================
const db = require('./db');
const { spawn } = require('child_process');
const os = require('os');
const ledgers = require('./ledgers');
const builders = require('./builders');

const CLAUDE = process.env.LAB_CLAUDE || '/home/tao/.local/bin/claude';

const CREW = [
  { id: 'nova',  name: 'Nova',  role: 'UX & Accessibility' },
  { id: 'sable', name: 'Sable', role: 'Infra & Fleet' },
  { id: 'echo',  name: 'Echo',  role: 'Network & Security' },
  { id: 'root',  name: 'Root',  role: 'Performance' },
  { id: 'pixel', name: 'Pixel', role: 'Interface & Delight' }
];
const nameOf = id => (CREW.find(c => c.id === id || c.name === id) || {}).name || id;
const NAMES = CREW.map(c => c.name);

// ---- Significance rubric (recalibrated to Tao's feedback) -------------------
//   Rate-limiting-type hardening is a 2, not a 7. Be stingy with high scores.
//   1-3  trivial / safe / purely additive (polish, small UX, rate-limits,
//        logging, retries, backups) ....................... auto-ships, silent
//   4-6  moderate, low-risk feature or refactor ........... usually auto-ships
//   7    notable, user-visible, worth a glance ............ auto-ships
//   8-10 MAJOR or risky ONLY: schema/data migrations, security-critical auth,
//        anything that could break the Hub for users, a brand-new app  -> ADMIN
const APPROVAL_THRESHOLD = 8;   // significance >= this needs the admin's call
const RUBRIC = [
  'Significance rubric — be conservative, MOST good improvements are 2-5:',
  '1-3 = trivial, safe, purely additive (polish, small UX tweaks, rate-limiting, logging, retries, backups) -> ships automatically, no human needed.',
  '4-6 = moderate, low-risk feature or refactor -> normally auto-ships.',
  '7   = notable, user-visible change worth a glance -> still auto-ships.',
  '8-10 = MAJOR or risky ONLY: schema/data migrations, security-critical auth changes, anything that could break the Hub for real users, or a brand-new app. These are the ONLY things that need the admin. Rate-limiting an endpoint is a 2, never a 7.'
].join('\n');

// ---- Heuristic fallback pool (recalibrated sigs + update paths) -------------
const POOL = [
  { agent: 'nova',  service: 'Hub / Interface', sig: 3, title: 'One-tap high-contrast theme',   path: 'Hub -> Interface -> Theme',        summary: 'Header toggle for a high-contrast Hub theme, for low-light use.' },
  { agent: 'nova',  service: 'Hub / Interface', sig: 2, title: 'Larger tap targets on mobile',   path: 'Hub -> Interface -> Mobile',       summary: 'Bigger controls on small screens for easier reach.' },
  { agent: 'nova',  service: 'Hub / Interface', sig: 3, title: 'First-run onboarding checklist',  path: 'Hub -> Onboarding',                summary: 'Guides new accounts through their first Hub steps.' },
  { agent: 'pixel', service: 'Hub / Interface', sig: 2, title: 'Smooth page transitions',         path: 'Hub -> Interface -> Motion',       summary: 'Subtle motion between Hub pages for a more polished feel.' },
  { agent: 'pixel', service: 'Hub / Interface', sig: 2, title: 'Per-user accent colours',         path: 'Hub -> Interface -> Theme',        summary: 'Each user picks an accent for their Hub.' },
  { agent: 'root',  service: 'Performance',     sig: 4, title: 'Batch telemetry writes',          path: 'Manager -> SQL Brain -> Events',   summary: 'Buffers device telemetry to cut write load on the SQL Brain.' },
  { agent: 'root',  service: 'Performance',     sig: 2, title: 'Lazy-load dashboard widgets',     path: 'Hub -> Dashboard',                 summary: 'Defers off-screen widgets to speed first paint.' },
  { agent: 'sable', service: 'Fleet / MDM',     sig: 3, title: 'Agent auto-reconnect with backoff', path: 'Fleet -> Agent',                summary: 'Device agents retry gracefully if the Manager is briefly unreachable.' },
  { agent: 'sable', service: 'Fleet / MDM',     sig: 3, title: 'Offline-device alerting',         path: 'Fleet -> Monitoring',              summary: 'Flags devices that miss check-ins beyond a threshold.' },
  { agent: 'sable', service: 'Infra',           sig: 8, title: 'Nightly SQL Brain backup',        path: 'Manager -> SQL Brain -> Backup',   summary: 'Dumps the database to the SSD each night with rotation.' },
  { agent: 'echo',  service: 'Security',        sig: 8, title: 'Rotate pairing tokens',           path: 'Manager -> Security -> Tokens',    summary: 'Expire and rotate admin/device tokens on a schedule.' },
  { agent: 'echo',  service: 'Security',        sig: 2, title: 'Rate-limit enrolment endpoints',  path: 'Manager -> Security -> Enrolment',  summary: 'Caps enrolment attempts to prevent abuse on the LAN.' }
];

const rnd = () => Math.random();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clampSig = v => Math.max(1, Math.min(10, Math.round(v) || 3));

// ---- The brain: talk to the Claude Code CLI on this node --------------------
function askClaude(prompt, timeout = 150000) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(CLAUDE, ['-p', prompt, '--output-format', 'text'], { cwd: '/srv/lab/manager' });
    } catch (e) { return reject(e); }
    let out = '', err = '';
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} reject(new Error('claude timeout')); }, timeout);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => { clearTimeout(t); reject(e); });
    child.on('close', () => { clearTimeout(t); out.trim() ? resolve(out.trim()) : reject(new Error(err.trim() || 'no output')); });
  });
}

function parseArray(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const s = cleaned.indexOf('['), e = cleaned.lastIndexOf(']');
  if (s === -1 || e === -1 || e < s) throw new Error('no JSON array in model output');
  return JSON.parse(cleaned.slice(s, e + 1));
}

// Snapshot of how the platform is actually being used — grounds the brain.
async function digest() {
  const [ev, fleet, accts, recent, teamLedger, clientSignals, research] = await Promise.all([
    db.events.countByType().catch(() => []),
    db.devices.list().catch(() => []),
    db.accounts.list().catch(() => []),
    db.updates.list().catch(() => []),
    ledgers.digest('team').catch(() => ''),
    ledgers.read('client', { kind: 'signal', limit: 12 }).catch(() => []),
    db.pool.query("SELECT topic FROM research_logs WHERE applied=false ORDER BY created_at DESC LIMIT 5").then(r => r.rows.map(x => x.topic)).catch(() => [])
  ]);
  const load = os.loadavg()[0];
  return {
    accounts: accts.length,
    devices: { total: fleet.length, online: fleet.filter(d => d.status === 'online').length },
    telemetry: ev.map(r => ({ type: r.type, count: +r.count })),
    clientSignals: clientSignals.map(s => `${s.key}×${(s.value && s.value.count) || 1}`),
    openResearch: research,
    server: { loadavg1: +load.toFixed(2), freeMemMB: Math.round(os.freemem() / 1048576) },
    alreadyShipped: recent.slice(0, 24).map(u => u.title),
    teamLedger  // the build team's ideology, north-star, guardrails, plans
  };
}

async function proposeAI(count, aggressiveness, ctx) {
  const prompt =
`You are the silent AI dev team for "L.A.B", a self-hosted family platform: a server Manager, an Admin Portal, and a warm user-facing Home Hub. You improve the platform continuously and are held to your own ledger.

FIRST, obey your build team's ledger — this is your standing brief, not decoration:
${ctx.teamLedger || '(ledger empty)'}

Live usage snapshot:
${JSON.stringify({ accounts: ctx.accounts, devices: ctx.devices, telemetry: ctx.telemetry, clientSignals: ctx.clientSignals, openResearch: ctx.openResearch }, null, 2)}
Already shipped (do NOT repeat): ${ctx.alreadyShipped.join(' | ')}

Aggressiveness ${aggressiveness}/10. Propose exactly ${count} improvement(s) that are MATERIAL — things the family would actually feel. Favour: a genuinely new Hub widget, a real feature, a fresh skin, a capability. Reject cosmetic micro-tweaks; the ledger demands changes people can feel. Every proposal must trace to a ledger plan or the north star.

Where a proposal can be produced as a real artifact right now, say so with "build":
- "skin"  → a new Hub colour theme (you will actually generate it).
- "widget" → a new dashboard card (tips / checklist / focus).
- "page"  → a whole new tab for the personal app (sections of text / list / links / metric / checklist / steps) — people add it from the App Store.
- "none"  → a change that needs human hands (code beyond skins/widgets/pages) — propose it, it gets filed.

${RUBRIC}

Return ONLY a JSON array, each element exactly:
{"agent": one of ${JSON.stringify(NAMES)},
 "title": short imperative (<=60 chars),
 "service": one of "Hub / Interface","Fleet / MDM","Security","Performance","Infra","Generation",
 "summary": ONE line, <=120 chars,
 "path": one-line update path,
 "build": "skin" | "widget" | "page" | "none",
 "brief": short brief for the artifact if build != none (<=140 chars),
 "size_bytes": integer estimate,
 "significance": integer 1-10 per the rubric}`;

  const raw = await askClaude(prompt);
  const arr = parseArray(raw);
  const out = arr.slice(0, count).map(p => ({
    agent: NAMES.includes(p.agent) ? p.agent : 'Nova',
    title: String(p.title || 'Untitled improvement').slice(0, 80),
    service: String(p.service || 'Hub / Interface').slice(0, 32),
    summary: String(p.summary || '').slice(0, 160),
    path: String(p.path || '').slice(0, 90),
    build: ['skin', 'widget', 'page'].includes(p.build) ? p.build : 'none',
    brief: String(p.brief || '').slice(0, 160),
    size_bytes: Math.max(1000, Math.round(Number(p.size_bytes)) || 250000),
    significance: clampSig(Number(p.significance)),
    brain: 'claude'
  }));
  if (!out.length) throw new Error('model returned an empty proposal set');
  return out;
}

function proposeHeuristic(count, aggressiveness) {
  return shuffle(POOL).slice(0, count).map(p => ({
    agent: nameOf(p.agent),
    title: p.title, service: p.service, summary: p.summary, path: p.path,
    build: 'none', brief: '',
    significance: clampSig(p.sig + Math.round((aggressiveness - 5) / 4)),
    size_bytes: 120000 + Math.round(rnd() * 4000000),
    brain: 'heuristic'
  }));
}

// Real brain first, heuristic as a safety net.
async function propose(count, aggressiveness, ctx) {
  try {
    return await proposeAI(count, aggressiveness, ctx);
  } catch (e) {
    await db.audit('devteam', 'brain.fallback', { error: String(e.message || e) }).catch(() => {});
    return proposeHeuristic(count, aggressiveness);
  }
}

let running = false;

async function standup(mode = 'scheduled') {
  const ai = await db.settings.get('ai', { activity: 5, aggressiveness: 5, buildingPaused: false });
  if (ai.buildingPaused) return { skipped: 'paused' };
  if (running) return { skipped: 'busy' };
  running = true;
  try {
    const count = Math.max(1, Math.min(3, Math.round(ai.aggressiveness / 3)));
    const ctx = await digest();
    const proposals = await propose(count, ai.aggressiveness, ctx);
    const filed = [];
    for (const p of proposals) {
      // If the proposal is a real artifact, actually build it now.
      let artifact = null;
      if (p.build === 'skin' || p.build === 'widget' || p.build === 'page') {
        try {
          artifact = p.build === 'skin' ? await builders.generateSkin({ brief: p.brief, agent: p.agent })
            : p.build === 'page' ? await builders.generatePage({ brief: p.brief, agent: p.agent })
            : await builders.generateWidget({ brief: p.brief, agent: p.agent });
          await ledgers.signal('team', 'global', 'built:' + p.build).catch(() => {});
        } catch (e) { await db.audit(p.agent, 'devteam.build.fail', { build: p.build, error: String(e.message || e) }).catch(() => {}); }
      }
      const madeReal = artifact && artifact.tested;
      const push = p.significance >= APPROVAL_THRESHOLD && !madeReal;   // real, tested artifacts ship themselves
      const changelog = `${p.agent} · ${p.service}${p.path ? ' · ' + p.path : ''}` + (artifact ? ` · generated ${artifact.kind} "${artifact.title}" [${artifact.status}]` : '');
      const u = await db.updates.create({
        kind: artifact ? 'app' : 'update', title: p.title, service: p.service, summary: p.summary,
        path: p.path, size_bytes: p.size_bytes, significance: p.significance,
        push_to_admin: push, agent: p.agent, changelog,
        validated: madeReal   // QC 'passed' only when a real artifact was tested
      });
      if (!push) await db.updates.decide(u.id, madeReal ? 'shipped' : 'auto-shipped');
      await db.audit(p.agent, push ? 'devteam.propose' : 'devteam.ship', { title: p.title, sig: p.significance, build: p.build, artifact: artifact && artifact.id });
      filed.push({ agent: p.agent, title: p.title, build: p.build, artifact: artifact || null, significance: p.significance, routed: push ? 'approval' : (madeReal ? 'shipped-real' : 'auto-shipped'), brain: p.brain });
    }
    // record the cycle in the team ledger so the team's memory grows
    await ledgers.write('team', { kind: 'evolution', value: { text: `standup shipped ${filed.length}: ${filed.map(f => f.title).join('; ')}`.slice(0, 380) }, source: 'agent' }).catch(() => {});
    return { mode, brain: proposals[0] && proposals[0].brain, filed };
  } finally { running = false; }
}

let timer;
function startScheduler() {
  if (timer) return;
  // Gentle: every 30 min, run with probability activity/10 (never when paused).
  timer = setInterval(async () => {
    try {
      const ai = await db.settings.get('ai', { activity: 5, buildingPaused: false });
      if (!ai.buildingPaused && rnd() < (ai.activity || 5) / 10) standup('scheduled').catch(() => {});
    } catch { /* keep looping */ }
  }, 30 * 60000);
}

async function status() {
  const ai = await db.settings.get('ai', { activity: 5, aggressiveness: 5, buildingPaused: false });
  const shipped = await db.pool.query("SELECT count(*) FROM updates WHERE decision='auto-shipped'").then(r => +r.rows[0].count).catch(() => 0);
  const pending = await db.pool.query("SELECT count(*) FROM updates WHERE decision='pending' AND push_to_admin=true").then(r => +r.rows[0].count).catch(() => 0);
  return { crew: CREW, running, ai, shipped, pending, threshold: APPROVAL_THRESHOLD };
}

module.exports = { CREW, standup, startScheduler, status };
