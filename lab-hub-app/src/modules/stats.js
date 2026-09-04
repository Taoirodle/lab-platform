// ============================================================
//  L.A.B Hub — Stats (slot 9). Real numbers only: the native sampler measures
//  what's in front of you once a minute; your server turns that into days, top
//  apps and peak hours. No data → no chart, and it says so.
// ============================================================
(() => {
const CATS = [
  { k: 'Gaming', color: '#ff9e6b' }, { k: 'Work', color: '#9a86ff' }, { k: 'Creativity', color: '#ffcf6f' },
  { k: 'Browsing', color: '#6fb4ff' }, { k: 'Comms', color: '#7ee2b8' }, { k: 'Entertainment', color: '#ff7bb0' },
  { k: 'Other', color: '#98a1ba' }
];
const COLOR = Object.fromEntries(CATS.map(c => [c.k, c.color]));
const fmtMin = m => { m = Math.round(m || 0); const h = Math.floor(m / 60); return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`; };
const fmtUp = s => { s = s || 0; const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };
const wd = d => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(d + 'T12:00:00').getDay()];
LAB.stats = { CATS, COLOR, fmtMin, fmtUp };

LAB.register({ id: 'stats', label: 'Stats', icon: I.stats, order: 9,
  dynLabel(ctx) { return (ctx.profile && ctx.profile.personalization && ctx.profile.personalization.statsKind) || 'Stats'; },
  async render(el, ctx) {
    const kind = (ctx.profile && ctx.profile.personalization && ctx.profile.personalization.statsKind) || 'Usage stats';
    el.innerHTML = head(kind, 'How you actually use this machine — measured by the app, summarised by your server.');
    if (!LAB.isNative()) { el.appendChild(LAB.el('div', 'card', soon('measuring needs the installed app — a browser can\'t see what\'s running'))); return; }

    // ---- right now (live, straight from the sampler) ----
    const live = LAB.el('div', 'card');
    live.innerHTML = `<h3>Right now</h3><div class="liverow"><div><div class="fgname" id="l-name">…</div><div class="fgtitle muted" id="l-title"></div></div>
      <div class="gauges"><div class="gauge"><span>CPU</span><b id="l-cpu">–</b></div><div class="gauge"><span>RAM</span><b id="l-mem">–</b></div>
      <div class="gauge"><span>Up</span><b id="l-up">–</b></div><div class="gauge"><span>You</span><b id="l-idle">–</b></div></div></div>`;
    el.appendChild(live);
    const paintLive = s => {
      if (!s) return; const f = s.foreground;
      const self = f && (f.name === 'lab-hub' || f.name === 'l.a.b hub');
      live.querySelector('#l-name').innerHTML = f
        ? `<i class="dot" style="background:${COLOR[f.category] || COLOR.Other}"></i>${self ? 'L.A.B Hub (this app)' : LAB.esc(f.name)} <span class="cat">${LAB.esc(f.category)}</span>`
        : (s.supports_foreground ? 'nothing in front' : 'front-app detection is Windows-only for now');
      live.querySelector('#l-title').textContent = (f && !self && f.title) || '';
      live.querySelector('#l-cpu').textContent = Math.round(s.cpu) + '%';
      live.querySelector('#l-mem').textContent = Math.round(100 * s.mem_used_mb / Math.max(1, s.mem_total_mb)) + '%';
      live.querySelector('#l-up').textContent = fmtUp(s.uptime_s);
      live.querySelector('#l-idle').textContent = s.idle_s == null ? '—' : s.idle_s >= LAB.telemetry.IDLE_AFTER_S ? 'away' : 'active';
    };
    paintLive(LAB.telemetry.last);
    const onT = e => { if (!document.body.contains(live)) return document.removeEventListener('lab:telemetry', onT); paintLive(e.detail); };
    document.addEventListener('lab:telemetry', onT);
    if (!LAB.telemetry.last && LAB.telemetry.enabled) LAB.telemetry.sample();

    // ---- history (your server) ----
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
    let sum = null;
    try { sum = await LAB.api(`/api/usage/summary?device_id=${encodeURIComponent(LAB.telemetry.deviceId())}&days=14&tz=${encodeURIComponent(tz)}`); } catch {}
    if (!sum || !sum.active_minutes) {
      el.appendChild(LAB.el('div', 'card', `<div class="soon">Collecting. The app samples once a minute while it's open — after some real use this fills in with your days, your top apps and your peak hours.${LAB.telemetry.enabled ? '' : ' Measuring is currently <b>off</b> in Settings.'}</div>`));
      return;
    }

    const days = sum.days || [], today = days[days.length - 1] || { cats: {}, total: 0 };
    const week = days.slice(-7), weekTot = week.reduce((s, d) => s + d.total, 0);
    const catWeek = {}; week.forEach(d => Object.entries(d.cats).forEach(([k, v]) => { catWeek[k] = (catWeek[k] || 0) + v; }));
    const topCat = Object.entries(catWeek).sort((a, b) => b[1] - a[1])[0];
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) { if (days[i].total >= 30) streak++; else if (i === days.length - 1) continue; else break; }

    const kp = LAB.el('div', 'kpis');
    kp.innerHTML = `<div class="kpi"><span>Today</span><b>${fmtMin(today.total)}</b></div><div class="kpi"><span>This week</span><b>${fmtMin(weekTot)}</b></div>
      <div class="kpi"><span>Streak</span><b>${streak} day${streak === 1 ? '' : 's'}</b></div>
      <div class="kpi"><span>Mostly</span><b>${topCat ? `<i style="background:${COLOR[topCat[0]] || COLOR.Other}"></i>${LAB.esc(topCat[0])}` : '—'}</b></div>`;
    el.appendChild(kp);

    const c1 = LAB.el('div', 'card'); c1.innerHTML = '<h3>Last 14 days · active time by kind <span class="muted">· tap a day</span></h3><canvas class="chart" id="ch-days"></canvas><div class="legend" id="lg"></div>'; el.appendChild(c1);
    const present = CATS.filter(c => days.some(d => d.cats[c.k]));
    const dayCanvas = c1.querySelector('#ch-days');
    LAB.charts.stacked(dayCanvas, days.map((d, i) => ({ label: wd(d.d), values: d.cats, hot: i === days.length - 1 })), present.length ? present : CATS.slice(0, 1));
    c1.querySelector('#lg').innerHTML = present.map(c => `<span><i style="background:${c.color}"></i>${c.k} · ${fmtMin(catWeek[c.k] || 0)} this week</span>`).join('');

    // one day, minute by minute: runs of the same app collapse into blocks
    const tl = LAB.el('div', 'card'); tl.innerHTML = '<h3 id="tl-h">Today · timeline</h3><canvas class="chart" id="ch-tl"></canvas><div id="tl-list"></div>'; el.appendChild(tl);
    const showDay = async d => {
      let day = null; try { day = await LAB.api(`/api/usage/day?device_id=${encodeURIComponent(LAB.telemetry.deviceId())}&date=${d}&tz=${encodeURIComponent(tz)}`); } catch {}
      const isToday = d === new Date().toLocaleDateString('en-CA');
      tl.querySelector('#tl-h').textContent = (isToday ? 'Today' : new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })) + ' · ' + fmtMin(day ? day.active_minutes : 0) + ' active';
      const runs = (day && day.runs) || [];
      const now = new Date(); LAB.charts.timeline(tl.querySelector('#ch-tl'), runs.map(r => ({ start: r.start, end: r.end, color: r.idle ? '#3a3f55' : (COLOR[r.category] || COLOR.Other), dim: r.idle })), { now: isToday ? now.getHours() * 60 + now.getMinutes() : null });
      const big = runs.filter(r => !r.idle && r.mins >= 5).slice(-12).reverse();
      tl.querySelector('#tl-list').innerHTML = big.length ? big.map(r => `<div class="prow"><span><i class="dot" style="background:${COLOR[r.category] || COLOR.Other}"></i> ${LAB.esc(r.app || 'something')}</span><span class="muted">${r.start}–${r.end} · ${fmtMin(r.mins)}</span></div>`).join('') : `<div class="muted">${runs.length ? 'Only short bursts that day.' : 'Nothing measured that day.'}</div>`;
    };
    dayCanvas.style.cursor = 'pointer';
    dayCanvas.onclick = e => { const rect = dayCanvas.getBoundingClientRect(); const x = e.clientX - rect.left, padL = 36, iw = rect.width - padL - 8; const i = Math.floor((x - padL) / (iw / days.length)); if (i >= 0 && i < days.length) showDay(days[i].d); };
    showDay(days[days.length - 1].d);

    if (sum.top_apps && sum.top_apps.length) {
      const c2 = LAB.el('div', 'card'); c2.innerHTML = '<h3>Top apps · 7 days</h3><canvas class="chart" id="ch-apps"></canvas>'; el.appendChild(c2);
      LAB.charts.hbars(c2.querySelector('#ch-apps'), sum.top_apps.map(a => ({ label: a.app, value: a.mins, color: COLOR[a.category] || COLOR.Other })), { fmt: fmtMin });
    }

    const hrs = sum.hours || new Array(24).fill(0);
    const peak = hrs.map((v, i) => [v, i]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]).sort((a, b) => a - b);
    const c3 = LAB.el('div', 'card');
    c3.innerHTML = `<h3>When you're on · 14 days</h3><canvas class="chart" id="ch-hrs"></canvas><div class="muted">Peak hours: ${peak.length ? peak.map(h => String(h).padStart(2, '0') + ':00').join(', ') : '—'} · measuring since ${sum.first_seen ? new Date(sum.first_seen).toLocaleDateString() : '—'}</div>`;
    el.appendChild(c3);
    LAB.charts.heat(c3.querySelector('#ch-hrs'), hrs, LAB.charts.cssVar('--a1', '#9a86ff'));

    const exp = LAB.el('div', 'btnrow'); exp.style.marginTop = '14px'; exp.innerHTML = '<button class="btn" id="st-csv">Export the last 30 days as CSV</button><span class="muted" id="st-csv-msg"></span>'; el.appendChild(exp);
    exp.querySelector('#st-csv').onclick = async () => {
      const msg = exp.querySelector('#st-csv-msg'); msg.textContent = 'Preparing…';
      try {
        const r = await fetch(`${ctx.server}/api/usage/export.csv?device_id=${encodeURIComponent(LAB.telemetry.deviceId())}&days=30&tz=${encodeURIComponent(tz)}`); const csv = await r.text();
        const p = await LAB.invoke('save_to_downloads', { name: 'lab-usage-' + new Date().toISOString().slice(0, 10) + '.csv', content: csv });
        msg.textContent = p ? 'Saved to ' + p : 'Could not save.';
      } catch { msg.textContent = 'Could not export right now.'; }
    };
    el.appendChild(LAB.el('div', 'privacy', 'Measured on this PC once a minute while the app is open. Only the app name, its kind and machine load reach your server — window titles are shown live here and never stored. Switch it off in Settings.'));
  }
});
})();
