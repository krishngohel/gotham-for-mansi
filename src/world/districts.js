// Landmark set pieces for each district, built into the shared city context.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';
import { SITES } from './mapData.js';
import { box, cylinder, prism, tiledBox } from './buckets.js';
import { bareTree } from './trees.js';
import { solid, glow, lightSpot, edgeGrapples, graffiti, waterTower, acUnit, vent, duct } from './cityBuilder.js';
import { addGargoyle, plinth } from './gargoyles.js';
import { jokerBillboard, wantedPoster } from './posterArt.js';
import { buildStealthSets } from './stealthSets.js';

const CONTAINERS = [PALETTE.containerRed, PALETTE.containerBlue, PALETTE.containerGreen, PALETTE.containerOrange, 0x5a5f66];

// ---------------- GCPD ----------------
function gcpd(ctx) {
  const y = 42;
  // Helipad ring and H.
  const ring = new THREE.RingGeometry(5, 5.5, 40).rotateX(-Math.PI / 2).translate(8, y + 0.02, -6);
  ctx.buckets.add('lane', ring);
  ctx.buckets.add('lane', new THREE.PlaneGeometry(0.6, 4).rotateX(-Math.PI / 2).translate(7, y + 0.02, -6));
  ctx.buckets.add('lane', new THREE.PlaneGeometry(0.6, 4).rotateX(-Math.PI / 2).translate(9, y + 0.02, -6));
  ctx.buckets.add('lane', new THREE.PlaneGeometry(2, 0.6).rotateX(-Math.PI / 2).translate(8, y + 0.02, -6));
  // Stair hut, radio mast, floodlights.
  solid(ctx, 'concrete', box(5, 3.2, 4, 12, y + 1.6, 12));
  ctx.buckets.add('roof', box(5.4, 0.2, 4.4, 12, y + 3.3, 12));
  solid(ctx, 'steel', cylinder(0.1, 0.2, 18, -15, y + 9, 14, 6));
  const i = ctx.halos.add(-15, y + 18.2, 14, PALETTE.balloon, 3);
  ctx.blinkers.push({ i, size: 3, phase: 0 });
  for (const [fx, fz] of [[-18, 18], [18, -18]]) {
    solid(ctx, 'steel', cylinder(0.08, 0.08, 2.2, fx, y + 1.1, fz, 6));
    glow(ctx, box(0.8, 0.5, 0.3, fx, y + 2.3, fz), PALETTE.windowCool);
    ctx.halos.add(fx, y + 2.3, fz, PALETTE.windowCool, 3);
    lightSpot(ctx, fx, y + 2.5, fz, PALETTE.windowCool, 30, 22);
  }
  graffiti(ctx, -4, y, 2, 0, 0, 9);
  // Working roof clutter, kept clear of the start point, the helipad and the signal.
  waterTower(ctx, 15, y, 1);
  acUnit(ctx, -16, y, 5, true);
  acUnit(ctx, -16, y, 0.5, true);
  acUnit(ctx, -6.5, y, 17.2);
  duct(ctx, -1, y, -17.4, 9, true);
  for (const [vx, vz] of [[-8, -17.2], [17, 9], [17.2, -8]]) vent(ctx, vx, y, vz);
  ctx.steam.push({ x: -8, y: y + 1.6, z: -17.2, s: 0.7 });
  for (const [fx, fz] of [[-18, 18], [18, -18]]) ctx.reflect.push({ x: fx, y, z: fz, h: 2.3, color: PALETTE.windowCool, w: 0.7, len: 6, k: 0.35 });
  // The district's skyline mark: a lattice radio mast on the tallest roof next door (the deco
  // tower's upper tier, one block west), read off the collision so it tracks the map data.
  const mastTop = ctx.collision.groundBelow(-60, 90, 0, 0.5);
  if (mastTop > 50) radioMast(ctx, -60, mastTop, 0, 22);
}

// A four-legged lattice mast with X braces on every bay and a blinking red top light.
function radioMast(ctx, x, y, z, h) {
  const base = 1.1, top = 0.32, bays = 8;
  const at = (k) => base + (top - base) * (k / h);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const leg = new THREE.BoxGeometry(0.14, h + 0.4, 0.14);
    const dx = sx * (top - base), dz = sz * (top - base);
    leg.rotateX(Math.atan2(dz, h)).rotateZ(-Math.atan2(dx, h));
    leg.translate(x + sx * (base + top) / 2, y + h / 2, z + sz * (base + top) / 2);
    solid(ctx, 'steel', leg);
  }
  for (let k = 0; k < bays; k++) {
    const y0 = y + (k / bays) * h, y1 = y + ((k + 1) / bays) * h;
    const r0 = at(y0 - y), r1 = at(y1 - y), rm = (r0 + r1) / 2, dy = y1 - y0;
    // A horizontal ring of struts at the bay top, then one X on each face.
    for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
      ctx.buckets.add('steel', box(Math.abs(bx - ax) ? r1 * 2 : 0.07, 0.07, Math.abs(bz - az) ? r1 * 2 : 0.07, x + (ax + bx) / 2 * r1, y1, z + (az + bz) / 2 * r1));
      const len = Math.hypot(rm * 2, dy);
      for (const s of [-1, 1]) {
        const brace = new THREE.BoxGeometry(0.06, len, 0.06);
        if (Math.abs(bx - ax)) brace.rotateZ(s * Math.atan2(rm * 2, dy)).translate(x, (y0 + y1) / 2, z + az * rm);
        else brace.rotateX(s * Math.atan2(rm * 2, dy)).translate(x + ax * rm, (y0 + y1) / 2, z);
        ctx.buckets.add('steel', brace);
      }
    }
  }
  // Dish, top light and a cap so the tip reads as a solid shape.
  ctx.buckets.add('painted', new THREE.SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, 0, 0.9).rotateX(-1.2).rotateY(0.7).translate(x + 0.6, y + h * 0.6, z), 0x8c877d);
  ctx.buckets.add('steel', box(0.08, 2.4, 0.08, x, y + h + 1.2, z));
  glow(ctx, box(0.36, 0.36, 0.36, x, y + h + 2.4, z), PALETTE.balloon);
  const i = ctx.halos.add(x, y + h + 2.4, z, PALETTE.balloon, 3.6);
  ctx.blinkers.push({ i, size: 3.6, phase: 0.7 });
  ctx.collision.addBox(x - top, y + h - 0.1, z - top, x + top, y + h, z + top, 'mastTop');
}

// ---------------- Docks ----------------
function container(ctx, x, y, z, alongX, color, perch = true) {
  const L = 12.2, W = 2.44, H = 2.6;
  solid(ctx, 'painted', box(alongX ? L : W, H, alongX ? W : L, x, y + H / 2, z), { color });
  // Door frame and ribs read as ink lines.
  for (let k = -5; k <= 5; k += 1.2) {
    const rx = alongX ? x + k : x, rz = alongX ? z : z + k;
    ctx.buckets.add('painted', box(alongX ? 0.08 : W + 0.06, H - 0.3, alongX ? W + 0.06 : 0.08, rx, y + H / 2, rz), new THREE.Color(color).offsetHSL(0, 0, -0.06).getHex());
  }
  if (perch) ctx.grapple.push({ x, y: y + H, z, nx: 0, nz: 1, perch: true });
}

function crane(ctx, x) {
  const z0 = 196, y = 30;
  const c = PALETTE.containerOrange;
  for (const [dx, dz] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) solid(ctx, 'painted', box(1, y, 1, x + dx, y / 2, z0 + dz), { color: c });
  for (const dz of [-5, 5]) ctx.buckets.add('painted', box(15, 0.6, 0.6, x, 9, z0 + dz), c);
  solid(ctx, 'painted', box(4, 2.4, 46, x, y + 1.2, z0 + 14), { color: c });
  solid(ctx, 'painted', box(4, 3, 4, x, y + 3.9, z0 - 2), { color: 0x6a7489 });
  glow(ctx, box(3, 1.2, 0.1, x, y + 4, z0 - 4.05), PALETTE.window);
  ctx.halos.add(x, y + 4, z0 - 4.2, PALETTE.window, 2);
  const hook = ctx.rng.range(20, 34);
  ctx.buckets.add('steel', box(0.06, y - 12, 0.06, x, y - (y - 12) / 2, z0 + hook));
  ctx.buckets.add('steel', box(1.2, 0.8, 0.8, x, 12, z0 + hook));
  const i = ctx.halos.add(x, y + 2.6, z0 + 36.5, PALETTE.balloon, 2.6);
  ctx.blinkers.push({ i, size: 2.6, phase: x });
  lightSpot(ctx, x, y - 1, z0 + 10, PALETTE.window, 30, 30);
  edgeGrapples(ctx, x, z0 + 14, 4, 46, y + 2.4, 10);
}

// The freighter's superstructure was one plain 16 x 13 x 14 m box: from the deck, a blank pale
// wall. Detail only (buckets and glow, no colliders, no ctx.rng draws, so the city is unchanged):
// three deck levels with walkways and rails, portholes and lit windows on every face, a full
// bridge band, doors with lamps, rust streaks and a lifeboat slung on each side.
function shipSuperstructureDetail(ctx, x0, deck, sz) {
  const W = 16, D = 14, hw = W / 2, hd = D / 2;
  const steel = 0x6a7489, dark = 0x23262e, rust = 0x7a4a34;
  // Walkway ledges between the levels, with a rail around each.
  for (const y of [deck + 4.3, deck + 8.6]) {
    ctx.buckets.add('painted', box(W + 1.2, 0.3, D + 1.2, x0, y, sz), steel);
    for (const [ox, oz, lx, lz] of [[0, hd + 0.55, W + 1.2, 0.07], [0, -hd - 0.55, W + 1.2, 0.07], [hw + 0.55, 0, 0.07, D + 1.2], [-hw - 0.55, 0, 0.07, D + 1.2]]) {
      ctx.buckets.add('steel', box(lx, 0.07, lz, x0 + ox, y + 1.0, sz + oz));
      ctx.buckets.add('steel', box(lx, 0.05, lz, x0 + ox, y + 0.55, sz + oz));
    }
  }
  // Windows on every face: portholes on the lowest level, square lit windows on the middle one,
  // and a continuous bridge band on top.
  const faces = [
    { nx: 0, nz: 1, span: W, ox: (u) => x0 + u, oz: () => sz + hd + 0.06, rot: 0 },
    { nx: 0, nz: -1, span: W, ox: (u) => x0 + u, oz: () => sz - hd - 0.06, rot: Math.PI },
    { nx: 1, nz: 0, span: D, ox: () => x0 + hw + 0.06, oz: (u) => sz + u, rot: Math.PI / 2 },
    { nx: -1, nz: 0, span: D, ox: () => x0 - hw - 0.06, oz: (u) => sz + u, rot: -Math.PI / 2 },
  ];
  for (const f of faces) {
    const n = Math.floor(f.span / 2.4);
    for (let k = 0; k < n; k++) {
      const u = -f.span / 2 + 1.2 + (k * (f.span - 2.4)) / Math.max(1, n - 1);
      const x = f.ox(u), z = f.oz(u);
      const port = new THREE.CircleGeometry(0.42, 14).rotateY(f.rot).translate(x, deck + 2.4, z);
      if (k % 3 === 1) glow(ctx, port, PALETTE.window); else ctx.buckets.add('painted', port, dark);
      const win = box(f.nx ? 0.08 : 1.3, 1.0, f.nx ? 1.3 : 0.08, x, deck + 6.6, z);
      if (k % 2 === 0) glow(ctx, win, PALETTE.windowCool); else ctx.buckets.add('painted', win, dark);
      // A rust streak under every other window.
      if (k % 2 === 1) ctx.buckets.add('painted', box(f.nx ? 0.05 : 0.18, 2.6, f.nx ? 0.18 : 0.05, x + f.nx * 0.01, deck + 4.9, z + f.nz * 0.01), rust);
    }
    // The bridge: one band of glass all the way across, under a dark visor.
    glow(ctx, box(f.nx ? 0.1 : f.span - 1.2, 1.3, f.nx ? f.span - 1.2 : 0.1, f.ox(0), deck + 10.6, f.oz(0)), f.nz === 1 ? PALETTE.window : PALETTE.windowCool);
    ctx.buckets.add('painted', box(f.nx ? 0.6 : f.span + 0.4, 0.25, f.nx ? f.span + 0.4 : 0.6, f.ox(0) + f.nx * 0.3, deck + 11.45, f.oz(0) + f.nz * 0.3), dark);
  }
  // Doors at deck level, fore and aft, each with a lamp over it.
  for (const s of [-1, 1]) {
    const z = sz + s * (hd + 0.07);
    ctx.buckets.add('painted', box(1.3, 2.2, 0.1, x0 + 3.5, deck + 1.1, z), dark);
    glow(ctx, box(0.4, 0.25, 0.12, x0 + 3.5, deck + 2.55, z + s * 0.02), PALETTE.window);
    ctx.halos.add(x0 + 3.5, deck + 2.6, z + s * 0.2, PALETTE.window, 1.4);
  }
  // A lifeboat on davits on each side.
  for (const s of [-1, 1]) {
    const x = x0 + s * (hw + 1.6);
    ctx.buckets.add('painted', new THREE.CapsuleGeometry(0.9, 4.2, 4, 10).rotateX(Math.PI / 2).scale(1, 0.75, 1).translate(x, deck + 9.6, sz), PALETTE.containerOrange);
    ctx.buckets.add('painted', box(1.9, 0.3, 4.8, x, deck + 10.15, sz), 0xe8e2d4);
    for (const dz of [-2, 2]) ctx.buckets.add('steel', box(0.15, 2.6, 0.15, x0 + s * (hw + 0.5), deck + 10.2, sz + dz));
  }
}

function freighter(ctx) {
  const x0 = -44, zMin = 212, zMax = 292, w = 22, deck = 9;
  // Hull with a black waterline band and a raked bow.
  solid(ctx, 'painted', box(w, deck + 3, zMax - zMin - 10, x0, deck / 2 - 1.5, (zMin + zMax) / 2 - 5), { color: 0x5a2a26 });
  ctx.buckets.add('painted', box(w + 0.1, 2.2, zMax - zMin - 10, x0, 0, (zMin + zMax) / 2 - 5), 0x16161a);
  const bow = prism(w, deck + 3, 10, 0, 0, 0, { sawtooth: true }).rotateY(-Math.PI / 2).translate(x0, -3, zMax - 10);
  solid(ctx, 'painted', bow, { color: 0x5a2a26 });
  ctx.buckets.add('roof', box(w - 0.4, 0.1, zMax - zMin - 10.4, x0, deck + 0.05, (zMin + zMax) / 2 - 5));
  // Deck rails (low walls you must hop), superstructure at the stern end.
  for (const s of [-1, 1]) solid(ctx, 'steel', box(0.15, 1, zMax - zMin - 12, x0 + s * (w / 2 - 0.2), deck + 0.5, (zMin + zMax) / 2 - 5));
  const sz = zMin + 8;
  solid(ctx, 'painted', box(16, 13, 14, x0, deck + 6.5, sz), { color: PALETTE.trim });
  solid(ctx, 'painted', box(18, 0.4, 16, x0, deck + 13.2, sz), { color: 0x6a7489 });
  solid(ctx, 'painted', box(6, 4, 6, x0, deck + 15.4, sz), { color: PALETTE.trim });
  solid(ctx, 'painted', cylinder(1.5, 1.8, 7, x0, deck + 20, sz + 1.5, 12), { color: PALETTE.containerRed });
  ctx.grapple.push({ x: x0, y: deck + 23.5, z: sz + 1.5, nx: 0, nz: 1, perch: true });
  for (let k = 0; k < 5; k++) {
    glow(ctx, box(1.8, 0.9, 0.1, x0 - 6 + k * 3, deck + 10.5, sz + 7.05), PALETTE.window);
    ctx.halos.add(x0 - 6 + k * 3, deck + 10.5, sz + 7.2, PALETTE.window, 1.2);
  }
  shipSuperstructureDetail(ctx, x0, deck, sz);
  edgeGrapples(ctx, x0, sz, 16, 14, deck + 13.6, 6);
  edgeGrapples(ctx, x0, (zMin + zMax) / 2 - 5, w, zMax - zMin - 10, deck, 10);
  // Deck cargo: a few containers as cover.
  container(ctx, x0 - 6, deck, 258, false, PALETTE.containerBlue);
  container(ctx, x0 + 6, deck, 262, false, PALETTE.containerGreen, false);
  container(ctx, x0 + 6, deck + 2.6, 262, false, PALETTE.containerRed);
  // Mast lights.
  solid(ctx, 'steel', cylinder(0.15, 0.2, 12, x0, deck + 6, 276, 6));
  ctx.halos.add(x0, deck + 12.2, 276, PALETTE.windowCool, 3);
  lightSpot(ctx, x0, deck + 8, 250, PALETTE.windowCool, 40, 34);
  ctx.reflect.push({ x: x0 + 12, y: -0.5, z: 250, h: 18, color: PALETTE.windowCool, w: 1, len: 20, k: 0.3, far: 1.6 });
  lightSpot(ctx, x0, deck + 8, 226, PALETTE.window, 30, 26);
  graffiti(ctx, x0 - w / 2 - 0.05, 5, 250, -1, 0, 10);
}

function lighthouse(ctx) {
  const x = 140, z = 270;
  solid(ctx, 'concrete', cylinder(12, 14, 4, x, 0, z, 18));
  for (let k = 0; k < 6; k++) solid(ctx, 'painted', cylinder(2.6 - k * 0.12, 2.72 - k * 0.12, 4, x, 2 + k * 4 + 2, z, 16), { color: k % 2 ? PALETTE.stripe : PALETTE.containerRed });
  glow(ctx, cylinder(1.6, 1.6, 2.2, x, 27.1, z, 12), PALETTE.window);
  solid(ctx, 'roof', cylinder(0.2, 2.2, 1.6, x, 29, z, 12));
  ctx.grapple.push({ x, y: 29.8, z, nx: 0, nz: -1, perch: true });
  ctx.halos.add(x, 27.1, z, PALETTE.window, 10);
  lightSpot(ctx, x, 26, z, PALETTE.window, 60, 50);
  ctx.reflect.push({ x, y: -0.5, z: z - 4, h: 27, color: PALETTE.window, w: 2.2, len: 45, k: 0.55, far: 2.6 });
  // Rotating beam: a flat comic wedge in the signal colour. One plane lies flat (the fan you see
  // from the roofs) and one stands on edge (the triangle you see from the docks).
  const wedge = () => {
    const g = new THREE.PlaneGeometry(150, 30, 1, 1).translate(75, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) < 1) p.setY(i, Math.sign(p.getY(i)) * 0.5);
    return g;
  };
  const beamMat = new THREE.MeshBasicMaterial({ color: PALETTE.signal, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Group();
  beam.add(new THREE.Mesh(wedge().rotateX(-Math.PI / 2), beamMat), new THREE.Mesh(wedge(), beamMat));
  beam.position.set(x, 27.1, z);
  for (const m of beam.children) { m.layers.set(LAYER_FX); m.frustumCulled = false; }
  beam.userData.dynamic = true;
  ctx.scene.add(beam);
  ctx.updaters.push((t) => { beam.rotation.y = t * 0.45; });
}

function docks(ctx) {
  // Piers.
  solid(ctx, 'wood', tiledBox(12, 3.6, 88, -64, -0.2, 249, { uvScale: [2.4, 2.4] }), { tag: 'pier' });
  solid(ctx, 'wood', tiledBox(10, 3.6, 46, 23, -0.2, 228, { uvScale: [2.4, 2.4] }), { tag: 'pier' });
  for (let z = 210; z < 292; z += 8) for (const px of [-70, -58]) ctx.buckets.add('wood', cylinder(0.25, 0.25, 4, px, -0.4, z, 6));
  for (let z = 210; z < 292; z += 12) {
    ctx.buckets.add('painted', cylinder(0.3, 0.35, 0.8, -58.6, 2, z, 8), 0x1e2026);
  }
  freighter(ctx);
  for (const x of [-150, -100, -20, 70]) crane(ctx, x);
  // Container yard (block 0,180): stacked rows with aisles.
  const rng = ctx.rng;
  for (const zRow of [165, 172, 186, 193]) {
    for (let x = -17; x <= 17; x += 13) {
      if (zRow === 186 && Math.abs(x) < 2) continue;
      const stack = rng.int(1, 3);
      for (let s = 0; s < stack; s++) container(ctx, x, 0.15 + s * 2.6, zRow, true, rng.pick(CONTAINERS), s === stack - 1);
    }
  }
  // Crates, barrels and bollards along the warehouses.
  for (let k = 0; k < 40; k++) {
    const x = rng.range(-200, 90), z = rng.range(152, 202);
    if (Math.abs(x) < 25 || ctx.collision.groundBelow(x, 1, z, 1.2) > 0.2) continue;
    if (rng.chance(0.5)) solid(ctx, 'wood', box(1.4, 1.4, 1.4, x, 0.85, z));
    else solid(ctx, 'painted', cylinder(0.45, 0.45, 1.2, x, 0.75, z, 10), { color: rng.pick([PALETTE.containerBlue, PALETTE.rust, PALETTE.containerRed]) });
  }
  lighthouse(ctx);
  // Buoys.
  for (const [bx, bz] of [[-120, 240], [0, 300], [90, 240], [-200, 280]]) {
    const i = ctx.halos.add(bx, 1.4, bz, PALETTE.jokerGreen, 3);
    ctx.blinkers.push({ i, size: 3, phase: bx });
  }
  graffiti(ctx, -80.1, 8, 180, -1, 0, 8);
  // The yard's tag on the warehouse wall facing it, with the Joker's paste-ups either side.
  graffiti(ctx, -40, 4.2, 178, 1, 0, 10, "WHERE'S THE CAKE, BAT?");
  wantedPoster(ctx, -40, 2.1, 170, 1, 0, 0.05);
  wantedPoster(ctx, 40, 2.2, 176, -1, 0, -0.04);
}

// ---------------- Neon Row ----------------
function neonRow(ctx) {
  const colors = [PALETTE.window, PALETTE.neonPink, PALETTE.neonCyan, PALETTE.signal];
  for (let z = -90; z <= 130; z += 18) {
    const y = 9 + ctx.rng.range(-1, 1);
    const ax = 141, bx = 159;
    const verts = [];
    let prev = null;
    for (let s = 0; s <= 12; s++) {
      const t = s / 12;
      const p = [ax + (bx - ax) * t, y - 1.2 * 4 * t * (1 - t), z + ctx.rng.range(-0.1, 0.1)];
      if (prev) verts.push(...prev, ...p);
      prev = p;
      if (s % 2 === 1) ctx.halos.add(p[0], p[1] - 0.15, p[2], colors[(s + Math.round(z)) % colors.length], 0.9);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: PALETTE.ink }));
    line.layers.set(LAYER_FX);
    ctx.scene.add(line);
  }
  lightSpot(ctx, 150, 6, -30, PALETTE.neonPink, 30, 26);
  lightSpot(ctx, 150, 6, 40, PALETTE.neonCyan, 30, 26);
  lightSpot(ctx, 150, 6, 100, PALETTE.neonPink, 30, 26);
  graffiti(ctx, 140.1, 7, 30, 1, 0, 7);
  graffiti(ctx, 180, 22, -60, 0, 0, 8);
  // The Joker's birthday billboard on the diner roof, facing the strip, and his tag on the diner
  // wall below it (clear of the DINER and EAT signs).
  jokerBillboard(ctx, 163, 9, 60, -1, 0);
  graffiti(ctx, 160, 6.4, 50, -1, 0, 7, "PARTY'S OVER!");
  wantedPoster(ctx, 160, 2.3, 74.2, -1, 0, 0.06, 0.22);
  wantedPoster(ctx, 160, 2.2, -47, -1, 0, -0.05, 0.22);
}

// ---------------- Ace Chemicals ----------------
function tank(ctx, x, z, r, h) {
  solid(ctx, 'painted', cylinder(r, r, h, x, h / 2 + 0.15, z, 24), { color: 0x8a8f96 });
  ctx.buckets.add('painted', new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 1).translate(x, h + 0.15, z), 0x8a8f96);
  for (let k = 1; k < h / 3; k++) ctx.buckets.add('steel', cylinder(r + 0.06, r + 0.06, 0.2, x, k * 3, z, 24, true));
  ctx.buckets.add('steel', box(0.6, h, 0.1, x, h / 2, z + r + 0.1));
  ctx.grapple.push({ x, y: h + 0.15, z: z + r, nx: 0, nz: 1 });
  ctx.grapple.push({ x: x + r, y: h + 0.15, z, nx: 1, nz: 0 });
}

function vat(ctx, x, z) {
  solid(ctx, 'steel', cylinder(5, 5.2, 6, x, 3.15, z, 24));
  const liquid = new THREE.CircleGeometry(4.7, 24).rotateX(-Math.PI / 2).translate(x, 6.1, z);
  ctx.buckets.add('chem', liquid);
  ctx.halos.add(x, 6.6, z, PALETTE.chem, 14);
  lightSpot(ctx, x, 8, z, PALETTE.chem, 50, 22);
  ctx.buckets.add('steel', cylinder(5.3, 5.3, 0.3, x, 6.2, z, 24, true));
}

function pipe(ctx, x1, z1, x2, z2, y, r = 0.55) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const g = new THREE.CylinderGeometry(r, r, len, 10).rotateZ(Math.PI / 2).rotateY(-Math.atan2(z2 - z1, x2 - x1)).translate((x1 + x2) / 2, y, (z1 + z2) / 2);
  solid(ctx, 'painted', g, { color: PALETTE.rust });
  for (let t = 0.1; t < 1; t += 0.25) {
    const sx = x1 + (x2 - x1) * t, sz = z1 + (z2 - z1) * t;
    solid(ctx, 'steel', box(0.3, y, 0.3, sx, y / 2, sz));
  }
}

function aceChemicals(ctx) {
  const c = ctx.compounds.ace;
  solid(ctx, 'yard', tiledBox(c.maxX - c.minX, 0.15, c.maxZ - c.minZ, (c.minX + c.maxX) / 2, 0.075, (c.minZ + c.maxZ) / 2, { uvScale: [12, 12] }));
  // Spilled chemicals glowing on the slab, and their reflections.
  for (const [px, pz, r] of [[104, -104, 3.5], [121, -134, 2.6], [138, -110, 2.2], [76, -150, 2.8], [160, -140, 3.2], [60, -104, 2]]) {
    ctx.buckets.add('pool', new THREE.CircleGeometry(r, 20).scale(1, 0.7, 1).rotateX(-Math.PI / 2).translate(px, 0.17, pz), 0x5aa83a);
    ctx.buckets.add('puddle', new THREE.PlaneGeometry(r * 1.6, r * 1.1).rotateX(-Math.PI / 2).translate(px, 0.165, pz));
  }
  for (const [vx, vz] of [[112, -112], [128, -126]]) ctx.reflect.push({ x: vx, y: 0.16, z: vz, h: 6.5, color: PALETTE.chem, w: 1.6, len: 14, k: 0.35 });
  ctx.reflect.push({ x: 140, y: 25.1, z: -150, h: 6, color: PALETTE.chem, w: 3, len: 10, k: 0.3 });
  // Chain-link fence with two gates.
  const fence = (x1, z1, x2, z2) => solid(ctx, 'steel', box(Math.max(0.1, Math.abs(x2 - x1)), 3.2, Math.max(0.1, Math.abs(z2 - z1)), (x1 + x2) / 2, 1.75, (z1 + z2) / 2));
  fence(c.minX, c.maxZ, 88, c.maxZ); fence(112, c.maxZ, c.maxX, c.maxZ);
  fence(c.minX, c.minZ, c.maxX, c.minZ);
  fence(c.minX, c.minZ, c.minX, -155); fence(c.minX, -135, c.minX, c.maxZ);
  fence(c.maxX, c.minZ, c.maxX, c.maxZ);
  // Smokestacks.
  for (const x of [112, 126]) {
    solid(ctx, 'painted', cylinder(2.2, 2.8, 56, x, 28, -191, 16), { color: PALETTE.brick });
    for (let k = 0; k < 3; k++) ctx.buckets.add('painted', cylinder(2.3, 2.3, 1.2, x, 48 + k * 2.6, -191, 16, true), k % 2 ? PALETTE.stripe : PALETTE.containerRed);
    const i = ctx.halos.add(x, 56.5, -191, PALETTE.balloon, 3.5);
    ctx.blinkers.push({ i, size: 3.5, phase: x });
    ctx.collision.addBox(x - 2.2, 55.6, -193.2, x + 2.2, 56, -188.8, 'stackTop');
    ctx.grapple.push({ x, y: 56, z: -191, nx: 0, nz: 1, perch: true });
  }
  tank(ctx, 60, -185, 6, 18);
  tank(ctx, 60, -160, 6, 18);
  tank(ctx, 88, -192, 4.5, 13);
  vat(ctx, 112, -112);
  vat(ctx, 128, -126);
  // Catwalk from the vats to the vat deck.
  solid(ctx, 'steel', box(40, 0.25, 2, 147, 9.9, -118), { tag: 'catwalk' });
  for (let x = 130; x < 168; x += 6) solid(ctx, 'steel', box(0.25, 9.9, 0.25, x, 4.95, -118));
  pipe(ctx, 66, -172, 108, -172, 8);
  pipe(ctx, 66, -168, 108, -168, 10, 0.4);
  pipe(ctx, 88, -150, 88, -110, 6);
  // ACE CHEMICALS sign on the factory roof, facing south.
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  g.font = '170px Bangers, Impact, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#7dff4a'; g.shadowBlur = 40;
  g.strokeStyle = '#7dff4a'; g.lineWidth = 10;
  g.strokeText('ACE CHEMICALS', 512, 128);
  g.fillStyle = '#f3ffe8';
  g.fillText('ACE CHEMICALS', 512, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  sign.position.set(140, 31, -151.5);
  sign.layers.set(LAYER_FX);
  ctx.scene.add(sign);
  solid(ctx, 'steel', box(40, 0.3, 1.2, 140, 25.6, -152));
  for (let x = 122; x <= 158; x += 9) solid(ctx, 'steel', box(0.3, 12, 0.3, x, 30, -152.6));
  for (let k = 0; k < 5; k++) ctx.halos.add(124 + k * 8, 31, -150.5, PALETTE.chem, 9);
  lightSpot(ctx, 140, 30, -146, PALETTE.chem, 45, 30);
  // A walkway along the top of the sign frame, so its perch has something to stand on.
  solid(ctx, 'steel', box(40, 0.25, 1.1, 140, 36.1, -152.6));
  ctx.grapple.push({ x: 140, y: 36.23, z: -152.6, nx: 0, nz: 1, perch: true });
  // Barrels.
  for (let k = 0; k < 30; k++) {
    const x = ctx.rng.range(45, 195), z = ctx.rng.range(-148, -100);
    if (ctx.collision.groundBelow(x, 2, z, 1) > 0.3) continue;
    solid(ctx, 'painted', cylinder(0.45, 0.45, 1.2, x, 0.75, z, 10), { color: ctx.rng.pick([PALETTE.chem, PALETTE.signal, PALETTE.containerBlue]) });
  }
  graffiti(ctx, 90, 2, -96.9, 0, 1, 7);
  // Three laughs down the factory's yard wall, under the pipe runs, and paste-ups by the doors.
  for (const z of [-158, -170, -182]) graffiti(ctx, 108, 4, z, -1, 0, 8, 'HA HA HA');
  wantedPoster(ctx, 108, 2.1, -164, -1, 0, 0.04);
}

// ---------------- Clock plaza ----------------
function clockFaceTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#f3e7b3';
  g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#0b0b12'; g.lineWidth = 14;
  g.beginPath(); g.arc(256, 256, 238, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#0b0b12';
  g.font = '64px "Patrick Hand SC", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const nums = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  nums.forEach((n, i) => { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; g.fillText(n, 256 + Math.cos(a) * 185, 256 + Math.sin(a) * 185); });
  // One minute to midnight.
  const hand = (a, len, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + Math.cos(a) * len, 256 + Math.sin(a) * len); g.stroke(); };
  hand(-Math.PI / 2 - 0.02, 120, 18);
  hand(-Math.PI / 2 - 0.1, 190, 10);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function gargoyle(ctx, x, y, z, rotY) {
  const parts = [
    box(0.8, 0.9, 1.1, 0, 0.45, 0),
    box(0.5, 0.45, 0.55, 0, 1.05, 0.45),
    new THREE.ConeGeometry(0.12, 0.45, 4).translate(-0.18, 1.45, 0.45),
    new THREE.ConeGeometry(0.12, 0.45, 4).translate(0.18, 1.45, 0.45),
    prism(0.1, 0.9, 1.4, 0.45, 0.6, -0.2), prism(0.1, 0.9, 1.4, -0.45, 0.6, -0.2),
  ];
  for (const p of parts) ctx.buckets.add('painted', p.rotateY(rotY).translate(x, y, z), 0x55524d);
}

// A pointed (gothic) arch, w wide and h tall, standing in the XY plane on y = 0.
function pointedArch(w, h) {
  const a = new THREE.Shape(), hw = w / 2, spring = h - w * 0.9;
  a.moveTo(-hw, 0); a.lineTo(-hw, spring); a.quadraticCurveTo(-hw * 0.9, h - w * 0.25, 0, h);
  a.quadraticCurveTo(hw * 0.9, h - w * 0.25, hw, spring); a.lineTo(hw, 0); a.lineTo(-hw, 0);
  return new THREE.ShapeGeometry(a);
}

// The clock tower was a plain 14 x 44 x 14 m stone box, and the boss fight happens right at its
// foot, where the clock faces (28 m up) are out of view: a blank wall. Detail only (buckets and
// glow, no colliders, no ctx.rng draws): corner pilasters, string courses, two tall pointed
// windows per face below the clock, louvred belfry openings above it, and an arched door with a
// lantern opening onto the arena.
function clockTowerDetail(ctx, hx, hz) {
  const half = 7, y0 = 58, y1 = 102;
  const dark = 0x1f2128, stoneDark = 0x5e5a55, wood = 0x3a2a22;
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) ctx.buckets.add('painted', box(1.8, y1 - y0, 1.8, hx + sx * (half - 0.5), (y0 + y1) / 2, hz + sz * (half - 0.5)), stoneDark);
  for (const y of [y0 + 0.4, 64.5, 70.5, 82.5, 90, 101.4]) ctx.buckets.add('trim', box(14.5, 0.45, 14.5, hx, y, hz));
  for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const rot = Math.atan2(nx, nz);
    // A point on this face: u runs along it, out pushes it off the wall.
    const at = (u, y, out = 0.06) => ({ x: hx + nx * (half + out) + (nz ? u : 0), y, z: hz + nz * (half + out) + (nx ? u : 0) });
    for (const u of [-2.6, 2.6]) {
      // Tall pointed windows between the lower string courses: a stone surround, dark glass, a
      // faint warm glow at the bottom, and a mullion.
      const p = at(u, 65.2);
      ctx.buckets.add('painted', pointedArch(2.4, 8.6).rotateY(rot).translate(p.x, p.y - 0.2, p.z), stoneDark);
      const g = at(u, 65.2, 0.1);
      ctx.buckets.add('painted', pointedArch(1.8, 8.0).rotateY(rot).translate(g.x, g.y, g.z), dark);
      glow(ctx, box(nz ? 1.6 : 0.06, 1.6, nz ? 0.06 : 1.6, g.x + nx * 0.02, 66.2, g.z + nz * 0.02), PALETTE.window);
      ctx.buckets.add('painted', box(nz ? 0.14 : 0.08, 7.4, nz ? 0.08 : 0.14, g.x + nx * 0.03, 68.9, g.z + nz * 0.03), stoneDark);
      // Belfry openings above the clock, slatted.
      const b = at(u, 96.6, 0.1);
      ctx.buckets.add('painted', pointedArch(2.0, 4.6).rotateY(rot).translate(b.x, b.y - 1.6, b.z), dark);
      for (let k = 0; k < 4; k++) ctx.buckets.add('painted', box(nz ? 1.8 : 0.1, 0.12, nz ? 0.1 : 1.8, b.x + nx * 0.05, 95.4 + k * 0.7, b.z + nz * 0.05), stoneDark);
    }
  }
  // The door onto the arena (the tower's south face), with a lantern over it.
  const dz = hz + half + 0.08;
  ctx.buckets.add('painted', pointedArch(3.0, 4.6).translate(hx, y0, dz), stoneDark);
  ctx.buckets.add('painted', pointedArch(2.3, 4.0).translate(hx, y0, dz + 0.04), wood);
  glow(ctx, box(0.5, 0.7, 0.3, hx, y0 + 5.3, dz + 0.25), PALETTE.window);
  ctx.halos.add(hx, y0 + 5.3, dz + 0.6, PALETTE.window, 2.4);
  lightSpot(ctx, hx, y0 + 5, dz + 1.5, PALETTE.window, 10, 12);
}

function clockPlaza(ctx) {
  const c = ctx.compounds.clock;
  solid(ctx, 'sidewalk', tiledBox(c.maxX - c.minX, 0.15, c.maxZ - c.minZ, (c.minX + c.maxX) / 2, 0.075, (c.minZ + c.maxZ) / 2, { uvScale: [3, 3] }));
  // Cathedral front towers, buttresses, rose window.
  for (const tx of [-129, -111]) {
    solid(ctx, 'painted', box(8, 48, 8, tx, 24, -122), { color: PALETTE.stone });
    ctx.buckets.add('trim', box(8.8, 0.6, 8.8, tx, 48, -122));
    // The spire's collider steps in with the cone, leaving a standable rim around its base.
    ctx.buckets.add('roof', new THREE.ConeGeometry(4.6, 16, 4).rotateY(Math.PI / 4).translate(tx, 56, -122));
    for (const [half, y0, y1] of [[3, 48, 49.5], [2.2, 49.5, 53], [1.2, 53, 60], [0.5, 60, 64]]) ctx.collision.addBox(tx - half, y0, -122 - half, tx + half, y1, -122 + half, 'spire');
    glow(ctx, box(1.4, 6, 0.1, tx, 36, -117.95), PALETTE.windowCool);
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.grapple.push({ x: tx + nx * 3.55, y: 48, z: -122 + nz * 3.55, nx, nz, perch: true });
    // Gargoyles on the rim's two plaza-facing corners, crouched on the trim and facing out.
    for (const sx of [-1, 1]) addGargoyle(ctx, tx + sx * 4.7, 48.3, -122 + 4.7, Math.atan2(sx, 1));
  }
  for (let z = -175; z < -125; z += 10) for (const s of [-1, 1]) solid(ctx, 'painted', box(2, 20, 2.4, -120 + s * 14, 10, z), { color: PALETTE.stone });
  // The nave's side ledges sit under its pitched roof, so the ridge gets its own perches instead.
  for (const z of [-172, -165, -150, -135, -128]) ctx.grapple.push({ x: -120, y: 37, z, nx: 0, nz: 1, perch: true });
  const rose = new THREE.CircleGeometry(4, 24).translate(-120, 30, -118.9);
  glow(ctx, rose, PALETTE.jokerPurple);
  ctx.halos.add(-120, 30, -118.5, PALETTE.neonPink, 12);
  lightSpot(ctx, -120, 20, -112, PALETTE.jokerPurple, 30, 26);
  ctx.reflect.push({ x: -120, y: 0.16, z: -117, h: 30, color: PALETTE.jokerPurple, w: 1.5, len: 12, k: 0.22 });
  for (let z = -170; z < -125; z += 7) for (const s of [-1, 1]) glow(ctx, box(0.1, 5, 1.6, -120 + s * 13.05, 16, z), s > 0 ? 0x3a5a9a : 0x9a3a4a);

  // Clock tower on the hall's north edge.
  const hx = -62, hz = -173;
  solid(ctx, 'painted', box(14, 44, 14, hx, 58 + 22, hz), { color: PALETTE.stone });
  ctx.buckets.add('trim', box(15, 0.8, 15, hx, 76, hz));
  ctx.buckets.add('trim', box(15, 0.8, 15, hx, 96, hz));
  clockTowerDetail(ctx, hx, hz);
  solid(ctx, 'roof', new THREE.ConeGeometry(10.5, 22, 4).rotateY(Math.PI / 4).translate(hx, 113, hz));
  const faceMat = new THREE.MeshBasicMaterial({ map: clockFaceTexture() });
  for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(5.2, 40), faceMat);
    face.position.set(hx + nx * 7.05, 86, hz + nz * 7.05);
    face.rotation.y = Math.atan2(nx, nz);
    ctx.scene.add(face);
    ctx.halos.add(hx + nx * 7.6, 86, hz + nz * 7.6, PALETTE.clockFace, 16);
  }
  lightSpot(ctx, hx, 86, hz + 12, PALETTE.clockFace, 60, 40);
  const i = ctx.halos.add(hx, 124.4, hz, PALETTE.balloon, 4);
  ctx.blinkers.push({ i, size: 4, phase: 1 });
  // Two gargoyles on the lower belt course, looking south over the arena and the balcony.
  for (const sx of [-1, 1]) addGargoyle(ctx, hx + sx * 7.82, 76.4, hz + 7.82, Math.atan2(sx, 1));
  // Joker's balcony above the arena.
  const by = SITES.balcony.y;
  solid(ctx, 'painted', box(12, 0.5, 5, hx, by - 0.25, hz + 9.5), { color: PALETTE.stone });
  // An open railing, not a solid sheet: from the arena floor a 1.1 m steel parapet hid him to the
  // eyebrows, so the fight's first phase was a voice and a speech balloon over an empty ledge.
  // Posts, a mid rail and a top rail; the mid rail still keeps anyone from slipping underneath.
  solid(ctx, 'steel', box(12, 0.12, 0.14, hx, by + 1.04, hz + 11.95));
  solid(ctx, 'steel', box(12, 0.07, 0.07, hx, by + 0.52, hz + 11.95));
  for (let i = 0; i <= 8; i++) solid(ctx, 'steel', box(0.09, 1.0, 0.09, hx - 5.95 + i * 1.4875, by + 0.5, hz + 11.95));
  for (const s of [-1, 1]) {
    solid(ctx, 'steel', box(0.14, 0.12, 5, hx + s * 5.95, by + 1.04, hz + 9.5));
    solid(ctx, 'steel', box(0.07, 0.07, 5, hx + s * 5.95, by + 0.52, hz + 9.5));
    for (let i = 0; i < 3; i++) solid(ctx, 'steel', box(0.09, 1.0, 0.09, hx + s * 5.95, by + 0.5, hz + 7.2 + i * 1.6));
  }
  // Arena lanterns and gargoyles on the hall corners.
  for (const [gx, gz] of [[-81, -141], [-43, -141], [-81, -179], [-43, -179]]) {
    gargoyle(ctx, gx, 58.9, gz, Math.atan2(gx + 62, gz + 160));
    ctx.buckets.add('painted', box(1.4, 1.2, 1.4, gx, 58.6, gz), PALETTE.stone);
  }
  for (const [lx, lz] of [[-76, -146], [-48, -146], [-76, -164], [-48, -164]]) {
    solid(ctx, 'steel', cylinder(0.12, 0.16, 3.4, lx, 59.7, lz, 8));
    glow(ctx, box(0.6, 0.8, 0.6, lx, 61.6, lz), PALETTE.window);
    ctx.halos.add(lx, 61.6, lz, PALETTE.window, 3);
    lightSpot(ctx, lx, 61, lz, PALETTE.window, 22, 16);
    ctx.reflect.push({ x: lx, y: 58, z: lz, h: 3.6, color: PALETTE.window, w: 0.6, len: 7, k: 0.4 });
  }
  // Fountain and statues in the plaza.
  solid(ctx, 'painted', cylinder(6, 6.2, 0.9, -90, 0.6, -110, 28), { color: PALETTE.stone });
  ctx.buckets.add('glass', new THREE.CircleGeometry(5.6, 28).rotateX(-Math.PI / 2).translate(-90, 1.0, -110));
  solid(ctx, 'painted', cylinder(0.8, 1.1, 3.6, -90, 2.4, -110, 12), { color: PALETTE.stone });
  for (const sx of [-100, -80]) {
    solid(ctx, 'painted', box(2, 2, 2, sx, 1.15, -100), { color: PALETTE.stone });
    ctx.buckets.add('painted', cylinder(0.4, 0.55, 2.4, sx, 3.35, -100, 8), 0x3b4a44);
    ctx.buckets.add('painted', new THREE.SphereGeometry(0.4, 10, 8).translate(sx, 4.9, -100), 0x3b4a44);
  }
  graffiti(ctx, -62, 58, -150, 0, 0, 10, 'HA HA HA');
  // The Joker's question on the hall's plaza wall, and a paste-up by the cathedral portal.
  graffiti(ctx, -62, 5, -140, 0, 1, 12, 'BIRTHDAY? WHAT BIRTHDAY?');
  wantedPoster(ctx, -112.5, 2.3, -118, 0, 1, 0.05);

  // The cathedral portal: a tall pointed doorway with candlelight inside.
  const portal = new THREE.Shape();
  portal.moveTo(-2.4, 0); portal.lineTo(-2.4, 5.5); portal.quadraticCurveTo(-2.2, 8.2, 0, 9.4);
  portal.quadraticCurveTo(2.2, 8.2, 2.4, 5.5); portal.lineTo(2.4, 0); portal.lineTo(-2.4, 0);
  ctx.buckets.add('painted', new THREE.ExtrudeGeometry(portal, { depth: 0.5, bevelEnabled: false }).scale(1.25, 1.1, 1).translate(-120, 0.15, -119.2), 0x55524d);
  ctx.buckets.add('glow', new THREE.ShapeGeometry(portal).translate(-120, 0.15, -118.65), 0x6a4a28);
  ctx.halos.add(-120, 4, -118, PALETTE.window, 7);
  ctx.reflect.push({ x: -120, y: 0.16, z: -117, h: 4, color: PALETTE.window, w: 1.8, len: 9, k: 0.35 });
  // Pinnacles on every buttress.
  for (let z = -175; z < -125; z += 10) for (const s of [-1, 1]) {
    ctx.buckets.add('painted', new THREE.ConeGeometry(0.9, 4, 4).rotateY(Math.PI / 4).translate(-120 + s * 14, 22, z), PALETTE.stone);
  }
  // Gothic lamp posts and bare trees around the plaza.
  for (const [lx, lz] of [[-104, -112], [-76, -112], [-104, -130], [-58, -104], [-46, -126], [-90, -134]]) {
    solid(ctx, 'steel', cylinder(0.12, 0.2, 4.6, lx, 0.15 + 2.3, lz, 8));
    ctx.buckets.add('steel', box(1.6, 0.1, 0.1, lx, 4.5, lz));
    for (const s of [-0.7, 0.7]) {
      ctx.buckets.add('steel', new THREE.ConeGeometry(0.34, 0.35, 4).rotateY(Math.PI / 4).translate(lx + s, 4.95, lz));
      glow(ctx, box(0.36, 0.5, 0.36, lx + s, 4.55, lz), PALETTE.window);
      ctx.halos.add(lx + s, 4.55, lz, PALETTE.window, 2.4);
    }
    lightSpot(ctx, lx, 4.2, lz, PALETTE.window, 20, 15);
    ctx.reflect.push({ x: lx, y: 0.16, z: lz, h: 4.5, color: PALETTE.sodium, w: 0.5, len: 7, k: 0.3 });
  }
  for (const [tx, tz, sc] of [[-98, -122, 1.2], [-82, -123, 1], [-52, -113, 1.3], [-66, -106, 0.9], [-104, -104, 1], [-45, -134, 1.1]]) {
    for (const g of bareTree(ctx.rng, tx, 0.15, tz, sc)) ctx.buckets.add('painted', g, 0x201c1c);
    ctx.collision.addBox(tx - 0.3, 0.15, tz - 0.3, tx + 0.3, 3, tz + 0.3, 'tree');
  }
}

export function buildDistricts(ctx) {
  gcpd(ctx);
  docks(ctx);
  neonRow(ctx);
  aceChemicals(ctx);
  buildStealthSets(ctx);
  clockPlaza(ctx);
  // A few water towers on the warehouses for the docks skyline.
  waterTower(ctx, -52, 16, 172);
  decoGargoyles(ctx);
}

// Gargoyles on the cornice corners of the two tallest deco towers (seed 11's map), on the faces
// that meet a street: the north face of the tower west of GCPD and the east face of the one by
// the docks road. Each crouches on a corner plinth at parapet height, a little proud of the wall,
// facing out diagonally, so it shows from the roof as well as the street.
function decoGargoyles(ctx) {
  const towers = [
    { id: 'f-60_-60_0_-10.5', face: [0, -1] },
    { id: 'f-180_60_10.5_0', face: [1, 0] },
  ];
  for (const t of towers) {
    const r = ctx.roofs.find((o) => o.id === t.id);
    if (!r) continue;
    const [fx, fz] = t.face;
    for (const s of [-1, 1]) {
      // The corner's outward diagonal: the face normal plus a unit step along the face.
      const dx = fx || s, dz = fz || s;
      const cx = r.x + dx * (r.w / 2 + 0.32), cz = r.z + dz * (r.d / 2 + 0.32);
      plinth(ctx, cx, r.y, cz);
      addGargoyle(ctx, cx, r.y + 0.9, cz, Math.atan2(dx, dz));
    }
  }
}
