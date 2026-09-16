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
    //
    // network_access=true is not laziness. Ubuntu 24.04 blocks unprivileged
    // user namespaces via AppArmor, so bubblewrap cannot build the network
    // namespace and the whole sandbox fails to start with
    //   bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted
    // Leaving the network shared skips that step and keeps the part that
    // actually protects this server: the filesystem confinement. The
    // alternative was turning off a kernel hardening flag on the family's
    // machine, which is a worse trade for a smaller gain.
    args: (prompt, o) => {
      const a = ['exec', '--skip-git-repo-check', '--color', 'never',
                 '-c', 'sandbox_workspace_write.network_access=true',
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

// ---- file context ------------------------------------------------------
// Ubuntu 24.04 blocks the unprivileged user namespaces that Codex's sandbox
// needs to shell out, so an engine cannot always read files for itself. It
// does not need to: the Manager already has the filesystem. We read the files
// and hand them over in the prompt, which is faster, cheaper, and auditable —
// we know exactly what left the house because we assembled it.
const FILE_CAP = 200000;          // total bytes of attached source
const FILE_MAX = 12;              // how many files one prompt may carry
const CODE_EXT = /\.(js|mjs|cjs|ts|json|md|html|css|toml|rs|sh|yml|yaml|sql|py)$/i;

function readContext(paths, root = WORKSPACE) {
  const taken = [], skipped = [];
  let budget = FILE_CAP;
  for (const raw of (paths || []).slice(0, FILE_MAX)) {
    const rel = String(raw).replace(/^[./]+/, '');
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(path.resolve(root))) { skipped.push([rel, 'outside the workspace']); continue; }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) { skipped.push([rel, 'not found']); continue; }
    const size = fs.statSync(abs).size;
    if (size > budget) { skipped.push([rel, `too large (${Math.round(size / 1024)}KB)`]); continue; }
    let body;
    try { body = fs.readFileSync(abs, 'utf8'); } catch (e) { skipped.push([rel, e.code || 'unreadable']); continue; }
    budget -= size;
    taken.push({ rel, body });
  }
  return { taken, skipped };
}

// Pull plausible repo paths out of a prompt so "look at presence.js" just works.
function mentionedFiles(prompt, root = WORKSPACE) {
  const out = new Set();
  for (const m of String(prompt).matchAll(/[\w][\w./-]*\.[A-Za-z]{1,5}\b/g)) {
    const tok = m[0].replace(/^[./]+/, '');
    if (!CODE_EXT.test(tok)) continue;
    const abs = path.resolve(root, tok);
    if (abs.startsWith(path.resolve(root)) && fs.existsSync(abs) && fs.statSync(abs).isFile()) out.add(tok);
  }
  return [...out].slice(0, FILE_MAX);
}

function withContext(prompt, files) {
  if (!files.length) return prompt;
  const blocks = files.map(f => `--- ${f.rel} ---\n${f.body}`).join('\n\n');
  return `${prompt}\n\n` +
    `The files below are attached in full — you do not need to read them from disk.\n\n${blocks}`;
}

// Applied to attached source rather than typed text: live credentials only.
const SECRET_IN_FILE = [
  ['an API key',        /\b(sk-[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/],
  ['a private key',     /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['an assigned password', /\b(password|passwd|secret)\s*[:=]\s*["'][^"']{6,}["']/i]
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

// stdin is 'ignore', not a pipe. Codex sees an open stdin pipe as "there is
// more prompt coming" and blocks forever waiting for it — every job looked
// like a timeout until we closed the tap.
function run(bin, args, { timeout = 15000, cwd } = {}) {
  return new Promise(resolve => {
    let child;
    try { child = spawn(bin, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { return resolve({ code: -1, out: '', err: e.message }); }
    let out = '', err = '';
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, timeout);
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('error', e => { clearTimeout(t); resolve({ code: -1, out, err: e.message }); });
    child.on('close', code => { clearTimeout(t); resolve({ code, out: out.trim(), err: err.trim() }); });
  });
}

// Liveness, learned rather than assumed. Credential files on disk prove
// nothing: Gemini's OAuth wrote a perfectly good oauth_creds.json and then the
// service refused the account anyway ("no longer supported for Gemini Code
// Assist for individuals"). So an engine is only "ok" once it has actually
// answered something, and a real job failing on auth marks it dead again.
const LIVE_TTL = 15 * 60000;
const live = {};   // name -> { ok, at, reason }

// Turn a CLI's failure text into something a human can act on.
function readFailure(name, text) {
  const t = String(text || '');
  if (/IneligibleTier|no longer supported for Gemini Code Assist/i.test(t))
    return 'Google has dropped Code Assist for individual accounts on this CLI — needs a GEMINI_API_KEY from aistudio.google.com/apikey';
  if (/not logged in|Please (sign|log) in|unauthor|401|invalid[_ ]api[_ ]key/i.test(t))
    return name === 'codex' ? 'run: codex login --device-auth'
         : name === 'gemini' ? 'no valid credentials — set GEMINI_API_KEY'
         : 'run: claude  (sign in once)';
  if (/Please set an Auth method|GEMINI_API_KEY/i.test(t))
    return 'no auth method set — put GEMINI_API_KEY in ~/.gemini/.env';
  if (/quota|rate.?limit|429|exhausted/i.test(t)) return 'quota or rate limit reached';
  return t.split('\n').map(s => s.trim()).filter(Boolean).pop() || 'did not answer';
}

// Record what a real invocation told us about an engine.
function noteResult(name, ok, text) {
  live[name] = { ok, at: Date.now(), reason: ok ? null : readFailure(name, text) };
}

async function liveness(name, bin) {
  const cached = live[name];
  if (cached && Date.now() - cached.at < LIVE_TTL) return cached;
  const e = ENGINES[name];
  const args = e.args('Reply with exactly: OK', { write: false, cwd: null, model: null, lastMessageFile: null });
  // Codex takes ~30-60s even for a trivial prompt — 45s was killing healthy engines.
  const r = await run(bin, args, { timeout: 120000, cwd: '/srv/lab/manager' });
  const ok = r.code === 0 && /\bOK\b/i.test(`${r.out}\n${r.err}`);
  noteResult(name, ok, r.err || r.out);
  return live[name];
}

async function probe(name, { deep = false } = {}) {
  const e = ENGINES[name];
  if (!e) return { name, ok: false, reason: 'unknown engine' };
  const ver = await run(e.bin, ['--version']);
  if (ver.code !== 0)
    return { name, label: e.label, vendor: e.vendor, ok: false, installed: false, reason: 'not installed' };
  const version = (ver.out || '').split('\n')[0].trim();

  // Cheap check first: is there anything that could count as a credential?
  const home = process.env.HOME || '/home/tao';
  const hasCreds =
    // codex reports login state on stderr, not stdout — read both.
    name === 'codex'  ? await (async () => { const s = await run(e.bin, ['login', 'status']);
                                             const txt = `${s.out}\n${s.err}`.trim();
                                             return !!txt && !/not logged in/i.test(txt); })()
  : name === 'gemini' ? (!!process.env.GEMINI_API_KEY
                         || fs.existsSync(path.join(home, '.gemini', '.env'))
                         || fs.existsSync(path.join(home, '.gemini', 'oauth_creds.json')))
  : /* claude */        (!!process.env.ANTHROPIC_API_KEY
                         || fs.existsSync(path.join(home, '.claude', '.credentials.json'))
                         || fs.existsSync(path.join(home, '.claude.json')));

  if (!hasCreds) {
    const reason = name === 'codex' ? 'run: codex login --device-auth'
                 : name === 'gemini' ? 'set GEMINI_API_KEY in ~/.gemini/.env'
                 : 'run: claude  (sign in once)';
    return { name, label: e.label, vendor: e.vendor, strength: e.strength,
             ok: false, installed: true, version, reason };
  }

  // Credentials exist — but do they work? Use what we last learned, and only
  // spend a real call when that knowledge has gone stale or was asked for.
  let state = live[name];
  if (deep || !state || Date.now() - state.at >= LIVE_TTL) state = await liveness(name, e.bin);

  return { name, label: e.label, vendor: e.vendor, strength: e.strength,
           ok: !!state.ok, installed: true, version,
           checked: state.at, reason: state.ok ? null : state.reason };
}

async function health({ fresh = false } = {}) {
  if (!fresh && cache.val && Date.now() - cache.at < 30000) return cache.val;
  const names = Object.keys(ENGINES);
  const val = [];
  for (const n of names) val.push(await probe(n, { deep: fresh }));  // serial: liveness spawns real CLIs
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
  const { id, engine, role, brief, status, started, ended, ms, cwd, write, error, rule, attached, skipped } = j;
  return { id, engine, role, brief, status, started, ended, ms, cwd, write, error, rule, attached, skipped,
           chars: j.out ? j.out.length : 0 };
}

// The single entry point. Returns a job record once the engine has finished.
async function ask(prompt, opts = {}) {
  const {
    engine: want, role = 'coder', timeout = DEFAULT_TIMEOUT,
    write = false, cwd = null, model = null, actor = 'system', brief = null,
    files = null, attach = true
  } = opts;

  guard(prompt);                                    // data boundary first

  // Attach source. The strict boundary above applies to what a human typed;
  // attached files get the narrower credential check instead, because the
  // workspace is a clone of a public repo — refusing it for containing the
  // string "house_bills" would make the feature useless.
  const wanted = files || (attach ? mentionedFiles(prompt) : []);
  const { taken, skipped } = readContext(wanted);
  for (const f of taken) {
    const leak = SECRET_IN_FILE.find(([, re]) => re.test(f.body));
    if (leak) {
      const e = new Error(`refused: ${f.rel} contains ${leak[0]}`);
      e.code = 'BOUNDARY'; e.rule = leak[0]; throw e;
    }
  }
  const finalPrompt = withContext(prompt, taken);

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
    cwd: dir, write: !!write, out: '', err: '', error: null, actor,
    attached: taken.map(f => f.rel), skipped: skipped.map(([p, why]) => `${p}: ${why}`)
  };
  jobs.set(job.id, job);
  running++;

  const lastMessageFile = def.usesLastMessageFile
    ? path.join(os.tmpdir(), `lab-engine-${job.id}.txt`) : null;
  const args = def.args(finalPrompt, { write, cwd: dir, model, lastMessageFile });
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
  if (!job.out) job.error = readFailure(engine, job.err || `exit ${res.code}`);
  // A real job is better evidence than any probe — let it correct the record.
  noteResult(engine, job.status === 'done', job.err);
  cache = { at: 0, val: null };
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
