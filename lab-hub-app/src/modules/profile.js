// ============================================================
//  L.A.B Hub — Profile (slot 2). Who you are on the L.A.B: sign in (same name
//  + PIN as the family Hub), avatar, what you share with the family, the
//  devices linked to you, your PIN. Edits are confirmed with your PIN.
// ============================================================
(() => {
const J = { 'Content-Type': 'application/json' };
const EMOJI = ['🙂', '😎', '🦊', '🐼', '🐸', '🦉', '🐙', '🌵', '🚀', '🎮', '🎧', '🎨', '⚡', '🌊', '🔥', '🍕', '🏄', '🧠', '🛠️', '🌙'];
const COLORS = ['#9a86ff', '#ff9e6b', '#ffcf6f', '#6fb4ff', '#7ee2b8', '#ff7bb0', '#c9a7ff', '#98a1ba'];

async function signIn(mode, name, pin) {
  const a = await LAB.api('/api/accounts' + (mode === 'login' ? '/login' : ''), { method: 'POST', headers: J, body: JSON.stringify({ name, pin }) });
  LAB.store.set('account', a); LAB.ctx.me = a;
  // this PC becomes yours: link its device + any samples it sent before you signed in
  if (LAB.isNative() && LAB.telemetry) LAB.api('/api/usage/link', { method: 'POST', headers: J, body: JSON.stringify({ device_id: LAB.telemetry.deviceId(), account_id: a.id }) }).catch(() => {});
  LAB.api('/api/events', { method: 'POST', headers: J, body: JSON.stringify({ account_id: a.id, type: 'login', payload: { name: a.name, app: 'hub-app' } }) }).catch(() => {});
  LAB.renderNav();
  return a;
}
LAB.account = { signIn, signOut() { LAB.store.del('account'); LAB.ctx.me = null; LAB.renderNav(); } };

function gate(el) {
  let mode = 'login';
  const card = LAB.el('div', 'card gate'); el.appendChild(card);
  const draw = () => {
    card.innerHTML = `<h3>${mode === 'login' ? 'Log in' : 'Create your account'}</h3><div class="muted">${mode === 'login' ? 'Same name and PIN as on the family Hub.' : 'Your name on the Hub and a 4–8 digit PIN.'}</div>
      <form class="gateform"><input id="g-name" placeholder="Name" maxlength="40" required autocomplete="off"><input id="g-pin" type="password" inputmode="numeric" placeholder="PIN" maxlength="8" required><button class="btn pri">${mode === 'login' ? 'Log in' : 'Create'}</button></form>
      <div class="muted" id="g-msg"></div><div class="muted">${mode === 'login' ? 'New here? <a id="g-sw">Create an account</a>' : 'Already set up? <a id="g-sw">Log in</a>'}</div>`;
    card.querySelector('#g-sw').onclick = () => { mode = mode === 'login' ? 'create' : 'login'; draw(); };
    card.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const msg = card.querySelector('#g-msg'); msg.textContent = '…';
      try { await signIn(mode, card.querySelector('#g-name').value.trim(), card.querySelector('#g-pin').value.trim()); LAB.go('profile'); }
      catch (err) { msg.textContent = err.message; }
    };
  };
  draw();
}

LAB.register({ id: 'profile', label: 'Profile', icon: I.user, order: 2,
  async render(el, ctx) {
    if (!ctx.me) { el.innerHTML = head('Profile', 'Sign in and this app becomes yours.'); gate(el); return; }
    let me = ctx.me;
    try { const fresh = await LAB.api('/api/accounts/' + me.id); me = { ...me, ...fresh }; LAB.store.set('account', me); LAB.ctx.me = me; } catch {}
    const av = me.avatar || { emoji: '🙂', color: COLORS[0] }, p = (ctx.profile && ctx.profile.personalization) || {};
    const pick = { ...av }, priv = { share_stats: false, share_calendar: false, ...(me.privacy || {}) };
    el.innerHTML = head('Profile', 'Who you are on the L.A.B.');

    const idc = LAB.el('div', 'card idcard'); el.appendChild(idc);
    idc.innerHTML = `<div class="avatar" id="av" style="background:${LAB.esc(av.color)}">${LAB.esc(av.emoji)}</div>
      <div class="idtext"><div class="big">${LAB.esc(me.name)}</div><div class="muted">${LAB.esc(me.role || 'member')} · on the Hub since ${me.created_at ? new Date(me.created_at).toLocaleDateString() : '—'}</div>
      ${p.archetype ? `<div class="muted">This machine: <b>${LAB.esc(p.archetype)}</b> · signature tab <b>${LAB.esc(p.personalizedTab || '—')}</b></div>` : ''}</div>
      <button class="btn" id="signout">Sign out</button>`;
    idc.querySelector('#signout').onclick = () => { LAB.account.signOut(); LAB.go('profile'); };

    const save = LAB.el('div', 'card savebar'); save.hidden = true;
    save.innerHTML = `<form class="wadd"><span class="muted">Confirm with your PIN to save</span><input type="password" inputmode="numeric" placeholder="PIN" maxlength="8" required style="flex:0 0 120px"><button class="btn pri">Save changes</button></form><div class="muted" id="s-msg"></div>`;
    const dirty = () => { save.hidden = false; };

    const avc = LAB.el('div', 'card'); el.appendChild(avc);
    const preview = () => { const a = idc.querySelector('#av'); a.style.background = pick.color; a.textContent = pick.emoji; dirty(); };
    const drawAv = () => {
      avc.innerHTML = `<h3>Avatar</h3><div class="emojis">${EMOJI.map(e => `<button class="emo ${pick.emoji === e ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
        <div class="swatches">${COLORS.map(c => `<button class="sw ${pick.color === c ? 'on' : ''}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>`;
      avc.querySelectorAll('.emo').forEach(b => b.onclick = () => { pick.emoji = b.dataset.e; drawAv(); preview(); });
      avc.querySelectorAll('.sw').forEach(b => b.onclick = () => { pick.color = b.dataset.c; drawAv(); preview(); });
    };
    drawAv();

    const pvc = LAB.el('div', 'card'); el.appendChild(pvc);
    pvc.innerHTML = `<h3>What the family can see</h3>
      <label class="wcheck"><input type="checkbox" id="p-stats" ${priv.share_stats ? 'checked' : ''}><span>My usage stats (hours by kind, top apps) on the family Hub</span></label>
      <label class="wcheck"><input type="checkbox" id="p-cal" ${priv.share_calendar ? 'checked' : ''}><span>My linked calendars on the family calendar</span></label>
      <div class="muted">Everything is off by default. Window titles never leave your PC either way.</div>`;
    pvc.querySelector('#p-stats').onchange = e => { priv.share_stats = e.target.checked; dirty(); };
    pvc.querySelector('#p-cal').onchange = e => { priv.share_calendar = e.target.checked; dirty(); };
    el.appendChild(save);
    save.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const msg = save.querySelector('#s-msg'); msg.textContent = '…';
      try {
        const a = await LAB.api('/api/accounts/' + me.id, { method: 'PATCH', headers: J, body: JSON.stringify({ pin: e.target.querySelector('input').value, avatar: pick, privacy: priv }) });
        me = { ...me, ...a }; LAB.store.set('account', me); LAB.ctx.me = me; msg.textContent = 'Saved.'; save.hidden = true; e.target.reset(); LAB.renderNav();
      } catch (err) { msg.textContent = err.message; }
    };

    const dv = LAB.el('div', 'card'); el.appendChild(dv); dv.innerHTML = '<h3>Your devices</h3><div class="muted">loading…</div>';
    LAB.api('/api/accounts/' + me.id + '/devices').then(r => {
      const rows = (r.devices || []).map(d => `<div class="prow"><span><b>${LAB.esc(d.name || d.id)}</b><div class="muted">${d.kind === 'hub-app' ? 'L.A.B Hub app' : LAB.esc(d.kind || '')} · ${LAB.esc(d.os || '')} · ${d.last_seen ? 'seen ' + new Date(d.last_seen).toLocaleString() : 'never seen'}</div></span><span class="muted">${d.active_7d ? LAB.stats.fmtMin(d.active_7d) + ' active this week' : ''}</span></div>`).join('');
      const profs = (r.profiles || []).map(x => `<div class="prow"><span><b>${LAB.esc(x.hostname || 'PC')}</b><div class="muted">wizard profile · ${LAB.esc(x.archetype || '')} · ${LAB.esc(x.os || '')}</div></span><span class="muted">${new Date(x.created_at).toLocaleDateString()}</span></div>`).join('');
      dv.innerHTML = '<h3>Your devices</h3>' + (rows + profs || '<div class="muted">No devices linked yet — this one links the moment it sends its first sample.</div>');
    }).catch(() => { dv.innerHTML = '<h3>Your devices</h3><div class="muted">Could not load devices.</div>'; });

    const pc = LAB.el('div', 'card'); el.appendChild(pc);
    pc.innerHTML = `<h3>PIN</h3><form class="wadd"><input type="password" inputmode="numeric" placeholder="Current PIN" maxlength="8" required><input type="password" inputmode="numeric" placeholder="New PIN (4–8 digits)" maxlength="8" required><button class="btn">Change PIN</button></form><div class="muted" id="pc-msg"></div>`;
    pc.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const [cur, nw] = [...e.target.querySelectorAll('input')].map(i => i.value); const msg = pc.querySelector('#pc-msg'); msg.textContent = '…';
      try { await LAB.api('/api/accounts/' + me.id, { method: 'PATCH', headers: J, body: JSON.stringify({ pin: cur, new_pin: nw }) }); msg.textContent = 'PIN changed.'; e.target.reset(); }
      catch (err) { msg.textContent = err.message; }
    };
  }
});
})();
