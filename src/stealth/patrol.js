// Predator patrols: walking a route (in a loop or back and forth, waiting and facing a way at
// some points), where scared goons huddle, and which walkable spot a searching goon tries next.
// Pure: writes into the caller's objects, so the runtime allocates nothing per frame.

export function createPatrol(start = 0) {
  return { i: start, dir: 1, waitT: 0 };
}

function advance(p, route) {
  const n = route.points.length;
  if (n < 2) return;
  if (route.mode === 'loop') { p.i = (p.i + 1) % n; return; }
  if (p.i + p.dir >= n || p.i + p.dir < 0) p.dir = -p.dir;
  p.i += p.dir;
}

const put = (out, pt, face) => { out.x = pt.x; out.y = pt.y; out.z = pt.z; out.face = face; return out; };

// Writes where to walk (or stand) into out { x, y, z, face }. Returns true while waiting at a point.
export function stepPatrol(p, route, pos, dt, out) {
  const pt = route.points[p.i];
  if (p.waitT > 0) {
    p.waitT -= dt;
    put(out, pt, pt.face ?? null);
    if (p.waitT <= 0) advance(p, route);
    return true;
  }
  if (Math.hypot(pos.x - pt.x, pos.z - pt.z) < 0.4) {
    if ((pt.wait ?? 0) > 0) { p.waitT = pt.wait; put(out, pt, pt.face ?? null); return true; }
    advance(p, route);
  }
  put(out, route.points[p.i], null);
  return false;
}

// Goon k of n stands on a ring round the centre, facing out (back to back).
export function huddleSpot(center, k, n, out, radius = 1.6) {
  const a = (k / Math.max(1, n)) * Math.PI * 2;
  out.x = center.x + Math.sin(a) * radius;
  out.y = center.y;
  out.z = center.z + Math.cos(a) * radius;
  out.face = a;
  return out;
}

// The k-th walkable spot (cycling) on the same level as y and within `within` of the centre.
const near = (s, center, y, within) => Math.abs(s.y - y) < 1 && Math.hypot(s.x - center.x, s.z - center.z) <= within;
export function pickSpot(spots, center, y, k, out, within = 12) {
  let n = 0;
  for (const s of spots) if (near(s, center, y, within)) n += 1;
  if (!n) return null;
  let i = ((k % n) + n) % n;
  for (const s of spots) {
    if (!near(s, center, y, within)) continue;
    if (i === 0) return put(out, s, null);
    i -= 1;
  }
  return null;
}

// Whether the leg a to b passes through the box rect { x, z, w, d } grown by pad (planar).
export function segmentHitsRect(a, b, rect, pad = 0) {
  const lo = [rect.x - rect.w / 2 - pad, rect.z - rect.d / 2 - pad];
  const hi = [rect.x + rect.w / 2 + pad, rect.z + rect.d / 2 + pad];
  const o = [a.x, a.z], d = [b.x - a.x, b.z - a.z];
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 2; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) return false; continue; }
    let u0 = (lo[k] - o[k]) / d[k], u1 = (hi[k] - o[k]) / d[k];
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0);
    t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return true;
}
