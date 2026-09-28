// ============================================================
//  One queue for every question the Manager asks Claude.
//  Each ask starts a real CLI process on a laptop with 8 GB. The Sauce, the
//  setup wizard, the dev team, the ledgers and research each used to start
//  them freely, so a burst of chat plus a scheduled standup could stack up a
//  handful at once. Now: two at a time, background work gets at most one of
//  them, and a person waiting (the Sauce, the wizard) always goes first.
//  (The Workshop's coding engines keep their own cap in engines.js.)
// ============================================================
const { spawn } = require('child_process');

const CLAUDE = process.env.LAB_CLAUDE || '/home/tao/.local/bin/claude';
const MAX = 2, MAX_BACKGROUND = 1;

let running = 0, runningBg = 0;
const queue = [];                                  // { bg, go }, people before background
const canStart = bg => running < MAX && (!bg || runningBg < MAX_BACKGROUND);
const take = bg => { running++; if (bg) runningBg++; };
function pump() {
  for (let i = 0; i < queue.length; i++) {
    if (!canStart(queue[i].bg)) continue;
    const q = queue.splice(i--, 1)[0]; take(q.bg); q.go();
  }
}
function slot(bg) {
  if (canStart(bg) && !queue.some(q => !q.bg || bg)) { take(bg); return Promise.resolve(); }
  return new Promise(go => { queue.push({ bg, go }); queue.sort((a, b) => a.bg - b.bg); });
}
function release(bg) { running--; if (bg) runningBg--; pump(); }

// The CLI's own sign-in lapses from time to time. When it does, every answer is
// the same error text, so it is caught here once — callers get an AUTH error
// instead of that text as a "reply", and the Admin's health pills can say so.
const SIGNED_OUT = /failed to authenticate|oauth (session|token) (has )?expired|please run \/login|not logged in|invalid api key/i;
let auth = { ok: null, at: null, detail: null };      // null = not asked since the Manager started

function run(prompt, timeout) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(CLAUDE, ['-p', prompt, '--output-format', 'text'], { cwd: '/srv/lab/manager' }); }
    catch (e) { return reject(e); }
    let out = '', err = '';
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} reject(new Error('timeout')); }, timeout);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => { clearTimeout(t); reject(e); });
    child.on('close', code => {
      clearTimeout(t);
      const text = out.trim(), why = (text || err.trim()).slice(0, 300);
      if (SIGNED_OUT.test(why)) {
        auth = { ok: false, at: new Date().toISOString(), detail: why };
        return reject(Object.assign(new Error('The server\'s Claude sign-in has expired.'), { code: 'AUTH' }));
      }
      if (code !== 0 || !text) return reject(new Error(why || 'no output'));   // a failed run's text is not an answer
      auth = { ok: true, at: new Date().toISOString(), detail: null };
      resolve(text);
    });
  });
}

/// Ask once. `background` work (dev team, ledgers, research) never takes the
/// last free slot from a person. The timeout covers the run, not the wait.
async function ask(prompt, { timeout = 150000, background = false } = {}) {
  await slot(background);
  try { return await run(prompt, timeout); } finally { release(background); }
}

module.exports = { ask, CLAUDE, stats: () => ({ running, background: runningBg, waiting: queue.length, auth }) };
