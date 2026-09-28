// Screen-space comic effects over the canvas: speed lines at the frame edge when moving fast,
// and a jagged panel border while the action camera holds a shot.
export function createComicFx(root) {
  const canvas = document.createElement('canvas');
  canvas.className = 'speed-lines';
  const panel = document.createElement('div');
  panel.className = 'action-panel';
  root.append(canvas, panel);
  const g = canvas.getContext('2d');
  const lines = Array.from({ length: 44 }, (_, i) => ({ a: (i / 44) * Math.PI * 2 + Math.random() * 0.1, len: 0.3 + Math.random() * 0.4, w: 1 + Math.random() * 2.5, ph: Math.random() }));
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
      g.strokeStyle = 'rgba(11,11,18,0.85)';
      for (const l of lines) {
        const flick = Math.floor(t * 14 + l.ph * 10) % 3 !== 0;
        if (!flick) continue;
        const r0 = R * (1 - l.len * k), r1 = R * 1.05;
        g.lineWidth = l.w;
        g.beginPath();
        g.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0);
        g.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1);
        g.stroke();
      }
    },
    panel(on) { panel.classList.toggle('on', on); },
  };
}
