// src/actors/traverse/probes.js
// Collision probes for ledges and wall runs. Pure: works on the collision module's boxes only.
const HANG_DROP = 2.05, HANG_OUT = 0.38, EDGE_PAD = 0.35;

// Which face of `b` is the point outside of? Returns the outward normal, or null when inside.
function outsideFace(b, x, z) {
  const d = [b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ];
  const i = d.indexOf(Math.max(...d));
  if (d[i] <= 0) return null;
  return [{ nx: -1, nz: 0 }, { nx: 1, nz: 0 }, { nx: 0, nz: -1 }, { nx: 0, nz: 1 }][i];
}

function makeLedge(b, nx, nz, along) {
  const axis = nx !== 0 ? 'z' : 'x';
  const min = (axis === 'z' ? b.minZ : b.minX) + EDGE_PAD;
  const max = (axis === 'z' ? b.maxZ : b.maxX) - EDGE_PAD;
  const t = Math.min(Math.max(along, min), max);
  const x = nx < 0 ? b.minX : nx > 0 ? b.maxX : t;
  const z = nz < 0 ? b.minZ : nz > 0 ? b.maxZ : t;
  return { x, y: b.maxY, z, nx, nz, axis, min, max, box: b };
}

// Room to stand on top at the pull-up spot, and the edge is the real top there.
function clearAbove(collision, l, headroom) {
  const lx = l.x - l.nx * 0.6, lz = l.z - l.nz * 0.6;
  if (collision.groundBelow(lx, l.y + 0.05, lz, 0.2) > l.y + 0.01) return false;
  return !collision.query(lx - 0.3, lz - 0.3, lx + 0.3, lz + 0.3).some((o) =>
    o !== l.box && o.minY < l.y + headroom && o.maxY > l.y + 0.05 && lx > o.minX - 0.3 && lx < o.maxX + 0.3 && lz > o.minZ - 0.3 && lz < o.maxZ + 0.3);
}

export function findLedge(collision, pos, dirX, dirZ, { minRise = 1.2, maxRise = 2.2, reach = 0.7, headroom = 1.9 } = {}) {
  const px = pos.x + dirX * reach, pz = pos.z + dirZ * reach;
  let best = null;
  for (const b of collision.query(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3)) {
    if (b.tag === 'bound') continue;
    const rise = b.maxY - pos.y;
    if (rise < minRise || rise > maxRise) continue;
    const face = outsideFace(b, pos.x, pos.z);
    if (!face) continue;
    if (dirX * -face.nx + dirZ * -face.nz < 0.5) continue; // must be facing the wall
    const l = makeLedge(b, face.nx, face.nz, face.nx !== 0 ? pos.z : pos.x);
    if (Math.hypot(pos.x - (l.x + l.nx * HANG_OUT), pos.z - (l.z + l.nz * HANG_OUT)) > reach + 0.4) continue;
    if (!clearAbove(collision, l, headroom)) continue;
    if (!best || l.y < best.y) best = l;
  }
  return best;
}

export function hangPos(l) {
  return { x: l.x + l.nx * HANG_OUT, y: l.y - HANG_DROP, z: l.z + l.nz * HANG_OUT };
}

// At an outside corner, carry on around onto the adjacent face of the same box.
// dir is -1 (toward min) or 1 (toward max) along the current edge.
export function wrapCorner(collision, l, dir, { headroom = 1.9 } = {}) {
  const b = l.box;
  let nx, nz, along;
  if (l.axis === 'x') { nx = dir < 0 ? -1 : 1; nz = 0; along = l.nz > 0 ? b.maxZ : b.minZ; }
  else { nx = 0; nz = dir < 0 ? -1 : 1; along = l.nx > 0 ? b.maxX : b.minX; }
  const w = makeLedge(b, nx, nz, along);
  // Something built against that face (an inside corner) blocks the hang spot.
  const h = hangPos(w);
  const blocked = collision.query(h.x - 0.3, h.z - 0.3, h.x + 0.3, h.z + 0.3).some((o) =>
    o !== b && o.tag !== 'bound' && o.maxY > h.y && o.minY < w.y && h.x > o.minX - 0.3 && h.x < o.maxX + 0.3 && h.z > o.minZ - 0.3 && h.z < o.maxZ + 0.3);
  if (blocked || !clearAbove(collision, w, headroom)) return null;
  return w;
}

// A building wall beside a running hero, at a shallow angle, tall enough to run on.
export function findRunWall(collision, pos, velX, velZ, { maxAngle = 0.61, reach = 0.8, minHeight = 4 } = {}) {
  const sp = Math.hypot(velX, velZ);
  if (sp < 4) return null;
  const fx = velX / sp, fz = velZ / sp;
  for (const side of [-1, 1]) {
    const sx = fz * side, sz = -fx * side; // perpendicular probe; side -1 is the wall the tests call left
    const px = pos.x + sx * reach, pz = pos.z + sz * reach;
    for (const b of collision.query(px - 0.2, pz - 0.2, px + 0.2, pz + 0.2)) {
      if (b.tag !== 'building' || b.maxY - b.minY < minHeight || b.maxY < pos.y + 2.5 || b.minY > pos.y + 0.5) continue;
      const face = outsideFace(b, pos.x, pos.z);
      if (!face) continue;
      // Travel must run along the face: the angle between velocity and the face plane.
      const into = fx * -face.nx + fz * -face.nz;
      if (Math.asin(Math.min(1, Math.abs(into))) > maxAngle) continue;
      const alongX = face.nz !== 0 ? Math.sign(fx) || 1 : 0, alongZ = face.nx !== 0 ? Math.sign(fz) || 1 : 0;
      return { nx: face.nx, nz: face.nz, alongX, alongZ, side, box: b };
    }
  }
  return null;
}
