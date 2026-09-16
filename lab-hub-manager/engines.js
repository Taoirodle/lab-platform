// ============================================================
//  L.A.B — The Workshop: many engines, one bench
//  ------------------------------------------------------------
//  The house has three coding subscriptions sitting on the same box:
//    • Claude  (Anthropic)  — architecture, long reasoning, prose
//    • Codex   (OpenAI)     — tight edits, refactors, tests
//    • Gemini  (Google)     — huge context, cross-file sweeps
//  Each ships a headless CLI. This module spawns them behind ONE interface so
//  the rest of the platform can say "ask an engine" without caring which.
//
//  Why bother with three? Because one model in a loop is how we ended up with
//  thirty shades of orange. Different model families disagree, and disagreement
//  is the only cheap source of quality we have. `panel()` asks all of them;
//  `review()` makes them mark each other's work.
//
//  HARD RULE — the data boundary:
//  Code leaves the house. The household does not. These engines are third-party
//  services. The house registry (bills, debts, contacts, alarm codes, who is
//  home) is never passed to them. That is enforced below in `guard()`, not left
//  to the caller to remember.
// ============================================================
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const db = require('./db');

const uid = () => crypto.randomBytes(6).toString('hex');

// Where engines are allowed to write: a clone of the repo, never the live server.
const WORKSPACE = process.env.LAB_WORKSPACE || '/srv/lab/workspace/lab-platform';
const MAX_CONCURRENT = 2;          // the G50 is a laptop, not a datacentre
const DEFAULT_TIMEOUT = 180000;
const MAX_TIMEOUT = 900000;

// ---- the engines -------------------------------------------------------
// `args` builds the headless invocation. `write` decides sandbox posture:
// read-only by default, workspace-write only inside WORKSPACE. We never pass
// --yolo, --dangerously-bypass-approvals-and-sandbox, or any equivalent.
const ENGINES = {
  claude: {
    label: 'Claude', vendor: 'Anthropic',
    bin: process.env.LAB_CLAUDE || '/home/tao/.local/bin/claude',
    strength: 'architecture, long-context reasoning, writing',
    args: (prompt, o) => {
      const a = ['-p', prompt, '--output-format', 'text'];
      if (o.model) a.push('--model', o.model);
      return a;
    }
  },
  codex: {
    label: 'Codex', vendor: 'OpenAI',
    bin: process.env.LAB_CODEX || 'codex',
    strength: 'precise code edits, refactors, writing tests',
    // Codex prints an event stream; --output-last-message gives us the clean answer.
    args: (prompt, o) => {
      const a = ['exec', '--skip-git-repo-check', '--color', 'never',
                 '-s', o.write ? 'workspace-write' : 'read-only'];
      if (o.cwd) a.push('-C', o.cwd);
      if (o.model) a.push('-m', o.model);
      if (o.lastMessageFile) a.push('-o', o.lastMessageFile);
      a.push(prompt);
      return a;
    },
    usesLastMessageFile: true
  },
  gemini: {
    label: 'Gemini', vendor: 'Google',
    bin: process.env.LAB_GEMINI || 'gemini',
    strength: 'very large context, cross-file sweeps, second opinions',
    // --skip-trust: headless runs have no way to answer the trusted-folder
    // prompt, and the only directory we ever hand it is our own clone.
    args: (prompt, o) => {
      const a = ['-p', prompt, '-o', 'text', '--skip-trust',
                 '--approval-mode', o.write ? 'auto_edit' : 'plan'];
      if (o.model) a.push('-m', o.model);
      return a;
    }
  }
};

// ---- the data boundary -------------------------------------------------
// Named rules so a refusal can say WHICH line it crossed. A silent "no" teaches
// nobody anything; a named one tells you what to take out of the prompt.
const BOUNDARY = [
  ['an alarm or gate code',      /\b(alarm|gate|safe|door)\s*(code|pin|combination)\b/i],
  ['a password or passphrase',   /\b(password|passphrase|passcode|secret\s*key)\b/i],
  ['an API key or token',        /\b(sk-[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,})\b/],
  ['a SA ID number',             /\b\d{6}[0-5]\d{3}[01]\d{2}\b/],
  ['a bank or card number',      /\b(?:\d[ -]?){13,19}\b/],
  ['a South African phone number', /\b(?:\+27|0)\s?[1-8]\d(?:[\s-]?\d){7}\b/],
  ['a household money figure',   /\bR\s?\d[\d ,.]{3,}\b/],
  ['the house registry',         /\bhouse_(providers|bills|debts|contacts|facts|assets)\b/i]
];

// Throws if the prompt would carry household data to a third party.
function guard(prompt) {
  const hit = BOUNDARY.find(([, re]) => re.test(prompt));
  if (hit) {
    const err = new Error(
      `refused: the prompt contains what looks like ${hit[0]}. ` +
      `Engines are third-party services — house data does not leave the LAN. ` +
      `Describe the shape of the data instead of the data itself.`);
    err.code = 'BOUNDARY';
    err.rule = hit[0];
    throw err;
  }
  return prompt;
}

// ---- availability ------------------------------------------------------
// An engine is only usable if its binary exists AND it is signed in. We cache
// briefly so the Admin page can poll without spawning processes constantly.
let cache = { at: 0, val: null };

function run(bin, args, { timeout = 15000, cwd } = {}) {
  return new Promise(resolve => {
    let child;
    try { child = spawn(bin, args, { cwd, env: process.env }); }
    catch (e) { return resolve({ code: -1, out: '', err: e.message }); }
    let out = '', err = '';
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, timeout);
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('error', e => { clearTimeout(t); resolve({ code: -1, out, err: e.message }); });
    child.on('close', code => { clearTimeout(t); resolve({ code, out: out.trim(), err: err.trim() }); });
  });
}

async function probe(name) {
  const e = ENGINES[name];
  if (!e) return { name, ok: false, reason: 'unknown engine' };
  const ver = await run(e.bin, ['--version']);
  if (ver.code !== 0) return { name, label: e.label, vendor: e.vendor, ok: false, installed: false, reason: 'not installed' };
  const version = (ver.out || '').split('\n')[0].trim();

  // Signed in? Each CLI reports this differently.
  let signedIn = false, who = null, reason = null;
  if (name === 'codex') {
    const s = await run(e.bin, ['login', 'status']);
    signedIn = s.code === 0 && !/not logged in/i.test(s.out + s.err);
    who = signedIn ? (s.out.split('\n').find(l => /@|account|plan/i.test(l)) || '').trim() || null : null;
    if (!signedIn) reason = 'run: codex login --device-auth';
  } else if (name === 'gemini') {
    const home = process.env.HOME || '/home/tao';
    signedIn = fs.existsSync(path.join(home, '.gemini', 'oauth_creds.json'))
            || fs.existsSync(path.join(home, '.gemini', 'google_accounts.json'))
            || !!process.env.GEMINI_API_KEY;
    if (!signedIn) reason = 'run: gemini  (pick "Login with Google" once)';
  } else if (name === 'claude') {
    const home = process.env.HOME || '/home/tao';
    signedIn = fs.existsSync(path.join(home, '.claude', '.credentials.json'))
            || fs.existsSync(path.join(home, '.claude.json'))
            || !!process.env.ANTHROPIC_API_KEY;
    if (!signedIn) reason = 'run: claude  (sign in once)';
  }
  return { name, label: e.label, vendor: e.vendor, strength: e.strength,
           ok: signedIn, installed: true, version, who, reason };
}

async function health({ fresh = false } = {}) {
  if (!fresh && cache.val && Date.now() - cache.at < 30000) return cache.val;
  const val = await Promise.all(Object.keys(ENGINES).map(probe));
  cache = { at: Date.now(), val };
  return val;
}

async function available() {
  return (await health()).filter(e => e.ok).map(e => e.name);
}

// Route a role to the engine best suited to it, falling back to whatever is
// actually signed in. Never throws for a missing favourite.
const ROLES = {
  architect: ['claude', 'gemini', 'codex'],
  coder:     ['codex', 'claude', 'gemini'],
  reviewer:  ['gemini', 'codex', 'claude'],
  sweeper:   ['gemini', 'claude', 'codex'],
  writer:    ['claude', 'gemini', 'codex']
};
async function pick(role = 'coder') {
  const up = await available();
  const order = ROLES[role] || ROLES.coder;
  return order.find(n => up.includes(n)) || up[0] || null;
}

// ---- jobs --------------------------------------------------------------
const jobs = new Map();      // id -> job record (live)
let running = 0;
const HISTORY = 200;

function trim() {
  const done = [...jobs.values()].filter(j => j.status !== 'running')
    .sort((a, b) => a.started - b.started);
  while (done.length > HISTORY) jobs.delete(done.shift().id);
}

function summary(j) {
  const { id, engine, role, brief, status, started, ended, ms, cwd, write, error, rule } = j;
  return { id, engine, role, brief, status, started, ended, ms, cwd, write, error, rule,
           chars: j.out ? j.out.length : 0 };
}

// The single entry point. Returns a job record once the engine has finished.
async function ask(prompt, opts = {}) {
  const {
    engine: want, role = 'coder', timeout = DEFAULT_TIMEOUT,
    write = false, cwd = null, model = null, actor = 'system', brief = null
  } = opts;

  guard(prompt);                                    // data boundary first

  const engine = want || await pick(role);
  if (!engine) { const e = new Error('no engine is signed in'); e.code = 'NO_ENGINE'; throw e; }
  const def = ENGINES[engine];
  if (!def) throw new Error(`unknown engine: ${engine}`);

  // Writing is only ever allowed inside the workspace clone. The live manager
  // is not a scratch pad.
  let dir = cwd || (write ? WORKSPACE : WORKSPACE);
  if (write) {
    const resolved = path.resolve(dir);
    if (!resolved.startsWith(path.resolve(WORKSPACE))) {
      const e = new Error(`refused: engines may only write inside ${WORKSPACE}`);
      e.code = 'SANDBOX'; throw e;
    }
    if (!fs.existsSync(resolved)) {
      const e = new Error(`workspace missing: ${resolved}`); e.code = 'SANDBOX'; throw e;
    }
  }
  if (!fs.existsSync(dir)) dir = '/srv/lab/manager';

  if (running >= MAX_CONCURRENT) {
    const e = new Error(`busy: ${running} engine jobs already running`); e.code = 'BUSY'; throw e;
  }

  const job = {
    id: uid(), engine, role, brief: brief || prompt.slice(0, 120),
    status: 'running', started: Date.now(), ended: null, ms: 0,
    cwd: dir, write: !!write, out: '', err: '', error: null, actor
  };
  jobs.set(job.id, job);
  running++;

  const lastMessageFile = def.usesLastMessageFile
    ? path.join(os.tmpdir(), `lab-engine-${job.id}.txt`) : null;
  const args = def.args(prompt, { write, cwd: dir, model, lastMessageFile });
  const t = Math.min(Number(timeout) || DEFAULT_TIMEOUT, MAX_TIMEOUT);

  const res = await run(def.bin, args, { timeout: t, cwd: dir });

  // Prefer the clean last-message file when the engine writes one.
  let text = res.out;
  if (lastMessageFile) {
    try {
      if (fs.existsSync(lastMessageFile)) {
        text = fs.readFileSync(lastMessageFile, 'utf8').trim() || res.out;
        fs.unlinkSync(lastMessageFile);
      }
    } catch {}
  }

  job.ended = Date.now();
  job.ms = job.ended - job.started;
  job.out = (text || '').trim();
  job.err = (res.err || '').slice(0, 4000);
  job.status = job.out ? 'done' : 'failed';
  if (!job.out) job.error = job.err.split('\n').slice(-3).join(' ').trim() || `exit ${res.code}`;
  running--;
  trim();

  db.audit(actor, 'engine.ask', {
    engine, role, ms: job.ms, status: job.status, write: !!write,
    brief: job.brief, chars: job.out.length, error: job.error
  });

  if (job.status === 'failed') { const e = new Error(job.error); e.job = summary(job); throw e; }
  return job;
}

// Convenience: just the text.
async function text(prompt, opts = {}) { return (await ask(prompt, opts)).out; }

// ---- panel: ask everyone, keep the disagreement -------------------------
// One model in a loop converges on its own taste. Three of them don't.
async function panel(prompt, opts = {}) {
  guard(prompt);
  const up = await available();
  if (!up.length) { const e = new Error('no engine is signed in'); e.code = 'NO_ENGINE'; throw e; }
  // Respect the concurrency cap by running in pairs.
  const out = [];
  for (let i = 0; i < up.length; i += MAX_CONCURRENT) {
    const slice = up.slice(i, i + MAX_CONCURRENT);
    const got = await Promise.all(slice.map(engine =>
      ask(prompt, { ...opts, engine }).then(j => ({ engine, ok: true, ms: j.ms, answer: j.out }))
        .catch(e => ({ engine, ok: false, error: e.message }))));
    out.push(...got);
  }
  return out;
}

// ---- review: make them mark each other's work ---------------------------
// A proposes, the others critique, A revises with the critique in hand.
async function review(task, opts = {}) {
  guard(task);
  const up = await available();
  if (up.length < 2) {
    const one = await ask(task, opts);
    return { drafted_by: one.engine, reviewers: [], critiques: [],
             final: one.out, note: 'only one engine signed in — no review performed' };
  }
  const author = opts.engine || await pick(opts.role || 'coder');
  const draft = await ask(task, { ...opts, engine: author });

  const reviewers = up.filter(n => n !== author);
  const critiquePrompt =
`You are reviewing another engineer's proposal. Be specific and short.
List only real problems: things that are wrong, unsafe, over-engineered, or that
do not actually do what was asked. If it is good, say so in one line.

THE TASK
${task}

THE PROPOSAL
${draft.out}`;

  const critiques = [];
  for (const engine of reviewers) {
    try { const c = await ask(critiquePrompt, { ...opts, engine, write: false, role: 'reviewer' });
          critiques.push({ engine, critique: c.out }); }
    catch (e) { critiques.push({ engine, error: e.message }); }
  }

  const usable = critiques.filter(c => c.critique);
  if (!usable.length) return { drafted_by: author, reviewers, critiques, final: draft.out };

  const revisePrompt =
`Here is your proposal and the reviews it received. Produce the final version.
Take the valid criticism, ignore the wrong criticism, and do not pad it out.
Return only the final answer — no preamble about what you changed.

THE TASK
${task}

YOUR PROPOSAL
${draft.out}

REVIEWS
${usable.map(c => `--- ${c.engine} ---\n${c.critique}`).join('\n\n')}`;

  const final = await ask(revisePrompt, { ...opts, engine: author });
  return { drafted_by: author, reviewers, draft: draft.out, critiques, final: final.out };
}

const list = () => [...jobs.values()].sort((a, b) => b.started - a.started).map(summary);
const get = id => jobs.get(id) || null;

module.exports = {
  ENGINES, WORKSPACE, ask, text, panel, review, health, available, pick,
  list, get, guard, BOUNDARY: BOUNDARY.map(([n]) => n)
};
