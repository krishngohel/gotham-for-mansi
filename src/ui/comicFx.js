// Screen-space comic effects over the canvas: tapered speed-line wedges at the frame edge
// when moving fast, and a bold tilted panel border while the action camera holds a shot.
export function createComicFx(root) {
  const canvas = document.createElement('canvas');
  canvas.className = 'speed-lines';
  const panel = document.createElement('div');
  panel.className = 'action-panel';
  root.append(canvas, panel);
  const g = canvas.getContext('2d');
  const N = 80;
  // Each wedge is wide at the frame edge and tapers to a point reaching toward the centre;
  // `reach` (0..1) is how far into the outer band it can taper at full speed, `half` is the
  // half-angle of its wide base. Every 4th line is drawn paper-white instead of ink.
  const lines = Array.from({ length: N }, (_, i) => ({
    a: (i / N) * Math.PI * 2 + Math.random() * 0.05,
    reach: 0.55 + Math.random() * 0.45,
    half: 0.01 + Math.random() * 0.016,
    ph: Math.random(),
    white: i % 4 === 3,
  }));
  let k = 0, t = 0;
  function resize() { canvas.width = Math.round(innerWidth / 2); canvas.height = Math.round(innerHeight / 2); }
  resize();
  addEventListener('resize', resize);
  return {
    update(dt, { speed = 0, actionActive = false }) {
      t += dt;
      const want = Math.min(1, Math.max(0, (speed - 16) / 20));
      k += (want - k) * Math.min(1, dt * 6);
      panel.classList.toggle('on', actionActive);
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (k < 0.02) return;
      const cx = canvas.width / 2, cy = canvas.height / 2, R = Math.hypot(cx, cy);
      // Wedges live only in the outer ~35% of the frame; the tip never reaches the middle.
      const rOuter = R * 1.05, rInner = R * 0.65;
      g.globalAlpha = Math.min(1, k);
      for (const l of lines) {
        const flick = Math.floor(t * 14 + l.ph * 10) % 3 !== 0;
        if (!flick) continue;
        const tipR = rOuter - (rOuter - rInner) * l.reach * k;
        const bx0 = cx + Math.cos(l.a - l.half) * rOuter, by0 = cy + Math.sin(l.a - l.half) * rOuter;
        const bx1 = cx + Math.cos(l.a + l.half) * rOuter, by1 = cy + Math.sin(l.a + l.half) * rOuter;
        const tx = cx + Math.cos(l.a) * tipR, ty = cy + Math.sin(l.a) * tipR;
        g.fillStyle = l.white ? 'rgba(239,230,207,0.8)' : 'rgba(11,11,18,0.8)';
        g.beginPath();
        g.moveTo(bx0, by0);
        g.lineTo(bx1, by1);
        g.lineTo(tx, ty);
        g.closePath();
        g.fill();
      }
      g.globalAlpha = 1;
    },
    panel(on) { panel.classList.toggle('on', on); },
  };
}
