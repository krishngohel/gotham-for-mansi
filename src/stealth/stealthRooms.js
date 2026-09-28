// The two predator rooms as data. src/world/stealthSets.js builds the scenery from this, the
// runtime (src/stealth/stealthSystem.js) reads the lights, perches, vent, huddle and routes, and
// roomCheck.js validates all of it against the live city. Every y is a walkable surface.
// Axes: x east, z south, y up; yaw 0 faces +z (south), PI / 2 east, PI north, -PI / 2 west.
import { SITES } from '../world/mapData.js';

const W = (x, y, z, wait = 0, face = null) => ({ x, y, z, wait, face });
const route = (mode, ...points) => ({ mode, points });
const toward = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);
const SOUTH = 0, EAST = Math.PI / 2, NORTH = Math.PI, WEST = -Math.PI / 2;

// ---- Monarch Balcony: a deck on the theater's quiet east face, 9 m below the roof. ----
const monarchBalcony = {
  id: 'monarchBalcony', name: 'Monarch Balcony', site: 'monarchBalcony', entry: 'monarchBalconyEntry', radius: 14,
  bounds: { minX: 199, maxX: 207.5, minY: 11, maxY: 26, minZ: -79.5, maxZ: -40.5 },
  decks: [{ minX: 200, maxX: 206, minZ: -78, maxZ: -42, y: 13, t: 0.3, kind: 'balcony', grapples: 'x+' }],
  posts: [],
  columns: [],
  // Gargoyles on plinths on the roof's east parapet (roof at 22), looking out over the balcony.
  perches: [-74, -64, -56, -46].map((z) => ({ x: 200.32, y: 22.9, z, yaw: EAST, plinth: 22 })),
  cover: [
    { x: 203, y: 13, z: -66, w: 1.4, d: 1.4, h: 1.1, kind: 'planter' },
    { x: 203, y: 13, z: -54, w: 1.4, d: 1.4, h: 1.1, kind: 'planter' },
  ],
  rails: [
    { x1: 206, z1: -78, x2: 206, z2: -42, y: 13 },
    { x1: 200, z1: -78, x2: 206, z2: -78, y: 13 },
    { x1: 200, z1: -42, x2: 206, z2: -42, y: 13 },
  ],
  // Lamps over the three doorways: pools of light against the wall, shadow at the rail.
  lights: [-70, -60, -50].map((z) => ({ x: 200.6, y: 15.6, z, r: 3.5, lamp: 'wall' })),
  doors: [-70, -60, -50].map((z) => ({ x: 200, y: 13, z })),
  vent: null,
  huddle: { x: 203, y: 13, z: -60 },
  squad: [
    { type: 'rifle', route: route('pingpong', W(201.2, 13, -76, 2, NORTH), W(201.2, 13, -44, 2, SOUTH)) },
    { type: 'rifle', route: route('pingpong', W(204.8, 13, -62, 1.5, EAST), W(204.8, 13, -44, 1.5, EAST)) },
    { type: 'rifle', route: route('pingpong', W(204.8, 13, -76, 3, EAST), W(204.8, 13, -65, 3, EAST)) },
    { type: 'grunt', route: route('pingpong', W(202.8, 13, -47, 5, EAST), W(202.8, 13, -50, 5, EAST)) },
  ],
};
monarchBalcony.encore = monarchBalcony.squad.map((g) => ({ ...g, type: 'rifle' }));

// ---- Ace Chemicals Catwalks: the vat hall round the two vats, with a 7 m catwalk "H". ----
const CX = 124, CZ = -118;
const columns = [[101, -101], [139, -101], [101, -138], [139, -138]].map(([x, z]) => ({ x, z, y0: 0.15, top: 11 }));
const aceCatwalks = {
  id: 'aceCatwalks', name: 'Ace Chemicals Catwalks', site: 'aceCatwalks', entry: 'aceCatwalksEntry', radius: 24,
  bounds: { minX: 98, maxX: 168, minY: -1, maxY: 14, minZ: -141, maxZ: -98 },
  decks: [
    { minX: 101, maxX: 137, minZ: -105, maxZ: -103.4, y: 7, t: 0.2, kind: 'catwalk', grapples: 'all' },
    { minX: 101, maxX: 137, minZ: -134.6, maxZ: -133, y: 7, t: 0.2, kind: 'catwalk', grapples: 'all' },
    { minX: 119.2, maxX: 120.8, minZ: -133, maxZ: -105, y: 7, t: 0.2, kind: 'catwalk', grapples: 'all' },
  ],
  posts: [
    ...[102, 108, 114, 126, 132, 136.4].flatMap((x) => [{ x, z: -104.2 }, { x, z: -133.8 }]),
    { x: 120, z: -110 }, { x: 120, z: -126 },
  ].map((p) => ({ ...p, y0: 0.15, y1: 6.8 })),
  columns,
  perches: columns.map((c) => ({ x: c.x, y: c.top, z: c.z, yaw: toward(c.x, c.z, CX, CZ) })),
  cover: [[146, -112], [145, -128], [150, -104], [156, -134], [109.5, -124], [134.5, -113]]
    .map(([x, z]) => ({ x, y: 0.15, z, w: 1.6, d: 1.6, h: 1.4, kind: 'crate' })),
  // Rails along both edges of each walkway, with gaps where the spine joins.
  rails: [
    { x1: 101, z1: -103.4, x2: 137, z2: -103.4, y: 7 },
    { x1: 101, z1: -105, x2: 119.2, z2: -105, y: 7 }, { x1: 120.8, z1: -105, x2: 137, z2: -105, y: 7 },
    { x1: 101, z1: -134.6, x2: 137, z2: -134.6, y: 7 },
    { x1: 101, z1: -133, x2: 119.2, z2: -133, y: 7 }, { x1: 120.8, z1: -133, x2: 137, z2: -133, y: 7 },
    { x1: 119.2, z1: -133, x2: 119.2, z2: -105, y: 7 }, { x1: 120.8, z1: -133, x2: 120.8, z2: -105, y: 7 },
  ],
  // The vats already glow (districts.js); three lamp posts light the rest, leaving dark lanes.
  lights: [
    { x: 112, y: 6.6, z: -112, r: 7, lamp: null },
    { x: 128, y: 6.6, z: -126, r: 7, lamp: null },
    { x: 146, y: 6, z: -104, r: 5, lamp: 'post', base: 0.15 },
    { x: 146, y: 6, z: -132, r: 5, lamp: 'post', base: 0.15 },
    { x: 104, y: 5, z: -137, r: 4, lamp: 'post', base: 0.15 },
  ],
  doors: [],
  vent: { x: 120, y: 0.15, z: -118, w: 3, d: 3 },
  huddle: { x: 145, y: 0.15, z: -121 },
  squad: [
    { type: 'rifle', route: route('pingpong', W(102.5, 7, -104.2, 2, NORTH), W(135.5, 7, -104.2, 2, NORTH)) },
    { type: 'rifle', route: route('pingpong', W(120, 7, -106.5, 1, NORTH), W(120, 7, -133.8, 1), W(103, 7, -133.8, 2, SOUTH)) },
    { type: 'rifle', route: route('pingpong', W(104, 0.15, -108, 2, EAST), W(104, 0.15, -130, 2, EAST)) },
    { type: 'rifle', route: route('loop', W(140, 0.15, -106), W(158, 0.15, -106, 1.5, WEST), W(158, 0.15, -130), W(140, 0.15, -130, 1.5, WEST)) },
  ],
};
aceCatwalks.encore = [
  ...aceCatwalks.squad,
  { type: 'knife', route: route('pingpong', W(126, 0.15, -100.5, 4, NORTH), W(114, 0.15, -100.5, 4, NORTH)) },
];

export const ROOMS = { monarchBalcony, aceCatwalks };
export const ROOM_IDS = Object.keys(ROOMS);

export const roomSquad = (room, kind = 'main') => (kind === 'encore' ? room.encore : room.squad);

// Every route point in the room, once: the walkable spots searching goons try.
export function roomSpots(room) {
  const seen = new Set(), out = [];
  for (const g of [...room.squad, ...room.encore]) {
    for (const p of g.route.points) {
      const k = `${p.x},${p.y},${p.z}`;
      if (!seen.has(k)) { seen.add(k); out.push(p); }
    }
  }
  return out;
}

// An encounter definition (src/game/encounters.js) for a room: one wave on the route starts.
// The story uses the main squad; the post-game (Part H, Missing Guests) can pass squad: 'encore'.
export function stealthFight(roomId, { squad = 'main' } = {}) {
  const room = ROOMS[roomId];
  if (!room) throw new Error(`Unknown stealth room ${roomId}`);
  const site = SITES[room.site];
  return {
    site: room.site, radius: room.radius, entry: room.entry, stealth: room.id, squad,
    waves: [roomSquad(room, squad).map((g) => {
      const p = g.route.points[0];
      return { type: g.type, dx: p.x - site.x, dz: p.z - site.z, y: p.y };
    })],
  };
}
