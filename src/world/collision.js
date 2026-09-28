// Axis-aligned box world with a spatial hash. Characters are vertical cylinders (feet position,
// radius, height). Pure data: no three.js, so it is unit-tested.
export function createCollision({ cell = 8, floor = () => 0 } = {}) {
  const boxes = [];
  const grid = new Map();
  const key = (i, j) => i * 73856093 ^ j * 19349663;

  function addBox(minX, minY, minZ, maxX, maxY, maxZ, tag = '') {
    const box = { minX, minY, minZ, maxX, maxY, maxZ, tag, id: boxes.length };
    boxes.push(box);
    for (let i = Math.floor(minX / cell); i <= Math.floor(maxX / cell); i++) {
      for (let j = Math.floor(minZ / cell); j <= Math.floor(maxZ / cell); j++) {
        const k = key(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(box);
      }
    }
    return box;
  }

  // Takes a box out of the world (a cracked wall blown open, a railing torn down). Its id stays
  // reserved so the query stamps stay valid.
  function removeBox(box) {
    if (!box || box.removed) return false;
    box.removed = true;
    for (let i = Math.floor(box.minX / cell); i <= Math.floor(box.maxX / cell); i++) {
      for (let j = Math.floor(box.minZ / cell); j <= Math.floor(box.maxZ / cell); j++) {
        const list = grid.get(key(i, j));
        const at = list ? list.indexOf(box) : -1;
        if (at >= 0) list.splice(at, 1);
      }
    }
    return true;
  }

  let stamp = 0;
  const seen = new Uint32Array(1 << 16);
  function query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    stamp = (stamp + 1) >>> 0 || 1;
    if (seen.length < boxes.length) return queryAll(minX, minZ, maxX, maxZ, out);
    for (let i = Math.floor(minX / cell); i <= Math.floor(maxX / cell); i++) {
      for (let j = Math.floor(minZ / cell); j <= Math.floor(maxZ / cell); j++) {
        const list = grid.get(key(i, j));
        if (!list) continue;
        for (const b of list) {
          if (seen[b.id] === stamp) continue;
          seen[b.id] = stamp;
          if (b.maxX >= minX && b.minX <= maxX && b.maxZ >= minZ && b.minZ <= maxZ) out.push(b);
        }
      }
    }
    return out;
  }
  function queryAll(minX, minZ, maxX, maxZ, out) {
    for (const b of boxes) if (!b.removed && b.maxX >= minX && b.minX <= maxX && b.maxZ >= minZ && b.minZ <= maxZ) out.push(b);
    return out;
  }

  const near = [];

  // Highest walkable surface at or below `y` under a disc of radius r.
  function groundBelow(x, y, z, r = 0.3) {
    let best = floor(x, z);
    if (best > y) best = -Infinity;
    query(x - r, z - r, x + r, z + r, near);
    for (const b of near) {
      if (b.maxY <= y + 1e-6 && b.maxY > best && x >= b.minX - r && x <= b.maxX + r && z >= b.minZ - r && z <= b.maxZ + r) best = b.maxY;
    }
    return best;
  }

  // prevY: feet height last frame. A box whose top was at or below it is floor we fell onto,
  // never a wall, so fast falls land on roofs instead of being shoved out the side.
  function resolveCylinder(p, radius, height, { stepUp = 0.45, prevY = -Infinity } = {}) {
    let hitWall = false;
    let ceiling = false;
    query(p.x - radius, p.z - radius, p.x + radius, p.z + radius, near);
    let landing = -Infinity;
    for (const b of near) {
      if (b.maxY <= prevY + 1e-4 && b.maxY > p.y && p.x > b.minX - radius * 0.6 && p.x < b.maxX + radius * 0.6 && p.z > b.minZ - radius * 0.6 && p.z < b.maxZ + radius * 0.6) landing = Math.max(landing, b.maxY);
    }
    if (landing > -Infinity) p.y = landing;
    for (const b of near) {
      // Step onto anything low enough; walls are everything taller than a step at the feet.
      if (b.maxY <= p.y + stepUp || b.minY >= p.y + height) continue;
      const cx = Math.min(Math.max(p.x, b.minX), b.maxX);
      const cz = Math.min(Math.max(p.z, b.minZ), b.maxZ);
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-12) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * radius;
        p.z = cz + (dz / d) * radius;
      } else {
        // Center inside the box: leave through the nearest side.
        const exits = [p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z];
        const m = exits.indexOf(Math.min(...exits));
        if (m === 0) p.x = b.minX - radius;
        else if (m === 1) p.x = b.maxX + radius;
        else if (m === 2) p.z = b.minZ - radius;
        else p.z = b.maxZ + radius;
      }
      hitWall = true;
    }
    const groundY = groundBelow(p.x, p.y + stepUp, p.z, radius * 0.6);
    let grounded = false;
    if (groundY > -Infinity && p.y <= groundY + 1e-4) { p.y = groundY; grounded = true; }
    for (const b of near) {
      if (b.minY > p.y + 0.5 && b.minY < p.y + height && p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ) {
        p.y = b.minY - height;
        ceiling = true;
      }
    }
    return { grounded, groundY, hitWall, ceiling };
  }

  // Slab test against boxes near the segment. Returns { t, box, normal } or null.
  function raycast(o, d, maxDist) {
    const ex = o.x + d.x * maxDist, ez = o.z + d.z * maxDist;
    const list = query(Math.min(o.x, ex), Math.min(o.z, ez), Math.max(o.x, ex), Math.max(o.z, ez), []);
    let best = null;
    for (const b of list) {
      let tmin = 0, tmax = maxDist, axis = -1, sign = 0;
      let miss = false;
      for (let a = 0; a < 3; a++) {
        const oa = a === 0 ? o.x : a === 1 ? o.y : o.z;
        const da = a === 0 ? d.x : a === 1 ? d.y : d.z;
        const lo = a === 0 ? b.minX : a === 1 ? b.minY : b.minZ;
        const hi = a === 0 ? b.maxX : a === 1 ? b.maxY : b.maxZ;
        if (Math.abs(da) < 1e-9) {
          if (oa < lo || oa > hi) { miss = true; break; }
          continue;
        }
        let t1 = (lo - oa) / da, t2 = (hi - oa) / da, s = -1;
        if (t1 > t2) { [t1, t2] = [t2, t1]; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) { miss = true; break; }
      }
      if (miss || axis < 0) continue;
      if (!best || tmin < best.t) {
        const normal = { x: 0, y: 0, z: 0 };
        normal[axis === 0 ? 'x' : axis === 1 ? 'y' : 'z'] = sign;
        best = { t: tmin, box: b, normal };
      }
    }
    return best;
  }

  return { addBox, removeBox, query: (a, b, c, d) => query(a, b, c, d, []), groundBelow, resolveCylinder, raycast, boxes };
}
