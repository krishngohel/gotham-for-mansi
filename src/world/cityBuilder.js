// Turns mapData into merged meshes, collision boxes, grapple points and light spots.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';
import { GRID, WORLD, SITES, districtAt } from './mapData.js';
import { createBuckets, tiledBox, box, cylinder, prism } from './buckets.js';
import { createCityMaterials, FACADE_METERS, FLOOR_METERS } from './materials.js';
import { neonTexture, billboardTexture, graffitiTexture } from './textures.js';
import { createHalos } from './halos.js';
import { facadeRelief, decoCrown, awnings } from './facadeDetail.js';
import { dressStreets } from './streetDressing.js';

const CAR_COLORS = [0x6d2f2f, 0x2f3f5a, 0x39473a, 0x5a5146, 0x1e2026, 0x7a6a44, 0x4a3a52];
const NEON = { pink: PALETTE.neonPink, cyan: PALETTE.neonCyan };

export function createCityContext(scene, rng, collision) {
  const materials = createCityMaterials(rng);
  const ctx = {
    scene, rng, collision, materials,
    buckets: createBuckets(materials),
    halos: createHalos(6000),
    grapple: [],
    lights: [],
    blinkers: [],
    flickers: [],
    updaters: [],
    roofs: [],
    steam: [],   // { x, y, z, s }: sources of rising steam (vents, chimneys, manholes)
    reflect: [], // { x, y, z, h, color, w, len, k }: lights that streak on the wet ground below them
  };
  scene.add(ctx.halos.points);
  return ctx;
}

// Adds geometry to a bucket and (optionally) its bounding box to collision.
export function solid(ctx, key, geo, { color = null, collide = true, tag = '' } = {}) {
  if (collide) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    ctx.collision.addBox(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z, tag);
  }
  ctx.buckets.add(key, geo, color);
}

export function glow(ctx, geo, color) {
  ctx.buckets.add('glow', geo, color);
}

export function lightSpot(ctx, x, y, z, color, intensity = 18, distance = 16) {
  ctx.lights.push({ x, y, z, color, intensity, distance });
}

export function edgeGrapples(ctx, x, z, w, d, y, step = 8) {
  const add = (px, pz, nx, nz) => ctx.grapple.push({ x: px, y, z: pz, nx, nz });
  for (let t = -w / 2 + step / 2; t < w / 2; t += step) { add(x + t, z - d / 2, 0, -1); add(x + t, z + d / 2, 0, 1); }
  for (let t = -d / 2 + step / 2; t < d / 2; t += step) { add(x - w / 2, z + t, -1, 0); add(x + w / 2, z + t, 1, 0); }
}

function parapet(ctx, x, z, w, d, y, hgt = 0.9, t = 0.35) {
  solid(ctx, 'trim', box(w, hgt, t, x, y + hgt / 2, z - d / 2 + t / 2));
  solid(ctx, 'trim', box(w, hgt, t, x, y + hgt / 2, z + d / 2 - t / 2));
  solid(ctx, 'trim', box(t, hgt, d - 2 * t, x - w / 2 + t / 2, y + hgt / 2, z));
  solid(ctx, 'trim', box(t, hgt, d - 2 * t, x + w / 2 - t / 2, y + hgt / 2, z));
}

// A cornice/belt as a ring around the footprint, so its top never z-fights with the roof.
function ring(ctx, key, x, z, w, d, y, hgt, over) {
  const t = over + 0.3;
  ctx.buckets.add(key, box(w + 2 * over, hgt, t, x, y, z - d / 2 - over + t / 2));
  ctx.buckets.add(key, box(w + 2 * over, hgt, t, x, y, z + d / 2 + over - t / 2));
  ctx.buckets.add(key, box(t, hgt, d, x - w / 2 - over + t / 2, y, z));
  ctx.buckets.add(key, box(t, hgt, d, x + w / 2 + over - t / 2, y, z));
}

// Returns the texture u offset so window-aligned relief can find the painted windows.
function facade(ctx, style, w, h, d, x, y0, z) {
  const uOffset = ctx.rng.next();
  ctx.buckets.add(`facade_${style}`, tiledBox(w, h, d, x, y0 + h / 2, z, {
    uvScale: [FACADE_METERS[style], FLOOR_METERS], uOffset, faces: [0, 1, 4, 5],
  }));
  ctx.buckets.add('roof', tiledBox(w, h, d, x, y0 + h / 2, z, { uvScale: [8, 8], faces: [2] }));
  ctx.collision.addBox(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2, 'building');
  return uOffset;
}

function faceFrame(face, x, z, w, d) {
  // Returns position on the face center, outward normal, and the face width.
  if (face === 'n') return { px: x, pz: z - d / 2, nx: 0, nz: -1, width: w };
  if (face === 's') return { px: x, pz: z + d / 2, nx: 0, nz: 1, width: w };
  if (face === 'e') return { px: x + w / 2, pz: z, nx: 1, nz: 0, width: d };
  return { px: x - w / 2, pz: z, nx: -1, nz: 0, width: d };
}

function fireEscape(ctx, b) {
  const f = faceFrame(b.fireEscape, b.x, b.z, b.w, b.d);
  const along = { x: -f.nz, z: f.nx };
  const width = Math.min(6, f.width - 4);
  for (let y = 6.8; y < b.h - 3; y += 3.4) {
    const cx = f.px + f.nx * 0.7, cz = f.pz + f.nz * 0.7;
    const sx = Math.abs(along.x) > 0 ? width : 1.3, sz = Math.abs(along.z) > 0 ? width : 1.3;
    ctx.buckets.add('steel', box(sx, 0.08, sz, cx, y, cz));
    const rx = f.px + f.nx * 1.32, rz = f.pz + f.nz * 1.32;
    ctx.buckets.add('steel', box(Math.abs(along.x) > 0 ? width : 0.05, 0.05, Math.abs(along.z) > 0 ? width : 0.05, rx, y + 1, rz));
    for (const s of [-1, 1]) ctx.buckets.add('steel', box(0.05, 1, 0.05, rx + along.x * s * width / 2, y + 0.5, rz + along.z * s * width / 2));
    // Diagonal stair between landings.
    const stair = box(0.5, 0.06, 3.6, 0, 0, 0);
    stair.rotateX(0.75);
    if (Math.abs(along.x) > 0) stair.rotateY(Math.PI / 2);
    stair.translate(cx, y + 1.7, cz);
    ctx.buckets.add('steel', stair);
  }
}

const NEON_WORDS = ['CAFE', 'LIQUOR', 'TATTOO', 'ARCADE', 'KARAOKE', 'PIZZA', 'CLUB', 'MOTEL', 'RECORDS', 'COMICS', 'DANCE', 'BOWL', 'CINEMA', 'OPEN'];

// Neon signs: 'flat' against the facade, 'blade' projecting over the sidewalk (readable down the
// street), or 'marquee' (a theater canopy with chaser bulbs).
function neonSign(ctx, b, n) {
  const f = faceFrame(n.face, b.x, b.z, b.w, b.d);
  const color = NEON[n.color] ?? n.color;
  const css = '#' + new THREE.Color(color).getHexString();
  const mode = n.mode ?? (n.big ? 'flat' : 'blade');
  const along = { x: -f.nz, z: f.nx };
  const { texture, aspect } = neonTexture(n.text, css, { vertical: n.vertical });
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  let height, width, px, pz, yMid;
  const plane = new THREE.Mesh(undefined, mat);
  if (mode === 'blade') {
    height = n.vertical ? Math.min(b.h - n.y - 2, n.text.length * 1.25) : 1.5;
    width = height * aspect;
    const out = width / 2 + 0.5;
    px = f.px + f.nx * (n.vertical ? 1.3 : out) + along.x * (n.offset ?? 0);
    pz = f.pz + f.nz * (n.vertical ? 1.3 : out) + along.z * (n.offset ?? 0);
    yMid = n.y + height / 2;
    plane.geometry = new THREE.PlaneGeometry(width, height);
    plane.rotation.y = Math.atan2(along.x, along.z);
    // Dark backing panel and bracket, so the sign reads as a solid object in daylight colors.
    const bw = n.vertical ? 1.9 : width + 0.6;
    const back = box(Math.abs(f.nx) ? bw : 0.22, height + 0.5, Math.abs(f.nz) ? bw : 0.22, px - along.x * 0.14, yMid, pz - along.z * 0.14);
    ctx.buckets.add('steel', back);
    ctx.buckets.add('steel', box(Math.abs(f.nx) ? 1.4 : 0.08, 0.08, Math.abs(f.nz) ? 1.4 : 0.08, f.px + f.nx * 0.7 + along.x * (n.offset ?? 0), yMid + height / 2 + 0.35, f.pz + f.nz * 0.7 + along.z * (n.offset ?? 0)));
    // A second face so the sign reads from both directions.
    const twin = new THREE.Mesh(plane.geometry, mat);
    twin.position.set(px - along.x * 0.28, yMid, pz - along.z * 0.28);
    twin.rotation.y = plane.rotation.y + Math.PI;
    twin.layers.set(LAYER_FX);
    ctx.scene.add(twin);
  } else {
    height = n.big ? 3.2 : 1.8;
    width = height * aspect;
    const out = mode === 'marquee' ? 2.6 : 0.18;
    px = f.px + f.nx * out;
    pz = f.pz + f.nz * out;
    yMid = n.y + height / 2;
    plane.geometry = new THREE.PlaneGeometry(width, height);
    plane.rotation.y = Math.atan2(f.nx, f.nz);
    if (mode === 'marquee') {
      const cw = width + 2, cd = 2.6;
      const canopy = box(Math.abs(f.nz) ? cw : cd, 0.9, Math.abs(f.nx) ? cw : cd, f.px + f.nx * 1.3, n.y - 0.45, f.pz + f.nz * 1.3);
      ctx.buckets.add('painted', canopy, 0x2a1a2e);
      glow(ctx, box(Math.abs(f.nz) ? cw - 0.4 : 0.06, 0.5, Math.abs(f.nx) ? cw - 0.4 : 0.06, f.px + f.nx * 2.62, n.y - 0.45, f.pz + f.nz * 2.62), PALETTE.window);
      const bulbs = [];
      for (let t = -cw / 2 + 0.4; t < cw / 2; t += 0.8) {
        for (const yy of [n.y + 0.05, n.y + height + 0.4]) {
          const i = ctx.halos.add(px + along.x * t + f.nx * 0.1, yy, pz + along.z * t + f.nz * 0.1, PALETTE.window, 0.9);
          bulbs.push({ i, k: bulbs.length });
        }
      }
      ctx.updaters.push((t) => { for (const bb of bulbs) ctx.halos.setSize(bb.i, (Math.floor(t * 8) + bb.k) % 3 === 0 ? 0.25 : 1); });
      ctx.buckets.add('painted', box(Math.abs(f.nz) ? width + 0.8 : 0.3, height + 0.9, Math.abs(f.nx) ? width + 0.8 : 0.3, px - f.nx * 0.2, yMid + 0.2, pz - f.nz * 0.2), 0x1a1220);
    }
  }
  plane.position.set(px, yMid, pz);
  plane.layers.set(LAYER_FX);
  ctx.scene.add(plane);
  for (let k = 0; k < 3; k++) {
    const t = (k + 0.5) / 3 - 0.5;
    const vert = n.vertical;
    const hx = mode === 'blade' ? px + (vert ? 0 : along.x * t * width * 0.8) : px + f.nx * 0.4 + along.x * t * width * 0.8;
    const hz = mode === 'blade' ? pz + (vert ? 0 : along.z * t * width * 0.8) : pz + f.nz * 0.4 + along.z * t * width * 0.8;
    const hy = vert ? n.y + (k + 0.5) * (height / 3) : yMid;
    ctx.halos.add(hx, hy, hz, color, n.big ? 9 : 5);
  }
  lightSpot(ctx, f.px + f.nx * 3, yMid, f.pz + f.nz * 3, color, 24, 18);
  ctx.reflect.push({ x: px + f.nx * 0.3, y: 0.16, z: pz + f.nz * 0.3, h: yMid, color, w: n.big ? 1.1 : 0.55, len: 12, k: 0.5 });
  if (ctx.rng.chance(0.3)) ctx.flickers.push({ mat, phase: ctx.rng.range(0, 10) });
}

function billboard(ctx, b, bb) {
  const f = faceFrame(bb.face, b.x, b.z, b.w, b.d);
  const width = Math.min(16, f.width - 2), height = width * 0.39;
  const base = b.h + 2.4;
  const cx = f.px - f.nx * 1.5, cz = f.pz - f.nz * 1.5;
  const bg = ctx.rng.pick([PALETTE.containerRed, PALETTE.containerBlue, PALETTE.jokerPurple, PALETTE.rust, PALETTE.containerGreen]);
  const mat = new THREE.MeshToonMaterial({ map: billboardTexture(bb.text, bb.sub, bg), emissive: 0xffffff, emissiveIntensity: 0.25 });
  mat.emissiveMap = mat.map;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  panel.position.set(cx + f.nx * 0.12, base + height / 2, cz + f.nz * 0.12);
  panel.rotation.y = Math.atan2(f.nx, f.nz);
  panel.castShadow = true;
  ctx.scene.add(panel);
  const along = { x: -f.nz, z: f.nx };
  const bw = Math.abs(along.x) ? width : 0.3, bd = Math.abs(along.z) ? width : 0.3;
  solid(ctx, 'steel', box(bw, height, bd, cx, base + height / 2, cz));
  for (const s of [-0.4, 0.4]) solid(ctx, 'steel', box(0.25, base - b.h, 0.25, cx + along.x * s * width, b.h + (base - b.h) / 2, cz + along.z * s * width));
  ctx.buckets.add('steel', box(bw + 0.2, 0.1, bd + (Math.abs(f.nz) ? 1.2 : 0.2), cx + f.nx * 0.6, base - 0.05, cz + f.nz * 0.6));
  for (const s of [-0.33, 0, 0.33]) {
    const lx = cx + along.x * s * width + f.nx * 1.4, lz = cz + along.z * s * width + f.nz * 1.4;
    glow(ctx, box(0.4, 0.2, 0.4, lx, base - 0.2, lz), PALETTE.windowCool);
    ctx.halos.add(lx, base - 0.1, lz, PALETTE.windowCool, 1.6);
  }
  ctx.grapple.push({ x: cx, y: base + height, z: cz, nx: f.nx, nz: f.nz, perch: true });
}

// ---- roof props ----

export function waterTower(ctx, x, y, z) {
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) solid(ctx, 'steel', cylinder(0.12, 0.12, 3, x + lx * 1.5, y + 1.5, z + lz * 1.5, 6));
  ctx.buckets.add('steel', box(3.4, 0.15, 3.4, x, y + 3, z));
  // Tank staves run vertically: swap the plank texture's axes around the cylinder.
  const tank = cylinder(2.1, 2.1, 3.4, x, y + 4.7, z, 20);
  const tuv = tank.attributes.uv;
  for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getY(i) * 0.4, tuv.getX(i) * 5);
  solid(ctx, 'wood', tank);
  ctx.buckets.add('steel', cylinder(2.16, 2.16, 0.15, x, y + 4, z, 20, true));
  ctx.buckets.add('steel', cylinder(2.16, 2.16, 0.15, x, y + 5.6, z, 20, true));
  // A low, flat-topped cap: its collider top is the perch, so the hero stands on the roof of the tank.
  solid(ctx, 'roof', cylinder(0.9, 2.3, 0.6, x, y + 6.7, z, 20));
  ctx.buckets.add('steel', cylinder(0.08, 0.08, 0.9, x + 0.6, y + 7.4, z, 6));
  // Cross bracing between the legs and a ladder up the side.
  for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
    const len = Math.hypot(3, 3);
    const brace = new THREE.BoxGeometry(0.05, len, 0.05).rotateZ(Math.PI / 4);
    brace.rotateY(-Math.atan2(bz - az, bx - ax)).translate(x + (ax + bx) * 0.75, y + 1.5, z + (az + bz) * 0.75);
    ctx.buckets.add('steel', brace);
  }
  for (const s of [-0.25, 0.25]) ctx.buckets.add('steel', box(0.05, 6.4, 0.05, x + s, y + 3.2, z + 2.3));
  for (let k = 0.4; k < 6.3; k += 0.45) ctx.buckets.add('steel', box(0.5, 0.04, 0.04, x, y + k, z + 2.3));
  ctx.grapple.push({ x, y: y + 7, z, nx: 0, nz: 1, perch: true });
}

export function acUnit(ctx, x, y, z, big = false) {
  const w = big ? 3 : 2, d = big ? 2 : 1.4, hgt = big ? 1.5 : 1.2;
  solid(ctx, 'painted', box(w, hgt, d, x, y + hgt / 2, z), { color: 0x454b55 });
  ctx.buckets.add('painted', box(w + 0.12, 0.1, d + 0.12, x, y + hgt, z), 0x555c67);
  for (const fx of big ? [-0.65, 0.65] : [0]) {
    ctx.buckets.add('painted', cylinder(0.48, 0.48, 0.1, x + fx, y + hgt + 0.1, z, 14), 0x14151a);
    ctx.buckets.add('painted', box(0.9, 0.04, 0.06, x + fx, y + hgt + 0.16, z), 0x3a3f48);
  }
  // Louvers on both long sides.
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) ctx.buckets.add('painted', box(w * 0.78, 0.07, 0.03, x, y + 0.3 + k * 0.26, z + s * (d / 2 + 0.015)), 0x2a2d33);
  // A pipe running from the unit down into the roof.
  ctx.buckets.add('steel', cylinder(0.08, 0.08, 0.9, x + w / 2 + 0.15, y + 0.45, z, 6));
}

export function vent(ctx, x, y, z) {
  solid(ctx, 'steel', cylinder(0.35, 0.35, 1.3, x, y + 0.65, z, 10));
  ctx.buckets.add('steel', cylinder(0.05, 0.6, 0.4, x, y + 1.5, z, 10));
  if (ctx.rng.chance(0.35)) ctx.steam.push({ x, y: y + 1.6, z, s: 0.6 });
}

// A long sheet-metal duct on short legs, ending in an elbow that drops into the roof.
export function duct(ctx, x, y, z, len, alongX) {
  const sx = alongX ? len : 0.8, sz = alongX ? 0.8 : len;
  solid(ctx, 'painted', box(sx, 0.8, sz, x, y + 0.85, z), { color: 0x555b65 });
  for (let t = -len / 2 + 0.8; t < len / 2; t += 1.6) {
    ctx.buckets.add('painted', box(alongX ? 0.07 : 0.88, 0.88, alongX ? 0.88 : 0.07, x + (alongX ? t : 0), y + 0.85, z + (alongX ? 0 : t)), 0x4c515b);
    ctx.buckets.add('steel', box(alongX ? 0.06 : 0.7, 0.45, alongX ? 0.7 : 0.06, x + (alongX ? t : 0), y + 0.22, z + (alongX ? 0 : t)));
  }
  const ex = x + (alongX ? len / 2 : 0), ez = z + (alongX ? 0 : len / 2);
  ctx.buckets.add('painted', box(1, 1.3, 1, ex, y + 0.65, ez), 0x5d636d);
}

function hatch(ctx, x, y, z) {
  solid(ctx, 'painted', box(1.3, 0.5, 1.3, x, y + 0.25, z), { color: 0x3b4250 });
  ctx.buckets.add('painted', box(1.4, 0.08, 1.4, x, y + 0.54, z), 0x4b586e);
  ctx.buckets.add('steel', box(0.5, 0.06, 0.06, x, y + 0.62, z));
}

function dish(ctx, x, y, z) {
  solid(ctx, 'steel', cylinder(0.06, 0.08, 1.4, x, y + 0.7, z, 6));
  const a = ctx.rng.range(0, Math.PI * 2);
  const g = new THREE.SphereGeometry(0.75, 12, 6, 0, Math.PI * 2, 0, 0.9).rotateX(-1.1).rotateY(a).translate(x, y + 1.55, z);
  ctx.buckets.add('painted', g, 0x8c877d);
}

function skylight(ctx, x, y, z) {
  solid(ctx, 'trim', box(3.2, 0.5, 2.2, x, y + 0.25, z));
  if (ctx.rng.chance(0.45)) {
    ctx.buckets.add('glow', prism(3, 0.9, 2, x, y + 0.5, z), 0x7a5a32);
    ctx.halos.add(x, y + 1.2, z, PALETTE.window, 2.2);
  } else ctx.buckets.add('glass', prism(3, 0.9, 2, x, y + 0.5, z));
  // Muntins over the glass.
  for (let k = -1; k <= 1; k++) ctx.buckets.add('steel', prism(0.06, 0.93, 2.04, x + k, y + 0.5, z));
}

function hut(ctx, x, y, z, rot) {
  solid(ctx, 'concrete', box(3.2, 2.8, 3.2, x, y + 1.4, z));
  ctx.buckets.add('roof', box(3.5, 0.2, 3.5, x, y + 2.9, z));
  const dz = rot ? 1.61 : 0, dx = rot ? 0 : 1.61;
  ctx.buckets.add('painted', box(rot ? 1.1 : 0.05, 2.1, rot ? 0.05 : 1.1, x + dx, y + 1.05, z + dz), 0x1a1c22);
  glow(ctx, box(0.3, 0.15, 0.3, x + dx * 1.05, y + 2.4, z + dz * 1.05), PALETTE.window);
  ctx.halos.add(x + dx * 1.1, y + 2.4, z + dz * 1.1, PALETTE.window, 1.4);
  ctx.reflect.push({ x: x + dx * 1.2, y, z: z + dz * 1.2, h: 2.4, color: PALETTE.window, w: 0.5, len: 3.5, k: 0.5 });
}

function antenna(ctx, x, y, z, h) {
  solid(ctx, 'steel', cylinder(0.06, 0.1, h, x, y + h / 2, z, 6));
  for (let k = 1; k < 4; k++) ctx.buckets.add('steel', box(1.2 - k * 0.25, 0.04, 0.04, x, y + h * (k / 4), z));
  const i = ctx.halos.add(x, y + h + 0.1, z, PALETTE.balloon, 2.2);
  ctx.blinkers.push({ i, x, y: y + h + 0.1, z, size: 2.2, phase: ctx.rng.range(0, 3) });
}

function chimney(ctx, x, y, z) {
  solid(ctx, 'painted', box(1.1, 2.4, 1.1, x, y + 1.2, z), { color: PALETTE.brick });
  ctx.buckets.add('painted', box(1.3, 0.2, 1.3, x, y + 2.45, z), 0x3a2a24);
  ctx.buckets.add('painted', cylinder(0.22, 0.22, 0.5, x, y + 2.75, z, 8), 0x2a2420);
  ctx.steam.push({ x, y: y + 3, z, s: 0.8 });
}

// Keeps rooftop clutter off the story sites, the corners (deco crowns) and upper tiers.
const clearOfSites = (px, py, pz, r) => Object.values(SITES).every((s) => Math.abs(s.y - py) > 4 || Math.hypot(s.x - px, s.z - pz) > 7 + r);

function roofProps(ctx, b, x, z, w, d, y) {
  const rng = ctx.rng;
  const placed = [];
  const tier = b.tiers[0];
  const free = (px, pz, r) => placed.every((p) => Math.hypot(p.x - px, p.z - pz) > p.r + r)
    && Math.abs(px - x) < w / 2 - r - 1.9 && Math.abs(pz - z) < d / 2 - r - 1.9
    && !(Math.abs(px - x) > w / 2 - 3.2 - r && Math.abs(pz - z) > d / 2 - 3.2 - r)
    && !(tier && Math.abs(px - x) < tier.w / 2 + r + 0.5 && Math.abs(pz - z) < tier.d / 2 + r + 0.5)
    && clearOfSites(px, y, pz, r);
  const put = (r, fn) => {
    for (let t = 0; t < 12; t++) {
      const px = x + rng.range(-w / 2, w / 2), pz = z + rng.range(-d / 2, d / 2);
      if (free(px, pz, r)) { placed.push({ x: px, z: pz, r }); fn(px, pz); return true; }
    }
    return false;
  };
  const area = w * d;
  if (b.props === 'industrial') {
    for (let i = 0; i < area / 120; i++) put(1.6, (px, pz) => (rng.chance(0.4) ? vent(ctx, px, y, pz) : acUnit(ctx, px, y, pz, rng.chance(0.5))));
    for (let i = 0; i < 2; i++) {
      const alongX = rng.chance(0.5), len = rng.range(6, 12);
      put(len / 2 + 0.6, (px, pz) => duct(ctx, px, y, pz, len, alongX));
    }
    return;
  }
  if (rng.chance(['brick', 'stone'].includes(b.style) ? 0.6 : 0.3) && area > 300) put(3, (px, pz) => waterTower(ctx, px, y, pz));
  if (rng.chance(0.8)) put(2.4, (px, pz) => hut(ctx, px, y, pz, rng.chance(0.5)));
  for (let i = 0, n = rng.int(1, Math.max(1, Math.floor(area / 160))); i < n; i++) put(1.4, (px, pz) => acUnit(ctx, px, y, pz, rng.chance(0.3)));
  if (area > 350 && rng.chance(0.55)) {
    const alongX = rng.chance(0.5), len = rng.range(5, 10);
    put(len / 2 + 0.6, (px, pz) => duct(ctx, px, y, pz, len, alongX));
  }
  for (let i = 0, n = rng.int(1, 4); i < n; i++) put(0.6, (px, pz) => vent(ctx, px, y, pz));
  if (rng.chance(0.6)) put(0.9, (px, pz) => hatch(ctx, px, y, pz));
  if (rng.chance(0.3)) put(0.9, (px, pz) => dish(ctx, px, y, pz));
  if (['brick', 'deco', 'stone'].includes(b.style) && rng.chance(0.5)) put(2, (px, pz) => skylight(ctx, px, y, pz));
  if (b.style === 'brick' || (b.style === 'stone' && rng.chance(0.4))) for (let i = 0, n = rng.int(1, 2); i < n; i++) put(0.8, (px, pz) => chimney(ctx, px, y, pz));
  if (b.h > 30 && rng.chance(0.5)) put(0.5, (px, pz) => antenna(ctx, px, y, pz, rng.range(5, 12)));
}

// ---- buildings ----

function building(ctx, b) {
  const { x, z, w, d, h, style } = b;
  const uFacade = facade(ctx, style, w, h, d, x, 0, z);
  ctx.roofs.push({ id: b.id, x, z, w, d, y: h, district: b.district });
  if (b.storefront && h > 8) {
    const uShop = ctx.rng.next();
    // Pick one of the two painted rows of shops so neighbors are not identical.
    const row = ctx.rng.int(0, 1);
    const shopBox = tiledBox(w + 0.3, 4.2, d + 0.3, x, 0.15 + 2.1, z, { uvScale: [39, 4.2], uOffset: uShop, faces: [0, 1, 4, 5] });
    const suv = shopBox.attributes.uv;
    for (let i = 0; i < suv.count; i++) suv.setY(i, suv.getY(i) * 0.5 + (row === 0 ? 0.5 : 0));
    ctx.buckets.add('storefront', shopBox);
    ring(ctx, 'trim', x, z, w, d, 4.5, 0.4, 0.35);
    awnings(ctx, x, z, w, d, uShop, ctx.materials.storefront.userData.shops.slice(row * 6, row * 6 + 6));
  }
  facadeRelief(ctx, b, uFacade);
  if (b.cornice) {
    ring(ctx, 'trim', x, z, w, d, h - 0.3, 0.6, 0.4);
    if (h > 24) ring(ctx, 'trim', x, z, w, d, Math.round(h * 0.36), 0.35, 0.15);
  }
  if (b.parapet) parapet(ctx, x, z, w, d, h);
  if (b.roof === 'sawtooth') {
    for (let t = -d / 2 + 3; t < d / 2 - 2; t += 6) {
      ctx.buckets.add('roof', prism(w - 1, 2.2, 6, x, h, z + t, { sawtooth: true }));
      // North-light glazing on the steep face of each tooth; the chemical plant works nights.
      const pane = box(w - 2.2, 1.5, 0.06, x, h + 1.05, z + t - 3 - 0.04);
      if (b.district === 'ace' && ctx.rng.chance(0.4)) ctx.buckets.add('glow', pane, 0x283020);
      else ctx.buckets.add('painted', pane, 0x1c2331);
      for (let m = -w / 2 + 2; m < w / 2 - 1; m += 2.4) ctx.buckets.add('steel', box(0.08, 1.6, 0.1, x + m, h + 1.05, z + t - 3 - 0.06));
    }
    ctx.collision.addBox(x - w / 2, h, z - d / 2, x + w / 2, h + 1.1, z + d / 2, 'roof');
  }
  if (b.roof === 'pitched') {
    // Ridge runs along the long (z) axis.
    ctx.buckets.add('roof', prism(d, 10, w, 0, 0, 0).rotateY(Math.PI / 2).translate(x, h, z));
    ctx.collision.addBox(x - w / 2, h, z - d / 2, x + w / 2, h + 3, z + d / 2, 'roof');
    ctx.collision.addBox(x - w * 0.3, h + 3, z - d / 2, x + w * 0.3, h + 6, z + d / 2, 'roof');
    ctx.collision.addBox(x - w * 0.12, h + 6, z - d / 2, x + w * 0.12, h + 9, z + d / 2, 'roof');
  }
  const roofY = b.roof === 'sawtooth' ? h + 1.1 : h;
  edgeGrapples(ctx, x, z, w, d, roofY);

  let top = h;
  for (const t of b.tiers) {
    facade(ctx, style, t.w, t.h, t.d, x, top, z);
    ring(ctx, 'trim', x, z, t.w, t.d, top + t.h - 0.25, 0.5, 0.3);
    parapet(ctx, x, z, t.w, t.d, top + t.h, 0.7, 0.3);
    edgeGrapples(ctx, x, z, t.w, t.d, top + t.h);
    top += t.h;
    if (t.spire) {
      solid(ctx, 'steel', new THREE.ConeGeometry(Math.min(t.w, t.d) * 0.28, 14, 4).rotateY(Math.PI / 4).translate(x, top + 7, z));
      antenna(ctx, x, top + 14, z, 4);
    }
  }
  if (style === 'deco' && !b.landmark && top > 30) {
    const last = b.tiers[b.tiers.length - 1];
    if (!last?.spire) decoCrown(ctx, x, z, last ? last.w : w, last ? last.d : d, top, solid);
  }
  if (b.fireEscape && h > 12) fireEscape(ctx, b);
  for (const n of b.neon) neonSign(ctx, b, n);
  if (b.district === 'neon' && b.fireEscape && b.h > 10) {
    const face = b.fireEscape;
    const span = (face === 'e' || face === 'w' ? b.d : b.w) / 2 - 2.5;
    for (let k = 0, n = ctx.rng.int(1, 2); k < n; k++) {
      neonSign(ctx, b, {
        text: ctx.rng.pick(NEON_WORDS), face, y: ctx.rng.range(4.8, 9), color: ctx.rng.pick(['pink', 'cyan', PALETTE.signal, PALETTE.chem]),
        vertical: ctx.rng.chance(0.4), offset: ctx.rng.range(-span, span),
      });
    }
  }
  if (b.billboard) billboard(ctx, b, b.billboard);
  if (b.props === 'auto' || b.props === 'industrial') {
    const tw = b.tiers.length ? w : w, td = d;
    roofProps(ctx, b, x, z, tw, td, h);
  }
}

// ---- streets ----

function streetLamp(ctx, x, z, nx, nz) {
  solid(ctx, 'steel', cylinder(0.09, 0.14, 6.2, x, 3.1, z, 8));
  const hx = x + nx * 1.4, hz = z + nz * 1.4;
  ctx.buckets.add('steel', box(Math.abs(nx) ? 1.5 : 0.1, 0.1, Math.abs(nz) ? 1.5 : 0.1, x + nx * 0.7, 6.15, z + nz * 0.7));
  ctx.buckets.add('steel', box(0.75, 0.22, 0.75, hx, 6.22, hz));
  glow(ctx, box(0.55, 0.12, 0.55, hx, 6.06, hz), PALETTE.sodium);
  ctx.halos.add(hx, 5.9, hz, PALETTE.sodium, 3.2);
  lightSpot(ctx, hx, 5.6, hz, PALETTE.sodium, 26, 17);
  ctx.reflect.push({ x: hx, y: 0.16, z: hz, h: 6, color: PALETTE.sodium, w: 0.45, len: 9, k: 0.34 });
  // A shaft of lamplight through the rain (color pass only, skipped on Low).
  if (ctx.quality?.name !== 'low') ctx.buckets.add('cone', new THREE.CylinderGeometry(0.3, 2.7, 5.9, 14, 1, true).translate(hx, 6.0 - 2.95, hz));
  const pool = new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2).translate(hx, 0.03, hz);
  ctx.buckets.add('pool', pool, 0x6b4520);
}

function parkedCar(ctx, x, z, alongX) {
  const color = ctx.rng.pick(CAR_COLORS);
  const L = 4.4, W = 1.9;
  const sx = alongX ? L : W, sz = alongX ? W : L;
  solid(ctx, 'painted', box(sx, 0.8, sz, x, 0.7, z), { color });
  ctx.buckets.add('painted', box(alongX ? 2.3 : 1.7, 0.65, alongX ? 1.7 : 2.3, x, 1.42, z), color);
  ctx.buckets.add('glass', box(alongX ? 2.35 : 1.5, 0.45, alongX ? 1.5 : 2.35, x, 1.45, z));
  for (const a of [-1, 1]) for (const s of [-1, 1]) {
    const wx = x + (alongX ? a * 1.4 : s * 0.95), wz = z + (alongX ? s * 0.95 : a * 1.4);
    const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 10).rotateX(alongX ? Math.PI / 2 : 0).rotateZ(alongX ? 0 : Math.PI / 2).translate(wx, 0.36, wz);
    ctx.buckets.add('painted', wheel, 0x111216);
  }
  for (const s of [-1, 1]) {
    const tx = x + (alongX ? -L / 2 : s * 0.7), tz = z + (alongX ? s * 0.7 : -L / 2);
    glow(ctx, box(0.12, 0.14, 0.12, tx, 0.85, tz), 0x5a1414);
  }
}

function streets(ctx) {
  const { rng } = ctx;
  // Ground: asphalt everywhere on land, the harbor is water (see water.js).
  const landD = WORLD.waterZ - WORLD.minZ - 4;
  ctx.buckets.add('asphalt', tiledBox(WORLD.maxX - WORLD.minX + 8, 0.2, landD + 8, 0, -0.1, WORLD.minZ + landD / 2, { uvScale: [17, 17], faces: [2] }));
  // Seawall along the harbor.
  solid(ctx, 'concrete', box(WORLD.maxX - WORLD.minX + 8, 1.4, 3, 0, -0.5, WORLD.waterZ - 1.5), { collide: false });

  for (const cx of GRID.centers) {
    for (const cz of GRID.centers) {
      const inAce = cx > 36 && cz < -95, inClock = cx < -36 && cz < -95;
      if (!inAce && !inClock) {
        solid(ctx, 'sidewalk', tiledBox(GRID.block, 0.15, GRID.block, cx, 0.075, cz, { uvScale: [4, 4] }), { tag: 'sidewalk' });
        // Lamps on the block corners and edge midpoints, facing the street.
        const e = GRID.block / 2 - 0.8;
        for (const [lx, lz, nx, nz] of [[-e, -e, 0, -1], [e, -e, 1, 0], [e, e, 0, 1], [-e, e, -1, 0], [0, -e, 0, -1], [e, 0, 1, 0], [0, e, 0, 1], [-e, 0, -1, 0]]) {
          if (cz + lz > WORLD.waterZ - 4) continue;
          streetLamp(ctx, cx + lx, cz + lz, nx, nz);
        }
        // Parked cars along the curbs.
        for (let k = 0; k < rng.int(0, 5); k++) {
          const side = rng.int(0, 3);
          const t = rng.range(-15, 15);
          const off = GRID.block / 2 + 2.2;
          if (side === 0) parkedCar(ctx, cx + t, cz - off, true);
          else if (side === 1) parkedCar(ctx, cx + t, cz + off, true);
          else if (side === 2) parkedCar(ctx, cx - off, cz + t, false);
          else parkedCar(ctx, cx + off, cz + t, false);
        }
      }
    }
  }
  // Lane dashes and crosswalks.
  const lines = [-210, -150, -90, -30, 30, 90, 150, 210];
  for (const L of lines) {
    for (let t = WORLD.minZ; t < WORLD.waterZ - 6; t += 8) {
      if (lines.some((q) => Math.abs(t - q) < 9)) continue;
      if (districtAt(L, t) === 'ace' && t < -97 && L > 36) continue;
      if (districtAt(L, t) === 'clock' && t < -97 && L < -36) continue;
      ctx.buckets.add('lane', new THREE.PlaneGeometry(0.25, 3.5).rotateX(-Math.PI / 2).translate(L, 0.02, t));
    }
    for (let t = WORLD.minX; t < WORLD.maxX; t += 8) {
      if (lines.some((q) => Math.abs(t - q) < 9)) continue;
      if (L < -97 && ((t > 36 && L < -95) || (t < -36 && L < -95))) continue;
      ctx.buckets.add('lane', new THREE.PlaneGeometry(3.5, 0.25).rotateX(-Math.PI / 2).translate(t, 0.02, L));
    }
  }
  for (const a of lines) for (const c of lines) {
    if (c > WORLD.waterZ - 8) continue;
    for (let s = -5; s <= 5; s += 1.4) {
      ctx.buckets.add('lane', new THREE.PlaneGeometry(0.7, 3).rotateX(-Math.PI / 2).translate(a + s, 0.02, c - 8.6));
      ctx.buckets.add('lane', new THREE.PlaneGeometry(3, 0.7).rotateX(-Math.PI / 2).translate(a - 8.6, 0.02, c + s));
    }
  }
}

function wires(ctx) {
  const pts = [];
  for (const r of ctx.roofs) {
    if (r.y < 10) continue;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push({ x: r.x + sx * (r.w / 2 - 0.4), y: r.y + 1.4, z: r.z + sz * (r.d / 2 - 0.4), id: r.id });
  }
  const verts = [];
  for (let i = 0; i < pts.length; i++) {
    if (!ctx.rng.chance(0.18)) continue;
    const a = pts[i];
    const b = pts.find((p) => p.id !== a.id && Math.hypot(p.x - a.x, p.z - a.z) > 14 && Math.hypot(p.x - a.x, p.z - a.z) < 34 && Math.abs(p.y - a.y) < 10);
    if (!b) continue;
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const sag = dist * 0.07;
    let prev = null;
    for (let s = 0; s <= 14; s++) {
      const t = s / 14;
      const p = [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t), a.z + (b.z - a.z) * t];
      if (prev) verts.push(...prev, ...p);
      prev = p;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: PALETTE.ink }));
  lines.layers.set(LAYER_FX);
  ctx.scene.add(lines);
}

export function graffiti(ctx, x, y, z, nx, nz, size = 5, text = 'HA HA HA') {
  const mat = new THREE.MeshBasicMaterial({ map: graffitiTexture(ctx.rng, text), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size / 2), mat);
  m.position.set(x + nx * 0.05, y, z + nz * 0.05);
  if (Math.abs(nx) + Math.abs(nz) < 0.5) { m.rotation.x = -Math.PI / 2; m.position.y = y + 0.03; }
  else m.rotation.y = Math.atan2(nx, nz);
  m.layers.set(LAYER_FX);
  ctx.scene.add(m);
}

export function buildCity(ctx, data) {
  streets(ctx);
  for (const b of data.buildings) building(ctx, b);
  wires(ctx);
  dressStreets(ctx);
  return ctx;
}

// Drops grapple points whose landing spot is buried in something solid (a landing inside a box
// would shove the hero off, or drop them through the city).
function pruneGrapples(ctx) {
  const keep = ctx.grapple.filter((p) => {
    const k = p.perch ? 0 : -1.1;
    const lx = p.x + (p.nx ?? 0) * k, lz = p.z + (p.nz ?? 0) * k;
    return !ctx.collision.query(lx - 0.2, lz - 0.2, lx + 0.2, lz + 0.2).some((b) =>
      b.maxY > p.y + 0.5 && b.minY < p.y + 1.8 && lx > b.minX - 0.2 && lx < b.maxX + 0.2 && lz > b.minZ - 0.2 && lz < b.maxZ + 0.2);
  });
  ctx.grapple.length = 0;
  ctx.grapple.push(...keep);
}

export function finishCity(ctx) {
  pruneGrapples(ctx);
  ctx.buckets.flush(ctx.scene);
  // Everything built so far stands still (signs, decals, wires): freeze their matrices so the
  // renderer stops recomposing them every pass. Movers opt out with userData.dynamic.
  for (const o of ctx.scene.children) {
    if (o.userData.dynamic || !o.matrixAutoUpdate) continue;
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  }
  ctx.updaters.push((t) => {
    for (const b of ctx.blinkers) ctx.halos.setSize(b.i, Math.sin(t * 2 + b.phase) > 0.2 ? b.size : 0.01);
    for (const f of ctx.flickers) f.mat.opacity = Math.sin(t * 23 + f.phase) > -0.93 || Math.sin(t * 1.3 + f.phase) > 0 ? 1 : 0.25;
  });
}
