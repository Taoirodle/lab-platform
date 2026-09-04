// ============================================================
//  L.A.B Hub — For you (slot 7). The tab the wizard names and shapes for this
//  PC. Gaming → your library + playtime; Work → recent files, a focus timer;
//  Creativity → recent creative files + the tools you actually used;
//  multitask / unknown → a blend. Real content read natively, or honest blanks.
// ============================================================
(() => {
const CREATIVE_EXT = new Set(['psd', 'ai', 'blend', 'prproj', 'aep', 'fig', 'kra', 'xcf', 'svg', 'afphoto', 'afdesign', 'flp', 'als', 'rpp', 'aup3', 'c4d', 'ma', 'mb', 'max', 'clip', 'procreate', 'drp', 'indd', 'sketch', 'png', 'jpg', 'jpeg', 'mp4', 'mov', 'wav', 'mp3', 'stl', '3mf', 'gcode']);
const WORK_EXT = new Set(['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf', 'txt', 'md', 'csv', 'json', 'js', 'ts', 'py', 'rs', 'java', 'cs', 'cpp', 'c', 'h', 'html', 'css', 'sql', 'ipynb', 'odt', 'ods', 'odp', 'one', 'msg', 'eml', 'ps1', 'sh', 'yml', 'yaml', 'toml']);
const ago = s => { if (!s) return ''; const d = Date.now() / 1000 - s; return d < 3600 ? Math.max(1, Math.round(d / 60)) + 'm ago' : d < 86400 ? Math.round(d / 3600) + 'h ago' : Math.round(d / 86400) + 'd ago'; };
const rows = (files, empty) => files.length ? files.map(f => `<div class="prow"><span><b>${LAB.esc(f.name)}</b></span><span class="muted">${ago(f.modified)}</span></div>`).join('') : `<div class="muted">${empty}</div>`;

LAB.register({ id: 'personalized', label: 'For you', icon: I.star, order: 7,
  dynLabel(ctx) { return (ctx.profile && ctx.profile.personalization && ctx.profile.personalization.personalizedTab) || 'For you'; },
  async render(el, ctx) {
    const p = (ctx.profile && ctx.profile.personalization) || {}, kind = p.archetype || null;
    el.innerHTML = head(p.personalizedTab || 'For you', p.report || 'Run the setup wizard from the web Hub and this tab shapes itself around how you use your PC.');
    if (!LAB.isNative()) { el.appendChild(LAB.el('div', 'card', soon('this tab reads your game library and recent files natively — it lives in the installed app'))); return; }
    const games = (await LAB.invoke('game_library')) || [], recent = (await LAB.invoke('recent_files')) || [];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    let usage = null; try { usage = await LAB.api(`/api/usage/summary?device_id=${encodeURIComponent(LAB.telemetry.deviceId())}&days=30&tz=${encodeURIComponent(tz)}`); } catch {}
    const top = (usage && usage.top_apps) || [];
    const blend = !kind || kind === 'multitask' || kind === 'everything';
    const showGames = kind === 'gaming' || (blend && games.length > 0);
    const showWork = kind === 'work' || blend;
    const showCreative = kind === 'creative' || blend;

    if (showGames) {
      const c = LAB.el('div', 'card'); el.appendChild(c);
      const played = top.filter(a => a.category === 'Gaming');
      const gameMins = usage ? usage.days.reduce((s, d) => s + (d.cats.Gaming || 0), 0) : 0;
      c.innerHTML = `<h3>Your library${games.length ? ' · ' + games.length : ''}</h3>` + (games.length
        ? `<div class="muted" style="margin-bottom:10px">${LAB.stats.fmtMin(gameMins)} played in the last 30 days${played[0] ? ' · most: <b>' + LAB.esc(played[0].app) + '</b>' : ''}</div>
           <div class="gamegrid">${games.slice(0, 24).map(g => `<div class="game"><b>${LAB.esc(g.name)}</b><span>${LAB.esc(g.source)}${g.size_gb ? ' · ' + g.size_gb + ' GB' : ''}${g.last_played ? ' · played ' + ago(g.last_played) : ''}</span></div>`).join('')}</div>${games.length > 24 ? `<div class="muted">and ${games.length - 24} more</div>` : ''}`
        : '<div class="muted">No Steam or Epic library found on this PC.</div>');
    }
    if (showWork) {
      const c = LAB.el('div', 'card'); el.appendChild(c);
      c.innerHTML = '<h3>Pick up where you left off</h3>' + rows(recent.filter(f => WORK_EXT.has(f.ext)).slice(0, 12), 'No recent documents found yet.');
      const t = LAB.el('div', 'card'); el.appendChild(t);
      t.innerHTML = `<h3>Focus</h3><div class="focusrow"><div class="big" id="f-time">25:00</div><div class="btnrow"><button class="btn pri" id="f-25">Start 25 min</button><button class="btn" id="f-5">5 min break</button><button class="btn" id="f-stop" hidden>Stop</button></div></div>
        <div class="muted">A plain timer. Afterwards, Stats shows what you actually did with it.</div>`;
      let iv = null, end = 0;
      const show = () => { const left = Math.max(0, Math.round((end - Date.now()) / 1000)); t.querySelector('#f-time').textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); if (!left) { stop(); t.querySelector('#f-time').textContent = 'Done'; } };
      const stop = () => { clearInterval(iv); iv = null; t.querySelector('#f-stop').hidden = true; };
      const start = m => { end = Date.now() + m * 60000; clearInterval(iv); iv = setInterval(() => { if (!document.body.contains(t)) return clearInterval(iv); show(); }, 500); t.querySelector('#f-stop').hidden = false; show(); };
      t.querySelector('#f-25').onclick = () => start(25); t.querySelector('#f-5').onclick = () => start(5);
      t.querySelector('#f-stop').onclick = () => { stop(); t.querySelector('#f-time').textContent = '25:00'; };
    }
    if (showCreative) {
      const c = LAB.el('div', 'card'); el.appendChild(c);
      const tools = top.filter(a => a.category === 'Creativity').slice(0, 5);
      c.innerHTML = '<h3>In the studio</h3>' + rows(recent.filter(f => CREATIVE_EXT.has(f.ext)).slice(0, 12), 'No recent creative files found yet.')
        + (tools.length ? `<div class="muted" style="margin-top:10px">Your tools this month: ${tools.map(a => `<b>${LAB.esc(a.app)}</b> ${LAB.stats.fmtMin(a.mins)}`).join(' · ')}</div>` : '');
    }
    if (!kind) el.appendChild(LAB.el('div', 'privacy', 'This is the blended view. Run the setup wizard and your L.A.B agents name and shape this tab for how you actually use this PC.'));
  }
});
})();
