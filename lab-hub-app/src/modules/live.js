// ============================================================
//  L.A.B Hub — live updates. One WebSocket to your server; when anyone changes
//  a shared thing (list, calendar, devices…) the server says so and the page
//  you're on refreshes at once. Reconnects on its own; quiet while offline.
// ============================================================
LAB.live = {
  ws: null, tries: 0, timer: null, last: 0,
  url() { return LAB.ctx.server.replace(/^http/, 'ws') + '/ws'; },
  start() {
    if (this.ws || !LAB.ctx.server) return;
    try { this.ws = new WebSocket(this.url()); } catch { return this.retry(); }
    this.ws.onopen = () => { this.tries = 0; };
    this.ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type !== 'shared') return;
      this.last = Date.now();
      document.dispatchEvent(new CustomEvent('lab:shared', { detail: m }));
    };
    this.ws.onclose = () => { this.ws = null; this.retry(); };
    this.ws.onerror = () => { try { this.ws && this.ws.close(); } catch {} };
  },
  retry() { clearTimeout(this.timer); const wait = Math.min(60000, 2000 * Math.pow(2, Math.min(5, this.tries++))); this.timer = setTimeout(() => this.start(), wait); },
  restart() { try { this.ws && this.ws.close(); } catch {} this.ws = null; this.tries = 0; this.start(); }
};

// Pages that show shared things re-render when they change — unless you're mid-typing.
const LIVE_PAGES = { todos: ['dashboard'], events: ['dashboard', 'calendar'], calendar: ['dashboard', 'calendar'], conductor: ['dashboard', 'automations'], kiosk: ['dashboard', 'automations'], sauce: ['dashboard', 'calendar', 'automations'], store: ['appstore'] };
let liveDebounce = null;
document.addEventListener('lab:shared', e => {
  const pages = LIVE_PAGES[e.detail.what] || []; if (!LAB.active || !pages.includes(LAB.active)) return;
  const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a.value) return;
  clearTimeout(liveDebounce); liveDebounce = setTimeout(() => LAB.go(LAB.active), 400);
});
