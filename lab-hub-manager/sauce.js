// ============================================================
//  The Sauce — the household AI assistant (now AGENTIC)
//  It doesn't just talk: it can act on the home through a small, SAFE set of
//  tools — switch a room, run a scene, add to the shared to-do or calendar.
//  The brain returns {reply, actions[]}; the server validates every action
//  against a fixed schema and executes it. Anything outside the home (ordering
//  food, spending money) is refused honestly — the plumbing exists, but a human
//  pulls that trigger.
// ============================================================
const { spawn } = require('child_process');

const CLAUDE = process.env.LAB_CLAUDE || '/home/tao/.local/bin/claude';

function askClaude(prompt, timeout = 90000) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(CLAUDE, ['-p', prompt, '--output-format', 'text'], { cwd: '/srv/lab/manager' }); }
    catch (e) { return reject(e); }
    let out = '', err = '';
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} reject(new Error('timeout')); }, timeout);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
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

const PERSONA =
`You are "The Sauce", the AI that runs the Volkwyn family's home platform (L.A.B) from their own private server. Warm, upbeat, concise (1-3 sentences), lightly witty — never corny.`;

function toolDoc(house) {
  const ev = (house.events || []).slice(0, 14).map(e => `${e.day}${e.at_time ? ' ' + e.at_time : ''} ${e.title}${e.source === 'family' ? '' : ' (' + (e.feed || 'linked') + ')'}`).join('; ');
  const todos = (house.todos || []).slice(0, 12).map(t => t.text).join('; ');
  return `You can ACT on the home. Only act on what the person actually asked for.
Available scenes: ${(house.scenes || []).map(s => s.name).join(', ') || '(none)'}
Rooms: ${(house.rooms || []).map(r => `${r.id} (${r.on ? 'on' : 'off'})`).join(', ') || '(none)'}
Devices by name: ${(house.devices || []).map(d => `${d.name} [${d.room}, ${d.on ? 'on' : 'off'}]`).join('; ') || '(none)'}
Calendar (today + tomorrow, real): ${ev || '(nothing on)'}
Open family to-dos (real): ${todos || '(list is clear)'}

Actions you may emit in "actions":
- {"tool":"scene","name":"<scene>"}            run a saved scene (e.g. movie-night, all-off)
- {"tool":"light","room":"<room id>","on":true|false}   switch one room's lights
- {"tool":"device","name":"<device name>","on":true|false}   switch one named device (strip, lamp, plug)
- {"tool":"todo","text":"<short>"}             add to the shared family to-do
- {"tool":"todo_done","text":"<words from an open to-do>"}   tick an open to-do off
- {"tool":"event","title":"<short>","day":"YYYY-MM-DD","time":"HH:MM" optional}  add to the shared family calendar

Rules: emit an action ONLY when the person clearly asked for it. When asked what's on or what's left, answer from the real calendar and list above — never invent events or items. If they ask for something outside the home (order food, buy something, spend money, message someone), do NOT invent an action — say that ability is being wired up and offer what you CAN do (a plan, a list). Never claim you did something you didn't emit an action for. Today is ${house.today || new Date().toISOString().slice(0, 10)}${house.now ? ', local time ' + house.now : ''}.`;
}

async function ask({ name, message, history, house = {} }) {
  if (!message || !String(message).trim()) return { reply: "I'm here — what do you need?", actions: [] };
  const convo = (history || []).slice(-6).map(m => `${m.role === 'user' ? (name || 'They') : 'The Sauce'}: ${String(m.text || '').slice(0, 700)}`).join('\n');
  const prompt =
`${PERSONA}
You're speaking with ${name || 'someone in the family'}.

${toolDoc(house)}

${convo ? 'Conversation so far:\n' + convo + '\n' : ''}${name || 'They'}: ${String(message).slice(0, 1500)}

Reply, and act if asked. Return ONLY JSON:
{"reply":"<what you say, 1-3 sentences, plain>","actions":[ ... ]}`;
  try {
    const out = parseJSON(await askClaude(prompt));
    return { reply: String(out.reply || '').replace(/^"|"$/g, '').trim() || 'Done.', actions: Array.isArray(out.actions) ? out.actions.slice(0, 5) : [] };
  } catch (e) {
    // Fall back to a plain reply if the JSON contract slips.
    try { const r = await askClaude(`${PERSONA}\n${name || 'They'}: ${message}\nReply in 1-2 plain sentences:`); return { reply: r, actions: [] }; }
    catch { return { reply: "My brain's a bit busy — try me again in a moment.", actions: [] }; }
  }
}

module.exports = { ask };
