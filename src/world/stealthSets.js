// The predator rooms' scenery, built into the city at boot from src/stealth/stealthRooms.js (the
// same data the stealth runtime reads, so a lamp here is a light pool there): catwalk decks and
// posts, perch columns with gargoyles, crates and planters, rails, lamps, doorways and the
// steaming floor vent. Everything goes into the city buckets, so it batches and warms with the city.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { box } from './buckets.js';
import { solid, glow, lightSpot, edgeGrapples } from './cityBuilder.js';
import { addGargoyle, plinth } from './gargoyles.js';
import { ROOMS } from '../stealth/stealthRooms.js';

const CRATE = 0x6b4a2e, CRATE_BAND = 0x3a2616, PLANTER = 0x6a655d, LEAVES = 0x1f3a26;
const DOOR = 0x241c2c, TRANSOM = 0xffd58a, COLUMN = 0x3d4148, LAMP = 0x2b2b30;

export function buildStealthSets(ctx, rooms = ROOMS) {
  for (const room of Object.values(rooms)) {
    for (const d of room.decks) deck(ctx, d);
    for (const p of room.posts) solid(ctx, 'steel', box(0.2, p.y1 - p.y0, 0.2, p.x, (p.y0 + p.y1) / 2, p.z), { tag: 'stealthPost' });
    for (const c of room.columns) column(ctx, c);
    for (const p of room.perches) {
      if (p.plinth !== undefined) plinth(ctx, p.x, p.plinth, p.z);
      addGargoyle(ctx, p.x, p.y, p.z, p.yaw);
    }
    for (const c of room.cover) (c.kind === 'planter' ? planter : crate)(ctx, c);
    for (const r of room.rails) rail(ctx, r);
    for (const l of room.lights) if (l.lamp) lamp(ctx, l);
    for (const d of room.doors) door(ctx, d);
    if (room.vent) vent(ctx, room.vent);
  }
}

function deck(ctx, d) {
  const w = d.maxX - d.minX, dd = d.maxZ - d.minZ, cx = (d.minX + d.maxX) / 2, cz = (d.minZ + d.maxZ) / 2;
  solid(ctx, 'steel', box(w, d.t, dd, cx, d.y - d.t / 2, cz), { tag: 'stealthDeck' });
  if (d.kind === 'balcony') {
    // A stone lip along the outer edge, and corbels against the wall every 4 m.
    ctx.buckets.add('trim', box(0.3, 0.35, dd, d.maxX - 0.15, d.y - d.t - 0.1, cz));
    for (let z = d.minZ + 2; z < d.maxZ; z += 4) ctx.buckets.add('trim', box(0.5, 0.9, 0.4, d.minX + 0.25, d.y - d.t - 0.45, z));
  } else {
    // Catwalk grating: inked slats across the walk (paint only).
    const along = w > dd, span = along ? w : dd;
    for (let t = -span / 2 + 0.3; t < span / 2; t += 0.6) {
      ctx.buckets.add('painted', box(along ? 0.06 : w, 0.01, along ? dd : 0.06, along ? cx + t : cx, d.y + 0.006, along ? cz : cz + t), PALETTE.ink);
    }
  }
  // Grapple points to land on (or, holding back, hang from) the edge.
  if (d.grapples === 'x+') for (let z = d.minZ + 3; z < d.maxZ; z += 6) ctx.grapple.push({ x: d.maxX, y: d.y, z, nx: 1, nz: 0 });
  else edgeGrapples(ctx, cx, cz, w, dd, d.y, 6);
}

function column(ctx, c) {
  solid(ctx, 'painted', box(1, c.top - c.y0, 1, c.x, (c.top + c.y0) / 2, c.z), { color: COLUMN, tag: 'stealthColumn' });
  for (let y = c.y0 + 2; y < c.top; y += 2) ctx.buckets.add('steel', box(1.08, 0.12, 1.08, c.x, y, c.z));
}

function crate(ctx, c) {
  solid(ctx, 'painted', box(c.w, c.h, c.d, c.x, c.y + c.h / 2, c.z), { color: CRATE, tag: 'stealthCover' });
  for (const k of [0.25, 0.75]) ctx.buckets.add('painted', box(c.w + 0.03, 0.1, c.d + 0.03, c.x, c.y + c.h * k, c.z), CRATE_BAND);
}

function planter(ctx, c) {
  solid(ctx, 'painted', box(c.w, c.h, c.d, c.x, c.y + c.h / 2, c.z), { color: PLANTER, tag: 'stealthCover' });
  ctx.buckets.add('painted', new THREE.IcosahedronGeometry(c.w * 0.55, 0).scale(1, 0.7, 1).translate(c.x, c.y + c.h + 0.25, c.z), LEAVES);
}

// Rails are paint only: goons keep to their routes, and Batman may vault or drop over the edge.
function rail(ctx, r) {
  const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1), yaw = Math.atan2(r.x2 - r.x1, r.z2 - r.z1);
  const mx = (r.x1 + r.x2) / 2, mz = (r.z1 + r.z2) / 2;
  ctx.buckets.add('steel', new THREE.BoxGeometry(0.06, 0.06, len).rotateY(yaw).translate(mx, r.y + 1.0, mz));
  ctx.buckets.add('steel', new THREE.BoxGeometry(0.04, 0.04, len).rotateY(yaw).translate(mx, r.y + 0.5, mz));
  const n = Math.max(1, Math.round(len / 1.5));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    ctx.buckets.add('steel', box(0.05, 1.0, 0.05, r.x1 + (r.x2 - r.x1) * k, r.y + 0.5, r.z1 + (r.z2 - r.z1) * k));
  }
}

function lamp(ctx, l) {
  let bx = l.x;
  if (l.lamp === 'post') {
    solid(ctx, 'painted', box(0.3, l.y - l.base, 0.3, l.x, (l.y + l.base) / 2, l.z), { color: LAMP, tag: 'stealthLamp' });
    ctx.buckets.add('painted', new THREE.ConeGeometry(0.55, 0.35, 12, 1, true).translate(l.x, l.y + 0.1, l.z), LAMP);
  } else {
    // A wall lamp: a bracket off the facade and a hood.
    bx = l.x + 0.3;
    ctx.buckets.add('painted', box(0.6, 0.08, 0.08, l.x, l.y + 0.2, l.z), LAMP);
    ctx.buckets.add('painted', new THREE.ConeGeometry(0.35, 0.3, 10, 1, true).translate(bx, l.y + 0.1, l.z), LAMP);
  }
  glow(ctx, new THREE.SphereGeometry(0.16, 10, 6).translate(bx, l.y - 0.05, l.z), PALETTE.sodium);
  ctx.halos.add(bx, l.y - 0.05, l.z, PALETTE.sodium, 5);
  lightSpot(ctx, bx, l.y - 0.2, l.z, PALETTE.sodium, 22, l.r * 2.6);
}

// Double doors painted flush on an east-facing facade (x = d.x), a warm transom, a stone frame.
function door(ctx, d) {
  ctx.buckets.add('painted', new THREE.PlaneGeometry(1.8, 2.7).rotateY(Math.PI / 2).translate(d.x + 0.03, d.y + 1.35, d.z), DOOR);
  glow(ctx, new THREE.PlaneGeometry(1.8, 0.35).rotateY(Math.PI / 2).translate(d.x + 0.035, d.y + 2.95, d.z), TRANSOM);
  for (const s of [-1, 1]) ctx.buckets.add('trim', box(0.12, 3.25, 0.15, d.x + 0.06, d.y + 1.62, d.z + s * 1.0));
  ctx.buckets.add('trim', box(0.12, 0.15, 2.15, d.x + 0.06, d.y + 3.25, d.z));
}

// A floor grate breathing chemical steam: Batman crouched in it can't be seen (vision.js).
function vent(ctx, v) {
  ctx.buckets.add('steel', box(v.w + 0.3, 0.05, v.d + 0.3, v.x, v.y + 0.02, v.z));
  for (let i = 0; i < 9; i++) ctx.buckets.add('painted', box(v.w, 0.02, 0.1, v.x, v.y + 0.055, v.z - v.d / 2 + 0.15 + i * ((v.d - 0.3) / 8)), PALETTE.ink);
  // A low bank of puffs over the whole grate (world.js draws `vent` steam with its own look:
  // denser, inked, hugging the floor and breathing), so the hiding spot reads from across the hall.
  for (const [dx, dz, s] of [[0, 0, 1.0], [-0.9, 0.7, 0.8], [0.9, -0.7, 0.8], [0.7, 0.9, 0.7], [-0.8, -0.8, 0.7], [0, -1.1, 0.6], [0, 1.1, 0.6]]) {
    ctx.steam.push({ x: v.x + dx, y: v.y + 0.1, z: v.z + dz, s, vent: true });
  }
}
