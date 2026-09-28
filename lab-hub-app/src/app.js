// ============================================================
//  L.A.B Hub — core (modular runtime)
//  A tiny framework: pages self-register into LAB.pages; the shell renders the
//  sidebar + active page from that registry. Adding a feature = register one
//  module object. Nothing here hard-codes the page list — it's all data.
//
//  A page module:
//    { id, label, icon(svg), order,
//      show(ctx) -> bool,          // optional: gate by archetype/profile
//      render(el, ctx) }           // paint into `el`
// ============================================================
const LAB = (window.LAB = {
  pages: [],
  ctx: { me: null, profile: null, device: null, server: window.LAB_CONFIG.SERVER },

  // --- module registration (the modular core) ---
  register(mod) {
    // same id registered again = replace (lets a module file override a stub, and skins/overhauls swap pages)
    const i = this.pages.findIndex(p => p.id === mod.id);
    if (i >= 0) this.pages[i] = mod; else this.pages.push(mod);
    this.pages.sort((a, b) => (a.order || 99) - (b.order || 99));
  },
  unregister(id) { this.pages = this.pages.filter(p => p.id !== id); if (this.active === id) this.go(this.visiblePages()[0] && this.visiblePages()[0].id); },

  // --- helpers shared by every page ---
  el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; },
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  // Every GET is remembered per install; when the server can't be reached, the last
  // answer comes back instead (and the shell shows an "offline · as of" bar). Writes
  // never pretend — they fail honestly.
  // Away from home the server wants your sign-in on every call (a session from
  // Profile, or the one the setup wizard left); at home it simply rides along.
  api(path, opts) {
    const isGet = !opts || !opts.method || opts.method === 'GET', key = 'labcache_' + path;
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), isGet ? 12000 : 120000);
    const s = this.store.get('session');
    const o = { ...(opts || {}), signal: ac.signal, headers: { ...((opts && opts.headers) || {}), ...(s ? { Authorization: 'Bearer ' + s } : {}) } };
    return fetch(this.ctx.server + path, o).then(async r => {
      clearTimeout(t);
      const j = await r.json().catch(() => ({}));
      this.setOnline(true);                      // it answered, even if it said no
      if (r.status === 401 && j.signin) this.needSignIn(j.error);
      if (!r.ok) { const e = new Error(j.error || 'Your L.A.B said no (' + r.status + ').'); e.status = r.status; throw e; }
      if (isGet) this.cache.put(key, j);
      return j;
    }).catch(e => {
      clearTimeout(t);
      const netFail = e instanceof TypeError || e.name === 'AbortError';
      if (netFail) {
        this.setOnline(false);
        if (isGet) { const c = this.cache.get(key); if (c && c.d !== undefined) { if (!this.cacheAge || c.t < this.cacheAge) this.cacheAge = c.t; return c.d; } }
        throw new Error(this.where === 'offline' ? 'Your L.A.B is out of reach right now.' : 'Could not reach your L.A.B.');
      }
      throw e;
    });
  },
  // The offline memory: the last answer per path, at most 200 of them, and a full
  // storage quota can never break a page.
  cache: {
    MAX: 200,
    put(key, d) {
      try { const s = JSON.stringify({ t: Date.now(), d }); if (s.length < 250000) localStorage.setItem(key, s); this.trim(this.MAX); }
      catch { this.trim(this.MAX / 2); }
    },
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    trim(max) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('labcache_')); if (keys.length <= max) return;
      keys.map(k => { let t = 0; try { t = JSON.parse(localStorage.getItem(k)).t || 0; } catch {} return [k, t]; })
        .sort((a, b) => a[1] - b[1]).slice(0, keys.length - max).forEach(([k]) => localStorage.removeItem(k));
    },
    clear() { Object.keys(localStorage).filter(k => k.startsWith('labcache_')).forEach(k => localStorage.removeItem(k)); }
  },
  // One quiet line at the bottom of the window. Writes that fail say so here
  // instead of silently snapping back.
  toast(msg) {
    let t = document.getElementById('toast'); if (!t) { t = this.el('div', 'toast'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 4500);
  },
  failed(what) { return e => { this.toast(what + (e && e.message ? ' — ' + e.message : '')); }; },
  // Away from home with no (or an expired) sign-in: say so once, point at Profile.
  needSignIn(msg) {
    if (this.ctx.needSignIn) return;
    this.ctx.needSignIn = true; this.store.del('session');
    const bar = document.getElementById('netbar');
    if (bar) { bar.hidden = false; bar.innerHTML = this.esc(msg || 'Sign in to use your L.A.B away from home.') + ' <a id="nb-signin">Sign in</a>'; bar.querySelector('#nb-signin').onclick = () => this.go('profile'); }
  },

  // --- reachability: home first, then the away (Tailscale) address ---
  online: true, where: 'home', cacheAge: 0, _recheck: null, _homeCheck: null, _serverWhere: 'home',
  ping(url) { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 2500); return fetch(url + '/api/health', { signal: ac.signal }).then(r => r.ok).catch(() => false).finally(() => clearTimeout(t)); },
  async homeAddr() { return this.store.get('server') || (await this.invoke('server_url')) || window.LAB_CONFIG.SERVER; },
  // yours if you typed one in Settings, otherwise the one the server told us (or the wizard left)
  awayAddr() { return this.store.get('server_away') || this.store.get('server_away_auto'); },
  async pickServer() {
    const home = await this.homeAddr(), away = this.awayAddr();
    if (await this.ping(home)) return { url: home, where: 'home' };
    if (away && away !== home && await this.ping(away)) return { url: away, where: 'away' };
    return { url: home, where: 'offline' };
  },
  // At home, the server says what its Tailscale address is; remember it for when you leave.
  learnAway() {
    this.api('/api/identity').then(id => {
      if (id && id.away && id.away.url) { try { this.store.set('server_away_auto', new URL(id.away.url).origin); } catch {} }
    }).catch(() => {});
  },
  switchTo(url, where) {
    this.ctx.server = url; this._serverWhere = where; this.where = where;
    this.setOnline(true); this.paintFoot();
    if (this.live) this.live.restart();
    if (this.active) this.go(this.active);
    if (where === 'home') this.learnAway();
    this.watchHome();
  },
  // On the away address, keep an ear out for home: back on the wifi, go back to it.
  watchHome() {
    clearInterval(this._homeCheck); this._homeCheck = null;
    if (this._serverWhere !== 'away') return;
    this._homeCheck = setInterval(async () => { const home = await this.homeAddr(); if (await this.ping(home)) this.switchTo(home, 'home'); }, 120000);
  },
  setOnline(on) {
    if (on === this.online && (on || this._recheck)) return;
    this.online = on;
    if (on) { this.where = this._serverWhere; clearInterval(this._recheck); this._recheck = null; this.cacheAge = 0; }
    else if (!this._recheck) {
      this.where = 'offline';
      this._recheck = setInterval(async () => { const s = await this.pickServer(); if (s.where !== 'offline') this.switchTo(s.url, s.where); }, 45000);
    }
    this.paintFoot();
  },
  paintFoot() {
    const f = document.getElementById('side-foot');
    if (f) f.textContent = (this.ctx.device ? 'native · ' : 'web · ') + 'v' + window.LAB_CONFIG.APP_VERSION + ' · ' + this.where;
    const bar = document.getElementById('netbar');
    if (bar && !this.ctx.needSignIn) { bar.hidden = this.online; if (!this.online) bar.textContent = 'Offline — showing what your L.A.B last said' + (this.cacheAge ? ' (as of ' + new Date(this.cacheAge).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ')' : '') + '. Reconnecting quietly.'; }
  },
  store: {
    get(k) { try { return JSON.parse(localStorage.getItem('labapp_' + k)); } catch { return null; } },
    set(k, v) {
      try { localStorage.setItem('labapp_' + k, JSON.stringify(v)); }
      catch { LAB.cache.trim(0); try { localStorage.setItem('labapp_' + k, JSON.stringify(v)); } catch {} }   // full: drop the offline copies first
      if (LAB.prefs.SYNCED.includes(k)) LAB.prefs.push();
    },
    del(k) { localStorage.removeItem('labapp_' + k); if (LAB.prefs.SYNCED.includes(k)) LAB.prefs.push(); }
  },

  // --- prefs that follow you between installs (widgets layout, look, theme) ---
  prefs: {
    SYNCED: ['widgets', 'look', 'skin', 'skinvars'], timer: null, pulling: false,
    // when this install last changed a synced pref; a change made offline wins over an older server copy
    push() {
      if (this.pulling) return;
      try { localStorage.setItem('labapp_prefs_at', JSON.stringify(new Date().toISOString())); } catch {}
      if (!LAB.ctx.me) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        const body = { widgets: LAB.store.get('widgets') || LAB.widgets.DEFAULT, look: LAB.look.get(), skin: LAB.store.get('skin'), skinvars: LAB.store.get('skinvars') };
        LAB.api('/api/accounts/' + LAB.ctx.me.id + '/prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
      }, 1500);
    },
    async pull() {
      if (!LAB.ctx.me) return false;
      let p = null; try { p = await LAB.api('/api/accounts/' + LAB.ctx.me.id + '/prefs'); } catch { return false; }
      if (!p || !p.updated_at) return false;
      const mine = LAB.store.get('prefs_at');
      if (mine && new Date(mine) > new Date(p.updated_at)) { this.push(); return true; }   // ours is newer: send it up instead
      this.pulling = true;
      try {
        if (Array.isArray(p.widgets)) LAB.store.set('widgets', p.widgets);
        if (p.look) { LAB.store.set('look', p.look); LAB.look.apply(); }
        if (p.skin && p.skinvars) { LAB.store.set('skin', p.skin); LAB.store.set('skinvars', p.skinvars); LAB.applySkin(p.skinvars); }
        else if (p.skin === null) { LAB.store.del('skin'); LAB.store.del('skinvars'); LAB.applySkin(null); }
      } finally { this.pulling = false; }
      return true;
    }
  },

  // --- native bridge (Tauri commands; graceful no-op in a plain browser) ---
  isNative() { return !!(window.__TAURI__ && window.__TAURI__.core); },
  async invoke(cmd, args) { if (this.isNative()) { try { return await window.__TAURI__.core.invoke(cmd, args); } catch { return null; } } return null; },

  // --- skins (shared with the web hub) ---
  applySkin(vars) { const r = document.documentElement.style, keys = ['--bg', '--panel', '--panel2', '--stroke', '--txt', '--txt2', '--a1', '--a2']; if (!vars) { keys.forEach(k => r.removeProperty(k)); return; } Object.entries(vars).forEach(([k, v]) => { if (keys.includes(k)) r.setProperty(k, v); }); },

  // --- looks: layout overhauls + effects (installed from the App Store, saved per install) ---
  look: {
    get() { return LAB.store.get('look') || { layout: 'default', effects: [] }; },
    save(l) { LAB.store.set('look', l); this.apply(); },
    apply() {
      const l = this.get(), c = document.documentElement.classList;
      [...c].filter(x => x.startsWith('layout-') || x.startsWith('fx-')).forEach(x => c.remove(x));
      c.add('layout-' + (l.layout || 'default')); (l.effects || []).forEach(e => c.add('fx-' + e));
    },
    setLayout(id) { const l = this.get(); l.layout = id; this.save(l); },
    toggleEffect(id) { const l = this.get(), s = new Set(l.effects || []); if (s.has(id)) s.delete(id); else s.add(id); l.effects = [...s]; this.save(l); },
    hasEffect(id) { return (this.get().effects || []).includes(id); }
  },

  // --- routing / shell ---
  active: null,
  go(id) {
    const p = this.pages.find(x => x.id === id) || this.visiblePages()[0];
    if (!p) return;
    this.active = p.id;
    document.querySelectorAll('#nav .navitem').forEach(n => n.classList.toggle('on', n.dataset.id === p.id));
    const main = document.getElementById('main');
    main.innerHTML = '';
    const wrap = this.el('div', 'page');
    main.appendChild(wrap);
    // pages that drive the house's own devices only exist on the home network
    if (p.homeOnly && this._serverWhere === 'away') {
      wrap.innerHTML = `<div class="phead"><h1>${this.esc(p.label)}</h1></div><div class="card"><div class="muted">${this.esc(p.label)} talks to devices on your home network, so it's here when you're home. You're connected from away right now; scenes still run from the Dashboard.</div></div>`;
      return;
    }
    const fail = e => { wrap.insertAdjacentHTML('beforeend', '<div class="err">This page hit a problem: ' + this.esc((e && e.message) || 'unknown error') + '</div>'); };
    try { const r = p.render(wrap, this.ctx); if (r && typeof r.catch === 'function') r.catch(fail); } catch (e) { fail(e); }
  },
  visiblePages() { return this.pages.filter(p => !p.show || p.show(this.ctx)); },
  renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = '';
    for (const p of this.visiblePages()) {
      const item = this.el('button', 'navitem', `<span class="ic">${p.icon || ''}</span><span>${this.esc(p.dynLabel ? p.dynLabel(this.ctx) : p.label)}</span>`);
      item.dataset.id = p.id;
      item.onclick = () => this.go(p.id);
      nav.appendChild(item);
    }
  },

  async boot() {
    // identity: reuse the account created via the web hub / wizard
    this.ctx.me = this.store.get('account');
    // The install wizard leaves a note on disk: the profile it built, who signed in,
    // the address it talked to and that sign-in — so the app is personalised, signed
    // in and pointed at the right place before you touch it. Read it before picking
    // a server: set up from outside the house, that address is the only one that works.
    const hint = await this.invoke('profile_hint');
    if (hint && hint.found) {
      if (hint.server) {
        try {
          const o = new URL(hint.server).origin;
          if (/^https?:\/\/(100\.|[^/]*\.ts\.net)/i.test(o)) { if (!this.store.get('server_away_auto')) this.store.set('server_away_auto', o); }
          else if (!this.store.get('server') && o !== new URL(await this.homeAddr()).origin) this.store.set('server', o);
        } catch {}
      }
      if (!this.store.get('signedOut')) {                 // once you sign out, the note doesn't sign you back in
        if (!this.ctx.me && hint.account_id && hint.account_name) { this.ctx.me = { id: String(hint.account_id), name: String(hint.account_name), role: 'member' }; this.store.set('account', this.ctx.me); }
        if (hint.session && !this.store.get('session') && this.ctx.me && String(this.ctx.me.id) === String(hint.account_id)) this.store.set('session', hint.session);
      }
      if (!this.store.get('profileId') && hint.id) this.store.set('profileId', String(hint.id));
    }
    // server: home address (your override > launch env > built-in) if it answers, else the away address, else offline on the home address
    const picked = await this.pickServer();
    this.ctx.server = picked.url; this._serverWhere = picked.where === 'away' ? 'away' : 'home'; this.where = picked.where; this.online = picked.where !== 'offline';
    if (!this.online) this.setOnline(false);
    if (picked.where === 'home') this.learnAway();
    this.watchHome();
    // native device probe (real, only in the compiled app)
    this.ctx.device = await this.invoke('device_info');
    // closing to the tray is remembered across launches (the native side starts each run at "on")
    const ctt = this.store.get('close_to_tray'); if (ctt != null) this.invoke('close_to_tray_set', { enable: !!ctt });
    const pid = this.store.get('profileId');
    if (pid) this.ctx.profile = await this.api('/api/wizard/profile/' + pid).catch(() => null);
    // apply saved skin + look, then let your synced prefs (if you're signed in) win
    try { const sv = this.store.get('skinvars'); if (sv) this.applySkin(sv); } catch {}
    try { this.look.apply(); } catch {}
    if (this.ctx.me) await this.prefs.pull().catch(() => false);
    this.paintFoot();
    this.renderNav();
    if (this.genpages) this.genpages.load();   // tabs made by your builders that you've added
    this.go(this.store.get('lastPage') || (this.visiblePages()[0] && this.visiblePages()[0].id));
    // remember last page
    const _go = this.go.bind(this); this.go = (id) => { this.store.set('lastPage', id); _go(id); };
    // the splash goes once there is something to look at
    const sp = document.getElementById('boot'); if (sp) { sp.classList.add('gone'); setTimeout(() => sp.remove(), 350); }
  }
});
