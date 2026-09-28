// Ladders and ziplines the hero can use. Filled by the city builder, read by the traversal
// controls. Pure data and maths: no three.js, so it is unit-tested.
const ZIP_MAX = 30, ZIP_MIN = 8, ZIP_G = 26;
// How far the cable sags below the straight chord at mid-span, as a fraction of its length.
// Shared by the ink-line draw (ziplines.js), the rider's hand position (traverse/zipline.js) and
// the catch check (zipClosest below), so all three agree on where the cable actually is.
export const ZIP_SAG = 0.03;

export function createClimbables() {
  return { ladders: [], ziplines: [] };
}

export function addLadder(c, { x, z, nx, nz, bottom, top }) {
  const l = { id: c.ladders.length, x, z, nx, nz, bottom, top };
  c.ladders.push(l);
  return l;
}

// Catch a ladder from the ground or mid-air. Facing is optional (a falling hero catches any
// ladder they drift into).
export function ladderGrab(ladders, p, { reach = 0.7, facingX, facingZ } = {}) {
  for (const l of ladders) {
    // Inlined `stand` point (x + nx*0.45, z + nz*0.45): this runs once per ladder every frame
    // the hero is grounded or falling, so it skips the object allocation.
    const sx = l.x + l.nx * 0.45, sz = l.z + l.nz * 0.45;
    if (Math.hypot(p.x - sx, p.z - sz) > reach) continue;
    if (p.y < l.bottom - 0.3 || p.y > l.top - 0.2) continue;
    if (facingX !== undefined && facingX * -l.nx + facingZ * -l.nz < 0.5) continue;
    return { ladder: l, y: Math.min(Math.max(p.y, l.bottom), l.top - 1) };
  }
  return null;
}

// Stepping off a roof onto the top of a ladder: standing just inside the edge, facing out.
export function ladderTopGrab(ladders, p, facingX, facingZ, { reach = 0.9 } = {}) {
  for (const l of ladders) {
    if (Math.abs(p.y - l.top) > 0.4) continue;
    const e = ladderExit(l);
    if (Math.hypot(p.x - e.x, p.z - e.z) > reach) continue;
    if (facingX * l.nx + facingZ * l.nz < 0.6) continue;
    return l;
  }
  return null;
}

export function ladderExit(l) {
  return { x: l.x - l.nx * 0.8, z: l.z - l.nz * 0.8 };
}

// Where a climber lands stepping off the BOTTOM of a ladder. The stand point (nx*0.45 out from
// the ladder) is solid ground for street-level ladders (real floor everywhere), but a ladder
// mounted off a landing's outer rail can overhang past that landing's edge, so step inward
// toward the wall in small increments until solid ground is found. `groundBelow` is injected
// (matching collision.groundBelow's (x, y, z, r) signature) so this stays pure and unit-testable.
export function ladderBottomExit(l, groundBelow, { step = 0.1, maxSteps = 30 } = {}) {
  const standX = l.x + l.nx * 0.45, standZ = l.z + l.nz * 0.45;
  if (l.bottom <= 0.05) return { x: standX, z: standZ };
  for (let i = 0; i <= maxSteps; i++) {
    const t = i * step;
    const x = standX - l.nx * t, z = standZ - l.nz * t;
    if (groundBelow(x, l.bottom + 0.1, z, 0.2) >= l.bottom - 0.05) return { x, z };
  }
  return { x: standX, z: standZ };
}

export function addZipline(c, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  const line = { id: c.ziplines.length, a: { ...a }, b: { ...b }, length, dir: { x: dx / length, y: dy / length, z: dz / length } };
  c.ziplines.push(line);
  return line;
}

// The straight chord between the two ends; does not include the cable's sag (see zipSag below).
export function zipPoint(line, s, out = {}) {
  const k = Math.min(Math.max(s, 0), line.length);
  out.x = line.a.x + line.dir.x * k;
  out.y = line.a.y + line.dir.y * k;
  out.z = line.a.z + line.dir.z * k;
  return out;
}

// How far below the chord the cable actually hangs at distance `s` along it: 0 at both ends,
// maximum at the middle. The drawn ink line, the rider's hand and the catch check all subtract
// this from zipPoint's straight-chord y so they agree on where the cable is.
export function zipSag(line, s) {
  return Math.sin((Math.PI * s) / line.length) * line.length * ZIP_SAG;
}

// A scratch point reused across calls: zipClosest only needs the interpolated point to measure
// a distance, so it never has to hand the caller a fresh object.
const _zipScratch = { x: 0, y: 0, z: 0 };
// `out` lets a hot caller (the per-line, per-airborne-frame check in hero.js) reuse a result
// object instead of getting a fresh {s, dist} every call.
export function zipClosest(line, p, out = {}) {
  const s = Math.min(Math.max((p.x - line.a.x) * line.dir.x + (p.y - line.a.y) * line.dir.y + (p.z - line.a.z) * line.dir.z, 0), line.length);
  const q = zipPoint(line, s, _zipScratch);
  q.y -= zipSag(line, s);
  out.s = s;
  out.dist = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  return out;
}

// Gravity along the cable minus a little drag. A flat or uphill cable still carries you at a
// crawl, as if the zipline has a motor.
export function zipSpeed(line, speed, dt) {
  const v = speed + (ZIP_G * -line.dir.y - speed * 0.05) * dt;
  return Math.min(ZIP_MAX, Math.max(ZIP_MIN, v));
}
