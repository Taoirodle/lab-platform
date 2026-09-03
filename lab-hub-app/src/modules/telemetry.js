// ============================================================
//  L.A.B Hub — telemetry sampler (native only)
//  Once a minute while the app is open: what's in front of you, how busy the
//  machine is, whether you're at the keyboard. Kept locally in a 24h ring and
//  synced to YOUR server in small batches. Window titles are shown live in the
//  UI but never stored and never sent. Off switch lives in Settings.
// ============================================================
LAB.telemetry = {
  SAMPLE_MS: 60000,
  SYNC_EVERY: 5,          // samples per batch (≈5 min)
  IDLE_AFTER_S: 300,      // 5 min without input = away
  last: null, history: [], pending: [], timer: null, enabled: true,

  /// Stable per-install id (not the hostname — two PCs can share a name).
  deviceId() {
    let id = LAB.store.get('deviceId');
    if (!id) { id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); LAB.store.set('deviceId', id); }
    return id;
  },

  async sample() {
    const s = await LAB.invoke('usage_snapshot');
    if (!s) return null;
    this.last = s;
    const idle = s.idle_s != null && s.idle_s >= this.IDLE_AFTER_S;
    // what counts as "what you're doing": the focused app unless it's the OS
    // shell or this app itself — then the busiest real process.
    let app = s.foreground && s.foreground.category !== 'System' ? s.foreground : null;
    if (!app) app = (s.top || []).find(p => p.category !== 'System' && p.cpu >= 1) || null;
    const sm = {
      t: Math.floor(s.ts / 60) * 60,
      app: app ? app.name : null,
      cat: app ? app.category : 'Other',
      cpu: Math.round(s.cpu),
      mem: Math.round(100 * s.mem_used_mb / Math.max(1, s.mem_total_mb)),
      idle
    };
    this.history.push(sm); if (this.history.length > 1440) this.history.shift();
    this.pending.push(sm);
    LAB.store.set('tele_hist', this.history.slice(-1440));
    LAB.store.set('tele_pending', this.pending.slice(-600));
    if (this.pending.length >= this.SYNC_EVERY) this.sync();
    document.dispatchEvent(new CustomEvent('lab:telemetry', { detail: s }));
    return s;
  },

  async sync() {
    if (!this.pending.length) return false;
    const batch = this.pending.splice(0, 600);
    try {
      await LAB.api('/api/usage/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        device_id: this.deviceId(), account_id: LAB.ctx.me && LAB.ctx.me.id,
        hostname: LAB.ctx.device && LAB.ctx.device.hostname, os: LAB.ctx.device && LAB.ctx.device.os, samples: batch }) });
      LAB.store.set('tele_pending', this.pending);
      return true;
    } catch {
      this.pending = batch.concat(this.pending).slice(-600);   // keep for next time
      LAB.store.set('tele_pending', this.pending);
      return false;
    }
  },

  start() {
    if (!LAB.isNative() || this.timer) return;
    this.enabled = LAB.store.get('telemetry') !== false;
    if (!this.enabled) return;
    this.history = LAB.store.get('tele_hist') || [];
    this.pending = LAB.store.get('tele_pending') || [];
    this.sample();
    this.timer = setInterval(() => this.sample(), this.SAMPLE_MS);
    window.addEventListener('beforeunload', () => this.sync());
  },

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.enabled = false;
    this.sync();
  }
};
