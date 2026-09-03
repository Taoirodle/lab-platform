// ============================================================
//  L.A.B Hub — Dashboard (slot 1). Your home screen: a grid of widgets you
//  arrange. Widgets come from modules/widgets.js, the App Store and your
//  server's builders. Order + choice are saved per install.
// ============================================================
LAB.register({ id: 'dashboard', label: 'Dashboard', icon: I.home, order: 1,
  async render(el, ctx) {
    const h = new Date().getHours();
    const greet = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    el.innerHTML = head(greet + (ctx.me ? ', ' + ctx.me.name : ''), new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + ' · your personal L.A.B.');
    await LAB.widgets.loadGenerated();
    const grid = LAB.el('div', 'wgrid'), bar = LAB.el('div', 'wbar');
    el.appendChild(grid); el.appendChild(bar);
    el.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) LAB.go(g.dataset.go); });

    const paint = () => {
      grid.innerHTML = '';
      const ids = LAB.widgets.installed();
      for (const id of ids) {
        const w = LAB.widgets.get(id); if (!w || (w.native && !LAB.isNative())) continue;
        const card = LAB.el('div', 'card w ' + (w.size || 'sm'));
        card.innerHTML = `<div class="whead"><h3>${LAB.esc(w.title)}</h3><span class="wtools"><button data-a="-1" title="Move up">↑</button><button data-a="1" title="Move down">↓</button><button data-a="x" title="Remove from dashboard">×</button></span></div><div class="wbody"></div>`;
        card.querySelectorAll('.wtools button').forEach(b => b.onclick = () => { if (b.dataset.a === 'x') LAB.widgets.remove(id); else LAB.widgets.move(id, +b.dataset.a); paint(); });
        grid.appendChild(card);
        const body = card.querySelector('.wbody'), snag = () => { body.innerHTML = '<div class="muted">This widget hit a snag.</div>'; };
        try { const r = w.render(body, ctx); if (r && r.catch) r.catch(snag); } catch { snag(); }
      }
      const avail = LAB.widgets.usable().filter(w => !ids.includes(w.id));
      bar.innerHTML = avail.length
        ? '<span class="muted">Add a widget:</span>' + avail.map(w => `<button class="btn" data-add="${LAB.esc(w.id)}">${LAB.esc(w.title)}${w.generated ? ' <em>· by your builders</em>' : ''}</button>`).join('')
        : '<span class="muted">Everything is on your dashboard. New widgets arrive from the App Store and your builders.</span>';
      bar.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { LAB.widgets.add(b.dataset.add); paint(); });
    };
    paint();
  }
});
