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
  // Sunday evening: one line about the week, from real numbers, once
  async digest() {
    if (!this.enabled() || !LAB.telemetry.enabled) return;
    const d = new Date(); if (d.getDay() !== 0 || d.getHours() < 18) return;
    const key = d.toLocaleDateString('en-CA'); if (LAB.store.get('digest_done') === key) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    let s = null; try { s = await LAB.api(`/api/usage/summary?device_id=${encodeURIComponent(LAB.telemetry.deviceId())}&days=7&tz=${encodeURIComponent(tz)}`); } catch { return; }
    if (!s || !s.active_minutes) return;
    const tot = s.days.reduce((a, x) => a + x.total, 0), cats = {}; s.days.forEach(x => Object.entries(x.cats).forEach(([k, v]) => { cats[k] = (cats[k] || 0) + v; }));
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
    let streak = 0; for (let i = s.days.length - 1; i >= 0; i--) { if (s.days[i].total >= 30) streak++; else break; }
    LAB.store.set('digest_done', key);
    await LAB.invoke('notify', { title: 'Your week on ' + ((LAB.ctx.device && LAB.ctx.device.hostname) || 'this PC'), body: `${LAB.stats.fmtMin(tot)} active · mostly ${top ? top[0] : '—'}${streak > 1 ? ' · ' + streak + '-day streak' : ''}. Details in Stats.` });
  },
  start() { if (this.timer || !this.enabled()) return; this.tick(); this.digest(); this.timer = setInterval(() => { this.tick(); this.digest(); }, this.EVERY_MS); },
  stop() { clearInterval(this.timer); this.timer = null; }
};
