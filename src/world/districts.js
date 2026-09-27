// Landmark set pieces for each district, built into the shared city context.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';
import { SITES } from './mapData.js';
import { box, cylinder, prism, tiledBox } from './buckets.js';
import { solid, glow, lightSpot, edgeGrapples, graffiti, waterTower } from './cityBuilder.js';

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
}

// ---------------- Docks ----------------
function container(ctx, x, y, z, alongX, color) {
  const L = 12.2, W = 2.44, H = 2.6;
  solid(ctx, 'painted', box(alongX ? L : W, H, alongX ? W : L, x, y + H / 2, z), { color });
  // Door frame and ribs read as ink lines.
  for (let k = -5; k <= 5; k += 1.2) {
    const rx = alongX ? x + k : x, rz = alongX ? z : z + k;
    ctx.buckets.add('painted', box(alongX ? 0.08 : W + 0.06, H - 0.3, alongX ? W + 0.06 : 0.08, rx, y + H / 2, rz), new THREE.Color(color).offsetHSL(0, 0, -0.06).getHex());
  }
  ctx.grapple.push({ x, y: y + H, z, nx: 0, nz: 1, perch: true });
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
  solid(ctx, 'painted', box(16, 13, 14, x0, deck + 6.5, sz), { color: PALETTE.stripe });
  solid(ctx, 'painted', box(18, 0.4, 16, x0, deck + 13.2, sz), { color: 0x6a7489 });
  solid(ctx, 'painted', box(6, 4, 6, x0, deck + 15.4, sz), { color: PALETTE.stripe });
  solid(ctx, 'painted', cylinder(1.5, 1.8, 7, x0, deck + 20, sz + 1.5, 12), { color: PALETTE.containerRed });
  for (let k = 0; k < 5; k++) {
    glow(ctx, box(1.8, 0.9, 0.1, x0 - 6 + k * 3, deck + 10.5, sz + 7.05), PALETTE.window);
    ctx.halos.add(x0 - 6 + k * 3, deck + 10.5, sz + 7.2, PALETTE.window, 1.2);
  }
  edgeGrapples(ctx, x0, sz, 16, 14, deck + 13.6, 6);
  edgeGrapples(ctx, x0, (zMin + zMax) / 2 - 5, w, zMax - zMin - 10, deck, 10);
  // Deck cargo: a few containers as cover.
  container(ctx, x0 - 6, deck, 258, false, PALETTE.containerBlue);
  container(ctx, x0 + 6, deck, 262, false, PALETTE.containerGreen);
  container(ctx, x0 + 6, deck + 2.6, 262, false, PALETTE.containerRed);
  // Mast lights.
  solid(ctx, 'steel', cylinder(0.15, 0.2, 12, x0, deck + 6, 276, 6));
  ctx.halos.add(x0, deck + 12.2, 276, PALETTE.windowCool, 3);
  lightSpot(ctx, x0, deck + 8, 250, PALETTE.windowCool, 40, 34);
  lightSpot(ctx, x0, deck + 8, 226, PALETTE.window, 30, 26);
  graffiti(ctx, x0 - w / 2 - 0.05, 5, 250, -1, 0, 10);
}

function lighthouse(ctx) {
  const x = 140, z = 270;
  solid(ctx, 'concrete', cylinder(12, 14, 4, x, 0, z, 18));
  for (let k = 0; k < 6; k++) solid(ctx, 'painted', cylinder(2.6 - k * 0.12, 2.72 - k * 0.12, 4, x, 2 + k * 4 + 2, z, 16), { color: k % 2 ? PALETTE.stripe : PALETTE.containerRed });
  glow(ctx, cylinder(1.6, 1.6, 2.2, x, 27.1, z, 12), PALETTE.window);
  solid(ctx, 'roof', cylinder(0.2, 2.2, 1.6, x, 29, z, 12));
  ctx.halos.add(x, 27.1, z, PALETTE.window, 10);
  lightSpot(ctx, x, 26, z, PALETTE.window, 60, 50);
  // Rotating beam.
  const beamGeo = new THREE.CylinderGeometry(9, 0.4, 150, 20, 1, true).translate(0, 75, 0).rotateZ(-Math.PI / 2);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(PALETTE.window) } },
    vertexShader: 'varying float vA; void main(){ vA = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ float a = (1.0 - vA) * 0.22; gl_FragColor = vec4(uColor * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(x, 27.1, z);
  beam.layers.set(LAYER_FX);
  beam.frustumCulled = false;
  ctx.scene.add(beam);
  ctx.updaters.push((t) => { beam.rotation.y = t * 0.45; });
}

function docks(ctx) {
  // Piers.
  solid(ctx, 'wood', box(12, 3.6, 88, -64, -0.2, 249), { tag: 'pier' });
  solid(ctx, 'wood', box(10, 3.6, 46, 23, -0.2, 228), { tag: 'pier' });
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
      for (let s = 0; s < stack; s++) container(ctx, x, 0.15 + s * 2.6, zRow, true, rng.pick(CONTAINERS));
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
  solid(ctx, 'concrete', tiledBox(c.maxX - c.minX, 0.15, c.maxZ - c.minZ, (c.minX + c.maxX) / 2, 0.075, (c.minZ + c.maxZ) / 2, { uvScale: [8, 8] }));
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
  ctx.grapple.push({ x: 140, y: 36, z: -152, nx: 0, nz: 1, perch: true });
  // Barrels.
  for (let k = 0; k < 30; k++) {
    const x = ctx.rng.range(45, 195), z = ctx.rng.range(-148, -100);
    if (ctx.collision.groundBelow(x, 2, z, 1) > 0.3) continue;
    solid(ctx, 'painted', cylinder(0.45, 0.45, 1.2, x, 0.75, z, 10), { color: ctx.rng.pick([PALETTE.chem, PALETTE.signal, PALETTE.containerBlue]) });
  }
  graffiti(ctx, 90, 2, -96.9, 0, 1, 7);
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

function clockPlaza(ctx) {
  const c = ctx.compounds.clock;
  solid(ctx, 'sidewalk', tiledBox(c.maxX - c.minX, 0.15, c.maxZ - c.minZ, (c.minX + c.maxX) / 2, 0.075, (c.minZ + c.maxZ) / 2, { uvScale: [3, 3] }));
  // Cathedral front towers, buttresses, rose window.
  for (const tx of [-129, -111]) {
    solid(ctx, 'painted', box(8, 48, 8, tx, 24, -122), { color: PALETTE.stone });
    ctx.buckets.add('trim', box(8.8, 0.6, 8.8, tx, 48, -122));
    solid(ctx, 'roof', new THREE.ConeGeometry(4.6, 16, 4).rotateY(Math.PI / 4).translate(tx, 56, -122));
    glow(ctx, box(1.4, 6, 0.1, tx, 36, -117.95), PALETTE.windowCool);
    edgeGrapples(ctx, tx, -122, 8, 8, 48, 4);
  }
  for (let z = -175; z < -125; z += 10) for (const s of [-1, 1]) solid(ctx, 'painted', box(2, 20, 2.4, -120 + s * 14, 10, z), { color: PALETTE.stone });
  const rose = new THREE.CircleGeometry(4, 24).translate(-120, 30, -118.9);
  glow(ctx, rose, PALETTE.jokerPurple);
  ctx.halos.add(-120, 30, -118.5, PALETTE.neonPink, 12);
  lightSpot(ctx, -120, 20, -112, PALETTE.jokerPurple, 30, 26);
  for (let z = -170; z < -125; z += 7) for (const s of [-1, 1]) glow(ctx, box(0.1, 5, 1.6, -120 + s * 13.05, 16, z), s > 0 ? 0x3a5a9a : 0x9a3a4a);

  // Clock tower on the hall's north edge.
  const hx = -62, hz = -173;
  solid(ctx, 'painted', box(14, 44, 14, hx, 58 + 22, hz), { color: PALETTE.stone });
  ctx.buckets.add('trim', box(15, 0.8, 15, hx, 76, hz));
  ctx.buckets.add('trim', box(15, 0.8, 15, hx, 96, hz));
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
  // Joker's balcony above the arena.
  const by = SITES.balcony.y;
  solid(ctx, 'painted', box(12, 0.5, 5, hx, by - 0.25, hz + 9.5), { color: PALETTE.stone });
  solid(ctx, 'steel', box(12, 1.1, 0.12, hx, by + 0.55, hz + 11.95));
  for (const s of [-1, 1]) solid(ctx, 'steel', box(0.12, 1.1, 5, hx + s * 5.95, by + 0.55, hz + 9.5));
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
}

export function buildDistricts(ctx) {
  gcpd(ctx);
  docks(ctx);
  neonRow(ctx);
  aceChemicals(ctx);
  clockPlaza(ctx);
  // A few water towers on the warehouses for the docks skyline.
  waterTower(ctx, -52, 16, 172);
}
