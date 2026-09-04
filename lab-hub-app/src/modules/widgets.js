// ============================================================
//  L.A.B Hub — widgets. The Dashboard is a grid of these. A widget is a module:
//    { id, title, size:'sm'|'md'|'lg', native?:bool, render(el, ctx) }
//  Built-ins register below. AI-generated ones from your server's builders are
//  wrapped by fromGeneration() — structured payloads rendered by trusted
//  templates, never raw HTML. The App Store adds/removes by id; layout is
//  saved per install.
// ============================================================
LAB.widgets = {
  list: [],
  DEFAULT: ['machine', 'usage', 'todos', 'today', 'house', 'sauce', 'foryou'],
  register(w) { const i = this.list.findIndex(x => x.id === w.id); if (i >= 0) this.list[i] = w; else this.list.push(w); },
  get(id) { return this.list.find(w => w.id === id); },
  installed() { const s = LAB.store.get('widgets'); return Array.isArray(s) ? s : this.DEFAULT.slice(); },
  save(ids) { LAB.store.set('widgets', ids); },
  add(id) { const ids = this.installed(); if (!ids.includes(id)) { ids.push(id); this.save(ids); } },
  remove(id) { this.save(this.installed().filter(x => x !== id)); },
  has(id) { return this.installed().includes(id); },
  move(id, dir) { const ids = this.installed(), i = ids.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= ids.length) return; ids.splice(i, 1); ids.splice(j, 0, id); this.save(ids); },
  usable() { return this.list.filter(w => !w.native || LAB.isNative()); },

  fromGeneration(g) {
    const p = g.payload || {}, items = (p.items || []).map(x => String(x)).slice(0, 8), id = 'gen:' + g.id;
    const accent = /^#[0-9a-f]{3,8}$/i.test(p.accent || '') ? p.accent : '';
    return { id, title: p.title || g.title || g.name || 'Widget', size: 'sm', generated: true, accent, summary: p.summary || g.summary || '',
      render(el) {
        if (p.template === 'checklist') {
          const done = new Set(LAB.store.get('wcheck_' + g.id) || []);
          el.innerHTML = items.map((t, i) => `<label class="wcheck"><input type="checkbox" data-i="${i}" ${done.has(i) ? 'checked' : ''}><span>${LAB.esc(t)}</span></label>`).join('');
          el.querySelectorAll('input').forEach(c => c.onchange = () => { const i = +c.dataset.i; if (c.checked) done.add(i); else done.delete(i); LAB.store.set('wcheck_' + g.id, [...done]); });
        } else if (p.template === 'focus') {
          el.innerHTML = `<div class="wfocus"${accent ? ` style="border-color:${accent}"` : ''}>${LAB.esc(items[0] || p.summary || '')}</div>` + items.slice(1, 4).map(t => `<div class="wline">${LAB.esc(t)}</div>`).join('');
          return;
        } else {
          let i = 0; const box = LAB.el('div', 'wtip'), dots = LAB.el('div', 'wdots'); el.appendChild(box); el.appendChild(dots);
          const show = () => { const k = items.length ? i % items.length : 0; box.textContent = items[k] || p.summary || ''; dots.innerHTML = items.map((_, n) => `<i class="${n === k ? 'on' : ''}"></i>`).join(''); };
          show();
          const iv = setInterval(() => { if (!document.body.contains(box)) return clearInterval(iv); i++; show(); }, 8000);
          dots.onclick = e => { const k = [...dots.children].indexOf(e.target); if (k >= 0) { i = k; show(); } };
        }
        if (p.summary) el.appendChild(LAB.el('div', 'muted', LAB.esc(p.summary)));
      } };
  },
  async loadGenerated() {
    try { const g = await LAB.api('/api/hub/generations'); (g.widgets || []).forEach(w => this.register(this.fromGeneration(w))); } catch {}
  }
};

// ---------------------------------------------------------------- built-ins
(() => {
const J = { 'Content-Type': 'application/json' };
const post = (path, body) => LAB.api(path, { method: 'POST', headers: J, body: JSON.stringify(body || {}) });
const link = (el, label, go) => { const b = LAB.el('button', 'btn wlink', label); b.dataset.go = go; el.appendChild(b); };

LAB.widgets.register({ id: 'machine', title: 'This machine', size: 'sm', native: true,
  render(el, ctx) {
    const d = ctx.device || {};
    el.innerHTML = `<div class="big">${LAB.esc(d.hostname || 'this PC')}</div><div class="muted">${LAB.esc(d.cpu || '')} · ${d.ram_gb || '?'}GB · ${LAB.esc(d.os || '')}</div><div class="minigauges"></div>`;
    const live = el.querySelector('.minigauges');
    const tick = async () => {
      if (!document.body.contains(live)) return clearInterval(iv);
      const q = await LAB.invoke('quick_load'); if (!q) return;
      const up = LAB.stats ? LAB.stats.fmtUp(q.uptime_s) : Math.round(q.uptime_s / 3600) + 'h';
      live.innerHTML = `<span><i>CPU</i>${Math.round(q.cpu)}%</span><span><i>RAM</i>${Math.round(100 * q.mem_used_mb / Math.max(1, q.mem_total_mb))}%</span><span><i>Up</i>${up}</span>`;
    };
    const iv = setInterval(tick, 5000); tick();
  } });

LAB.widgets.register({ id: 'usage', title: 'Today so far', size: 'sm', native: true,
  async render(el, ctx) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    let s = null; try { s = await LAB.api(`/api/usage/summary?device_id=${encodeURIComponent(LAB.telemetry.deviceId())}&days=1&tz=${encodeURIComponent(tz)}`); } catch {}
    const day = s && s.days && s.days[0], tot = day ? day.total : 0;
    if (!tot) { el.innerHTML = `<div class="muted">${LAB.telemetry.enabled ? 'Nothing measured yet today — it fills in as you use the PC.' : 'Measuring is off in Settings.'}</div>`; return; }
    const C = LAB.stats.COLOR, cats = Object.entries(day.cats).sort((a, b) => b[1] - a[1]);
    el.innerHTML = `<div class="big">${LAB.stats.fmtMin(tot)}</div><div class="wbar-stack">${cats.map(([k, v]) => `<i style="width:${(100 * v / tot).toFixed(1)}%;background:${C[k] || C.Other}" title="${LAB.esc(k)}"></i>`).join('')}</div>
      <div class="muted">${cats.slice(0, 3).map(([k, v]) => `${LAB.esc(k)} ${LAB.stats.fmtMin(v)}`).join(' · ')}${s.top_apps && s.top_apps[0] ? `<br>Top app this week: <b>${LAB.esc(s.top_apps[0].app)}</b>` : ''}</div>`;
    link(el, 'Open stats', 'stats');
  } });

LAB.widgets.register({ id: 'todos', title: 'Lists', size: 'md',
  async render(el, ctx) {
    let cur = LAB.store.get('todo_list') || 'Family';
    const paint = async () => {
      let lists = [], t = [];
      try { [lists, t] = await Promise.all([LAB.api('/api/shared/lists'), LAB.api('/api/shared/todos?list=' + encodeURIComponent(cur))]); } catch {}
      if (!lists.some(l => l.list === cur)) lists.push({ list: cur, open: 0, total: 0 });
      const open = t.filter(x => !x.done).slice(0, 8), done = t.filter(x => x.done).length;
      el.innerHTML = `<div class="chips">${lists.map(l => `<button class="chip ${l.list === cur ? 'on' : ''}" data-list="${LAB.esc(l.list)}">${LAB.esc(l.list)}${l.open ? ` <b>${l.open}</b>` : ''}</button>`).join('')}<button class="chip" data-newlist title="New list">+</button></div>`
        + (open.length ? open.map(x => `<label class="wcheck"><input type="checkbox" data-id="${x.id}"><span>${LAB.esc(x.text)}${x.by_name ? ` <em>· ${LAB.esc(x.by_name)}</em>` : ''}</span></label>`).join('') : '<div class="muted">All clear.</div>')
        + `<form class="wadd"><input placeholder="Add to ${LAB.esc(cur)}…" maxlength="300"><button class="btn pri">Add</button></form>` + (done ? `<div class="muted">${done} done</div>` : '');
      el.querySelectorAll('[data-list]').forEach(b => b.onclick = () => { cur = b.dataset.list; LAB.store.set('todo_list', cur); paint(); });
      el.querySelector('[data-newlist]').onclick = () => { const n = prompt('Name the new list (e.g. Groceries, Chores, Holiday)'); if (n && n.trim()) { cur = n.trim().slice(0, 30); cur = cur[0].toUpperCase() + cur.slice(1); LAB.store.set('todo_list', cur); paint(); } };
      el.querySelectorAll('input[type=checkbox]').forEach(c => c.onchange = async () => { await post('/api/shared/todos/' + c.dataset.id + '/toggle').catch(() => {}); paint(); });
      el.querySelector('form').onsubmit = async e => { e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (!v) return; await post('/api/shared/todos', { text: v, by: ctx.me && ctx.me.name, list: cur }).catch(() => {}); paint(); };
    };
    await paint();
  } });

LAB.widgets.register({ id: 'today', title: 'Coming up', size: 'sm',
  async render(el, ctx) {
    let ev = []; try { ev = await LAB.api((LAB.calendar && LAB.calendar.eventsPath) ? LAB.calendar.eventsPath() : '/api/shared/events'); } catch {}
    const today = new Date().toLocaleDateString('en-CA'), tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');
    const soon = ev.filter(e => e.day >= today).slice(0, 5);
    el.innerHTML = soon.length
      ? soon.map(e => `<div class="wev"><span class="wday">${e.day === today ? 'Today' : e.day === tomorrow ? 'Tomorrow' : LAB.esc(e.day.slice(5))}${e.at_time ? ' ' + LAB.esc(e.at_time) : ''}</span><b>${LAB.esc(e.title)}</b></div>`).join('')
      : '<div class="muted">Nothing on the calendar.</div>';
    link(el, 'Open calendar', 'calendar');
  } });

LAB.widgets.register({ id: 'house', title: 'House', size: 'md',
  async render(el, ctx) {
    const paint = async () => {
      const [rooms, scenes] = await Promise.all([LAB.api('/api/kiosk/rooms').catch(() => []), LAB.api('/api/conductor/scenes').catch(() => [])]);
      el.innerHTML = `<div class="wrooms">${rooms.map(r => `<button class="rtile ${r.on ? 'on' : ''}" data-room="${LAB.esc(r.id)}"><span>${r.on ? 'on' : 'off'}${r.online === false ? ' · offline' : ''}</span>${LAB.esc(r.name)}</button>`).join('') || '<div class="muted">No rooms yet — add devices from the web Hub.</div>'}</div>`
        + (scenes.length ? `<div class="wscenes">${scenes.map(s => `<button class="btn" data-scene="${LAB.esc(s.id)}">${LAB.esc(s.name)}</button>`).join('')}</div>` : '');
      el.querySelectorAll('[data-room]').forEach(b => b.onclick = async () => { b.disabled = true; await post('/api/kiosk/rooms/' + encodeURIComponent(b.dataset.room) + '/toggle').catch(() => {}); paint(); });
      el.querySelectorAll('[data-scene]').forEach(b => b.onclick = async () => { b.disabled = true; await post('/api/conductor/scenes/' + encodeURIComponent(b.dataset.scene) + '/run').catch(() => {}); paint(); });
    };
    await paint();
  } });

LAB.widgets.register({ id: 'sauce', title: 'Ask The Sauce', size: 'md',
  render(el, ctx) {
    // the last few exchanges stick around (per install) so a follow-up makes sense
    let hist = LAB.store.get('sauce_hist') || [];
    el.innerHTML = `<div class="wreply" id="w-sauce-log"></div><form class="wadd"><input placeholder="Lights off in the lounge · add milk to the list · what's on tonight?" maxlength="500"><button class="btn pri">Ask</button></form>`;
    const log = el.querySelector('#w-sauce-log');
    const paint = () => { log.innerHTML = hist.slice(-3).map(x => `<div class="wq muted">${LAB.esc(x.q)}</div><div>${LAB.esc(x.a).replace(/\n/g, '<br>')}${x.did && x.did.length ? `<div class="msg did">⚡ ${x.did.map(LAB.esc).join(' · ')}</div>` : ''}</div>`).join(''); };
    paint();
    el.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const inp = e.target.querySelector('input'), t = inp.value.trim(); if (!t) return; inp.value = '';
      log.insertAdjacentHTML('beforeend', `<div class="wq muted">${LAB.esc(t)}</div><div id="w-sauce-think">…</div>`);
      try {
        const r = await post('/api/sauce/ask', { account_id: ctx.me && ctx.me.id, name: ctx.me && ctx.me.name, message: t, history: hist.slice(-3).flatMap(x => [{ role: 'user', text: x.q }, { role: 'assistant', text: x.a }]) });
        hist = hist.concat([{ q: t, a: r.reply, did: r.did || [] }]).slice(-6); LAB.store.set('sauce_hist', hist); paint();
      } catch { const th = el.querySelector('#w-sauce-think'); if (th) th.textContent = 'The Sauce is out of reach right now.'; }
    };
  } });

LAB.widgets.register({ id: 'foryou', title: 'For you', size: 'sm',
  render(el, ctx) {
    const p = (ctx.profile && ctx.profile.personalization) || {};
    el.innerHTML = p.archetype
      ? `<div class="big">${LAB.esc(p.personalizedTab || 'For you')}</div><div class="muted">${LAB.esc(p.report || `Tuned for a ${p.archetype} machine.`)}</div>`
      : `<div class="muted">Run the setup wizard from the web Hub and this app shapes itself around how you use your PC.</div>`;
    link(el, p.archetype ? 'Open ' + (p.personalizedTab || 'For you') : 'See how', 'personalized');
  } });
})();
