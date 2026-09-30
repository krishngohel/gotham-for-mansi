// src/vehicles/wingArmada.js
// Pure logic for the Joker balloon armada set piece: spawning, gentle drift and pop counting.
// No three.js here so it stays cheap to unit test; src/vehicles/batwing.js builds the visuals.

// Spawns `n` balloons in a box region { cx, cy, cz, rx, ry, rz }, alternating purple and green.
export function makeArmadaBalloons(rng, n, region) {
  const list = [];
  for (let i = 0; i < n; i++) {
    list.push({
      id: i,
      x: region.cx + rng.range(-region.rx, region.rx),
      y: region.cy + rng.range(-region.ry, region.ry),
      z: region.cz + rng.range(-region.rz, region.rz),
      vx: rng.range(-1.4, 1.4),
      vy: rng.range(-0.3, 0.3),
      vz: rng.range(-1.4, 1.4),
      kind: i % 2 === 0 ? 'purple' : 'green',
      popped: false,
    });
  }
  return list;
}

// Drifts every live balloon, bouncing softly off the region's box so they stay findable.
export function driftArmada(balloons, dt, region) {
  for (const b of balloons) {
    if (b.popped) continue;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.x > region.cx + region.rx || b.x < region.cx - region.rx) b.vx *= -1;
    if (b.y > region.cy + region.ry || b.y < region.cy - region.ry) b.vy *= -1;
    if (b.z > region.cz + region.rz || b.z < region.cz - region.rz) b.vz *= -1;
  }
}

// Pops every live balloon within `radius` of (x, y, z). Returns how many just popped.
export function popArmadaNear(balloons, x, y, z, radius) {
  let n = 0;
  const r2 = radius * radius;
  for (const b of balloons) {
    if (b.popped) continue;
    const dx = b.x - x, dy = b.y - y, dz = b.z - z;
    if (dx * dx + dy * dy + dz * dz <= r2) { b.popped = true; n++; }
  }
  return n;
}

export function armadaPoppedCount(balloons) {
  let n = 0;
  for (const b of balloons) if (b.popped) n++;
  return n;
}

export function armadaAllPopped(balloons) {
  return balloons.length > 0 && balloons.every((b) => b.popped);
}
