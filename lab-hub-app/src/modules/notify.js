// ============================================================
//  L.A.B Hub — reminders (native only). Every few minutes: anything on the
//  merged calendar starting within the next 15 minutes gets one OS
//  notification. Nothing else, ever — no nags, no marketing.
// ============================================================
LAB.notify = {
  timer: null, LEAD_MIN: 15, EVERY_MS: 3 * 60 * 1000,
  enabled() { return LAB.isNative() && LAB.store.get('reminders') !== false; },
  async tick() {
    if (!this.enabled()) return;
    const today = new Date().toLocaleDateString('en-CA'), tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');
    let ev = []; try { ev = await LAB.api(LAB.calendar ? LAB.calendar.eventsPath(today, tomorrow) : `/api/calendar/events?from=${today}&to=${tomorrow}`); } catch { return; }
    const seen = new Set(LAB.store.get('notified') || []), now = Date.now();
    for (const e of ev) {
      if (e.all_day || !e.at_time) continue;
      const at = new Date(e.day + 'T' + e.at_time + ':00').getTime(), key = e.id + '@' + e.day + e.at_time;
      const mins = (at - now) / 60000;
      if (mins < -1 || mins > this.LEAD_MIN || seen.has(key)) continue;
      seen.add(key);
      await LAB.invoke('notify', { title: (mins <= 1 ? 'Now: ' : 'In ' + Math.round(mins) + ' min: ') + e.title, body: (e.source === 'family' ? 'Family calendar' : (e.feed || 'Your calendar')) + (e.location ? ' · ' + e.location : '') });
    }
    LAB.store.set('notified', [...seen].slice(-200));
  },
  start() { if (this.timer || !this.enabled()) return; this.tick(); this.timer = setInterval(() => this.tick(), this.EVERY_MS); },
  stop() { clearInterval(this.timer); this.timer = null; }
};
