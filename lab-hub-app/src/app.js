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
  api(path, opts) {
    const isGet = !opts || !opts.method || opts.method === 'GET', key = 'labcache_' + path;
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), isGet ? 12000 : 120000);
    return fetch(this.ctx.server + path, { ...(opts || {}), signal: ac.signal }).then(async r => {
      clearTimeout(t);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'error');
      if (isGet) { try { const s = JSON.stringify(j); if (s.length < 250000) localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: j })); } catch {} }
      this.setOnline(true);
      return j;
    }).catch(e => {
      clearTimeout(t);
      const netFail = e instanceof TypeError || e.name === 'AbortError';
      if (netFail) {
        this.setOnline(false);
        if (isGet) { try { const c = JSON.parse(localStorage.getItem(key)); if (c && c.d !== undefined) { if (!this.cacheAge || c.t < this.cacheAge) this.cacheAge = c.t; return c.d; } } catch {} }
        throw new Error(this.where === 'offline' ? 'Your L.A.B is out of reach right now.' : 'Could not reach your L.A.B.');
      }
      throw e;
    });
  },

  // --- reachability: home first, then the away (Tailscale) address ---
  online: true, where: 'home', cacheAge: 0, _recheck: null,
  ping(url) { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 2500); return fetch(url + '/api/health', { signal: ac.signal }).then(r => r.ok).catch(() => false).finally(() => clearTimeout(t)); },
  async pickServer() {
    const home = this.store.get('server') || (await this.invoke('server_url')) || window.LAB_CONFIG.SERVER;
    const away = this.store.get('server_away');
    if (await this.ping(home)) return { url: home, where: 'home' };
    if (away && await this.ping(away)) return { url: away, where: 'away' };
    return { url: home, where: 'offline' };
  },
  setOnline(on) {
    if (on === this.online && (on || this._recheck)) return;
    this.online = on;
    if (on) { if (this.where === 'offline') this.where = 'home'; clearInterval(this._recheck); this._recheck = null; this.cacheAge = 0; }
    else if (!this._recheck) {
      this.where = 'offline';
      this._recheck = setInterval(async () => { const s = await this.pickServer(); if (s.where !== 'offline') { this.ctx.server = s.url; this.where = s.where; this.setOnline(true); this.paintFoot(); if (this.live) this.live.restart(); if (this.active) this.go(this.active); } }, 45000);
    }
    this.paintFoot();
  },
  paintFoot() {
    const f = document.getElementById('side-foot');
    if (f) f.textContent = (this.ctx.device ? 'native · ' : 'web · ') + 'v' + window.LAB_CONFIG.APP_VERSION + ' · ' + this.where;
    const bar = document.getElementById('netbar');
    if (bar) { bar.hidden = this.online; if (!this.online) bar.textContent = 'Offline — showing what your L.A.B last said' + (this.cacheAge ? ' (as of ' + new Date(this.cacheAge).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ')' : '') + '. Reconnecting quietly.'; }
  },
  store: {
    get(k) { try { return JSON.parse(localStorage.getItem('labapp_' + k)); } catch { return null; } },
    set(k, v) { localStorage.setItem('labapp_' + k, JSON.stringify(v)); if (LAB.prefs.SYNCED.includes(k)) LAB.prefs.push(); },
    del(k) { localStorage.removeItem('labapp_' + k); if (LAB.prefs.SYNCED.includes(k)) LAB.prefs.push(); }
  },

  // --- prefs that follow you between installs (widgets layout, look, theme) ---
  prefs: {
    SYNCED: ['widgets', 'look', 'skin', 'skinvars'], timer: null, pulling: false,
    push() {
      if (!LAB.ctx.me || this.pulling) return;
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
    try { p.render(wrap, this.ctx); } catch (e) { wrap.innerHTML = '<div class="err">This module failed to load: ' + this.esc(e.message) + '</div>'; }
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
    // server: home address (your override > launch env > built-in) if it answers, else the away address, else offline on the home address
    const picked = await this.pickServer();
    this.ctx.server = picked.url; this.where = picked.where; this.online = picked.where !== 'offline';
    if (!this.online) this.setOnline(false);
    // native device probe (real, only in the compiled app)
    this.ctx.device = await this.invoke('device_info');
    // personalization profile from the install wizard (if any). The wizard also
    // leaves a note on disk (profile id + who signed in) that the native app reads
    // on first launch — so it's personalised and signed in before you touch it.
    let pid = this.store.get('profileId');
    if (!pid || !this.ctx.me) {
      const hint = await this.invoke('profile_hint');
      if (hint && hint.found) {
        if (!pid && hint.id) { pid = String(hint.id); this.store.set('profileId', pid); }
        if (!this.ctx.me && hint.account_id && hint.account_name) { this.ctx.me = { id: String(hint.account_id), name: String(hint.account_name), role: 'member' }; this.store.set('account', this.ctx.me); }
      }
    }
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
  }
});
