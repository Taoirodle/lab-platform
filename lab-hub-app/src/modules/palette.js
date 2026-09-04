// ============================================================
//  L.A.B Hub — command palette (Ctrl/Cmd+K). Jump to a page, run a scene,
//  or type anything else and The Sauce answers right there.
// ============================================================
(() => {
const J = { 'Content-Type': 'application/json' };
let box = null, items = [], sel = 0, scenes = [];
function ensure() {
  if (box) return box;
  box = LAB.el('div', 'palette'); box.hidden = true;
  box.innerHTML = '<div class="pbox"><input id="p-in" placeholder="Go to a page, run a scene, or ask The Sauce…" autocomplete="off"><div id="p-list"></div></div>';
  document.body.appendChild(box);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  const inp = box.querySelector('#p-in');
  inp.addEventListener('input', () => { sel = 0; paint(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[sel]); }
    else if (e.key === 'Escape') close();
  });
  return box;
}
function open() { ensure(); box.hidden = false; const i = box.querySelector('#p-in'); i.value = ''; sel = 0; paint(); setTimeout(() => i.focus(), 10); LAB.api('/api/conductor/scenes').then(s => { scenes = s || []; paint(); }).catch(() => {}); }
function close() { if (box) box.hidden = true; }
function paint() {
  const q = box.querySelector('#p-in').value.trim().toLowerCase();
  const pages = LAB.visiblePages().map(p => ({ kind: 'page', label: p.dynLabel ? p.dynLabel(LAB.ctx) : p.label, hint: 'Go to', id: p.id }));
  const sc = scenes.map(s => ({ kind: 'scene', label: s.name, hint: 'Run scene', id: s.id }));
  const hit = x => !q || x.label.toLowerCase().includes(q);
  items = pages.filter(hit).concat(sc.filter(hit));
  if (q) items.push({ kind: 'sauce', label: q, hint: 'Ask The Sauce' });
  if (sel >= items.length) sel = Math.max(0, items.length - 1);
  box.querySelector('#p-list').innerHTML = items.map((it, i) => `<div class="pitem ${i === sel ? 'on' : ''}" data-i="${i}"><span>${LAB.esc(it.label)}</span><em>${it.hint}</em></div>`).join('') || '<div class="pitem muted">Nothing matches.</div>';
  box.querySelectorAll('.pitem[data-i]').forEach(d => d.onclick = () => run(items[+d.dataset.i]));
}
async function run(it) {
  if (!it) return;
  if (it.kind === 'page') { close(); LAB.go(it.id); return; }
  if (it.kind === 'scene') { close(); LAB.api('/api/conductor/scenes/' + encodeURIComponent(it.id) + '/run', { method: 'POST', headers: J, body: '{}' }).catch(() => {}); return; }
  const list = box.querySelector('#p-list'); list.innerHTML = '<div class="pitem muted">…</div>';
  try {
    const r = await LAB.api('/api/sauce/ask', { method: 'POST', headers: J, body: JSON.stringify({ account_id: LAB.ctx.me && LAB.ctx.me.id, name: LAB.ctx.me && LAB.ctx.me.name, message: it.label, history: [] }) });
    list.innerHTML = `<div class="pitem answer">${LAB.esc(r.reply).replace(/\n/g, '<br>')}${r.did && r.did.length ? `<div class="msg did">⚡ ${r.did.map(LAB.esc).join(' · ')}</div>` : ''}</div>`;
  } catch (e) { list.innerHTML = `<div class="pitem muted">${LAB.esc(e.message)}</div>`; }
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (box && !box.hidden) close(); else open(); }
});
LAB.palette = { open, close };
})();
