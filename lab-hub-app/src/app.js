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

  // --- helpers shared by every page ---
  el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; },
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  api(path, opts) { return fetch(this.ctx.server + path, opts).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'error'); return j; }); },
  store: {
    get(k) { try { return JSON.parse(localStorage.getItem('labapp_' + k)); } catch { return null; } },
    set(k, v) { localStorage.setItem('labapp_' + k, JSON.stringify(v)); },
    del(k) { localStorage.removeItem('labapp_' + k); }
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
    this.ctx.server = (await this.invoke('server_url')) || window.LAB_CONFIG.SERVER;
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
    // apply saved skin + look
    try { const sv = this.store.get('skinvars'); if (sv) this.applySkin(sv); } catch {}
    try { this.look.apply(); } catch {}
    // footer
    document.getElementById('side-foot').textContent = (this.ctx.device ? 'native · ' : 'web · ') + 'v' + window.LAB_CONFIG.APP_VERSION;
    this.renderNav();
    this.go(this.store.get('lastPage') || (this.visiblePages()[0] && this.visiblePages()[0].id));
    // remember last page
    const _go = this.go.bind(this); this.go = (id) => { this.store.set('lastPage', id); _go(id); };
  }
});
