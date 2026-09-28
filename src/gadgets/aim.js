// Aiming maths for gadgets. Pure: points are plain { x, y, z }; `collision` is the
// createCollision API (raycast, groundBelow). Called when a gadget fires, not every frame.

// Items nearest the aim line first, inside `range` and a cone of `maxAngle` radians around `dir`
// (unit length). `lift` is added to each item's y (aim at the chest, not the feet).
export function pickAimedMany(items, eye, dir, n, { range = 20, maxAngle = 0.35, lift = 1.1, filter = () => true, getPos = (e) => e.pos } = {}) {
  const scored = [];
  for (const it of items) {
    if (!filter(it)) continue;
    const p = getPos(it);
    const dx = p.x - eye.x, dy = p.y + lift - eye.y, dz = p.z - eye.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > range || d < 0.3) continue;
    const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle > maxAngle) continue;
    scored.push({ it, score: angle * 8 + d * 0.05 });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, n).map((s) => s.it);
}

export function pickAimed(items, eye, dir, opts) {
  return pickAimedMany(items, eye, dir, 1, opts)[0] ?? null;
}

// A straight line shaped like a zipline (src/world/climbables.js addZipline), not registered
// anywhere. sag 0 = taut.
export function lineBetween(a, b, sag = 0) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  return { id: -1, a: { ...a }, b: { ...b }, length, dir: { x: dx / length, y: dy / length, z: dz / length }, sag };
}

// The line launcher: a level line from Batman's hand to the first wall ahead along `yaw`. Three
// rays (shins, chest, the line itself) so the rider hanging under it passes over nothing.
export function launcherLine(collision, pos, yaw, { range = 40, min = 6, heights = [0.3, 1.2, 2.1], hang = 2.05, back = 0.6 } = {}) {
  const dir = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
  let dist = Infinity;
  for (const h of heights) {
    const hit = collision.raycast({ x: pos.x, y: pos.y + h, z: pos.z }, dir, range);
    if (hit && hit.t < dist) dist = hit.t;
  }
  if (dist === Infinity) return { ok: false, reason: 'none' };
  if (dist < min) return { ok: false, reason: 'short' };
  const y = pos.y + hang;
  const a = { x: pos.x, y, z: pos.z };
  const b = { x: pos.x + dir.x * (dist - back), y, z: pos.z + dir.z * (dist - back) };
  return { ok: true, line: lineBetween(a, b, 0), dist };
}

// Where a gel blob sticks: the first box the aim ray hits (floor or wall, with its normal), or
// the ground where a downward ray meets it.
export function gelSpot(collision, eye, dir, { range = 14 } = {}) {
  const hit = collision.raycast(eye, dir, range);
  if (hit) {
    return { x: eye.x + dir.x * hit.t, y: eye.y + dir.y * hit.t, z: eye.z + dir.z * hit.t, nx: hit.normal.x, ny: hit.normal.y, nz: hit.normal.z };
  }
  if (dir.y > -0.05) return null;
  const floorY = collision.groundBelow(eye.x, eye.y, eye.z, 0.1);
  if (floorY === -Infinity) return null;
  const t = (eye.y - floorY) / -dir.y;
  if (t > range) return null;
  const x = eye.x + dir.x * t, z = eye.z + dir.z * t;
  const y = collision.groundBelow(x, eye.y, z, 0.1);
  if (y === -Infinity) return null;
  return { x, y, z, nx: 0, ny: 1, nz: 0 };
}

export function inRadius(c, p, r, dy = 2.5) {
  return Math.hypot(p.x - c.x, p.z - c.z) <= r && Math.abs(p.y - c.y) <= dy;
}

// Turn `cur` toward `want` (both unit length) at up to `rate` per second; writes `out`.
export function steerDir(cur, want, dt, rate, out) {
  const k = Math.min(1, rate * dt);
  const x = cur.x + (want.x - cur.x) * k, y = cur.y + (want.y - cur.y) * k, z = cur.z + (want.z - cur.z) * k;
  const l = Math.hypot(x, y, z) || 1;
  out.x = x / l; out.y = y / l; out.z = z / l;
  return out;
}

// The batclaw's arc: launch speeds that land a goon at `to` under gravity g (the enemy's own
// ballistic flight in enemy.js uses 24).
export function yankVelocity(from, to, g = 24) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const t = Math.min(0.6, Math.max(0.3, Math.hypot(dx, dz) / 18));
  return { vx: dx / t, vy: dy / t + 0.5 * g * t, vz: dz / t, t };
}
