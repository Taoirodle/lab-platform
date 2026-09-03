// ============================================================
//  L.A.B Hub — App Store (slot 5). Two shelves:
//   · packaged apps from your server's catalog — "Install" records it on your
//     server; where the app maps to something already built, "Open" goes there.
//   · Hub-side: overhauls (layout), effects, colour themes and widgets — these
//     change THIS app the moment you tap them and are saved per install.
//  Nothing here pretends: an app that isn't built yet says so.
// ============================================================
(() => {
const J = { 'Content-Type': 'application/json' };
const OPENS = { sauce: 'sauce', rooms: 'automations', family: 'calendar', pulse: 'stats' };
const LAYOUTS = [
  { id: 'default', title: 'Classic rail', sub: 'Sidebar with labels — the default.' },
  { id: 'compact', title: 'Compact rail', sub: 'Icon-only sidebar, more room for content.' },
  { id: 'topbar', title: 'Top bar', sub: 'Navigation across the top, full-width pages.' }
];
const EFFECTS = [
  { id: 'glass', title: 'Glass panels', sub: 'Frosted, translucent cards.' },
  { id: 'glow', title: 'Ambient glow', sub: 'A soft accent-coloured light behind the rail.' },
  { id: 'calm', title: 'Calm motion', sub: 'No hover lifts, no fades. Just content.' },
  { id: 'dense', title: 'Dense', sub: 'Tighter spacing, smaller cards.' }
];
const fmtMB = b => b ? (b / 1048576).toFixed(b > 10485760 ? 0 : 1) + ' MB' : '';

LAB.register({ id: 'appstore', label: 'App Store', icon: I.store, order: 5,
  async render(el, ctx) {
    el.innerHTML = head('App Store', 'Apps for your L.A.B, and ways to make this app yours.');
    const box = LAB.el('div', 'storewrap'); el.appendChild(box);
    box.innerHTML = '<div class="storeside" id="ss"></div><div class="storemain" id="sm"></div>';
    const [store, inst, gens] = await Promise.all([
      LAB.api('/api/store/apps').catch(() => ({ apps: [], categories: [] })),
      ctx.me ? LAB.api('/api/store/installs?account_id=' + encodeURIComponent(ctx.me.id)).catch(() => ({ installed: [] })) : Promise.resolve({ installed: [] }),
      LAB.api('/api/hub/generations').catch(() => ({ skins: [], widgets: [] }))
    ]);
    const apps = store.apps || [], installed = new Set(inst.installed || []);
    const CATS = [{ k: 'suggested', label: 'Suggested' }, ...(store.categories || []).map(c => ({ k: 'cat:' + c, label: c })),
      { k: 'overhaul', label: 'Hub overhauls' }, { k: 'effect', label: 'Effects' }, { k: 'skin', label: 'Colour / themes' }, { k: 'widget', label: 'Widgets' }];
    const ss = box.querySelector('#ss'), sm = box.querySelector('#sm');
    let cur = 'suggested', open = null;
    ss.innerHTML = CATS.map(c => `<button class="cat" data-k="${LAB.esc(c.k)}">${LAB.esc(c.label)}</button>`).join('');
    ss.querySelectorAll('.cat').forEach(b => b.onclick = () => { cur = b.dataset.k; open = null; paint(); });

    function appCard(a) {
      const isIn = installed.has(a.id), go = OPENS[a.id], soonApp = a.status === 'soon';
      return `<div class="acard app" data-app="${LAB.esc(a.id)}"><div class="arow"><div class="aicon"><svg viewBox="0 0 32 32" fill="none" stroke="${LAB.esc(a.accent || '#888')}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${a.icon || ''}</svg></div>
        <div><div class="an">${LAB.esc(a.name)}${soonApp ? '<span class="badge">soon</span>' : ''}${isIn ? '<span class="badge on">installed</span>' : ''}</div><div class="as">${LAB.esc(a.tagline || '')}</div></div></div>
        ${open === a.id ? `<div class="adesc">${LAB.esc(a.desc || '')}</div><div class="apreview">${a.preview || ''}</div><div class="muted">v${LAB.esc(a.version || '')} · ${fmtMB(a.size_bytes)} · ${a.installs || 0} install${a.installs === 1 ? '' : 's'} on your L.A.B</div>` : ''}
        <div class="abtns">${isIn ? (go ? `<button class="btn pri" data-go="${go}">Open</button>` : '<button class="btn" disabled>Not built yet</button>') + `<button class="btn" data-rm="${LAB.esc(a.id)}">Remove</button>`
          : `<button class="btn pri" data-in="${LAB.esc(a.id)}" ${soonApp ? 'disabled' : ''}>${soonApp ? 'Coming' : 'Install'}</button>`}<button class="btn" data-more="${LAB.esc(a.id)}">${open === a.id ? 'Less' : 'Details'}</button></div></div>`;
    }
    function lookCard(title, sub, on, attr) { return `<div class="card look"><div class="lookrow"><div><b>${LAB.esc(title)}</b><div class="muted">${LAB.esc(sub)}</div></div><button class="btn ${on ? 'pri' : ''}" ${attr}>${on ? 'On' : 'Use'}</button></div></div>`; }

    function paint() {
      ss.querySelectorAll('.cat').forEach(b => b.classList.toggle('on', b.dataset.k === cur));
      let html = '';
      if (cur === 'suggested') {
        const feat = apps.filter(a => a.featured || a.status === 'published').slice(0, 6);
        html = feat.map(appCard).join('') + (ctx.me ? '' : '<div class="muted full">Sign in on Profile to install apps — everything else here works right away.</div>');
      } else if (cur.startsWith('cat:')) {
        const list = apps.filter(a => a.category === cur.slice(4)); html = list.length ? list.map(appCard).join('') : soon(cur.slice(4) + ' apps');
      } else if (cur === 'overhaul') {
        const l = LAB.look.get().layout || 'default';
        html = LAYOUTS.map(x => lookCard(x.title, x.sub, l === x.id, `data-layout="${x.id}"`)).join('') + '<div class="muted full">Overhauls change the shape of this app. Full reskins from your builders will show up here too.</div>';
      } else if (cur === 'effect') {
        html = EFFECTS.map(x => lookCard(x.title, x.sub, LAB.look.hasEffect(x.id), `data-fx="${x.id}"`)).join('');
      } else if (cur === 'skin') {
        const curSkin = LAB.store.get('skin');
        html = lookCard('Default', 'The L.A.B look — coral on violet.', !curSkin, 'data-skin="default"')
          + (gens.skins || []).map(s => lookCard(s.title, s.summary || 'made by your builders', curSkin === s.id, `data-skin="${LAB.esc(s.id)}"`)).join('')
          + ((gens.skins || []).length ? '' : '<div class="muted full">Your builders publish colour themes here as they make them.</div>');
      } else if (cur === 'widget') {
        html = LAB.widgets.usable().map(w => lookCard(w.title, w.generated ? (w.summary || 'made by your builders') : 'built in', LAB.widgets.has(w.id), `data-widget="${LAB.esc(w.id)}"`)).join('')
          + '<div class="muted full">Widgets live on your Dashboard. "On" means it\'s there.</div>';
      }
      sm.innerHTML = html;
      sm.querySelectorAll('[data-more]').forEach(b => b.onclick = () => { open = open === b.dataset.more ? null : b.dataset.more; paint(); });
      sm.querySelectorAll('[data-go]').forEach(b => b.onclick = () => LAB.go(b.dataset.go));
      sm.querySelectorAll('[data-in],[data-rm]').forEach(b => b.onclick = async () => {
        if (!ctx.me) { LAB.go('profile'); return; }
        const id = b.dataset.in || b.dataset.rm; b.disabled = true;
        try { const r = await LAB.api('/api/store/install', { method: 'POST', headers: J, body: JSON.stringify({ account_id: ctx.me.id, app_id: id, remove: !!b.dataset.rm }) }); installed.clear(); (r.installed || []).forEach(x => installed.add(x)); } catch {}
        paint();
      });
      sm.querySelectorAll('[data-layout]').forEach(b => b.onclick = () => { LAB.look.setLayout(b.dataset.layout); paint(); });
      sm.querySelectorAll('[data-fx]').forEach(b => b.onclick = () => { LAB.look.toggleEffect(b.dataset.fx); paint(); });
      sm.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => {
        const id = b.dataset.skin;
        if (id === 'default') { LAB.store.del('skin'); LAB.store.del('skinvars'); LAB.applySkin(null); }
        else { const s = (gens.skins || []).find(x => x.id === id); if (s && s.payload && s.payload.vars) { LAB.store.set('skin', id); LAB.store.set('skinvars', s.payload.vars); LAB.applySkin(s.payload.vars); } }
        paint();
      });
      sm.querySelectorAll('[data-widget]').forEach(b => b.onclick = () => { const id = b.dataset.widget; if (LAB.widgets.has(id)) LAB.widgets.remove(id); else LAB.widgets.add(id); paint(); });
    }
    await LAB.widgets.loadGenerated();
    paint();
  }
});
})();
