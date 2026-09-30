// Part I: enterable interiors. Two landmarks from mapData.js are hollow (`hollow: true`,
// `exteriorHoles`, read by cityBuilder.js's facade()): the cathedral (the Joker's Act 3 funhouse)
// and the Ace Chemicals factory (the interior hall). Both keep their exterior look and their roof
// exactly as built; only one or two faces lose their whole-volume collision box, replaced here by
// real wall/ceiling collision with actual gaps for the doors.
//
// This file has two halves:
//  - pure data + pure helpers (INTERIOR_ROOMS, roomBounds, insideRoom, roomAt): no three.js, unit
//    tested directly (tests/unit/interiors.test.js).
//  - buildInteriors(ctx), called once from world.js right alongside buildCity/buildDistricts (so
//    its geometry merges into the same buckets and freezes with the rest of the city), plus the
//    runtime createInteriors(deps), the Part I contract: `{ rooms, enter(id), exit(), inside }`.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { createRng } from '../core/rng.js';
import { box, cylinder, tiledBox } from './buckets.js';
import { solid, glow, lightSpot, edgeGrapples } from './cityBuilder.js';
import { addLadder } from './climbables.js';
import { billboardTexture } from './textures.js';
import { toonMaterial } from '../render/toon.js';

// ---- pure data: room bounds + doors ----

export const INTERIOR_ROOMS = {
  funhouse: {
    id: 'funhouse', name: "Joker's Funhouse", building: 'cathedral',
    // The nave's clear floor: about 22 x 58 m, 20 m to the ceiling (spec: "about 22 x 56 x 20").
    bounds: { minX: -131, maxX: -109, minY: 0, maxY: 20, minZ: -179, maxZ: -121 },
    doors: [
      // The plaza doors: walkable, street level, under the existing stone portal (districts.js).
      { id: 'doors', x: -120, y: 0, z: -119, w: 6, h: 10.5, walk: true },
      // The broken rose window, high on the far (north) gable: glide in, no floor there.
      { id: 'rose', x: -120, y: 17, z: -181, w: 6, h: 6, walk: false },
    ],
    fight: { x: -120, y: 0.15, z: -150, radius: 12 },
    outside: { x: -120, y: 0, z: -108 },
  },
  aceHall: {
    id: 'aceHall', name: 'Ace Chemicals Hall', building: 'factory',
    bounds: { minX: 112, maxX: 168, minY: 0, maxY: 18, minZ: -190, maxZ: -154 },
    doors: [
      // A loading dock door on the factory's west wall, by the existing "paste-ups by the doors"
      // graffiti and wanted poster (districts.js's aceChemicals()).
      { id: 'dock', x: 108, y: 0, z: -164, w: 6, h: 6, walk: true },
    ],
    fight: { x: 140, y: 0.15, z: -172, radius: 12 },
    outside: { x: 96, y: 0, z: -164 },
  },
  gcpd: {
    id: 'gcpd', name: 'GCPD Headquarters', building: 'gcpd',
    // A single ground-floor lobby under the tower (the roof, the Batsignal and the party stay
    // exactly as built): the clear floor, a little inset from the walls at x/z = +-20.
    bounds: { minX: -18, maxX: 18, minY: 0, maxY: 6, minZ: -18, maxZ: 18 },
    doors: [
      // The street doors, south face (the storefront side), under the GCPD sign.
      { id: 'doors', x: 0, y: 0, z: 20, w: 7, h: 4.5, walk: true },
    ],
    fight: { x: 0, y: 0.15, z: 6, radius: 9 },
    outside: { x: 0, y: 0, z: 25 },
  },
};

// Padded a little past the clear interior: "inside" reads true right up to the walls and a step
// or two past a doorway, rather than only exactly on the centre line.
const PAD = 1.5;
export function roomBounds(room) {
  const b = room.bounds;
  return { minX: b.minX - PAD, maxX: b.maxX + PAD, minY: b.minY - 1, maxY: b.maxY + PAD, minZ: b.minZ - PAD, maxZ: b.maxZ + PAD };
}

export function insideRoom(room, p) {
  const b = roomBounds(room);
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY && p.z >= b.minZ && p.z <= b.maxZ;
}

// Which room (if any) contains point p. The two rooms are far apart, so at most one ever matches.
export function roomAt(p, rooms = INTERIOR_ROOMS) {
  for (const room of Object.values(rooms)) if (insideRoom(room, p)) return room.id;
  return null;
}

// ---- impure: geometry + collision, built once alongside the city ----

const WT = 1.2; // exterior wall collision thickness, straddling the facade's visual plane

// A single-sided box face is invisible from the side its normal points away from: standing INSIDE
// a hollow building and looking at one of its own walls would see nothing (backface-culled) and
// straight through to whatever is further outside, unless that wall is drawn double-sided. Every
// interior wall/ceiling surface in this file uses this one small, dedicated material (never the
// shared city 'facade_*' materials) so the fix is contained to these two rooms and costs nothing
// on the main exterior view.
function interiorMat(ctx, color) {
  if (!ctx.materials.interiorWall) {
    ctx.materials.interiorWall = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  }
  return { key: 'interiorWall', color };
}

// A dedicated, always-on fill light for one room: real ambient lift (not just baked halos), but
// distance-limited so it never reaches the exterior city. Added once, at boot, alongside the rest
// of the city (before ink.compileAsync), so it's part of the one-time shader compile, exactly like
// world.js's fireworkLight (a light that exists from boot so the scene's light count never changes
// mid-run).
function roomFill(ctx, x, y, z, color, intensity, distance) {
  if (typeof THREE.PointLight !== 'function') return;
  const light = new THREE.PointLight(color, intensity, distance, 1.4);
  light.position.set(x, y, z);
  ctx.scene.add(light);
}

// A straight exterior wall along one axis, minus a single rectangular gap (a door or a window):
// left pier, right pier, footer (if the gap doesn't reach the floor) and header. `axis` is the
// wall's long run ('x' or 'z'); `at` is its fixed position on the other axis. Visual and collision
// together (solid()), so the gap is a real hole in both, and double-sided (see interiorMat above).
function wallWithGap(ctx, axis, at, s0, s1, h, t, gap, color) {
  const { key } = interiorMat(ctx, color);
  const { g0, g1, gy0 = 0, gy1 = h } = gap;
  const seg = (a0, a1, y0, y1) => {
    if (a1 - a0 <= 0.02 || y1 - y0 <= 0.02) return;
    const len = a1 - a0, mid = (a0 + a1) / 2, midY = (y0 + y1) / 2, hh = y1 - y0;
    const w = axis === 'x' ? len : t, d = axis === 'x' ? t : len;
    const px = axis === 'x' ? mid : at, pz = axis === 'x' ? at : mid;
    solid(ctx, key, box(w, hh, d, px, midY, pz), { color, tag: 'building' });
  };
  seg(s0, g0, 0, h);
  seg(g1, s1, 0, h);
  seg(g0, g1, 0, gy0);
  seg(g0, g1, gy1, h);
}

// A plain wall, no gap: collision plus a double-sided visual lining, inset a little from the
// shared exterior facade mesh it sits just inside of (so the two never z-fight), for a face that
// keeps its normal textured facade outside (unexcluded in mapData.js) but still needs to read as
// an enclosing wall, not a hole, from inside the room.
function wallLining(ctx, axis, at, s0, s1, h, inset, color) {
  const { key } = interiorMat(ctx, color);
  const a = at + inset;
  const w = axis === 'x' ? s1 - s0 : 0.3, d = axis === 'x' ? 0.3 : s1 - s0;
  const px = axis === 'x' ? (s0 + s1) / 2 : a, pz = axis === 'x' ? a : (s0 + s1) / 2;
  ctx.buckets.add(key, box(w, h, d, px, h / 2, pz), color);
}

// A painted stripe band, a hair's breadth proud of a wallLining so it never z-fights it.
function stripeBand(ctx, axis, at, s0, s1, y, inset, color) {
  const { key } = interiorMat(ctx, color);
  const a = at + inset;
  const w = axis === 'x' ? s1 - s0 : 0.34, d = axis === 'x' ? 0.34 : s1 - s0;
  const px = axis === 'x' ? (s0 + s1) / 2 : a, pz = axis === 'x' ? a : (s0 + s1) / 2;
  ctx.buckets.add(key, box(w, 1.4, d, px, y, pz), color);
}

// A circus harlequin band: alternating diamond panels along a wall running along z (fixed x).
function harlequinBand(ctx, wallX, z0, z1, y, inset, colors) {
  const { key } = interiorMat(ctx, colors[0]);
  const n = Math.round((z1 - z0) / 2.2);
  for (let i = 0; i < n; i++) {
    const z = z0 + (z1 - z0) * ((i + 0.5) / n);
    const diamond = new THREE.PlaneGeometry(1.9, 1.9).rotateZ(Math.PI / 4).rotateY(Math.PI / 2).translate(wallX + inset, y, z);
    ctx.buckets.add(key, diamond, colors[i % 2]);
  }
}

// Diagonal circus stripes on a wall running along z (fixed x): tilted bands in the (y, z) plane.
function diagonalStripes(ctx, wallX, z0, z1, y0, y1, inset, colors) {
  const { key } = interiorMat(ctx, colors[0]);
  const n = Math.round((z1 - z0) / 1.6);
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const strip = box(0.5, (y1 - y0) * 1.9, 1.3, 0, 0, 0).rotateX(Math.PI / 4).translate(wallX + inset, (y0 + y1) / 2, z0 + (z1 - z0) * t);
    ctx.buckets.add(key, strip, colors[i % 2]);
  }
}

// A giant playing-card panel: a rounded rectangle with a big suit diamond and corner pips.
function cardPanel(ctx, wallX, y, z, inset, cardColor, suitColor) {
  const key = interiorMat(ctx, cardColor).key;
  ctx.buckets.add(key, box(0.12, 5.2, 3.4, wallX + inset, y, z), cardColor);
  const suit = new THREE.PlaneGeometry(1.7, 1.7).rotateZ(Math.PI / 4).rotateY(Math.PI / 2).translate(wallX + inset * 1.2, y, z);
  ctx.buckets.add(key, suit, suitColor);
  for (const s of [-1, 1]) {
    const pip = new THREE.PlaneGeometry(0.5, 0.5).rotateZ(Math.PI / 4).rotateY(Math.PI / 2).translate(wallX + inset * 1.2, y + s * 2.1, z - 1.2);
    ctx.buckets.add(key, pip, suitColor);
  }
}

// A ring of coloured floor tiles (a checkerboard), drawn only (no per-tile collision: the world's
// implicit floor is already y = 0 everywhere here, same as every street).
function checkerFloor(ctx, minX, maxX, minZ, maxZ, y, tile, a, b) {
  const cols = Math.round((maxX - minX) / tile), rows = Math.round((maxZ - minZ) / tile);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const tx = minX + tile / 2 + i * tile, tz = minZ + tile / 2 + j * tile;
      ctx.buckets.add('painted', box(tile - 0.06, 0.1, tile - 0.06, tx, y, tz), (i + j) % 2 === 0 ? a : b);
    }
  }
}

// A comic-book Joker face, built entirely from primitives (no canvas: it must build under the
// unit-test's plain-node ctx too), flat against a wall, facing +z (outward toward the doors).
function jokerFacePlaque(ctx, x, y, z) {
  // The wall faces +z (toward the doors, where the viewer stands), so every detail drawn "on top
  // of" the base disc must sit at a LARGER z than it (closer to the viewer), not smaller.
  const put = (g, color) => ctx.buckets.add('painted', g, color);
  put(new THREE.CircleGeometry(6.2, 28).translate(x, y, z), 0xe9e2c8);
  // Green hair: a ring of triangular spikes around the top half.
  for (let a = -Math.PI * 0.92; a <= Math.PI * -0.08; a += 0.16) {
    const spike = new THREE.ConeGeometry(0.55, 2.4, 3).rotateX(Math.PI / 2).rotateZ(a + Math.PI / 2);
    spike.translate(x + Math.cos(a) * 6.4, y + Math.sin(a) * 6.4, z + 0.05);
    put(spike, PALETTE.jokerGreen);
  }
  for (const s of [-1, 1]) put(new THREE.CircleGeometry(1.05, 18).scale(0.72, 1, 1).translate(x + s * 2.3, y + 0.6, z + 0.08), 0x0b0b12);
  // The grin: a fat red arc built from short straight segments (a torus would show its hole).
  const R = 3.6;
  for (let a = -0.95; a < 0.95; a += 0.14) {
    const a2 = Math.min(a + 0.14, 0.95);
    const p1x = Math.sin(a) * R, p1y = -Math.cos(a) * R, p2x = Math.sin(a2) * R, p2y = -Math.cos(a2) * R;
    const len = Math.hypot(p2x - p1x, p2y - p1y);
    const seg = box(len + 0.3, 0.8, 0.12, x + (p1x + p2x) / 2, y - 2.1 + (p1y + p2y) / 2, z + 0.08);
    seg.rotateZ(Math.atan2(p2y - p1y, p2x - p1x));
    put(seg, PALETTE.balloon);
  }
  for (let k = -3; k <= 3; k++) put(box(0.55, 0.8, 0.14, x + k * 0.8, y - 3, z + 0.12), 0xf3f3f3);
}

// A party bunting garland strung between two points: small triangular flags, alternating colour.
function bunting(ctx, x1, z1, x2, z2, y, colors) {
  const n = Math.max(4, Math.round(Math.hypot(x2 - x1, z2 - z1) / 1.4));
  for (let i = 0; i <= n; i++) {
    const t = i / n, sag = Math.sin(Math.PI * t) * 0.7;
    const fx = x1 + (x2 - x1) * t, fz = z1 + (z2 - z1) * t, fy = y - sag;
    const flag = new THREE.ConeGeometry(0.35, 0.6, 3).rotateX(Math.PI).translate(fx, fy - 0.3, fz);
    ctx.buckets.add('painted', flag, colors[i % colors.length]);
  }
}

function buildFunhouse(ctx) {
  const rng = createRng(4242);
  const CX = -120, CZ = -150, CW = 26, CD = 62, CH = 28;
  const cx0 = CX - CW / 2, cx1 = CX + CW / 2, cz0 = CZ - CD / 2, cz1 = CZ + CD / 2;
  const r = INTERIOR_ROOMS.funhouse;
  const doorGap = { g0: r.doors[0].x - r.doors[0].w / 2, g1: r.doors[0].x + r.doors[0].w / 2, gy0: 0, gy1: r.doors[0].h };
  const roseGap = { g0: r.doors[1].x - r.doors[1].w / 2, g1: r.doors[1].x + r.doors[1].w / 2, gy0: r.doors[1].y, gy1: r.doors[1].y + r.doors[1].h };
  // South wall (z = cz1): the plaza doors, under the existing stone portal. North wall (z = cz0):
  // the rose window, high in the gable end. East/west keep their normal facade mesh outside
  // (unhollowed by exteriorHoles) and just need their own collision plus an inside lining now the
  // whole-volume box is gone.
  wallWithGap(ctx, 'x', cz1, cx0, cx1, CH, WT, doorGap, PALETTE.stone);
  wallWithGap(ctx, 'x', cz0, cx0, cx1, CH, WT, roseGap, PALETTE.stone);
  ctx.collision.addBox(cx0 - WT / 2, 0, cz0, cx0 + WT / 2, CH, cz1, 'building');
  ctx.collision.addBox(cx1 - WT / 2, 0, cz0, cx1 + WT / 2, CH, cz1, 'building');
  wallLining(ctx, 'z', cx0, cz0, cz1, CH, 0.3, PALETTE.stone);
  wallLining(ctx, 'z', cx1, cz0, cz1, CH, -0.3, PALETTE.stone);
  // Big-top stripes painted over the walls: two purple/green bands running the length of the room.
  for (const [y, color] of [[3.5, PALETTE.jokerPurple], [8.5, PALETTE.jokerGreen]]) {
    stripeBand(ctx, 'z', cx0, cz0 + 4, cz1 - 4, y, 0.45, color);
    stripeBand(ctx, 'z', cx1, cz0 + 4, cz1 - 4, y, -0.45, color);
  }
  // Big diagonal circus stripes low and a harlequin diamond band high on the west wall, plus two
  // giant playing-card panels, so the side walls read as circus tent, not plain grey. The east
  // wall keeps its stripes plus the funhouse mirrors (below) as its own decoration.
  diagonalStripes(ctx, cx0, cz0 + 5, cz1 - 5, 1, 5.5, 0.5, [PALETTE.jokerPurple, PALETTE.paper]);
  harlequinBand(ctx, cx0, cz0 + 5, cz1 - 5, 12, 0.5, [PALETTE.jokerPurple, 0xf0e6c8]);
  cardPanel(ctx, cx0, 6.5, -142, 0.5, 0xf0e6c8, PALETTE.balloon);
  cardPanel(ctx, cx0, 6.5, -158, 0.5, 0xf0e6c8, PALETTE.jokerPurple);
  harlequinBand(ctx, cx1, cz0 + 5, cz1 - 5, 15.5, -0.5, [PALETTE.jokerGreen, 0xf0e6c8]);
  // Ceiling: below the roof (h = 28), so the pitched roof deck people can stand on is untouched.
  const b = r.bounds;
  solid(ctx, 'painted', box(b.maxX - b.minX, 0.6, b.maxZ - b.minZ, CX, b.maxY - 0.3, CZ), { color: 0x1c1620, tag: 'ceiling' });

  checkerFloor(ctx, b.minX, b.maxX, b.minZ, b.maxZ, 0.06, 4, 0xf0e6c8, 0x1c1620);

  // Pillars down both long sides, with collision, clear of the fight circle at the room's centre.
  // Big-top stripes: alternating purple and Joker-green painted bands, wound all the way up.
  const pillarX = [CX - 7, CX + 7];
  const pillarZ = [-130, -140, -150, -160, -170];
  const STRIPE_COLORS = [PALETTE.jokerPurple, PALETTE.jokerGreen];
  for (const xc of pillarX) {
    for (const zc of pillarZ) {
      solid(ctx, 'trim', cylinder(0.9, 0.9, 20, xc, 10, zc, 12), { tag: 'pillar' });
      for (let k = 0; k < 10; k++) ctx.buckets.add('painted', cylinder(0.92, 0.92, 1, xc, 0.5 + k, zc, 12), STRIPE_COLORS[k % 2]);
    }
  }

  // Carnival lights strung between every pair of pillars down each side, sagging like real bulbs:
  // dense and bright, so the strings read as a glowing line, not scattered dots. A cross line
  // between the two rows too, so the middle of the room is strung with lights as well.
  const BULB_COLORS = [PALETTE.balloon, PALETTE.chem, PALETTE.window, PALETTE.jokerPurple, PALETTE.signal];
  const bulbLine = (x1, z1, x2, z2, y0) => {
    for (let t = 0; t <= 1; t += 0.09) {
      const xt = x1 + (x2 - x1) * t, zt = z1 + (z2 - z1) * t, sag = Math.sin(Math.PI * t) * 0.6;
      const y = y0 - sag, col = rng.pick(BULB_COLORS);
      glow(ctx, new THREE.SphereGeometry(0.17, 8, 6).translate(xt, y, zt), col);
      ctx.halos.add(xt, y, zt, col, 2.4);
    }
  };
  for (const xc of pillarX) for (let i = 0; i < pillarZ.length - 1; i++) bulbLine(xc, pillarZ[i], xc, pillarZ[i + 1], 19.2);
  for (const zc of pillarZ) bulbLine(pillarX[0], zc, pillarX[1], zc, 18.4);

  // Balcony ring: a standing ledge along both long walls, with grapple points along its edge.
  for (const xc of [CX - 10.5, CX + 10.5]) {
    solid(ctx, 'steel', box(1.4, 0.3, b.maxZ - b.minZ - 4, xc, 10, CZ), { tag: 'stealthDeck' });
    edgeGrapples(ctx, xc, CZ, 1.4, b.maxZ - b.minZ - 4, 10, 7);
  }

  // The Joker's face stage, on the north wall facing the doors, lit from below and from a big
  // spotlight cone hung over the middle of the room.
  jokerFacePlaque(ctx, CX, 13, cz0 + 1.1);
  glow(ctx, box(10, 0.4, 0.3, CX, 6.4, cz0 + 1.3), PALETTE.jokerPurple);
  ctx.halos.add(CX, 6.6, cz0 + 1.5, PALETTE.neonPink, 8);
  if (ctx.quality?.name !== 'low') ctx.buckets.add('cone', new THREE.CylinderGeometry(0.4, 3.6, 18, 14, 1, true).translate(CX, 10, cz0 + 6));
  // A real fill light over the nave: warm, so the room reads bright at a glance instead of
  // relying only on baked halos. Distance-limited, never reaches the exterior city.
  roomFill(ctx, CX, 10, CZ, 0xffdba0, 2, 55);
  roomFill(ctx, CX, 8, cz0 + 8, PALETTE.jokerPurple, 1.6, 30);
  // Warm and cool light pools on the floor, big and bright: a spotlight glow under the stage, a
  // sickly one centre, and two more down each side so the whole floor reads lit, not grey.
  ctx.buckets.add('pool', new THREE.CircleGeometry(5.4, 22).rotateX(-Math.PI / 2).translate(CX, 0.13, cz0 + 6), 0xffdba0);
  ctx.buckets.add('pool', new THREE.CircleGeometry(6.5, 22).rotateX(-Math.PI / 2).translate(CX, 0.13, CZ), 0xa06ae0);
  for (const zc of [-135, -165]) {
    ctx.buckets.add('pool', new THREE.CircleGeometry(4, 20).rotateX(-Math.PI / 2).translate(CX - 7, 0.13, zc), 0x6fef3a);
    ctx.buckets.add('pool', new THREE.CircleGeometry(4, 20).rotateX(-Math.PI / 2).translate(CX + 7, 0.13, zc), 0xff5aa0);
  }

  // Funhouse mirrors: flat reflective panels along the east wall.
  for (let i = 0; i < 4; i++) ctx.buckets.add('glass', box(0.15, 6.5, 3.2, cx1 - 0.8, 6.2, -136 - i * 9));

  // A spinning spiral wall panel near the entrance (dynamic: exempted from finishCity's freeze).
  if (typeof document !== 'undefined') {
    const spiral = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ map: spiralTexture() }));
    spiral.position.set(cx0 + 3.6, 8, -128);
    spiral.rotation.y = Math.PI / 2;
    spiral.userData.dynamic = true;
    ctx.scene.add(spiral);
    ctx.updaters.push((t) => { spiral.rotation.z = t * 0.6; });
    // A big "HAPPY BIRTHDAY" banner strung right across the nave, at eye-catching height, facing
    // both ways so it reads from the doors and from the stage.
    const bannerTex = billboardTexture('HAPPY BIRTHDAY MANSI', 'COURTESY OF THE JOKER', PALETTE.jokerPurple);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true, side: THREE.DoubleSide });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(20, 7.4), bannerMat);
    banner.position.set(CX, 13.5, -148);
    ctx.scene.add(banner);
    const banner2 = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.4), new THREE.MeshBasicMaterial({ map: billboardTexture('GUESS WHO', 'HA HA HA HA', PALETTE.balloon), transparent: true, side: THREE.DoubleSide }));
    banner2.position.set(CX, 16.6, -128);
    ctx.scene.add(banner2);
  }
  bunting(ctx, cx0 + 3, -175, cx1 - 3, -175, 18.6, [PALETTE.balloon, PALETTE.chem, PALETTE.jokerPurple, PALETTE.signal]);
  bunting(ctx, cx0 + 3, -132, cx1 - 3, -132, 18.6, [PALETTE.jokerPurple, PALETTE.chem, PALETTE.balloon, PALETTE.signal]);

  // Balloons scattered up near the ceiling, plus big clusters lower down by the pillars, right in
  // view from the middle of the room.
  for (let i = 0; i < 12; i++) {
    const bx = CX + rng.range(-9, 9), bz = CZ + rng.range(-25, 25), by = 15.5 + rng.range(-1, 2.2);
    const col = rng.pick([PALETTE.balloon, PALETTE.chem, PALETTE.jokerPurple, PALETTE.signal]);
    ctx.buckets.add('painted', new THREE.SphereGeometry(0.5, 10, 8).translate(bx, by, bz), col);
    ctx.buckets.add('steel', box(0.03, 1.4, 0.03, bx, by - 1.2, bz));
  }
  const CLUSTER_COLORS = [PALETTE.balloon, PALETTE.chem, PALETTE.jokerPurple, PALETTE.signal, PALETTE.neonPink];
  for (const [cxc, czc] of [[CX - 7.6, -140], [CX + 7.6, -140], [CX - 7.6, -160], [CX + 7.6, -160], [CX, cz1 - 3]]) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bx = cxc + Math.cos(a) * 0.6, bz = czc + Math.sin(a) * 0.6, by = 5.5 + (i % 3) * 0.55;
      ctx.buckets.add('painted', new THREE.SphereGeometry(0.42, 10, 8).translate(bx, by, bz), CLUSTER_COLORS[i % CLUSTER_COLORS.length]);
    }
  }

  // Confetti scattered across the floor.
  for (let i = 0; i < 40; i++) {
    const fx = CX + rng.range(-10, 10), fz = CZ + rng.range(-26, 26);
    const col = rng.pick([PALETTE.balloon, PALETTE.chem, PALETTE.jokerPurple, PALETTE.signal, PALETTE.paper]);
    ctx.buckets.add('painted', new THREE.PlaneGeometry(0.3, 0.15).rotateX(-Math.PI / 2).rotateZ(rng.range(0, Math.PI * 2)).translate(fx, 0.12, fz), col);
  }

  // Warm point lights (the shared light pool picks the closest few to the player, same as every
  // streetlamp and neon sign in the city): stage footlights, the entrance, and a sickly centre
  // glow over the fight floor.
  lightSpot(ctx, CX, 9, cz0 + 4, PALETTE.jokerPurple, 40, 26);
  lightSpot(ctx, CX, 6, cz1 - 6, PALETTE.window, 30, 20);
  lightSpot(ctx, CX, 11, CZ, PALETTE.chem, 26, 22);
  lightSpot(ctx, CX - 9, 11, CZ, PALETTE.window, 22, 16);
  lightSpot(ctx, CX + 9, 11, CZ, PALETTE.window, 22, 16);
}

function hallVat(ctx, x, z) {
  solid(ctx, 'painted', cylinder(3.4, 3.6, 4, x, 2, z, 20), { color: 0x9aa0a6 });
  // Emissive, bubbling top: the flat pool plus a scatter of brighter "bubble" discs on it.
  ctx.buckets.add('chem', new THREE.CircleGeometry(3.1, 20).rotateX(-Math.PI / 2).translate(x, 4.05, z));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + x, rr = 1.2 + (k % 2);
    glow(ctx, new THREE.CircleGeometry(0.4, 10).rotateX(-Math.PI / 2).translate(x + Math.cos(a) * rr, 4.06, z + Math.sin(a) * rr), 0xd8ffb0);
  }
  ctx.halos.add(x, 4.4, z, PALETTE.chem, 16);
  lightSpot(ctx, x, 5, z, PALETTE.chem, 55, 22);
  ctx.buckets.add('painted', cylinder(3.65, 3.65, 0.2, x, 4.1, z, 20, true), 0x9aa0a6);
}

function hallPipe(ctx, x1, z1, x2, z2, y, r = 0.5, color = PALETTE.rust) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const g = new THREE.CylinderGeometry(r, r, len, 10).rotateZ(Math.PI / 2).rotateY(-Math.atan2(z2 - z1, x2 - x1)).translate((x1 + x2) / 2, y, (z1 + z2) / 2);
  solid(ctx, 'painted', g, { color });
}

// A hand-wheel valve clamped onto a pipe run.
function valve(ctx, x, y, z, r = 0.6) {
  ctx.buckets.add('steel', cylinder(r * 0.35, r * 0.35, 0.9, x, y, z, 10));
  ctx.buckets.add('steel', cylinder(r, r, 0.12, x, y, z, 12, true));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    ctx.buckets.add('steel', box(r * 1.8, 0.08, 0.08, 0, 0, 0).rotateY(a).translate(x, y, z));
  }
}

// A hanging work light: a cord from the ceiling to a caged bulb, with a warm halo.
function hangingLight(ctx, x, y0, y1, z) {
  ctx.buckets.add('steel', box(0.04, y0 - y1, 0.04, x, (y0 + y1) / 2, z));
  ctx.buckets.add('steel', cylinder(0.22, 0.22, 0.1, x, y1, z, 8, true));
  glow(ctx, new THREE.SphereGeometry(0.16, 10, 6).translate(x, y1 - 0.15, z), PALETTE.window);
  ctx.halos.add(x, y1 - 0.15, z, PALETTE.window, 3.2);
  lightSpot(ctx, x, y1 - 0.3, z, PALETTE.window, 20, 14);
}

function buildAceHall(ctx) {
  const rng = createRng(9911);
  const FX = 140, FZ = -172, FW = 64, FD = 44, FH = 24;
  const fx0 = FX - FW / 2, fx1 = FX + FW / 2, fz0 = FZ - FD / 2, fz1 = FZ + FD / 2;
  const r = INTERIOR_ROOMS.aceHall;
  const d = r.doors[0];
  const dockGap = { g0: d.z - d.w / 2, g1: d.z + d.w / 2, gy0: 0, gy1: d.h };
  // West wall (x = fx0): the loading dock. North, south and east keep their normal facade mesh
  // outside and get their own collision plus an inside lining (see wallLining above).
  wallWithGap(ctx, 'z', fx0, fz0, fz1, FH, WT, dockGap, PALETTE.steel);
  ctx.collision.addBox(fx0, 0, fz0 - WT / 2, fx1, FH, fz0 + WT / 2, 'building');
  ctx.collision.addBox(fx0, 0, fz1 - WT / 2, fx1, FH, fz1 + WT / 2, 'building');
  ctx.collision.addBox(fx1 - WT / 2, 0, fz0, fx1 + WT / 2, FH, fz1, 'building');
  wallLining(ctx, 'x', fz0, fx0, fx1, FH, 0.3, PALETTE.steel);
  wallLining(ctx, 'x', fz1, fx0, fx1, FH, -0.3, PALETTE.steel);
  wallLining(ctx, 'z', fx1, fz0, fz1, FH, -0.3, PALETTE.steel);
  // A retracted roller shutter over the dock opening (visual only).
  ctx.buckets.add('steel', box(0.3, 0.7, d.w + 0.4, fx0, d.h + 0.35, d.z));

  const b = r.bounds;
  solid(ctx, 'painted', box(b.maxX - b.minX, 0.6, b.maxZ - b.minZ, FX, b.maxY - 0.3, FZ), { color: 0x1c2018, tag: 'ceiling' });
  ctx.buckets.add('concrete', tiledBox(b.maxX - b.minX, 0.15, b.maxZ - b.minZ, FX, 0.08, FZ, { uvScale: [8, 8] }));
  // A real fill light over the vat floor: toxic green, so the hall reads bright at a glance
  // instead of relying only on baked halos. Distance-limited, never reaches the exterior city.
  roomFill(ctx, FX, 9, FZ, PALETTE.chem, 2.4, 55);
  roomFill(ctx, FX, 4, FZ - 12, PALETTE.chem, 1.6, 32);
  roomFill(ctx, FX, 4, FZ + 12, PALETTE.chem, 1.4, 28);
  // A soft toxic pool under the centre catwalk, so straight down the aisle reads green too,
  // without washing the whole floor flat.
  ctx.buckets.add('pool', new THREE.CircleGeometry(3.6, 22).rotateX(-Math.PI / 2).translate(FX, 0.15, FZ), 0x6fef3a);

  // Three rows of glowing, bubbling vats (six total), all clearly in view from the hall centre.
  for (const [px, pz] of [[122, -184], [158, -184], [122, -176], [158, -168], [122, -160], [158, -160]]) hallVat(ctx, px, pz);
  for (const [px, pz, rr] of [[130, -170, 2.6], [150, -158, 2.2], [130, -182, 2.2]]) {
    ctx.buckets.add('pool', new THREE.CircleGeometry(rr, 18).scale(1, 0.7, 1).rotateX(-Math.PI / 2).translate(px, 0.17, pz), 0x6fef3a);
  }
  // Big yellow/black hazard stripe borders around the catwalk footprint and the vat rows.
  const hazard = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.round(len / 1.6);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 0.6) / n;
      const mx = x1 + (x2 - x1) * (t0 + t1) / 2, mz = z1 + (z2 - z1) * (t0 + t1) / 2;
      const yaw = Math.atan2(x2 - x1, z2 - z1);
      ctx.buckets.add('painted', new THREE.PlaneGeometry(1.1, len / n * 0.62).rotateX(-Math.PI / 2).rotateY(yaw).translate(mx, 0.1, mz), i % 2 ? 0x14120e : PALETTE.signal);
    }
  };
  hazard(b.minX + 6, FZ - 6, b.maxX - 6, FZ - 6);
  hazard(b.minX + 6, FZ + 6, b.maxX - 6, FZ + 6);
  hazard(b.minX + 6, FZ - 6, b.minX + 6, FZ + 6);
  hazard(b.maxX - 6, FZ - 6, b.maxX - 6, FZ + 6);

  // Catwalks with collision: a spine down the hall's centre and a cross-brace, on posts. Painted
  // a light steel grey (not the shared dark 'steel' material) so they read against the dark walls.
  const LIGHT_STEEL = 0x9aa0a6;
  solid(ctx, 'painted', box(b.maxX - b.minX - 8, 0.25, 2, FX, 9, FZ), { color: LIGHT_STEEL, tag: 'catwalk' });
  solid(ctx, 'painted', box(2, 0.25, b.maxZ - b.minZ - 8, FX, 9, FZ), { color: LIGHT_STEEL, tag: 'catwalk' });
  // Rails along the spine's edges, at grab height, so the catwalk reads even brighter from below.
  for (const s of [-1, 1]) ctx.buckets.add('painted', box(b.maxX - b.minX - 8, 0.08, 0.08, FX, 9.9, FZ + s * 0.95), LIGHT_STEEL);
  for (let x = b.minX + 6; x < b.maxX - 5; x += 8) solid(ctx, 'painted', box(0.25, 8.9, 0.25, x, 4.45, FZ - 1), { color: LIGHT_STEEL });
  for (let z = b.minZ + 6; z < b.maxZ - 5; z += 8) if (Math.abs(z - FZ) > 3) solid(ctx, 'painted', box(0.25, 8.9, 0.25, FX + 1, 4.45, z), { color: LIGHT_STEEL });
  edgeGrapples(ctx, FX, FZ, b.maxX - b.minX - 8, 2, 9, 8);
  addLadder(ctx.climbables, { x: fx0 + 5, z: fz0 + 5, nx: -1, nz: 0, bottom: 0, top: 9 });

  hallPipe(ctx, b.minX + 4, fz0 + 6, b.maxX - 4, fz0 + 6, 15, 0.5, LIGHT_STEEL);
  hallPipe(ctx, b.minX + 4, fz0 + 9, b.maxX - 4, fz0 + 9, 16.5, 0.35, LIGHT_STEEL);
  for (const x of [128, 152]) valve(ctx, x, 15, fz0 + 6);
  valve(ctx, 140, 16.5, fz0 + 9, 0.45);
  // Hanging work lights along the catwalk: bright, clearly glowing caged bulbs.
  for (const [x, z] of [[122, FZ - 4], [140, FZ + 3], [158, FZ - 4], [131, FZ + 3], [149, FZ - 4]]) hangingLight(ctx, x, b.maxY - 0.3, 11, z);

  // ACE CHEMICALS painted on the north wall, the same sign face the exterior reads from outside.
  if (typeof document !== 'undefined') {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 4.6), new THREE.MeshBasicMaterial({ map: hallSignTexture(), transparent: true, depthWrite: false }));
    sign.position.set(FX, 14.5, fz0 + 0.55);
    ctx.scene.add(sign);
    ctx.halos.add(FX, 14.5, fz0 + 0.7, PALETTE.chem, 6);
  }
  // Factory-textured wall panels, inset just inside the flat linings, so the walls read as real
  // sheet-metal facade instead of a flat painted colour.
  for (const [px, pz, w, d] of [[FX, fz0 + 0.5, 44, 0.1], [FX, fz1 - 0.5, 44, 0.1], [fx1 - 0.5, FZ, 0.1, 34]]) {
    ctx.buckets.add('facade_factory', tiledBox(w, 16, d, px, 12, pz, { uvScale: [30, 30] }));
  }

  // A raised office in the far corner, reached from the catwalk, lit warm from inside.
  solid(ctx, 'painted', box(10, 3.2, 8, 150, 10.6, -184), { color: 0x3a3f4a, tag: 'office' });
  ctx.buckets.add('glass', box(9.2, 1.5, 0.1, 150, 10.9, -179.9));
  glow(ctx, box(8.6, 1.1, 0.05, 150, 10.9, -179.85), PALETTE.window);
  ctx.halos.add(150, 10.9, -179.8, PALETTE.window, 5);
  lightSpot(ctx, 150, 10, -181, PALETTE.window, 34, 22);
  roomFill(ctx, 150, 10.9, -182, PALETTE.window, 1.2, 16);
  for (const [lx, lz] of [[146, -188], [154, -188], [146, -180], [154, -180]]) solid(ctx, 'painted', box(0.3, 9, 0.3, lx, 4.5, lz), { color: LIGHT_STEEL });

  // Barrels scattered on the floor, off the catwalk footprint.
  for (let k = 0; k < 10; k++) {
    const x = rng.range(b.minX + 3, b.maxX - 3), z = rng.range(b.minZ + 3, b.maxZ - 3);
    if (Math.abs(x - FX) < 3 || Math.abs(z - FZ) < 3) continue;
    solid(ctx, 'painted', cylinder(0.45, 0.45, 1.2, x, 0.75, z, 10), { color: rng.pick([PALETTE.chem, PALETTE.signal, PALETTE.containerBlue]) });
  }

  lightSpot(ctx, FX, 9, FZ, PALETTE.window, 30, 24);
  lightSpot(ctx, d.x + 6, 4, d.z, PALETTE.window, 24, 16);
}

// A row of vertical cell bars between two posts, with a horizontal top and bottom rail.
function cellBars(ctx, x0, x1, y0, y1, z, color = 0x2a2c32) {
  ctx.buckets.add('steel', box(x1 - x0, 0.06, 0.06, (x0 + x1) / 2, y0, z), color);
  ctx.buckets.add('steel', box(x1 - x0, 0.06, 0.06, (x0 + x1) / 2, y1, z), color);
  solid(ctx, 'steel', box(0.08, y1 - y0, 0.08, x0, (y0 + y1) / 2, z), { color, tag: 'building' });
  solid(ctx, 'steel', box(0.08, y1 - y0, 0.08, x1, (y0 + y1) / 2, z), { color, tag: 'building' });
  const n = Math.max(2, Math.round((x1 - x0) / 0.32));
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * (i / n);
    solid(ctx, 'steel', cylinder(0.032, 0.032, y1 - y0, x, (y0 + y1) / 2, z, 6), { color, tag: 'building' });
  }
}

// A single evidence card: a pinned photo/card with a red pin, connected to `to` (or nothing) by a
// taut string. Purely decorative (no per-card collision).
function evidenceCard(ctx, x, y, z, wallX, color, to) {
  ctx.buckets.add('painted', box(0.02, 0.9, 0.7, wallX, y, z), color);
  ctx.buckets.add('painted', cylinder(0.05, 0.05, 0.06, wallX + 0.05, y + 0.38, z), PALETTE.balloon);
  if (!to) return;
  const len = Math.hypot(to.y - y, to.z - z);
  const string = box(0.015, len, 0.015, wallX + 0.06, (y + to.y) / 2, (z + to.z) / 2);
  string.rotateX(Math.atan2(to.z - z, to.y - y));
  ctx.buckets.add('painted', string, PALETTE.balloon);
}

function buildGCPDLobby(ctx) {
  const rng = createRng(5115);
  const GH = 42; // the tower's own full height: only the lobby has its own ceiling below this
  const CEIL = 7; // the lobby's own ceiling
  const g0 = -20, g1 = 20;
  const r = INTERIOR_ROOMS.gcpd;
  const d = r.doors[0];
  const doorGap = { g0: d.x - d.w / 2, g1: d.x + d.w / 2, gy0: 0, gy1: d.h };
  // South wall (z = 20): the street doors, under the GCPD sign, full tower height above the
  // doorway (the upper floors are still there, just capped by the lobby's own ceiling below).
  // North, east and west keep their normal facade mesh outside and get their own collision plus
  // an inside lining now the whole-volume box is gone.
  wallWithGap(ctx, 'x', g1, g0, g1, GH, WT, doorGap, PALETTE.deco);
  ctx.collision.addBox(g0, 0, g0 - WT / 2, g1, GH, g0 + WT / 2, 'building');
  ctx.collision.addBox(g0 - WT / 2, 0, g0, g0 + WT / 2, GH, g1, 'building');
  ctx.collision.addBox(g1 - WT / 2, 0, g0, g1 + WT / 2, GH, g1, 'building');
  wallLining(ctx, 'x', g0, g0, g1, GH, 0.3, PALETTE.deco);
  wallLining(ctx, 'z', g0, g0, g1, GH, 0.3, PALETTE.deco);
  wallLining(ctx, 'z', g1, g0, g1, GH, -0.3, PALETTE.deco);
  // The tower above the lobby (from its own ceiling up to the real roof) still needs to be
  // solid: it is what the roof (the Batsignal and the party, SITES.start/signal) actually
  // stands on. hollow: true dropped the single whole-volume box that used to cover this along
  // with the ground floor, so it is rebuilt here, floor to roof, minus the lobby's own footprint.
  ctx.collision.addBox(g0, CEIL, g0, g1, GH, g1, 'building');

  const b = r.bounds;
  // The lobby's own ceiling: caps the room well below the tower's real roof (the Batsignal and
  // the party stay exactly as built above it).
  solid(ctx, 'painted', box(b.maxX - b.minX, 0.5, b.maxZ - b.minZ, 0, CEIL - 0.25, 0), { color: 0x4a5060, tag: 'ceiling' });
  ctx.buckets.add('concrete', tiledBox(b.maxX - b.minX, 0.1, b.maxZ - b.minZ, 0, 0.05, 0, { uvScale: [9, 9] }));
  checkerFloor(ctx, -8, 8, -10, 10, 0.06, 2, 0x565b64, 0x3a3e46);

  // Warm, readable fill light: the lobby reads bright at a glance, not like the dark precinct
  // corridors elsewhere. Distance-limited, never reaches the exterior city.
  roomFill(ctx, 0, 5.5, 0, 0xffdfae, 8, 55);
  roomFill(ctx, 0, 5, 10, 0xffdfae, 5, 30);
  roomFill(ctx, 0, 5, -10, 0xffdfae, 4.5, 28);
  roomFill(ctx, -12, 5, -2, PALETTE.detective, 3, 22);
  roomFill(ctx, 12, 5, -2, PALETTE.signal, 3, 22);
  // A GCPD blue and gold stripe band around the room, low, so a level shot always frames some
  // saturated colour even where the ceiling is out of view.
  stripeBand(ctx, 'x', b.minZ, b.minX + 1, b.maxX - 1, 2.2, 0.35, PALETTE.detective);
  stripeBand(ctx, 'x', b.maxZ, b.minX + 1, b.maxX - 1, 2.2, -0.35, PALETTE.detective);
  stripeBand(ctx, 'z', b.minX, b.minZ + 1, b.maxZ - 1, 2.2, 0.35, PALETTE.signal);
  stripeBand(ctx, 'z', b.maxX, b.minZ + 1, b.maxZ - 1, 2.2, -0.35, PALETTE.signal);
  lightSpot(ctx, 0, 6, 12, PALETTE.window, 34, 26);
  lightSpot(ctx, 0, 6, -8, PALETTE.window, 30, 24);
  lightSpot(ctx, -12, 6, -2, PALETTE.detective, 24, 20);
  lightSpot(ctx, 12, 6, -2, PALETTE.signal, 24, 20);
  ctx.buckets.add('pool', new THREE.CircleGeometry(7, 22).rotateX(-Math.PI / 2).translate(0, 0.12, 8), 0xffdfae);
  ctx.buckets.add('pool', new THREE.CircleGeometry(6, 20).rotateX(-Math.PI / 2).translate(-11, 0.12, -3), PALETTE.detective);
  ctx.buckets.add('pool', new THREE.CircleGeometry(6, 20).rotateX(-Math.PI / 2).translate(11, 0.12, -3), PALETTE.signal);
  // Ceiling light panels: self-lit, so the room reads bright at a glance even where a dynamic
  // light's falloff has not reached (the shared light pool only lights the closest few sources
  // to the player at once, same as every streetlamp in the city).
  for (const [px, pz] of [[0, 14], [0, 8], [-8, 8], [8, 8], [0, 2], [-8, 2], [8, 2], [0, -4], [-8, -4], [8, -4], [0, -10], [-8, -10], [8, -10], [0, -16]]) {
    glow(ctx, box(3.6, 0.12, 1.7, px, CEIL - 0.28, pz), 0xfff2d0);
  }
  // Cove lighting along the top of every wall, at a height a normal eye-level camera actually
  // frames (unlike the ceiling panels above, which a level shot can miss entirely): a warm,
  // unlit strip that reads bright regardless of the dynamic light budget.
  glow(ctx, box(b.maxX - b.minX - 1, 0.3, 0.15, 0, CEIL - 1, b.minZ + 0.3), 0xffe9b8);
  glow(ctx, box(b.maxX - b.minX - 1, 0.3, 0.15, 0, CEIL - 1, b.maxZ - 0.3), 0xffe9b8);
  glow(ctx, box(0.15, 0.3, b.maxZ - b.minZ - 1, b.minX + 0.3, CEIL - 1, 0), 0xffe9b8);
  glow(ctx, box(0.15, 0.3, b.maxZ - b.minZ - 1, b.maxX - 0.3, CEIL - 1, 0), 0xffe9b8);

  // ---- the front desk, facing the doors, with a GCPD crest on the wall behind it ----
  solid(ctx, 'painted', box(9, 1.1, 2, 0, 0.55, 9), { color: 0x3a3f4a, tag: 'furniture' });
  ctx.buckets.add('painted', box(9.2, 0.08, 2.2, 0, 1.11, 9), 0x5a606e);
  for (const s of [-1, 1]) ctx.buckets.add('painted', box(0.1, 1.6, 0.1, s * 4.3, 0.8, 8.2), 0x14151b);
  // The crest: a shield of dark stone on the wall, with a bat pip and a five-point badge star.
  ctx.buckets.add('painted', new THREE.CircleGeometry(2.1, 5).rotateY(Math.PI).translate(0, 4.6, 17.6), 0x2a2f3c);
  ctx.buckets.add('painted', new THREE.CircleGeometry(0.85, 5).rotateY(Math.PI).translate(0, 4.6, 17.55), PALETTE.detective);
  ctx.buckets.add('painted', new THREE.PlaneGeometry(0.16, 3.2).rotateY(Math.PI).translate(-0.85, 4.6, 17.5), PALETTE.detective);
  ctx.buckets.add('painted', new THREE.PlaneGeometry(0.16, 3.2).rotateY(Math.PI).translate(0.85, 4.6, 17.5), PALETTE.detective);

  // ---- the trophy case: an empty glass shelf unit (the rescued gifts, src/game/gcpdLobby.js,
  // show and hide inside it at runtime, tracking party guests as the story unlocks them) ----
  solid(ctx, 'painted', box(6.4, 0.15, 1.2, 0, 1.0, -2), { color: 0x5a606e, tag: 'furniture' });
  solid(ctx, 'painted', box(6.4, 0.15, 1.2, 0, 2.0, -2), { color: 0x5a606e, tag: 'furniture' });
  for (const s of [-1, 0, 1]) ctx.buckets.add('steel', box(0.06, 2.1, 0.06, s * 3.1, 1.6, -2));
  ctx.buckets.add('glass', box(6.5, 2.2, 0.06, 0, 1.65, -1.4));
  ctx.buckets.add('glass', box(6.5, 2.2, 0.06, 0, 1.65, -2.6));

  // ---- the evidence board: the west wall, Joker clue cards and polaroids strung with red
  // string, under a title card that says the whole story out loud ----
  const evX = -19.6;
  const pins = [[-6, 2.6], [-3.8, 3.4], [-4.6, 1.8], [-1.6, 2.9], [0.6, 2.2], [-2.4, 1.4], [2.6, 3.1], [-6.4, 4.1]];
  const evCenter = { y: 3.0, z: -6.5 };
  for (const [z, y] of pins) evidenceCard(ctx, 0, y, z, evX, rng.pick([0xefe6cf, PALETTE.jokerPurple, PALETTE.jokerGreen]), evCenter);
  evidenceCard(ctx, 0, evCenter.y, evCenter.z, evX, PALETTE.balloon, null);
  if (typeof document !== 'undefined') {
    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.4),
      new THREE.MeshBasicMaterial({ map: billboardTexture('WHO IS THE', 'PARTY CRASHER?', PALETTE.balloon), transparent: true, side: THREE.DoubleSide }),
    );
    title.position.set(evX + 0.03, 5.1, -6.5);
    title.rotation.y = Math.PI / 2;
    ctx.scene.add(title);
  }
  ctx.halos.add(evX + 0.2, 3.5, -6.5, PALETTE.balloon, 6);
  lightSpot(ctx, evX + 2, 5, -6.5, PALETTE.window, 20, 14);

  // ---- holding cells: the east wall, three barred cells (idle Joker goons, non-hostile, are
  // placed at runtime: src/game/gcpdLobby.js) ----
  const cellZ = [[-9, -5], [-3.5, 0.5], [1.5, 5.5]];
  for (const [z0, z1] of cellZ) {
    cellBars(ctx, 15.5, 18, 0, 3, z0);
    cellBars(ctx, 15.5, 18, 0, 3, z1);
  }
  // A low riser floor inside the cells, and a warm-lit panel on the real back wall (x = 20) so
  // each cell reads as its own lit space behind the bars, not just open floor.
  ctx.buckets.add('painted', box(2.4, 0.15, cellZ[2][1] - cellZ[0][0], 16.8, 0.07, (cellZ[0][0] + cellZ[2][1]) / 2), 0x3a3d44);
  for (const [z0, z1] of cellZ) glow(ctx, box(0.1, 1.8, z1 - z0 - 0.6, 19.5, 1.2, (z0 + z1) / 2), 0xd8ccb8);
  roomFill(ctx, 17, 3, -2, 0xd8ccb8, 1.2, 14);

  // ---- Gordon's office: a glass-walled room at the back, a desk and a lamp ----
  solid(ctx, 'painted', box(9, 3, 6, -8, 3.2, -14), { color: 0x3a3f4a, tag: 'office' });
  ctx.buckets.add('glass', box(0.1, 2.2, 5.4, -3.55, 2.8, -14));
  glow(ctx, box(0.06, 1.6, 4.6, -3.5, 2.8, -14), PALETTE.window);
  ctx.halos.add(-3.5, 2.8, -14, PALETTE.window, 6);
  roomFill(ctx, -8, 2.6, -14, PALETTE.window, 1.3, 18);
  lightSpot(ctx, -8, 3, -13, PALETTE.window, 22, 16);
  solid(ctx, 'painted', box(2.6, 0.9, 1.3, -8, 0.45, -15), { color: 0x2a2436, tag: 'furniture' });
  glow(ctx, box(0.4, 0.5, 0.4, -8.9, 1.05, -15.3), PALETTE.signal);
  ctx.halos.add(-8.9, 1.15, -15.3, PALETTE.signal, 2.6);

  // A little street-level scatter: a coat stand and a couple of chairs by the desk.
  ctx.buckets.add('steel', cylinder(0.04, 0.04, 1.7, 7.5, 0.85, 6, 8));
  ctx.buckets.add('steel', cylinder(0.4, 0.04, 0.3, 7.5, 1.75, 6, 8));
  for (const [cx, cz] of [[-6.5, 6.5], [6.5, 6.5]]) {
    solid(ctx, 'painted', box(0.9, 0.9, 0.9, cx, 0.45, cz), { color: 0x3a3f4a, tag: 'furniture' });
  }
}

// ---- canvas-based decoration: browser only (guarded by `typeof document`, see buildFunhouse) ----

function hallSignTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.font = '150px Bangers, Impact, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#7dff4a'; g.shadowBlur = 36;
  g.strokeStyle = '#7dff4a'; g.lineWidth = 9;
  g.strokeText('ACE CHEMICALS', 512, 128);
  g.fillStyle = '#f3ffe8';
  g.fillText('ACE CHEMICALS', 512, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function spiralTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#efe6cf';
  g.lineWidth = 14;
  g.beginPath();
  for (let a = 0; a < Math.PI * 7; a += 0.06) {
    const rr = 2 + a * 6, px = 128 + Math.cos(a) * rr, py = 128 + Math.sin(a) * rr;
    if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- boot-time entry point, called from world.js alongside buildCity/buildDistricts ----

export function buildInteriors(ctx) {
  buildFunhouse(ctx);
  buildAceHall(ctx);
  buildGCPDLobby(ctx);
}

// ---- runtime: the Part I contract ----
// createInteriors(deps) -> { rooms, enter(id), exit(), inside }. deps: hero (teleport + pos),
// events (roomEnter/roomExit), rain (world.rain, hidden while inside), collision (ground snap).
export function createInteriors({ hero, events, rain, collision, rooms = INTERIOR_ROOMS } = {}) {
  const state = { inside: null };
  function snap(p) {
    if (!collision) return p;
    const g = collision.groundBelow(p.x, p.y + 3, p.z, 0.3);
    return { x: p.x, y: g > -Infinity ? g : p.y, z: p.z };
  }
  function setInside(id) {
    if (state.inside === id) return;
    const prev = state.inside;
    state.inside = id;
    if (rain?.mesh) rain.mesh.visible = !id;
    if (prev) events?.emit('roomExit', { id: prev });
    if (id) events?.emit('roomEnter', { id });
  }
  return {
    rooms,
    get inside() { return state.inside; },
    enter(id) {
      const room = rooms[id];
      if (!room) return;
      hero?.teleport?.(snap(room.fight));
      setInside(id);
    },
    exit() {
      const id = state.inside;
      if (!id) return;
      const room = rooms[id];
      hero?.teleport?.(snap(room.outside));
      setInside(null);
    },
    // Called once a frame (game.js's Part I hook block). Every way in or out of a room is through
    // a real gap in the collision (the doors built above), so testing the hero's own position
    // against the room bounds is exactly "walked (or glided) through a doorway".
    update() {
      if (!hero) return;
      const id = roomAt(hero.pos, rooms);
      if (id !== state.inside) setInside(id);
    },
  };
}
