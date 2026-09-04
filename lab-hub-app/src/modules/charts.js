// ============================================================
//  L.A.B Hub — tiny canvas charts. No libraries, DPR-aware, reads the live
//  theme tokens so skins recolour the charts too.
// ============================================================
LAB.charts = {
  cssVar(n, fb) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb; },

  prep(canvas, h) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 600;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.height = h + 'px';
    const g = canvas.getContext('2d'); g.scale(dpr, dpr);
    g.font = '11px ' + this.cssVar('--mono', 'monospace');
    return { g, w, h, txt: this.cssVar('--txt', '#f2f4fb'), txt2: this.cssVar('--txt2', '#98a1ba'), stroke: this.cssVar('--stroke', 'rgba(255,255,255,.09)') };
  },

  rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, h / 2, w / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  },

  /// days: [{label, values:{k:minutes}}], cats: [{k,color}] — stacked minutes per day
  stacked(canvas, days, cats, opts = {}) {
    const { g, w, h, txt2, stroke } = this.prep(canvas, opts.height || 190);
    const padL = 36, padB = 22, padT = 8, iw = w - padL - 8, ih = h - padB - padT;
    const max = Math.max(60, ...days.map(d => cats.reduce((s, c) => s + (d.values[c.k] || 0), 0)));
    const step = max > 600 ? 180 : max > 300 ? 120 : max > 120 ? 60 : 30;
    g.strokeStyle = stroke; g.lineWidth = 1; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let m = 0; m <= max; m += step) {
      const y = padT + ih - (m / max) * ih;
      g.beginPath(); g.moveTo(padL, y + .5); g.lineTo(w - 8, y + .5); g.stroke();
      g.fillStyle = txt2; g.fillText(m % 60 ? (m / 60).toFixed(1) + 'h' : (m / 60) + 'h', padL - 7, y);
    }
    const bw = iw / days.length, barw = Math.max(6, Math.min(34, bw * 0.62));
    days.forEach((d, i) => {
      let y = padT + ih; const x = padL + i * bw + (bw - barw) / 2;
      for (const c of cats) {
        const v = d.values[c.k] || 0; if (!v) continue;
        const bh = (v / max) * ih; g.fillStyle = c.color; this.rr(g, x, y - bh, barw, bh, 3); g.fill(); y -= bh;
      }
      g.fillStyle = d.hot ? this.cssVar('--txt', '#fff') : txt2; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(d.label, x + barw / 2, padT + ih + 7);
    });
  },

  /// items: [{label, value, color}] — horizontal bars with label + value
  hbars(canvas, items, opts = {}) {
    const rowH = 27, { g, w, txt, txt2 } = this.prep(canvas, Math.max(40, items.length * rowH));
    const max = Math.max(1, ...items.map(i => i.value)), labW = Math.min(170, w * 0.32), barX = labW + 12, barW = w - barX - 62;
    g.textBaseline = 'middle';
    items.forEach((it, i) => {
      const y = i * rowH + rowH / 2;
      g.fillStyle = txt; g.textAlign = 'left'; g.font = '600 12px ' + this.cssVar('--disp', 'sans-serif');
      g.fillText(this.trunc(g, it.label, labW), 0, y);
      g.fillStyle = 'rgba(255,255,255,.06)'; this.rr(g, barX, y - 6, barW, 12, 6); g.fill();
      g.fillStyle = it.color; this.rr(g, barX, y - 6, Math.max(5, barW * it.value / max), 12, 6); g.fill();
      g.fillStyle = txt2; g.textAlign = 'right'; g.font = '11px ' + this.cssVar('--mono', 'monospace');
      g.fillText(opts.fmt ? opts.fmt(it.value) : String(it.value), w, y);
    });
  },

  trunc(g, s, maxW) {
    s = String(s); if (g.measureText(s).width <= maxW) return s;
    while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  },

  /// runs: [{start:'HH:MM', end:'HH:MM', color}] — one day laid out left to right
  timeline(canvas, runs, opts = {}) {
    const { g, w, txt2, stroke } = this.prep(canvas, 54);
    const mins = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
    g.fillStyle = 'rgba(255,255,255,.05)'; this.rr(g, 0, 0, w, 30, 6); g.fill();
    for (const r of runs) {
      const a = mins(r.start), b = Math.max(mins(r.end), a + 1);
      g.fillStyle = r.color; g.globalAlpha = r.dim ? .35 : 1;
      g.fillRect((a / 1440) * w, 0, Math.max(1.5, ((b - a) / 1440) * w), 30); g.globalAlpha = 1;
    }
    g.strokeStyle = stroke; for (let h = 0; h <= 24; h += 6) { const x = (h / 24) * w; g.beginPath(); g.moveTo(x + .5, 30); g.lineTo(x + .5, 36); g.stroke(); }
    g.fillStyle = txt2; g.textBaseline = 'top';
    for (let h = 0; h <= 24; h += 6) { g.textAlign = h === 0 ? 'left' : h === 24 ? 'right' : 'center'; g.fillText(String(h).padStart(2, '0') + ':00', (h / 24) * w, 39); }
    if (opts.now != null) { const x = (opts.now / 1440) * w; g.fillStyle = this.cssVar('--txt', '#fff'); g.fillRect(x - 1, 0, 2, 30); }
  },

  /// hours: number[24] — a 24-cell heat strip
  heat(canvas, hours, color) {
    const { g, w, txt2 } = this.prep(canvas, 46);
    const max = Math.max(1, ...hours), cw = w / 24;
    hours.forEach((v, i) => {
      g.globalAlpha = 0.10 + 0.90 * (v / max); g.fillStyle = color; this.rr(g, i * cw + 1, 0, cw - 2, 26, 4); g.fill(); g.globalAlpha = 1;
      if (i % 3 === 0) { g.fillStyle = txt2; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(String(i).padStart(2, '0'), i * cw + cw / 2, 31); }
    });
  }
};
