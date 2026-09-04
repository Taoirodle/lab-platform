// ============================================================
//  L.A.B Hub — Settings (slot 10). Your app, your way: which server, measuring
//  on/off, updates, start with your PC, your data (export / delete), theme.
// ============================================================
(() => {
const J = { 'Content-Type': 'application/json' };
const semverGt = (a, b) => { const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return true; if ((x[i] || 0) < (y[i] || 0)) return false; } return false; };
LAB.openExternal = async url => { if (LAB.isNative()) { try { await window.__TAURI__.core.invoke('plugin:shell|open', { path: url }); return; } catch {} } window.open(url, '_blank'); };
LAB.updates = {
  async check() { try { const v = await LAB.api('/api/app/version'); return v && v.version && semverGt(v.version, window.LAB_CONFIG.APP_VERSION) ? v : null; } catch { return null; } }
};

LAB.register({ id: 'settings', label: 'Settings', icon: I.cog, order: 10,
  async render(el, ctx) {
    el.innerHTML = head('Settings', 'Your app, your way.');
    const row = (k, v) => `<div class="prow"><span>${k}</span><b>${v}</b></div>`;

    // ---- about + updates ----
    const c = LAB.el('div', 'card'); el.appendChild(c);
    c.innerHTML = row('Runtime', LAB.isNative() ? 'Native (Tauri)' : 'Browser preview') + row('Version', 'v' + LAB.esc(window.LAB_CONFIG.APP_VERSION)) + row('Server', `<span id="s-srv">${LAB.esc(ctx.server)}</span>`) + `<div class="muted" id="s-upd">Checking for updates…</div>`;
    LAB.updates.check().then(u => {
      const box = c.querySelector('#s-upd');
      if (!u) { box.textContent = 'You are on the latest version.'; return; }
      box.innerHTML = `<b>v${LAB.esc(u.version)} is available.</b> ${LAB.esc(u.notes || '')} <button class="btn pri" id="s-get">Get the update</button>`;
      box.querySelector('#s-get').onclick = () => LAB.openExternal(ctx.server + '/app/download/' + (LAB.ctx.device && /mac/i.test(LAB.ctx.device.os) ? 'mac' : LAB.ctx.device && /linux/i.test(LAB.ctx.device.os) ? 'linux' : 'win'));
    });

    // ---- where your L.A.B is: home address + away (Tailscale) address ----
    const sv = LAB.el('div', 'card'); el.appendChild(sv);
    const okUrl = u => /^https?:\/\/[^\s/]+(:\d+)?$/.test(u);
    sv.innerHTML = `<h3>Where your L.A.B is</h3><div class="muted">Right now: <b>${LAB.esc(LAB.where)}</b> via ${LAB.esc(ctx.server)}. The app tries home first, then away, and switches back on its own.</div>
      <form class="wadd" style="margin-top:10px"><span class="muted" style="flex:0 0 52px">Home</span><input id="s-url" placeholder="${LAB.esc(window.LAB_CONFIG.SERVER)}" value="${LAB.esc(LAB.store.get('server') || '')}"><button class="btn">Save</button></form>
      <form class="wadd" id="s-away-f"><span class="muted" style="flex:0 0 52px">Away</span><input id="s-away" placeholder="http://100.x.y.z:8090 (the server's Tailscale address)" value="${LAB.esc(LAB.store.get('server_away') || '')}"><button class="btn">Save</button></form>
      <div class="muted" id="s-msg">Leave Home empty for the built-in address. Away is used when home doesn't answer — install Tailscale on the server and put its 100.x address here.</div>`;
    sv.querySelector('form').onsubmit = e => { e.preventDefault(); const u = sv.querySelector('#s-url').value.trim().replace(/\/+$/, ''); if (u && !okUrl(u)) { sv.querySelector('#s-msg').textContent = 'That needs to look like http://host:port'; return; } if (u) LAB.store.set('server', u); else LAB.store.del('server'); sv.querySelector('#s-msg').textContent = 'Saved — used on the next launch.'; };
    sv.querySelector('#s-away-f').onsubmit = e => { e.preventDefault(); const u = sv.querySelector('#s-away').value.trim().replace(/\/+$/, ''); if (u && !okUrl(u)) { sv.querySelector('#s-msg').textContent = 'That needs to look like http://host:port'; return; } if (u) LAB.store.set('server_away', u); else LAB.store.del('server_away'); sv.querySelector('#s-msg').textContent = 'Saved — tried whenever home does not answer.'; };

    // ---- native: measuring, autostart ----
    if (LAB.isNative()) {
      const on = LAB.store.get('telemetry') !== false;
      const tele = LAB.el('div', 'card'); el.appendChild(tele);
      tele.innerHTML = `<h3>Usage measuring</h3><div class="prow"><span>Sample what's in front once a minute — it powers Stats and "For you". Window titles never leave this PC.</span><button class="btn ${on ? 'pri' : ''}" id="t-tog">${on ? 'On' : 'Off'}</button></div>`;
      tele.querySelector('#t-tog').onclick = () => { const next = !on; LAB.store.set('telemetry', next); if (next) LAB.telemetry.start(); else LAB.telemetry.stop(); LAB.go('settings'); };
      const auto = LAB.el('div', 'card'); el.appendChild(auto);
      auto.innerHTML = `<h3>Start with your PC</h3><div class="prow"><span>Open the Hub quietly when you sign in, so measuring and reminders are always on.</span><button class="btn" id="a-tog">…</button></div>`;
      const ab = auto.querySelector('#a-tog');
      const paintAuto = async () => { const en = await LAB.invoke('autostart_enabled'); if (en == null) { ab.textContent = 'n/a'; ab.disabled = true; return; } ab.textContent = en ? 'On' : 'Off'; ab.classList.toggle('pri', !!en); };
      ab.onclick = async () => { const en = await LAB.invoke('autostart_enabled'); await LAB.invoke('autostart_set', { enable: !en }); paintAuto(); };
      paintAuto();
      const tray = LAB.el('div', 'card'); el.appendChild(tray);
      const ctt = await LAB.invoke('close_to_tray_get');
      const rem = LAB.store.get('reminders') !== false;
      tray.innerHTML = `<h3>In the background</h3>
        <div class="prow"><span>Keep running in the tray when the window is closed (quit from the tray icon).</span><button class="btn ${ctt ? 'pri' : ''}" id="ct-tog">${ctt ? 'On' : 'Off'}</button></div>
        <div class="prow"><span>Remind me 15 minutes before calendar events (one OS notification, nothing else).</span><button class="btn ${rem ? 'pri' : ''}" id="rm-tog">${rem ? 'On' : 'Off'}</button></div>`;
      tray.querySelector('#ct-tog').onclick = async () => { await LAB.invoke('close_to_tray_set', { enable: !ctt }); LAB.go('settings'); };
      tray.querySelector('#rm-tog').onclick = () => { LAB.store.set('reminders', !rem); if (!rem) LAB.notify.start(); else LAB.notify.stop(); LAB.go('settings'); };
    }

    // ---- theme ----
    const th = LAB.el('div', 'card'); th.innerHTML = '<h3>Theme</h3><div class="skins" id="skl"></div><div class="muted">More themes, effects and layouts live in the App Store.</div>'; el.appendChild(th);
    const g = await LAB.api('/api/hub/generations').catch(() => ({ skins: [] }));
    const cur = LAB.store.get('skin');
    th.querySelector('#skl').innerHTML = `<button class="skin ${!cur ? 'on' : ''}" data-s="default">Default</button>` + (g.skins || []).map(s => `<button class="skin ${cur === s.id ? 'on' : ''}" data-s="${LAB.esc(s.id)}" style="--sw:${(s.payload && s.payload.vars && s.payload.vars['--a1']) || '#888'}">${LAB.esc(s.title)}</button>`).join('');
    th.querySelectorAll('.skin').forEach(b => b.onclick = () => { const id = b.dataset.s; if (id === 'default') { LAB.store.del('skin'); LAB.store.del('skinvars'); LAB.applySkin(null); } else { const s = (g.skins || []).find(x => x.id === id); if (s) { LAB.store.set('skin', id); LAB.store.set('skinvars', s.payload.vars); LAB.applySkin(s.payload.vars); } } LAB.go('settings'); });

    // ---- your data ----
    const d = LAB.el('div', 'card'); el.appendChild(d);
    d.innerHTML = `<h3>Your data</h3><div class="prow"><span>Export everything this app holds about you (settings, layout, your usage summary) as a JSON file.</span><button class="btn" id="d-exp">Export</button></div>
      <div class="prow"><span>Delete this PC's measurements from your server and reset this app.</span><button class="btn" id="d-del">Delete</button></div><div class="muted" id="d-msg"></div>`;
    d.querySelector('#d-exp').onclick = async () => {
      const msg = d.querySelector('#d-msg'); msg.textContent = 'Preparing…';
      const local = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('labapp_')) { try { local[k.slice(7)] = JSON.parse(localStorage.getItem(k)); } catch { local[k.slice(7)] = localStorage.getItem(k); } } }
      let usage = null; if (LAB.isNative()) { try { usage = await LAB.api(`/api/usage/summary?device_id=${encodeURIComponent(LAB.telemetry.deviceId())}&days=90`); } catch {} }
      const payload = JSON.stringify({ exported_at: new Date().toISOString(), app_version: window.LAB_CONFIG.APP_VERSION, account: ctx.me, local, usage }, null, 2);
      const name = 'lab-hub-export-' + new Date().toISOString().slice(0, 10) + '.json';
      const p = LAB.isNative() ? await LAB.invoke('save_to_downloads', { name, content: payload }) : null;
      if (p) msg.textContent = 'Saved to ' + p; else { try { await navigator.clipboard.writeText(payload); msg.textContent = 'Copied to your clipboard.'; } catch { msg.textContent = 'Could not save.'; } }
    };
    d.querySelector('#d-del').onclick = async () => {
      if (!confirm('Delete this PC\'s measurements from the server and reset the app? Your account stays.')) return;
      const msg = d.querySelector('#d-msg'); msg.textContent = 'Deleting…';
      try { if (LAB.isNative()) { LAB.telemetry.stop(); await LAB.api('/api/usage/device/' + encodeURIComponent(LAB.telemetry.deviceId()), { method: 'DELETE' }); } } catch {}
      Object.keys(localStorage).filter(k => k.startsWith('labapp_')).forEach(k => localStorage.removeItem(k));
      msg.textContent = 'Done. Restarting…'; setTimeout(() => location.reload(), 800);
    };
  }
});
})();
