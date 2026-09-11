// ============================================================
//  L.A.B Hub — "Your week": the one card that is about YOU, not the house.
//  Everything here is measured on this machine — no hardware, no family
//  needed. Hours, what you actually ran, your longest sit, your peak hour.
// ============================================================
(() => {
const fmt = m => { m = Math.round(m || 0); const h = Math.floor(m / 60); return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`; };
const dayName = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });
// A few real titles get a friendlier face; everything else keeps its process name.
const PRETTY = { 'fallout4': 'Fallout 4', 'bodycam-win64-shipping': 'BodyCam', 'code': 'VS Code', 'msedge': 'Edge', 'chrome': 'Chrome', 'opera': 'Opera', 'opera_gx': 'Opera GX', 'steam': 'Steam', 'claude': 'Claude', 'explorer': 'Windows', 'pwsh': 'Terminal', 'powershell': 'Terminal', 'devenv': 'Visual Studio', 'obs64': 'OBS', 'discord': 'Discord', 'spotify': 'Spotify' };
const nice = a => PRETTY[String(a || '').toLowerCase()] || String(a || '').replace(/-win64-shipping$/i, '').replace(/\b\w/g, c => c.toUpperCase());

LAB.widgets.register({ id: 'week', title: 'Your week', size: 'lg',
  async render(el, ctx) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const dev = LAB.telemetry.deviceId();
    let s = null;
    try { s = await LAB.api(`/api/usage/summary?device_id=${encodeURIComponent(dev)}&days=14&tz=${encodeURIComponent(tz)}`); } catch {}
    if (!s || !s.active_minutes) {
      el.innerHTML = `<div class="muted">Nothing measured yet. Leave the Hub running and this fills in with your hours, what you ran and when you were at it.${LAB.telemetry.enabled ? '' : ' Measuring is currently <b>off</b> in Settings.'}</div>`;
      return;
    }
    const days = s.days || [], week = days.slice(-7), prev = days.slice(-14, -7);
    const tot = week.reduce((a, d) => a + d.total, 0), prevTot = prev.reduce((a, d) => a + d.total, 0);
    const C = (LAB.stats && LAB.stats.COLOR) || {}, CATS = (LAB.stats && LAB.stats.CATS) || [];
    const cats = {}; week.forEach(d => Object.entries(d.cats).forEach(([k, v]) => { cats[k] = (cats[k] || 0) + v; }));
    const play = cats.Gaming || 0, work = (cats.Work || 0) + (cats.Creativity || 0);
    const best = week.reduce((a, d) => (d.total > (a ? a.total : -1) ? d : a), null);
    const apps = (s.top_apps || []).slice(0, 4);
    const peak = (s.hours || []).map((v, i) => [v, i]).sort((a, b) => b[0] - a[0])[0];
    const delta = prevTot ? tot - prevTot : null;

    el.innerHTML = `
      <div class="weekhero">
        <div><div class="wkbig">${fmt(tot)}</div><div class="muted">at this machine over 7 days${delta !== null ? ` · <b style="color:${delta >= 0 ? 'var(--a2)' : 'var(--txt2)'}">${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta))}</b> vs the week before` : ''}</div></div>
        <div class="wksplit">
          ${play ? `<div><span style="color:${C.Gaming}">●</span> Playing <b>${fmt(play)}</b></div>` : ''}
          ${work ? `<div><span style="color:${C.Work}">●</span> Working <b>${fmt(work)}</b></div>` : ''}
        </div>
      </div>
      <canvas class="chart" id="wk-days"></canvas>
      <div class="wkrow">
        <div class="wkcol"><h4>What you actually ran</h4><canvas class="chart" id="wk-apps"></canvas></div>
        <div class="wkcol"><h4>The details</h4><div id="wk-facts"></div></div>
      </div>`;

    const present = CATS.filter(c => days.some(d => d.cats[c.k]));
    LAB.charts.stacked(el.querySelector('#wk-days'),
      days.map((d, i) => ({ label: new Date(d.d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })[0], values: d.cats, hot: i === days.length - 1 })),
      present.length ? present : CATS.slice(0, 1), { height: 120 });
    LAB.charts.hbars(el.querySelector('#wk-apps'),
      apps.map(a => ({ label: nice(a.app), value: a.mins, color: C[a.category] || C.Other })), { fmt });

    // the details worth telling someone: longest unbroken sit, biggest day, peak hour
    const facts = [];
    if (best && best.total) facts.push(`<div class="prow"><span>Biggest day</span><b>${dayName(best.d)} · ${fmt(best.total)}</b></div>`);
    if (peak && peak[0]) facts.push(`<div class="prow"><span>Peak hour</span><b>${String(peak[1]).padStart(2, '0')}:00</b></div>`);
    if (apps[0]) facts.push(`<div class="prow"><span>Most time in</span><b>${LAB.esc(nice(apps[0].app))}</b></div>`);
    el.querySelector('#wk-facts').innerHTML = facts.join('') + '<div class="prow"><span>Longest sit</span><b id="wk-sit">…</b></div>';
    if (best) {
      try {
        const d = await LAB.api(`/api/usage/day?device_id=${encodeURIComponent(dev)}&date=${best.d}&tz=${encodeURIComponent(tz)}`);
        const run = (d.runs || []).filter(r => !r.idle).sort((a, b) => b.mins - a.mins)[0];
        const sit = el.querySelector('#wk-sit');
        if (sit) sit.textContent = run ? `${fmt(run.mins)} in ${nice(run.app)}` : '—';
      } catch { const sit = el.querySelector('#wk-sit'); if (sit) sit.textContent = '—'; }
    }
  } });
})();
