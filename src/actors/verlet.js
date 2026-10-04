// Position-based verlet cloth. Plain arrays, no three.js, so it is unit-testable.
// Row 0 is pinned. The bottom row's even columns hang lower to make the cape's points.
export function createCloth({ cols, rows, topWidth, bottomWidth, length, pointDrop = 0 }) {
  const n = cols * rows;
  const layout = new Float32Array(n * 3);
  const pinned = new Uint8Array(n);
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const w = topWidth + (bottomWidth - topWidth) * t;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      layout[i * 3] = (c / (cols - 1) - 0.5) * w;
      layout[i * 3 + 1] = -length * t - (r === rows - 1 && c % 2 === 0 ? pointDrop : 0);
      if (r === 0) pinned[i] = 1;
    }
  }
  const pairs = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols) pairs.push(i, i + 1);
      if (r + 1 < rows) pairs.push(i, i + cols);
      if (c + 1 < cols && r + 1 < rows) pairs.push(i, i + cols + 1, i + 1, i + cols);
    }
  }
  const cons = Int32Array.from(pairs);
  const rest = new Float32Array(cons.length / 2);
  for (let k = 0; k < rest.length; k++) {
    const a = cons[2 * k] * 3, b = cons[2 * k + 1] * 3;
    rest[k] = Math.hypot(layout[b] - layout[a], layout[b + 1] - layout[a + 1], layout[b + 2] - layout[a + 2]);
  }
  const pos = Float32Array.from(layout);
  return { cols, rows, n, pos, prev: Float32Array.from(layout), layout, pinned, cons, rest };
}

export function hangFrom(cloth, pins) {
  const { cols, n, pos, prev, layout } = cloth;
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    pos[i * 3] = pins[c * 3] + layout[i * 3] - layout[c * 3];
    pos[i * 3 + 1] = pins[c * 3 + 1] + layout[i * 3 + 1] - layout[c * 3 + 1];
    pos[i * 3 + 2] = pins[c * 3 + 2];
  }
  prev.set(pos);
}

function applyPins(cloth, pins) {
  for (let c = 0; c < cloth.cols; c++) {
    if (!cloth.pinned[c]) continue;
    cloth.pos[c * 3] = cloth.prev[c * 3] = pins[c * 3];
    cloth.pos[c * 3 + 1] = cloth.prev[c * 3 + 1] = pins[c * 3 + 1];
    cloth.pos[c * 3 + 2] = cloth.prev[c * 3 + 2] = pins[c * 3 + 2];
  }
}

// floor: a height no free point may drop below (the ground under the wearer), so a hem rests on
// the roof instead of hanging through it; one number for every point, or an array with a height
// per point (-Infinity where nothing is under that point, so it hangs over an edge).
// back ({ x, z, nx, nz, d, top }, optional): a vertical plane through (x, z) with horizontal
// normal (nx, nz), the wearer's facing. No free particle may sit more than d in front of it, or
// above the height top: a cape stays behind and below the shoulder line instead of flipping over
// the head and hanging down the front, where the body colliders would otherwise hold it for good.
export function stepCloth(cloth, dt, {
  gravity = [0, -9.8, 0], wind = [0, 0, 0], damping = 0.03, iterations = 6, colliders = [], pins = null, floor = -Infinity, back = null,
} = {}) {
  const { n, pos, prev, pinned, cons, rest } = cloth;
  const dt2 = dt * dt;
  const acc = [(gravity[0] + wind[0]) * dt2, (gravity[1] + wind[1]) * dt2, (gravity[2] + wind[2]) * dt2];
  const keep = 1 - damping;
  for (let i = 0; i < n; i++) {
    if (pinned[i]) continue;
    for (let d = 0; d < 3; d++) {
      const k = i * 3 + d;
      const p = pos[k];
      pos[k] = p + (p - prev[k]) * keep + acc[d];
      prev[k] = p;
    }
  }
  for (let it = 0; it < iterations; it++) {
    if (pins) applyPins(cloth, pins);
    for (let k = 0; k < rest.length; k++) {
      const ia = cons[2 * k], ib = cons[2 * k + 1];
      const wa = pinned[ia] ? 0 : 1, wb = pinned[ib] ? 0 : 1;
      if (!(wa + wb)) continue;
      const a = ia * 3, b = ib * 3;
      const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
      const d = Math.hypot(dx, dy, dz) || 1e-6;
      const s = (d - rest[k]) / d / (wa + wb);
      pos[a] += dx * s * wa; pos[a + 1] += dy * s * wa; pos[a + 2] += dz * s * wa;
      pos[b] -= dx * s * wb; pos[b + 1] -= dy * s * wb; pos[b + 2] -= dz * s * wb;
    }
    for (const s of colliders) {
      for (let i = 0; i < n; i++) {
        if (pinned[i]) continue;
        const k = i * 3;
        const dx = pos[k] - s.x, dy = pos[k + 1] - s.y, dz = pos[k + 2] - s.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < s.r * s.r) {
          const m = s.r / (Math.sqrt(d2) || 1e-6);
          pos[k] = s.x + dx * m; pos[k + 1] = s.y + dy * m; pos[k + 2] = s.z + dz * m;
        }
      }
    }
    if (back) {
      for (let i = 0; i < n; i++) {
        if (pinned[i]) continue;
        const k = i * 3;
        // Above the top: down to it, with no speed up or down left (it would only climb again).
        if (pos[k + 1] > back.top) { pos[k + 1] = back.top; prev[k + 1] = back.top; }
        const over = (pos[k] - back.x) * back.nx + (pos[k + 2] - back.z) * back.nz - back.d;
        if (over <= 0) continue;
        pos[k] -= back.nx * over; pos[k + 2] -= back.nz * over;
        // No speed into or off the plane (prev onto it too): pushed out in one step it was flung
        // back, and left its speed into the plane it climbed up it and over her head. Speed along
        // the plane is kept, so it still slides and swings.
        const pn = (prev[k] - back.x) * back.nx + (prev[k + 2] - back.z) * back.nz - back.d;
        prev[k] -= back.nx * pn; prev[k + 2] -= back.nz * pn;
      }
    }
    if (floor !== null && floor !== -Infinity) {
      const perPoint = typeof floor !== 'number';
      for (let i = 0; i < n; i++) {
        const f = perPoint ? floor[i] : floor;
        if (!pinned[i] && pos[i * 3 + 1] < f) { pos[i * 3 + 1] = f; prev[i * 3 + 1] = Math.max(prev[i * 3 + 1], f); }
      }
    }
  }
  if (pins) applyPins(cloth, pins);
}
