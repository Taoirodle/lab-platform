// ============================================================
//  L.A.B Hub — what's new. Shown once after an update (and any time from
//  Settings). Short, and only things that changed for the person using it.
// ============================================================
LAB.whatsNew = {
  version: '1.8',
  items: [
    ['Works away from home', 'With Tailscale on, the app reaches your L.A.B from anywhere. It learns the address while you\'re home, and goes back to home by itself when you are.'],
    ['Signed in means you', 'Away from home the app and the Hub ask who you are, so only family reach the family\'s lists, calendar and house.'],
    ['Nothing fails quietly', 'If a change doesn\'t go through, a line at the bottom says why instead of it just snapping back.'],
    ['Sign out sticks, and your data is yours', 'Signing out stays signed out, "delete my data" tells you if it couldn\'t, and a layout you change offline isn\'t overwritten.'],
    ['Setup that works everywhere', 'The setup wizard now runs on any Windows PC, and from outside the house too.']
  ],
  show() {
    let box = document.getElementById('wnew');
    if (!box) { box = LAB.el('div', 'wnew'); box.id = 'wnew'; document.body.appendChild(box); }
    box.innerHTML = `<div class="card wnewcard"><h3>New in ${LAB.esc(this.version)}</h3>`
      + this.items.map(([t, s]) => `<div class="prow" style="display:block"><b>${LAB.esc(t)}</b><div class="muted">${LAB.esc(s)}</div></div>`).join('')
      + `<div class="btnrow" style="margin-top:14px"><button class="btn pri" id="wnew-ok">Got it</button></div></div>`;
    box.hidden = false;
    box.querySelector('#wnew-ok').onclick = () => { box.hidden = true; LAB.store.set('seen_version', window.LAB_CONFIG.APP_VERSION); };
  },
  // once per version, and never on a fresh install (nothing is "new" on day one)
  maybeShow() {
    const seen = LAB.store.get('seen_version');
    if (seen === window.LAB_CONFIG.APP_VERSION) return;
    if (!seen && !LAB.store.get('lastPage')) { LAB.store.set('seen_version', window.LAB_CONFIG.APP_VERSION); return; }
    this.show();
  }
};
