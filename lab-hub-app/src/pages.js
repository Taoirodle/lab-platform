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
    el.innerHTML = head('Automations', 'Teach your home to run itself — when something happens, it does something.');
    const wrap = LAB.el('div'); el.appendChild(wrap);
    async function refresh() {
      const [autos, scenes, entities] = await Promise.all([
        LAB.api('/api/conductor/automations').catch(() => []),
        LAB.api('/api/conductor/scenes').catch(() => []),
        LAB.api('/api/conductor/entities').catch(() => [])
      ]);
      const rooms = [...new Set(entities.map(e => e.room))];
      wrap.innerHTML = `
        <div class="card"><h3>Active automations</h3><div>${autos.length ? autos.map(a => `<div class="prow"><span>${LAB.esc(a.name)}</span><b>${a.enabled ? 'on' : 'off'}</b></div>`).join('') : '<div class="muted">None yet — build one below.</div>'}</div></div>
        <div class="card"><h3>New automation</h3><div class="autobuild">
          <span class="w">When</span>
          <select id="a-trig">${rooms.map(r => `<option value="${r}">motion in ${LAB.esc(r)}</option>`).join('') || '<option>no rooms yet</option>'}</select>
          <span class="w">run</span>
          <select id="a-scene">${scenes.map(s => `<option value="${s.id}">${LAB.esc(s.name)}</option>`).join('') || '<option>no scenes yet</option>'}</select>
          <button class="btn pri" id="a-save">Create</button>
        </div><div class="muted" style="margin-top:10px">Backed by the L.A.B Conductor — our own device engine.</div></div>`;
      const save = wrap.querySelector('#a-save');
      if (save) save.onclick = async () => {
        const room = wrap.querySelector('#a-trig').value, scene = wrap.querySelector('#a-scene').value;
        if (!room || !scene) return;
        await LAB.api('/api/conductor/automations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'When motion in ' + room, trigger: { type: 'motion', room }, actions: [{ scene }] }) }).catch(() => {});
        refresh();
      };
    }
    refresh();
  }
});

// 7 · Personalized tab (name + content from the wizard) ----------------------
LAB.register({ id: 'personalized', label: 'For you', icon: I.star, order: 7,
  dynLabel(ctx) { return (ctx.profile && ctx.profile.personalization && ctx.profile.personalization.personalizedTab) || 'For you'; },
  render(el, ctx) {
    const p = (ctx.profile && ctx.profile.personalization) || {};
    el.innerHTML = head(p.personalizedTab || 'For you', p.report || 'Run the setup wizard and this tab shapes itself around how you use your PC.');
    el.appendChild(LAB.el('div', 'card', `<h3>Tuned for a ${LAB.esc(p.archetype || '—')} machine</h3>` + soon('your archetype-specific tools + shortcuts')));
  }
});

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
      <div class="prow"><span>RAM</span><b>${d.ram_gb} GB</b></div>
      ${(d.disks || []).map(k => `<div class="prow"><span>Disk ${LAB.esc(k.name)}</span><b>${k.free_gb} / ${k.total_gb} GB free</b></div>`).join('')}`;
    el.appendChild(c);
  }
});

// 9 · Stats — lives in modules/stats.js (real data from the native sampler) --

// 10 · Settings --------------------------------------------------------------
LAB.register({ id: 'settings', label: 'Settings', icon: I.cog, order: 10,
  async render(el, ctx) {
    el.innerHTML = head('Settings', 'Your app, your way.');
    const c = LAB.el('div', 'card'); c.innerHTML = `
      <div class="prow"><span>Server</span><b>${LAB.esc(ctx.server)}</b></div>
      <div class="prow"><span>Runtime</span><b>${LAB.isNative() ? 'Native (Tauri)' : 'Browser preview'}</b></div>
      <div class="prow"><span>Version</span><b>v${window.LAB_CONFIG.APP_VERSION}</b></div>`;
    el.appendChild(c);
    if (LAB.isNative()) {
      const on = LAB.store.get('telemetry') !== false;
      const tele = LAB.el('div', 'card');
      tele.innerHTML = `<h3>Usage measuring</h3><div class="prow"><span>Sample what's in front once a minute — it powers Stats. Window titles never leave this PC.</span><button class="btn ${on ? 'pri' : ''}" id="t-tog">${on ? 'On' : 'Off'}</button></div>`;
      tele.querySelector('#t-tog').onclick = () => { const next = !on; LAB.store.set('telemetry', next); if (next) LAB.telemetry.start(); else LAB.telemetry.stop(); LAB.go('settings'); };
      el.appendChild(tele);
    }
    const th = LAB.el('div', 'card'); th.innerHTML = '<h3>Theme</h3><div class="skins" id="skl"></div>'; el.appendChild(th);
    const g = await LAB.api('/api/hub/generations').catch(() => ({ skins: [] }));
    const cur = LAB.store.get('skin');
    th.querySelector('#skl').innerHTML = `<button class="skin ${!cur ? 'on' : ''}" data-s="default">Default</button>` + (g.skins || []).map(s => `<button class="skin ${cur === s.id ? 'on' : ''}" data-s="${s.id}" style="--sw:${(s.payload && s.payload.vars && s.payload.vars['--a1']) || '#888'}">${LAB.esc(s.title)}</button>`).join('');
    th.querySelectorAll('.skin').forEach(b => b.onclick = () => { const id = b.dataset.s; if (id === 'default') { LAB.store.del('skin'); LAB.store.del('skinvars'); LAB.applySkin(null); } else { const s = (g.skins || []).find(x => x.id === id); if (s) { LAB.store.set('skin', id); LAB.store.set('skinvars', s.payload.vars); LAB.applySkin(s.payload.vars); } } LAB.go('settings'); });
  }
});
