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
  // Ceiling: below the roof (h = 28), so the pitched roof deck people can stand on is untouched.
  const b = r.bounds;
  solid(ctx, 'painted', box(b.maxX - b.minX, 0.6, b.maxZ - b.minZ, CX, b.maxY - 0.3, CZ), { color: 0x1c1620, tag: 'ceiling' });

  checkerFloor(ctx, b.minX, b.maxX, b.minZ, b.maxZ, 0.06, 4, 0xf0e6c8, 0x1c1620);

  // Pillars down both long sides, with collision, clear of the fight circle at the room's centre.
  const pillarX = [CX - 7, CX + 7];
  const pillarZ = [-130, -140, -150, -160, -170];
  for (const xc of pillarX) for (const zc of pillarZ) solid(ctx, 'trim', cylinder(0.9, 0.9, 20, xc, 10, zc, 12), { tag: 'pillar' });

  // Carnival lights strung between every pair of pillars down each side, sagging like real bulbs.
  for (const xc of pillarX) {
    for (let i = 0; i < pillarZ.length - 1; i++) {
      for (let t = 0; t <= 1; t += 0.2) {
        const zt = pillarZ[i] + (pillarZ[i + 1] - pillarZ[i]) * t, sag = Math.sin(Math.PI * t) * 0.5;
        const y = 19.2 - sag;
        glow(ctx, new THREE.SphereGeometry(0.13, 8, 6).translate(xc, y, zt), rng.pick([PALETTE.balloon, PALETTE.chem, PALETTE.window]));
        ctx.halos.add(xc, y, zt, PALETTE.window, 1.3);
      }
    }
  }

  // Balcony ring: a standing ledge along both long walls, with grapple points along its edge.
  for (const xc of [CX - 10.5, CX + 10.5]) {
    solid(ctx, 'steel', box(1.4, 0.3, b.maxZ - b.minZ - 4, xc, 10, CZ), { tag: 'stealthDeck' });
    edgeGrapples(ctx, xc, CZ, 1.4, b.maxZ - b.minZ - 4, 10, 7);
  }

  // The Joker's face stage, on the north wall facing the doors, lit from below.
  jokerFacePlaque(ctx, CX, 13, cz0 + 1.1);
  glow(ctx, box(10, 0.4, 0.3, CX, 6.4, cz0 + 1.3), PALETTE.jokerPurple);
  ctx.halos.add(CX, 6.6, cz0 + 1.5, PALETTE.neonPink, 8);

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
    // Party banners: "HAPPY BIRTHDAY" with the Joker's twist.
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(15, 6), new THREE.MeshBasicMaterial({ map: billboardTexture('HAPPY BIRTHDAY MANSI', 'COURTESY OF THE JOKER', PALETTE.jokerPurple), transparent: true }));
    banner.position.set(CX, 17.4, -139);
    ctx.scene.add(banner);
    const banner2 = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.4), new THREE.MeshBasicMaterial({ map: billboardTexture('GUESS WHO', 'HA HA HA HA', PALETTE.balloon), transparent: true }));
    banner2.position.set(CX, 16.6, -128);
    ctx.scene.add(banner2);
  }
  bunting(ctx, cx0 + 3, -175, cx1 - 3, -175, 18.6, [PALETTE.balloon, PALETTE.chem, PALETTE.jokerPurple, PALETTE.signal]);
  bunting(ctx, cx0 + 3, -132, cx1 - 3, -132, 18.6, [PALETTE.jokerPurple, PALETTE.chem, PALETTE.balloon, PALETTE.signal]);

  // Balloons scattered up near the ceiling.
  for (let i = 0; i < 12; i++) {
    const bx = CX + rng.range(-9, 9), bz = CZ + rng.range(-25, 25), by = 15.5 + rng.range(-1, 2.2);
    const col = rng.pick([PALETTE.balloon, PALETTE.chem, PALETTE.jokerPurple, PALETTE.signal]);
    ctx.buckets.add('painted', new THREE.SphereGeometry(0.5, 10, 8).translate(bx, by, bz), col);
    ctx.buckets.add('steel', box(0.03, 1.4, 0.03, bx, by - 1.2, bz));
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
  solid(ctx, 'steel', cylinder(3.4, 3.6, 4, x, 2, z, 20));
  ctx.buckets.add('chem', new THREE.CircleGeometry(3.1, 20).rotateX(-Math.PI / 2).translate(x, 4.05, z));
  ctx.halos.add(x, 4.4, z, PALETTE.chem, 10);
  lightSpot(ctx, x, 5, z, PALETTE.chem, 40, 18);
  ctx.buckets.add('steel', cylinder(3.65, 3.65, 0.2, x, 4.1, z, 20, true));
}

function hallPipe(ctx, x1, z1, x2, z2, y, r = 0.5) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const g = new THREE.CylinderGeometry(r, r, len, 10).rotateZ(Math.PI / 2).rotateY(-Math.atan2(z2 - z1, x2 - x1)).translate((x1 + x2) / 2, y, (z1 + z2) / 2);
  solid(ctx, 'painted', g, { color: PALETTE.rust });
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

  hallVat(ctx, 122, -184);
  hallVat(ctx, 158, -184);
  hallVat(ctx, 158, -160);
  for (const [px, pz, rr] of [[130, -170, 2.4], [150, -158, 1.8]]) {
    ctx.buckets.add('pool', new THREE.CircleGeometry(rr, 18).scale(1, 0.7, 1).rotateX(-Math.PI / 2).translate(px, 0.17, pz), 0x5aa83a);
  }

  // Catwalks with collision: a spine down the hall's centre and a cross-brace, on posts.
  solid(ctx, 'steel', box(b.maxX - b.minX - 8, 0.25, 2, FX, 9, FZ), { tag: 'catwalk' });
  solid(ctx, 'steel', box(2, 0.25, b.maxZ - b.minZ - 8, FX, 9, FZ), { tag: 'catwalk' });
  for (let x = b.minX + 6; x < b.maxX - 5; x += 8) solid(ctx, 'steel', box(0.25, 8.9, 0.25, x, 4.45, FZ - 1));
  for (let z = b.minZ + 6; z < b.maxZ - 5; z += 8) if (Math.abs(z - FZ) > 3) solid(ctx, 'steel', box(0.25, 8.9, 0.25, FX + 1, 4.45, z));
  edgeGrapples(ctx, FX, FZ, b.maxX - b.minX - 8, 2, 9, 8);
  addLadder(ctx.climbables, { x: fx0 + 5, z: fz0 + 5, nx: -1, nz: 0, bottom: 0, top: 9 });

  hallPipe(ctx, b.minX + 4, fz0 + 6, b.maxX - 4, fz0 + 6, 15);
  hallPipe(ctx, b.minX + 4, fz0 + 9, b.maxX - 4, fz0 + 9, 16.5, 0.35);

  // A raised office in the far corner, reached from the catwalk.
  solid(ctx, 'painted', box(10, 3.2, 8, 150, 10.6, -184), { color: 0x3a3f4a, tag: 'office' });
  ctx.buckets.add('glass', box(9.2, 1.5, 0.1, 150, 10.9, -179.9));
  glow(ctx, box(8.6, 1.1, 0.05, 150, 10.9, -179.85), PALETTE.window);
  ctx.halos.add(150, 10.9, -179.8, PALETTE.window, 3);
  lightSpot(ctx, 150, 10, -181, PALETTE.window, 26, 18);
  for (const [lx, lz] of [[146, -188], [154, -188], [146, -180], [154, -180]]) solid(ctx, 'steel', box(0.3, 9, 0.3, lx, 4.5, lz));

  // Barrels scattered on the floor, off the catwalk footprint.
  for (let k = 0; k < 10; k++) {
    const x = rng.range(b.minX + 3, b.maxX - 3), z = rng.range(b.minZ + 3, b.maxZ - 3);
    if (Math.abs(x - FX) < 3 || Math.abs(z - FZ) < 3) continue;
    solid(ctx, 'painted', cylinder(0.45, 0.45, 1.2, x, 0.75, z, 10), { color: rng.pick([PALETTE.chem, PALETTE.signal, PALETTE.containerBlue]) });
  }

  lightSpot(ctx, FX, 9, FZ, PALETTE.window, 30, 24);
  lightSpot(ctx, d.x + 6, 4, d.z, PALETTE.window, 24, 16);
}

// ---- canvas-based decoration: browser only (guarded by `typeof document`, see buildFunhouse) ----

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
