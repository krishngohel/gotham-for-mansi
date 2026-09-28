// Gadget breakables around the city, as data, and the maths to build them. Pure.
// Faces: 'e' is +x, 'w' is -x, 's' is +z, 'n' is -z (north is -z). A room is a little brick shed:
// center x, z; floor y; w along x, d along z; h tall. Its `open` face is the cracked wall;
// `against` is left out because a building wall is already there; `noRoof` leaves the roof off.
// Coordinates are checked against the live city by scripts/breakables-check.mjs (Task 11).
export const FACES = { e: { nx: 1, nz: 0 }, w: { nx: -1, nz: 0 }, s: { nx: 0, nz: 1 }, n: { nx: 0, nz: -1 } };

export function faceFromNormal(nx, nz) {
  return Math.abs(nx) >= Math.abs(nz) ? (nx >= 0 ? 'e' : 'w') : (nz >= 0 ? 's' : 'n');
}

export const BREAKABLES = [
  // Explosive gel: cracked walls.
  { id: 'wallMonarchBooth', kind: 'weakWall', room: { x: 158.2, y: 0.15, z: -60, w: 3.6, d: 3, h: 3.2, open: 'w', against: 'e' }, hides: { type: 'balloon', index: 6 } },
  { id: 'wallColdStore', kind: 'weakWall', room: { x: -70, y: 22, z: 128, w: 3, d: 3, h: 2.6, open: 'e' }, hides: { type: 'cache', id: 'cacheColdStore' } },
  { id: 'wallDinerRoof', kind: 'weakWall', room: { x: 192, y: 9, z: 66, w: 3, d: 3, h: 2.6, open: 'w' }, hides: { type: 'cache', id: 'cacheDinerRoof' } },
  { id: 'wallDockBrick', kind: 'weakWall', room: { x: -190, y: 26, z: 108, w: 3, d: 3, h: 2.6, open: 'e' }, hides: { type: 'cache', id: 'cacheDockBrick' } },
  { id: 'wallBarEscape', kind: 'weakWall', ladderNear: { x: 140, z: 48 }, hides: { type: 'shortcut' } },
  { id: 'wallIcebergEscape', kind: 'weakWall', ladderNear: { x: 160, z: 115 }, hides: { type: 'shortcut' } },
  // Remote batarang: the Joker's glass party signs hung over the street.
  { id: 'glassNeonNorth', kind: 'glass', box: { x: 150, y: 6.5, z: -30, w: 6, h: 1.6, d: 0.12 } },
  { id: 'glassNeonMid', kind: 'glass', box: { x: 150, y: 6.5, z: 30, w: 6, h: 1.6, d: 0.12 } },
  { id: 'glassNeonSouth', kind: 'glass', box: { x: 150, y: 6.5, z: 90, w: 6, h: 1.6, d: 0.12 } },
  { id: 'glassAceGate', kind: 'glass', box: { x: 95, y: 6, z: -99, w: 6, h: 1.6, d: 0.12 } },
  // Batclaw: vent covers on rooftop ducts, each hiding a small cache.
  { id: 'ventGcpd', kind: 'vent', room: { x: 14, y: 42, z: -10, w: 1.4, d: 1.4, h: 1.2, open: 's' }, hides: { type: 'cache', id: 'cacheVentGcpd' } },
  { id: 'ventWarehouse', kind: 'vent', room: { x: 66, y: 13, z: 186, w: 1.4, d: 1.4, h: 1.2, open: 'w' }, hides: { type: 'cache', id: 'cacheVentWarehouse' } },
  { id: 'ventJazz', kind: 'vent', room: { x: 110, y: 34, z: 76, w: 1.4, d: 1.4, h: 1.2, open: 'n' }, hides: { type: 'cache', id: 'cacheVentJazz' } },
  // Batclaw: weak railings on roof edges where goons stand. `site` finds the roof and its edge.
  { id: 'railWarehouse', kind: 'railing', site: { x: 60, y: 13, z: 166 }, len: 6 },
  { id: 'railFactory', kind: 'railing', site: { x: 140, y: 25.1, z: -172 }, len: 6 },
];
export const BREAKABLE_IDS = BREAKABLES.map((b) => b.id);

export const CACHES = [
  { id: 'cacheColdStore', xp: 250 }, { id: 'cacheDinerRoof', xp: 250 }, { id: 'cacheDockBrick', xp: 250 },
  { id: 'cacheVentGcpd', xp: 100 }, { id: 'cacheVentWarehouse', xp: 100 }, { id: 'cacheVentJazz', xp: 100 },
];
export const CACHE_IDS = CACHES.map((c) => c.id);
export const cacheById = (id) => CACHES.find((c) => c.id === id) ?? null;

export function roomWalls(r, t = 0.3) {
  const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = r.z - r.d / 2, z1 = r.z + r.d / 2, y0 = r.y, y1 = r.y + r.h;
  const faces = {
    w: { minX: x0, maxX: x0 + t, minZ: z0, maxZ: z1 },
    e: { minX: x1 - t, maxX: x1, minZ: z0, maxZ: z1 },
    n: { minX: x0, maxX: x1, minZ: z0, maxZ: z0 + t },
    s: { minX: x0, maxX: x1, minZ: z1 - t, maxZ: z1 },
  };
  const box = (f) => ({ ...f, minY: y0, maxY: y1 });
  const solid = [];
  for (const f of ['n', 's', 'e', 'w']) if (f !== r.open && f !== r.against) solid.push(box(faces[f]));
  return {
    weak: box(faces[r.open]),
    solid,
    roof: r.noRoof ? null : { minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y1, maxY: y1 + t },
  };
}

// A boarded cage around the foot of a street-level fire-escape ladder: the ladder's wall is the
// back, the weak face looks out along the ladder's normal. No roof, so climbing is untouched.
export function cageRoom(l, { depth = 1.8, width = 2.2, h = 3 } = {}) {
  const alongX = Math.abs(l.nx) >= Math.abs(l.nz);
  return {
    x: l.x + (l.nx * depth) / 2, y: l.bottom, z: l.z + (l.nz * depth) / 2,
    w: alongX ? depth : width, d: alongX ? width : depth, h,
    open: faceFromNormal(l.nx, l.nz), against: faceFromNormal(-l.nx, -l.nz), noRoof: true,
  };
}

export function nearestLadder(ladders, x, z, { maxBottom = 0.5, within = 12 } = {}) {
  let best = null, bd = within;
  for (const l of ladders) {
    if (l.bottom > maxBottom) continue;
    const d = Math.hypot(l.x - x, l.z - z);
    if (d <= bd) { best = l; bd = d; }
  }
  return best;
}

// A rail along the edge of roof box `b` nearest the site (sx, sz), `len` long, just inside the edge.
export function roofEdgeRail(b, sx, sz, len = 6, { inset = 0.1, t = 0.15, h = 1.1 } = {}) {
  const d = { w: sx - b.minX, e: b.maxX - sx, n: sz - b.minZ, s: b.maxZ - sz };
  const face = Object.keys(d).reduce((a, k) => (d[k] < d[a] ? k : a), 'w');
  const { nx, nz } = FACES[face];
  const half = len / 2;
  const cx = Math.min(Math.max(sx, b.minX + half), b.maxX - half);
  const cz = Math.min(Math.max(sz, b.minZ + half), b.maxZ - half);
  const y = b.maxY;
  if (nx) {
    const x = nx > 0 ? b.maxX - inset : b.minX + inset;
    return { minX: x - t / 2, maxX: x + t / 2, minZ: cz - half, maxZ: cz + half, minY: y, maxY: y + h, nx, nz, face };
  }
  const z = nz > 0 ? b.maxZ - inset : b.minZ + inset;
  return { minX: cx - half, maxX: cx + half, minZ: z - t / 2, maxZ: z + t / 2, minY: y, maxY: y + h, nx, nz, face };
}

export function boxDistance(b, p) {
  const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX);
  const dy = Math.max(b.minY - p.y, 0, p.y - b.maxY);
  const dz = Math.max(b.minZ - p.z, 0, p.z - b.maxZ);
  return Math.hypot(dx, dy, dz);
}
