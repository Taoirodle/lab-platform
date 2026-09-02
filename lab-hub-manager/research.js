// ============================================================
//  L.A.B — Research Agents
//  Silent agents that periodically (and on demand) reason about how to make
//  the platform materially better, grounded in the ledgers, and file research
//  logs the build team reads before building. For Beta this reasons with the
//  on-server brain; live internet-scouring + user-data harvesting is a
//  deliberate, admin-gated next step (privacy call), not done unsupervised.
// ============================================================
const { spawn } = require('child_process');
const db = require('./db');
const ledgers = require('./ledgers');

const CLAUDE = process.env.LAB_CLAUDE || '/home/tao/.local/bin/claude';

function askClaude(prompt, timeout = 160000) {
  return new Promise((resolve, reject) => {
    let child; try { child = spawn(CLAUDE, ['-p', prompt, '--output-format', 'text'], { cwd: '/srv/lab/manager' }); } catch (e) { return reject(e); }
    let out = '', err = ''; const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} reject(new Error('timeout')); }, timeout);
    child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d);
    child.on('error', e => { clearTimeout(t); reject(e); });
    child.on('close', () => { clearTimeout(t); out.trim() ? resolve(out.trim()) : reject(new Error(err.trim() || 'no output')); });
  });
}
function parseJSON(text) { const c = text.replace(/```json/gi, '').replace(/```/g, '').trim(); const s = c.indexOf('{'), e = c.lastIndexOf('}'); if (s === -1) throw new Error('no json'); return JSON.parse(c.slice(s, e + 1)); }

const TOPICS = [
  'experimental Hub widgets the family would actually keep',
  'ways to make the AI dev team ship bigger, safer changes autonomously',
  'how open-source projects could be adapted into deeper L.A.B features',
  'smart-home automations worth building next',
  'making the analytics genuinely insightful, not just charts'
];

async function run(topic) {
  const t = topic || TOPICS[Math.floor((Date.now() / 3.6e6) % TOPICS.length)] || TOPICS[0];
  const team = await ledgers.digest('team').catch(() => '');
  const client = await ledgers.read('client', { kind: 'signal', limit: 10 }).then(r => r.map(x => x.key).join(', ')).catch(() => '');
  const prompt =
`You are a research agent for L.A.B, a self-hosted family platform. Research the topic below and produce a crisp, ACTIONABLE research log the build team can pull from — concrete ideas, not fluff. You may reason from first principles and general knowledge; do not claim to have browsed live sites.

Topic: ${t}
Team ledger:\n${team.slice(0, 700)}
What the family uses: ${client || '(little yet)'}

Return ONLY JSON:
{"topic":"${t.replace(/"/g, "'")}",
 "findings":[{"idea":"concrete thing to build/try","why":"why it helps","effort":"S|M|L","novelty":1-10}],
 "recommendation":"the single most promising thing to build next"}`;
  const out = parseJSON(await askClaude(prompt));
  const findings = { items: (out.findings || []).slice(0, 6), recommendation: String(out.recommendation || '').slice(0, 300) };
  await db.pool.query('INSERT INTO research_logs(agent,topic,findings) VALUES($1,$2,$3)', ['research', String(out.topic || t).slice(0, 160), JSON.stringify(findings)]);
  // seed a team plan from the recommendation so builds trace to research
  if (findings.recommendation) await ledgers.write('team', { kind: 'plan', key: 'research:' + t.slice(0, 30).toLowerCase().replace(/\W+/g, '-'), value: { text: findings.recommendation }, weight: 4, source: 'agent' }).catch(() => {});
  return { ok: true, topic: out.topic || t, count: findings.items.length, recommendation: findings.recommendation };
}

const list = () => db.pool.query('SELECT id,agent,topic,findings,applied,created_at FROM research_logs ORDER BY created_at DESC LIMIT 60').then(r => r.rows);

module.exports = { run, list, TOPICS };
