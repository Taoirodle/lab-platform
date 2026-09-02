// ============================================================
//  LabLoader — the L.A.B mark as a rotating 3D wireframe cube-in-cube.
//  Shared loading animation for every L.A.B app. No dependencies.
//    LabLoader.create(canvasEl, {size, color})      -> inline animation
//    LabLoader.overlay({label, bg, color, size})    -> full-screen loading screen
// ============================================================
(function (global) {
  const CUBE = r => [[-r, -r, -r], [r, -r, -r], [r, r, -r], [-r, r, -r], [-r, -r, r], [r, -r, r], [r, r, r], [-r, r, r]];
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

  function create(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const color = opts.color || '#1b2330';
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const size = opts.size || 128;
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    const outer = CUBE(1), inner = CUBE(0.5);
    let t = 0, raf;
    const rot = (p, ax, ay) => {
      let [x, y, z] = p;
      let x1 = x * Math.cos(ay) + z * Math.sin(ay), z1 = -x * Math.sin(ay) + z * Math.cos(ay);
      let y2 = y * Math.cos(ax) - z1 * Math.sin(ax), z2 = y * Math.sin(ax) + z1 * Math.cos(ax);
      return [x1, y2, z2];
    };
    const proj = (p, cx, cy, s) => { const d = 4, f = d / (d - p[2]); return [cx + p[0] * s * f, cy + p[1] * s * f]; };
    function draw(pts, alpha) {
      ctx.globalAlpha = alpha;
      for (const [a, b] of EDGES) { ctx.beginPath(); ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); ctx.stroke(); }
    }
    function frame() {
      t += 0.012;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5 * dpr; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const cx = canvas.width / 2, cy = canvas.height / 2, s = canvas.width * 0.26;
      const ax = Math.sin(t * 0.6) * 0.5 + 0.35, ay = t;
      const O = outer.map(p => proj(rot(p, ax, ay), cx, cy, s));
      const I = inner.map(p => proj(rot(p, ax, ay), cx, cy, s));
      draw(O, 1);
      draw(I, 0.5);
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(O[i][0], O[i][1]); ctx.lineTo(I[i][0], I[i][1]); ctx.stroke(); }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return { stop() { cancelAnimationFrame(raf); } };
  }

  function overlay(opts = {}) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:' + (opts.bg || '#e8eaee') + ';transition:opacity .45s ease';
    const cv = document.createElement('canvas'); el.appendChild(cv);
    const lab = document.createElement('div');
    lab.textContent = opts.label || '';
    lab.style.cssText = 'font:600 11px "Segoe UI",Inter,system-ui,sans-serif;letter-spacing:2.5px;text-transform:uppercase;color:#8b93a1';
    el.appendChild(lab);
    document.body.appendChild(el);
    const anim = create(cv, { size: opts.size || 132, color: opts.color || '#1b2330' });
    return { el, setLabel(x) { lab.textContent = x; }, done() { el.style.opacity = '0'; setTimeout(() => { anim.stop(); el.remove(); }, 460); } };
  }

  global.LabLoader = { create, overlay };
})(window);
