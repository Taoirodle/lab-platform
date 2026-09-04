// ============================================================
//  L.A.B Hub — Calendar (slot 3). Month grid + day agenda that merges the
//  family calendar with your linked calendars. Google / Apple / Outlook link
//  through their private iCal addresses — no OAuth, no tunnel, and the feed
//  only ever touches your own server.
// ============================================================
(() => {
const J = { 'Content-Type': 'application/json' };
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PROVIDERS = {
  google: { label: 'Google', color: '#6fb4ff', steps: ['Google Calendar on the web → Settings (gear) → pick the calendar in the left list.', 'Scroll to "Integrate calendar" and copy the "Secret address in iCal format".', 'Paste it below. Keep it private — anyone with that link can read the calendar.'] },
  apple: { label: 'Apple', color: '#ff7bb0', steps: ['iCloud.com → Calendar → the share icon next to the calendar.', 'Tick "Public Calendar" and copy the webcal:// link.', 'Paste it below — webcal links work as they are.'] },
  outlook: { label: 'Outlook', color: '#7ee2b8', steps: ['Outlook on the web → Settings → Calendar → Shared calendars.', 'Under "Publish a calendar" pick the calendar and "Can view all details", then Publish.', 'Copy the ICS link and paste it below.'] },
  other: { label: 'Other', color: '#ffcf6f', steps: ['Any calendar with an iCal / ICS / webcal subscription link works.', 'Paste the link below.'] }
};

LAB.calendar = {
  eventsPath(from, to) {
    const a = LAB.ctx.me ? '&account_id=' + encodeURIComponent(LAB.ctx.me.id) : '';
    return `/api/calendar/events?from=${from || ymd(new Date(Date.now() - 86400000))}&to=${to || ymd(new Date(Date.now() + 60 * 86400000))}${a}`;
  }
};

LAB.register({ id: 'calendar', label: 'Calendar', icon: I.cal, order: 3,
  async render(el, ctx) {
    el.innerHTML = head('Calendar', 'The family calendar and your own, together. Link Google, Apple or Outlook in a minute.');
    let cur = new Date(); cur.setDate(1);
    let sel = ymd(new Date()), events = [];
    const wrap = LAB.el('div', 'calwrap'); el.appendChild(wrap);
    wrap.innerHTML = `
      <div class="card"><div class="calnav"><button class="btn" id="c-prev" title="Previous month">‹</button><b id="c-title"></b><button class="btn" id="c-next" title="Next month">›</button><button class="btn" id="c-today">Today</button></div><div class="calgrid" id="c-grid"></div></div>
      <div class="card"><h3 id="a-title">Agenda</h3><div id="a-list"></div>
        <form class="wadd" id="a-add"><input placeholder="Add a family event…" maxlength="120"><input type="time" id="a-time" style="flex:0 0 auto"><button class="btn pri">Add</button></form>
        <div class="muted">Family events are seen by everyone on the Hub.</div></div>`;
    const feedsCard = LAB.el('div', 'card'); el.appendChild(feedsCard);
    // the other direction: put the family calendar on every phone
    const sub = LAB.el('div', 'card'); el.appendChild(sub);
    const icsUrl = ctx.server.replace(/\/+$/, '') + '/api/calendar/family.ics';
    sub.innerHTML = `<h3>Family calendar on your phone</h3><div class="muted">Subscribe once and family events (plus calendars shared with the family) show up in your phone's own calendar app, refreshed automatically. On the home network or over Tailscale.</div>
      <form class="wadd" style="margin-top:10px"><input readonly value="${LAB.esc(icsUrl)}" onclick="this.select()"><button class="btn" type="button" id="ics-copy">Copy</button></form>
      <div class="muted">iPhone: Settings → Calendar → Accounts → Add Subscribed Calendar. Android/Google: paste it under "From URL" on calendar.google.com. Outlook: Add calendar → Subscribe from web.</div>`;
    sub.querySelector('#ics-copy').onclick = async () => { try { await navigator.clipboard.writeText(icsUrl); sub.querySelector('#ics-copy').textContent = 'Copied'; } catch {} };

    async function load() {
      const from = ymd(new Date(cur.getFullYear(), cur.getMonth(), -6)), to = ymd(new Date(cur.getFullYear(), cur.getMonth() + 1, 7));
      try { events = await LAB.api(LAB.calendar.eventsPath(from, to)); } catch { events = []; }
      paint();
    }
    function paint() {
      wrap.querySelector('#c-title').textContent = MONTHS[cur.getMonth()] + ' ' + cur.getFullYear();
      const g = wrap.querySelector('#c-grid'), first = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const startOff = (first.getDay() + 6) % 7, dim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate(), today = ymd(new Date());
      let html = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<div class="cdow">${d}</div>`).join('');
      const rows = Math.ceil((startOff + dim) / 7) * 7;
      for (let i = 0; i < rows; i++) {
        const n = i - startOff + 1;
        if (n < 1 || n > dim) { html += '<div class="cday off"></div>'; continue; }
        const d = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(n)}`, evs = events.filter(e => e.day === d);
        html += `<div class="cday${d === today ? ' today' : ''}${d === sel ? ' sel' : ''}" data-d="${d}"><span class="cn">${n}</span>`
          + evs.slice(0, 3).map(e => `<i class="chip" style="background:${e.color || 'var(--a2)'}" title="${LAB.esc(e.title)}">${LAB.esc(e.title)}</i>`).join('')
          + (evs.length > 3 ? `<i class="more">+${evs.length - 3} more</i>` : '') + '</div>';
      }
      g.innerHTML = html;
      g.querySelectorAll('.cday[data-d]').forEach(c => c.onclick = () => { sel = c.dataset.d; paint(); });
      const day = new Date(sel + 'T12:00:00');
      wrap.querySelector('#a-title').textContent = day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
      const list = events.filter(e => e.day === sel);
      wrap.querySelector('#a-list').innerHTML = list.length ? list.map(e => `<div class="aev"><span class="atime">${e.all_day ? 'all day' : LAB.esc(e.at_time || '') + (e.end_time ? '–' + LAB.esc(e.end_time) : '')}</span>
        <div><b>${LAB.esc(e.title)}</b><div class="muted">${e.source === 'family' ? 'Family calendar' + (e.by ? ' · ' + LAB.esc(e.by) : '') : LAB.esc(e.feed || '')}${e.location ? ' · ' + LAB.esc(e.location) : ''}</div></div>
        <i class="dot" style="background:${e.color || 'var(--a2)'}"></i></div>`).join('') : '<div class="muted">Nothing on this day.</div>';
    }
    wrap.querySelector('#c-prev').onclick = () => { cur.setMonth(cur.getMonth() - 1); load(); };
    wrap.querySelector('#c-next').onclick = () => { cur.setMonth(cur.getMonth() + 1); load(); };
    wrap.querySelector('#c-today').onclick = () => { cur = new Date(); cur.setDate(1); sel = ymd(new Date()); load(); };
    wrap.querySelector('#a-add').onsubmit = async e => {
      e.preventDefault(); const t = e.target.querySelector('input').value.trim(); if (!t) return;
      const at = wrap.querySelector('#a-time').value;
      await LAB.api('/api/shared/events', { method: 'POST', headers: J, body: JSON.stringify({ title: t, day: sel, time: at || null, by: ctx.me && ctx.me.name }) }).catch(() => {});
      e.target.reset(); load();
    };

    // ---- linked calendars ----
    let prov = 'google';
    async function paintFeeds() {
      let feeds = []; try { feeds = await LAB.api('/api/calendar/feeds' + (ctx.me ? '?account_id=' + encodeURIComponent(ctx.me.id) : '')); } catch {}
      const draw = () => {
        feedsCard.innerHTML = `<h3>Your calendars</h3>` + (feeds.length ? feeds.map(f => `<div class="prow"><span><i class="dot" style="background:${LAB.esc(f.color || '#6fb4ff')}"></i> <b>${LAB.esc(f.name)}</b>${f.shared ? '<em class="tag">family</em>' : ''}
            <div class="muted">${f.event_count || 0} events · ${f.last_status === 'ok' ? 'synced ' + (f.last_fetch ? new Date(f.last_fetch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '') : LAB.esc(f.last_status || 'pending')}</div></span>
            <span class="btnrow"><button class="btn" data-refresh="${LAB.esc(f.id)}">Sync</button><button class="btn" data-del="${LAB.esc(f.id)}">Remove</button></span></div>`).join('') : '<div class="muted">No linked calendars yet — your events stay on this server, refreshed every 30 minutes.</div>')
          + `<h3 style="margin-top:20px">Link a calendar</h3>
          <div class="btnrow ptabs">${Object.entries(PROVIDERS).map(([k, p]) => `<button class="btn ${k === prov ? 'pri' : ''}" data-prov="${k}">${p.label}</button>`).join('')}</div>
          <ol class="steps">${PROVIDERS[prov].steps.map(s => `<li>${LAB.esc(s)}</li>`).join('')}</ol>
          <form class="feedform" id="f-add"><input id="f-name" placeholder="Name (e.g. Work)" maxlength="60" required><input id="f-url" placeholder="Paste the iCal / webcal link" required>
            <input type="color" id="f-color" value="${PROVIDERS[prov].color}" title="Colour"><label class="chk"><input type="checkbox" id="f-shared"> Show it to the whole family</label><button class="btn pri">Link</button></form>
          <div class="muted" id="f-msg"></div>`;
        feedsCard.querySelectorAll('[data-prov]').forEach(b => b.onclick = () => { prov = b.dataset.prov; draw(); });
        feedsCard.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { b.disabled = true; await LAB.api('/api/calendar/feeds/' + encodeURIComponent(b.dataset.del) + (ctx.me ? '?account_id=' + encodeURIComponent(ctx.me.id) : ''), { method: 'DELETE' }).catch(() => {}); paintFeeds(); load(); });
        feedsCard.querySelectorAll('[data-refresh]').forEach(b => b.onclick = async () => { b.disabled = true; b.textContent = '…'; await LAB.api('/api/calendar/feeds/' + encodeURIComponent(b.dataset.refresh) + '/refresh', { method: 'POST' }).catch(() => {}); paintFeeds(); load(); });
        feedsCard.querySelector('#f-add').onsubmit = async e => {
          e.preventDefault(); const msg = feedsCard.querySelector('#f-msg'), btn = e.target.querySelector('button.pri');
          msg.textContent = 'Reading the calendar…'; btn.disabled = true;
          try {
            const r = await LAB.api('/api/calendar/feeds', { method: 'POST', headers: J, body: JSON.stringify({ account_id: ctx.me && ctx.me.id, name: feedsCard.querySelector('#f-name').value, url: feedsCard.querySelector('#f-url').value, color: feedsCard.querySelector('#f-color').value, shared: feedsCard.querySelector('#f-shared').checked }) });
            msg.textContent = `Linked ${r.name} — ${r.events} events.`; paintFeeds(); load();
          } catch (err) { msg.textContent = err.message; btn.disabled = false; }
        };
      };
      draw();
    }
    load(); paintFeeds();
  }
});
})();
