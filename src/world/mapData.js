// The city as data. x is east, z is south (north is -z), y is up, meters. Streets are at y 0.
// Blocks sit on a 60 m grid; districts replace blocks with landmark buildings.
import { createRng } from '../core/rng.js';

export const GRID = { centers: [-180, -120, -60, 0, 60, 120, 180], block: 46, sidewalk: 0.15 };
export const WORLD = { minX: -236, maxX: 236, minZ: -236, maxZ: 205, waterZ: 205 };

// Merged super-blocks (no streets inside).
const COMPOUNDS = {
  ace: { minX: 37, maxX: 203, minZ: -203, maxZ: -97 },
  clock: { minX: -143, maxX: -37, minZ: -203, maxZ: -97 },
};

export function districtAt(x, z) {
  if (z > 150 || (z > 90 && x < -30)) return 'docks';
  if (x > 95 && z > -95 && z <= 150) return 'neon';
  if (x > 35 && z < -95) return 'ace';
  if (x < -35 && z < -95) return 'clock';
  if (Math.abs(x) < 30 && Math.abs(z) < 30) return 'gcpd';
  return 'city';
}

const inCompound = (x, z) => Object.values(COMPOUNDS).some((c) => x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1);

const B = (o) => ({ roof: 'flat', parapet: true, cornice: true, storefront: false, tiers: [], props: 'auto', neon: [], ...o });

function landmarks() {
  const list = [];
  // GCPD headquarters: the Batsignal roof.
  // hollow + exteriorHoles: Part I (interiors), the GCPD lobby. Face 4 (+z, south, the storefront
  // side) opens for the street doors; the roof (the Batsignal and the party) and every other face
  // are untouched.
  list.push(B({ id: 'gcpd', x: 0, z: 0, w: 40, d: 40, h: 42, style: 'deco', props: 'none', district: 'gcpd', landmark: true, storefront: true, neon: [{ text: 'GCPD', face: 's', y: 33, color: 'cyan', big: true }], hollow: true, exteriorHoles: [4] }));

  // The Docks: warehouses along the waterfront, a container yard, cold storage.
  list.push(B({ id: 'wh1', x: -180, z: 180, w: 40, d: 40, h: 12, style: 'warehouse', roof: 'sawtooth', parapet: false, cornice: false, district: 'docks' }));
  list.push(B({ id: 'wh2', x: -120, z: 182, w: 40, d: 32, h: 14, style: 'warehouse', parapet: false, cornice: false, district: 'docks' }));
  list.push(B({ id: 'wh3', x: -60, z: 180, w: 40, d: 40, h: 16, style: 'warehouse', parapet: true, district: 'docks', props: 'industrial', landmark: true }));
  list.push(B({ id: 'wh4', x: 60, z: 180, w: 40, d: 36, h: 13, style: 'warehouse', roof: 'sawtooth', parapet: false, cornice: false, district: 'docks' }));
  list.push(B({ id: 'cold', x: -60, z: 120, w: 38, d: 38, h: 22, style: 'concrete', district: 'docks', props: 'industrial' }));
  list.push(B({ id: 'wh5', x: -120, z: 120, w: 40, d: 40, h: 15, style: 'warehouse', roof: 'sawtooth', parapet: false, cornice: false, district: 'docks' }));
  list.push(B({ id: 'dockbrick', x: -180, z: 120, w: 36, d: 40, h: 26, style: 'brick', district: 'docks' }));

  // Neon Row: narrow buildings both sides of the x = 150 strip.
  const neonWest = [
    { z: -75, d: 16, h: 45, id: 'hotel', neon: [{ text: 'HOTEL', face: 'e', y: 20, color: 'pink', vertical: true }] },
    { z: -48, d: 22, h: 26, neon: [{ text: 'PAWN', face: 'e', y: 7, color: 'cyan' }] },
    { z: 0, d: 40, h: 30, id: 'gazette', billboard: { text: 'GOTHAM GAZETTE', sub: 'All the news that fits', face: 's' }, landmark: true },
    { z: 48, d: 20, h: 22, neon: [{ text: 'BAR', face: 'e', y: 6, color: 'pink', vertical: true }] },
    { z: 72, d: 18, h: 34, neon: [{ text: 'LIVE JAZZ', face: 'e', y: 9, color: 'cyan' }] },
    { z: 112, d: 30, h: 20, neon: [{ text: 'NOODLES', face: 'e', y: 6, color: 'pink' }] },
  ];
  for (const n of neonWest) list.push(B({ id: n.id ?? `nw${n.z}`, x: 120, z: n.z, w: 40, d: n.d, h: n.h, style: n.h > 30 ? 'deco' : 'brick', district: 'neon', storefront: true, neon: n.neon ?? [], billboard: n.billboard, landmark: !!n.landmark, fireEscape: 'e' }));
  const neonEast = [
    { z: -60, d: 40, h: 22, id: 'monarch', neon: [{ text: 'MONARCH', face: 'w', y: 6, color: 'pink', big: true, mode: 'marquee' }], landmark: true },
    { z: -9, d: 26, h: 38, neon: [{ text: 'OPEN 24H', face: 'w', y: 6, color: 'cyan' }] },
    { z: 13.5, d: 17, h: 28, billboard: { text: 'VOTE HARVEY DENT', sub: 'A brighter Gotham', face: 'w' } },
    { z: 60, d: 30, h: 9, id: 'diner', neon: [{ text: 'DINER', face: 'w', y: 5.5, color: 'cyan', big: true }, { text: 'EAT', face: 'w', y: 5, color: 'pink', offset: 11 }] },
    { z: 115, d: 34, h: 30, neon: [{ text: 'ICEBERG', face: 'w', y: 14, color: 'cyan', vertical: true }] },
  ];
  for (const n of neonEast) list.push(B({ id: n.id ?? `ne${n.z}`, x: 180, z: n.z, w: 40, d: n.d, h: n.h, style: n.h > 30 ? 'deco' : 'brick', district: 'neon', storefront: true, neon: n.neon ?? [], billboard: n.billboard, landmark: !!n.landmark, fireEscape: 'w' }));

  // Ace Chemicals: the factory, its smokestacks, the vat platform.
  // hollow + exteriorHoles: Part I (interiors). The factory keeps its sawtooth roof deck exactly
  // as built; only its west wall (face 1) gets a doorway, cut into src/world/interiors.js's hall.
  list.push(B({ id: 'factory', x: 140, z: -172, w: 64, d: 44, h: 24, style: 'factory', roof: 'sawtooth', parapet: true, district: 'ace', props: 'none', landmark: true, hollow: true, exteriorHoles: [1] }));
  list.push(B({ id: 'acelab', x: 70, z: -118, w: 30, d: 26, h: 14, style: 'concrete', district: 'ace', props: 'industrial' }));
  list.push(B({ id: 'vatdeck', x: 180, z: -118, w: 26, d: 26, h: 10, style: 'steel', parapet: true, cornice: false, district: 'ace', props: 'none', landmark: true }));

  // Clock plaza: the cathedral and the clock tower hall (the boss arena is its roof).
  // hollow + exteriorHoles: Part I (interiors), the Joker funhouse. Faces 4 (+z, the plaza doors)
  // and 5 (-z, the rose window) are cut by src/world/interiors.js; the pitched roof is untouched.
  list.push(B({ id: 'cathedral', x: -120, z: -150, w: 26, d: 62, h: 28, style: 'stone', roof: 'pitched', parapet: false, cornice: true, district: 'clock', props: 'none', landmark: true, hollow: true, exteriorHoles: [4, 5] }));
  list.push(B({ id: 'hall', x: -62, z: -160, w: 40, d: 40, h: 58, style: 'stone', district: 'clock', props: 'none', landmark: true }));
  return list;
}

const STYLES = ['brick', 'brick', 'stone', 'deco', 'concrete'];

function fillerBlock(rng, cx, cz) {
  const out = [];
  const layouts = [
    [[0, 0, 40, 40]],
    [[-10.5, 0, 19, 40], [10.5, 0, 19, 40]],
    [[0, -10.5, 40, 19], [0, 10.5, 40, 19]],
    [[-10.5, -10.5, 19, 19], [10.5, -10.5, 19, 19], [0, 10.5, 40, 19]],
    [[-10.5, -10.5, 19, 19], [10.5, -10.5, 19, 19], [-10.5, 10.5, 19, 19], [10.5, 10.5, 19, 19]],
  ];
  const layout = rng.pick(layouts);
  for (const [ox, oz, w, d] of layout) {
    const tall = rng.chance(0.18);
    const h = Math.round(tall ? rng.range(44, 64) : rng.range(14, 40));
    const style = h > 40 ? rng.pick(['deco', 'stone']) : rng.pick(STYLES);
    const tiers = [];
    if (h > 34 && w > 18 && d > 18 && rng.chance(0.6)) tiers.push({ w: w * 0.62, d: d * 0.62, h: rng.range(6, 14), spire: rng.chance(0.4) });
    out.push(B({
      id: `f${cx}_${cz}_${ox}_${oz}`, x: cx + ox, z: cz + oz, w: w - 1, d: d - 1, h, style, tiers,
      storefront: rng.chance(0.6), fireEscape: rng.chance(0.35) ? rng.pick(['n', 's', 'e', 'w']) : null,
      district: districtAt(cx, cz),
    }));
  }
  return out;
}

export function buildMapData(seed = 11) {
  const rng = createRng(seed);
  const buildings = landmarks();
  const taken = new Set(['0,0']);
  for (const b of buildings) {
    const cx = GRID.centers.reduce((a, c) => (Math.abs(c - b.x) < Math.abs(a - b.x) ? c : a));
    const cz = GRID.centers.reduce((a, c) => (Math.abs(c - b.z) < Math.abs(a - b.z) ? c : a));
    taken.add(`${cx},${cz}`);
  }
  // Blocks kept open on purpose: the container yard and the waterfront east of it.
  for (const k of ['0,180', '120,180', '180,180', '120,120', '180,120']) taken.add(k);
  for (const cx of GRID.centers) {
    for (const cz of GRID.centers) {
      if (taken.has(`${cx},${cz}`) || inCompound(cx, cz)) continue;
      buildings.push(...fillerBlock(rng, cx, cz));
    }
  }
  return { buildings, compounds: COMPOUNDS, sites: SITES };
}

// Named gameplay anchors. y is the walkable surface.
export const SITES = {
  start: { x: 6, y: 42, z: 10 },
  signal: { x: -12, y: 42, z: -12 },
  wh3Roof: { x: -60, y: 16, z: 180 },
  yard: { x: 0, y: 0.15, z: 178 },
  freighter: { x: -44, y: 9, z: 238 },
  presents: { x: -44, y: 9, z: 232 },
  gazetteRoof: { x: 120, y: 30, z: 0 },
  neonStreet: { x: 150, y: 0, z: 62 },
  monarchRoof: { x: 180, y: 22, z: -60 },
  party: { x: 186, y: 22, z: -66 },
  aceYard: { x: 95, y: 0, z: -140 },
  factoryRoof: { x: 140, y: 25.1, z: -172 },
  vatDeck: { x: 180, y: 10, z: -118 },
  cake: { x: 184, y: 10, z: -112 },
  arena: { x: -62, y: 58, z: -154 },
  balcony: { x: -62, y: 68, z: -176 },
  // Predator rooms (src/stealth/stealthRooms.js): each room's centre and where Batman arrives.
  monarchBalcony: { x: 203, y: 13, z: -60 },
  monarchBalconyEntry: { x: 192, y: 22, z: -60 },
  aceCatwalks: { x: 124, y: 0.15, z: -118 },
  aceCatwalksEntry: { x: 172, y: 10, z: -124 },
  // Interiors (Part I, src/world/interiors.js): the nave floor inside the cathedral (the Act 3
  // finale fight) and the factory hall floor (a fight or stealth room, entered at the loading dock).
  funhouse: { x: -120, y: 0.15, z: -150 },
  aceHall: { x: 140, y: 0.15, z: -172 },
  // The plaza doors' outside landing (src/world/interiors.js's INTERIOR_ROOMS.funhouse.outside):
  // Part S's 'toFunhouse' step targets this, not the nave floor itself, so the travel waypoint
  // leads Mansi up to the door instead of pointing through a solid wall from outside.
  funhouseDoor: { x: -120, y: 0, z: -108 },
  // The GCPD headquarters lobby (Part I, src/world/interiors.js's INTERIOR_ROOMS.gcpd), just
  // inside the street doors on the south face.
  gcpdLobby: { x: 0, y: 0.15, z: 6 },
};
