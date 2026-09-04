// ============================================================
//  L.A.B Hub — page modules (the 10 slots)
//  Every page is a self-contained module registered into the core. Delete one,
//  add one, reorder — nothing else changes. This is the "fully modular" spine;
//  content can stay light until each is fleshed out.
// ============================================================
const I = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/></svg>',
  sauce:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/></svg>',
  store:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16l-1 4a3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 11v8h14v-8"/></svg>',
  rooms:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10 12 3l9 7"/><path d="M6 9v11h12V9"/><rect x="10" y="13" width="4" height="7"/></svg>',
  bolt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>',
  device:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  stats:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
  cog:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></svg>'
};
const head = (t, s) => `<div class="phead"><h1>${LAB.esc(t)}</h1>${s ? `<p>${LAB.esc(s)}</p>` : ''}</div>`;
const soon = (what) => `<div class="soon">Module scaffolded — ${LAB.esc(what)} lands here. The framework is ready; content is pluggable.</div>`;

// 1 · Dashboard — lives in modules/dashboard.js (widget grid) -----------------

// 2 · Profile — lives in modules/profile.js (sign-in, avatar, privacy, devices, PIN)
// 3 · Calendar — lives in modules/calendar.js (month grid, agenda, ICS feeds)

// 4 · The Sauce (real, talks to the on-server brain) -------------------------
LAB.register({ id: 'sauce', label: 'The Sauce', icon: I.sauce, order: 4,
  render(el, ctx) {
    el.innerHTML = head('The Sauce', 'Your home AI — ask it anything, it lives on your server.');
    const card = LAB.el('div', 'card sauce'); card.innerHTML = `<div class="slog" id="slog"></div>
      <form class="sform" id="sform"><input id="sin" placeholder="Ask The Sauce…" autocomplete="off"><button class="btn pri" id="ssend">Send</button></form>`;
    el.appendChild(card);
    const hist = [];
    const add = (role, html, cls) => { const m = LAB.el('div', 'msg ' + role + (cls ? ' ' + cls : ''), html); card.querySelector('#slog').appendChild(m); card.querySelector('#slog').scrollTop = 1e9; return m; };
    add('them', `Hey${ctx.me ? ' ' + LAB.esc(ctx.me.name) : ''} — what do you need?`);
    card.querySelector('#sform').onsubmit = async e => {
      e.preventDefault(); const t = card.querySelector('#sin').value.trim(); if (!t) return;
      card.querySelector('#sin').value = ''; add('me', LAB.esc(t)); hist.push({ role: 'user', text: t });
      const think = add('them', '…', 'think'); card.querySelector('#ssend').disabled = true;
      try {
        const r = await LAB.api('/api/sauce/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account_id: ctx.me && ctx.me.id, name: ctx.me && ctx.me.name, message: t, history: hist }) });
        think.remove();
        add('them', LAB.esc(r.reply).replace(/\n/g, '<br>'));
        if (r.did && r.did.length) add('them', '⚡ ' + r.did.map(LAB.esc).join(' &nbsp;·&nbsp; '), 'did');
        hist.push({ role: 'assistant', text: r.reply });
      }
      catch { think.remove(); add('them', 'My brain took too long — try again.', 'think'); }
      card.querySelector('#ssend').disabled = false;
    };
  }
});

// 5 · App Store — lives in modules/appstore.js (installs, overhauls, effects, themes, widgets)

// 6 · Automations — "when X, do Y" (locked in as slot 6) --------------------
LAB.register({ id: 'automations', label: 'Automations', icon: I.bolt, order: 6,
  async render(el, ctx) {
    el.innerHTML = head('Automations', 'Your devices, your scenes, and "when this happens, do that" — all on the L.A.B Conductor, our own engine.');
    const wrap = LAB.el('div'); el.appendChild(wrap);
    const J = { 'Content-Type': 'application/json' }, post = (p, b, m) => LAB.api(p, { method: m || 'POST', headers: J, body: b == null ? undefined : JSON.stringify(b) });
    const DRIVERS = { wled: 'WLED strip (HTTP)', wiz: 'WiZ bulb (UDP)', push: 'Sensor that pushes (ESP32 / PIR)', virtual: 'Virtual (test)' };
    const KINDS = { light: 'Light', 'led-strip': 'LED strip', motion: 'Motion sensor', sensor: 'Sensor', switch: 'Switch' };
    let flash = null;   // a push device's token, shown once
    async function refresh() {
      const [autos, scenes, entities] = await Promise.all([
        LAB.api('/api/conductor/automations').catch(() => []),
        LAB.api('/api/conductor/scenes').catch(() => []),
        LAB.api('/api/conductor/entities').catch(() => [])
      ]);
      const rooms = [...new Set(entities.map(e => e.room))];
      wrap.innerHTML = `
        <div class="card"><h3>Devices · ${entities.length}</h3>
          ${entities.length ? entities.map(e => `<div class="prow"><span><i class="dot" style="background:${e.online ? '#7ee2b8' : 'var(--stroke)'}"></i> <b>${LAB.esc(e.name)}</b><div class="muted">${LAB.esc(e.room)} · ${LAB.esc(KINDS[e.kind] || e.kind)} · ${LAB.esc(DRIVERS[e.driver] ? e.driver : e.driver)}${e.address ? ' · ' + LAB.esc(e.address) : ''} · ${e.online ? 'online' : 'not seen'}</div></span><span class="btnrow"><button class="btn" data-tog="${LAB.esc(e.id)}" ${e.kind === 'light' || e.kind === 'led-strip' ? '' : 'hidden'}>${e.state && e.state.on ? 'Off' : 'On'}</button><button class="btn" data-del="${LAB.esc(e.id)}">Remove</button></span></div>`).join('') : '<div class="muted">No devices yet.</div>'}
          <div class="btnrow" style="margin-top:12px"><button class="btn" id="d-probe">Check who's online</button></div>
          ${flash ? `<div class="privacy" style="border:1px solid var(--a2);border-radius:12px;padding:12px;margin-top:12px">Token for <b>${LAB.esc(flash.name)}</b> — shown once. Flash it into the sensor: it POSTs to <code>/api/ingest/${LAB.esc(flash.token)}</code><br><code style="user-select:all">${LAB.esc(flash.token)}</code></div>` : ''}</div>
        <div class="card"><h3>Add a device</h3><form class="devform" id="d-add">
          <input id="d-name" placeholder="Name (e.g. Lounge strip)" maxlength="60" required>
          <input id="d-room" placeholder="Room" list="d-rooms" maxlength="40" required><datalist id="d-rooms">${rooms.map(r => `<option value="${LAB.esc(r)}">`).join('')}</datalist>
          <select id="d-driver">${Object.entries(DRIVERS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <select id="d-kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <input id="d-addr" placeholder="IP address (WLED / WiZ)" maxlength="80">
          <button class="btn pri">Add</button></form>
          <div class="muted" id="d-msg">WLED and WiZ talk over the LAN by IP; a push sensor gets a token and calls in on its own; virtual is for trying things.</div></div>
        <div class="card"><h3>Scenes · ${scenes.length}</h3>
          ${scenes.length ? scenes.map(s => `<div class="prow"><span><b>${LAB.esc(s.name)}</b><div class="muted">${(s.actions || []).length} step${(s.actions || []).length === 1 ? '' : 's'}</div></span><button class="btn" data-run="${LAB.esc(s.id)}">Run</button></div>`).join('') : '<div class="muted">No scenes yet.</div>'}
          <form class="wadd" id="s-save" style="margin-top:12px"><input id="s-name" placeholder="Save how the lights are right now as…" maxlength="40" required><button class="btn pri">Save scene</button></form></div>
        <div class="card"><h3>Automations · ${autos.length}</h3><div>${autos.length ? autos.map(a => { const t = a.trigger || {}; const when = t.type === 'time' ? 'at ' + LAB.esc(t.at) + (t.days && t.days.length && t.days.length < 7 ? ' on ' + t.days.map(d => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d]).join(' ') : ' daily') : 'when motion in ' + LAB.esc(t.room || '?');
            return `<div class="prow"><span><b>${LAB.esc(a.name)}</b><div class="muted">${when} → ${(a.actions || []).map(x => x.scene ? 'scene ' + LAB.esc(scenes.find(s => s.id === x.scene)?.name || x.scene) : 'device').join(', ')}</div></span><span class="btnrow"><button class="btn ${a.enabled ? 'pri' : ''}" data-aen="${LAB.esc(a.id)}" data-on="${a.enabled ? 1 : 0}">${a.enabled ? 'On' : 'Off'}</button><button class="btn" data-adel="${LAB.esc(a.id)}">Delete</button></span></div>`; }).join('') : '<div class="muted">None yet — build one below.</div>'}</div>
          <div class="autobuild" style="margin-top:12px">
          <span class="w">When</span>
          <select id="a-kind"><option value="motion">motion in…</option><option value="time">the clock says…</option></select>
          <select id="a-trig">${rooms.map(r => `<option value="${LAB.esc(r)}">${LAB.esc(r)}</option>`).join('') || '<option>no rooms yet</option>'}</select>
          <input type="time" id="a-at" value="22:00" hidden>
          <span id="a-days" hidden>${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => `<label class="daychip"><input type="checkbox" value="${i}" checked><span>${d}</span></label>`).join('')}</span>
          <span class="w">run</span>
          <select id="a-scene">${scenes.map(s => `<option value="${LAB.esc(s.id)}">${LAB.esc(s.name)}</option>`).join('') || '<option>no scenes yet</option>'}</select>
          <button class="btn pri" id="a-save">Create</button></div><div class="muted" id="a-msg"></div></div>`;
      const kindSel = wrap.querySelector('#a-kind');
      kindSel.onchange = () => { const time = kindSel.value === 'time'; wrap.querySelector('#a-trig').hidden = time; wrap.querySelector('#a-at').hidden = !time; wrap.querySelector('#a-days').hidden = !time; };
      wrap.querySelectorAll('[data-aen]').forEach(b => b.onclick = async () => { await post('/api/conductor/automations/' + encodeURIComponent(b.dataset.aen) + '/enable', { enabled: b.dataset.on !== '1' }).catch(() => {}); refresh(); });
      wrap.querySelectorAll('[data-adel]').forEach(b => b.onclick = async () => { await post('/api/conductor/automations/' + encodeURIComponent(b.dataset.adel), null, 'DELETE').catch(() => {}); refresh(); });
      flash = null;
      wrap.querySelector('#d-add').onsubmit = async e => {
        e.preventDefault(); const msg = wrap.querySelector('#d-msg'); const driver = wrap.querySelector('#d-driver').value, addr = wrap.querySelector('#d-addr').value.trim();
        if ((driver === 'wled' || driver === 'wiz') && !/^\d{1,3}(\.\d{1,3}){3}$|^[a-z0-9.-]+$/i.test(addr)) { msg.textContent = 'That driver needs the device\'s IP address.'; return; }
        msg.textContent = 'Adding…';
        try {
          const r = await post('/api/conductor/entities', { name: wrap.querySelector('#d-name').value.trim(), room: wrap.querySelector('#d-room').value.trim().toLowerCase(), driver, kind: wrap.querySelector('#d-kind').value, address: addr || null, port: driver === 'wiz' ? 38899 : null });
          if (driver === 'push' && r.token) flash = { name: r.name, token: r.token };
          await LAB.api('/api/conductor/probe').catch(() => {});
          refresh();
        } catch (err) { msg.textContent = err.message; }
      };
      wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Remove this device from the L.A.B?')) return; await post('/api/conductor/entities/' + encodeURIComponent(b.dataset.del), null, 'DELETE').catch(() => {}); refresh(); });
      wrap.querySelectorAll('[data-tog]').forEach(b => b.onclick = async () => { b.disabled = true; await post('/api/conductor/entities/' + encodeURIComponent(b.dataset.tog) + '/command', { toggle: true }).catch(() => {}); refresh(); });
      wrap.querySelectorAll('[data-run]').forEach(b => b.onclick = async () => { b.disabled = true; await post('/api/conductor/scenes/' + encodeURIComponent(b.dataset.run) + '/run').catch(() => {}); refresh(); });
      wrap.querySelector('#d-probe').onclick = async e => { e.target.disabled = true; e.target.textContent = 'Checking…'; await LAB.api('/api/conductor/probe').catch(() => {}); refresh(); };
      wrap.querySelector('#s-save').onsubmit = async e => {
        e.preventDefault(); const name = wrap.querySelector('#s-name').value.trim(); if (!name) return;
        const actions = entities.filter(x => x.kind === 'light' || x.kind === 'led-strip').map(x => ({ entity: x.id, cmd: { on: !!(x.state && x.state.on) } }));
        await post('/api/conductor/scenes', { name, actions }).catch(() => {}); refresh();
      };
      const save = wrap.querySelector('#a-save');
      if (save) save.onclick = async () => {
        const scene = wrap.querySelector('#a-scene').value, sceneName = scenes.find(s => s.id === scene)?.name || scene; if (!scene) return;
        let body;
        if (kindSel.value === 'time') {
          const at = wrap.querySelector('#a-at').value, days = [...wrap.querySelectorAll('#a-days input:checked')].map(i => +i.value);
          if (!at) return; body = { name: `${sceneName} at ${at}`, trigger: { type: 'time', at, days: days.length === 7 ? [] : days }, actions: [{ scene }] };
        } else { const room = wrap.querySelector('#a-trig').value; if (!room) return; body = { name: `${sceneName} when motion in ${room}`, trigger: { type: 'motion', room }, actions: [{ scene }] }; }
        try { await post('/api/conductor/automations', body); refresh(); } catch (e) { wrap.querySelector('#a-msg').textContent = e.message; }
      };
    }
    refresh();
  }
});

// 7 · For you — lives in modules/foryou.js (library, recent files, focus, studio)

// 8 · Device (native probe) --------------------------------------------------
LAB.register({ id: 'device', label: 'Device', icon: I.device, order: 8,
  render(el, ctx) {
    el.innerHTML = head('Device', 'What this machine is — read natively by the app.');
    const d = ctx.device;
    if (!d) { el.appendChild(LAB.el('div', 'card', soon('native specs show in the installed app (browser preview can\'t read hardware)'))); return; }
    const c = LAB.el('div', 'card'); c.innerHTML = `
      <div class="prow"><span>Host</span><b>${LAB.esc(d.hostname)}</b></div>
      <div class="prow"><span>OS</span><b>${LAB.esc(d.os)} ${LAB.esc(d.os_version)} (${LAB.esc(d.arch)})</b></div>
      <div class="prow"><span>CPU</span><b>${LAB.esc(d.cpu)} · ${d.cpu_cores} cores</b></div>
      <div class="prow"><span>RAM</span><b>${d.ram_gb} GB</b></div>`;
    el.appendChild(c);
    // live: disks with a fill bar + network interfaces, refreshed while you look
    const live = LAB.el('div', 'card'); live.innerHTML = '<h3>Storage</h3><div id="dv-disks" class="muted">reading…</div>'; el.appendChild(live);
    const net = LAB.el('div', 'card'); net.innerHTML = '<h3>Network</h3><div id="dv-net" class="muted">reading…</div>'; el.appendChild(net);
    const gb = b => (b / 1073741824).toFixed(b > 10737418240 ? 0 : 1) + ' GB';
    const rate = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB/s' : b > 1024 ? (b / 1024).toFixed(0) + ' KB/s' : b + ' B/s';
    let prev = null, prevT = 0;
    const tick = async () => {
      if (!document.body.contains(live)) return clearInterval(iv);
      const s = await LAB.invoke('live_device');
      if (!s) { live.querySelector('#dv-disks').innerHTML = (d.disks || []).map(k => `<div class="prow"><span>${LAB.esc(k.name)}</span><b>${k.free_gb} / ${k.total_gb} GB free</b></div>`).join('') || 'no disks reported'; net.querySelector('#dv-net').textContent = 'live network needs the latest app build'; return clearInterval(iv); }
      live.querySelector('#dv-disks').innerHTML = (s.disks || []).map(k => { const used = k.total - k.free, pct = k.total ? Math.round(100 * used / k.total) : 0; return `<div class="prow" style="display:block"><div style="display:flex;justify-content:space-between"><span>${LAB.esc(k.name || k.mount)} <span class="muted">${LAB.esc(k.mount)}${k.fs ? ' · ' + LAB.esc(k.fs) : ''}</span></span><b>${gb(k.free)} free of ${gb(k.total)}</b></div><div class="wbar-stack" style="margin:8px 0 0"><i style="width:${pct}%;background:${pct > 90 ? 'var(--a2)' : 'var(--a1)'}"></i></div></div>`; }).join('') || '<div class="muted">no disks reported</div>';
      const now = Date.now(), dt = prev ? (now - prevT) / 1000 : 0;
      net.querySelector('#dv-net').innerHTML = (s.networks || []).filter(n => n.rx_total > 0 || n.tx_total > 0).sort((a, b) => (b.rx_total + b.tx_total) - (a.rx_total + a.tx_total)).slice(0, 6).map(n => {
        const p = prev && prev.networks.find(x => x.name === n.name); const down = p && dt ? rate(Math.max(0, n.rx_total - p.rx_total) / dt) : '…', up = p && dt ? rate(Math.max(0, n.tx_total - p.tx_total) / dt) : '…';
        return `<div class="prow"><span><b>${LAB.esc(n.name)}</b>${n.mac ? `<div class="muted">${LAB.esc(n.mac)}</div>` : ''}</span><span class="muted">↓ ${down} · ↑ ${up}<div>${gb(n.rx_total)} in · ${gb(n.tx_total)} out since boot</div></span></div>`;
      }).join('') || '<div class="muted">no active interfaces</div>';
      prev = s; prevT = now;
    };
    const iv = setInterval(tick, 3000); tick();
  }
});

// 9 · Stats — lives in modules/stats.js (real data from the native sampler) --

// 10 · Settings — lives in modules/settings.js (server, measuring, autostart, updates, data, theme)
