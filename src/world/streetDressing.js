// Street furniture and grime: hydrants, newspaper boxes, trash, phone booths, benches, mailboxes,
// traffic lights, manholes (some steaming) and puddles. Merged through the buckets; anything you
// could walk into gets a collision box. Story sites are kept clear.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { GRID, WORLD, SITES } from './mapData.js';
import { box, cylinder } from './buckets.js';
import { bareTree } from './trees.js';
import { districtAt } from './mapData.js';

const CURB = GRID.block / 2 - 0.75;   // curb-side props
const WALL = 20.3;                      // wall-side props (buildings end at 19.5-20)
const LAMP_E = GRID.block / 2 - 0.8;    // lamp posts, see cityBuilder.streets

function addSolid(ctx, key, geo, color) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  ctx.collision.addBox(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z, 'prop');
  ctx.buckets.add(key, geo, color);
}

// Rotates a prop built around the origin so its local +z faces the street, then places it.
function place(geo, x, y, z, nx, nz) {
  return geo.rotateY(Math.atan2(nx, nz)).translate(x, y, z);
}

function hydrant(ctx, x, z) {
  const c = PALETTE.containerRed;
  ctx.buckets.add('painted', cylinder(0.17, 0.2, 0.55, x, 0.15 + 0.3, z, 10), c);
  ctx.buckets.add('painted', cylinder(0.24, 0.24, 0.08, x, 0.15 + 0.6, z, 10), c);
  ctx.buckets.add('painted', new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, 0.15 + 0.64, z), c);
  ctx.buckets.add('painted', new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8).rotateZ(Math.PI / 2).translate(x, 0.15 + 0.42, z), 0x5a2a24);
  ctx.collision.addBox(x - 0.25, 0.15, z - 0.25, x + 0.25, 0.95, z + 0.25, 'prop');
}

function newsBoxes(ctx, x, z, nx, nz) {
  const colors = [PALETTE.containerBlue, PALETTE.containerRed, 0x6a6048, PALETTE.containerGreen];
  const along = { x: -nz, z: nx };
  const n = ctx.rng.int(2, 3);
  for (let k = 0; k < n; k++) {
    const o = (k - (n - 1) / 2) * 0.58;
    const px = x + along.x * o, pz = z + along.z * o;
    const body = new THREE.BoxGeometry(0.52, 1.0, 0.46);
    addSolid(ctx, 'painted', place(body, px, 0.15 + 0.5, pz, nx, nz), ctx.rng.pick(colors));
    ctx.buckets.add('glass', place(new THREE.BoxGeometry(0.4, 0.3, 0.02), px, 0.15 + 0.78, pz, nx, nz).translate(nx * 0.235, 0, nz * 0.235));
    ctx.buckets.add('painted', place(new THREE.BoxGeometry(0.56, 0.05, 0.5), px, 0.15 + 1.02, pz, nx, nz), 0x1e2026);
  }
}

function trashBags(ctx, x, z) {
  for (let k = 0, n = ctx.rng.int(2, 5); k < n; k++) {
    const r = ctx.rng.range(0.2, 0.32);
    const g = new THREE.IcosahedronGeometry(r, 0).scale(1, ctx.rng.range(0.6, 0.85), 1).rotateY(ctx.rng.range(0, 3));
    g.translate(x + ctx.rng.range(-0.5, 0.5), 0.15 + r * 0.55, z + ctx.rng.range(-0.5, 0.5));
    ctx.buckets.add('painted', g, ctx.rng.pick([0x23262d, 0x2b2e36, 0x33312c]));
  }
}

function trashCan(ctx, x, z) {
  addSolid(ctx, 'steel', cylinder(0.3, 0.26, 0.95, x, 0.15 + 0.47, z, 12));
  ctx.buckets.add('painted', cylinder(0.33, 0.33, 0.06, x, 0.15 + 0.97, z, 12), 0x5a5d63);
  ctx.buckets.add('steel', cylinder(0.31, 0.31, 0.05, x, 0.15 + 0.7, z, 12, true));
}

function mailbox(ctx, x, z, nx, nz) {
  addSolid(ctx, 'painted', place(new THREE.BoxGeometry(0.5, 0.85, 0.45), x, 0.15 + 0.55, z, nx, nz), PALETTE.containerBlue);
  ctx.buckets.add('painted', place(new THREE.CylinderGeometry(0.25, 0.25, 0.45, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), x, 0.15 + 0.97, z, nx, nz), PALETTE.containerBlue);
  for (const s of [-1, 1]) ctx.buckets.add('steel', place(new THREE.BoxGeometry(0.06, 0.25, 0.06).translate(s * 0.2, 0, 0), x, 0.15 + 0.12, z, nx, nz));
}

function bench(ctx, x, z, nx, nz) {
  addSolid(ctx, 'wood', place(new THREE.BoxGeometry(1.8, 0.07, 0.45).translate(0, 0.45, 0), x, 0.15, z, nx, nz));
  ctx.buckets.add('wood', place(new THREE.BoxGeometry(1.8, 0.4, 0.06).translate(0, 0.75, -0.24).rotateX(-0.12), x, 0.15, z, nx, nz));
  for (const s of [-0.75, 0.75]) ctx.buckets.add('steel', place(new THREE.BoxGeometry(0.06, 0.45, 0.4).translate(s, 0.22, 0), x, 0.15, z, nx, nz));
}

function phoneBooth(ctx, x, z, nx, nz) {
  const frame = 0x2c3a52;
  addSolid(ctx, 'painted', box(1.0, 0.12, 1.0, x, 0.15 + 0.06, z), frame);
  ctx.buckets.add('painted', box(1.06, 0.3, 1.06, x, 0.15 + 2.35, z), frame);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.buckets.add('painted', box(0.08, 2.2, 0.08, x + sx * 0.47, 0.15 + 1.2, z + sz * 0.47), frame);
  // Lit glass on three sides, open on the street side.
  const glassCol = 0x55657d;
  for (const [gx, gz, w, d] of [[0.47, 0, 0.03, 0.86], [-0.47, 0, 0.03, 0.86], [0, 0.47, 0.86, 0.03], [0, -0.47, 0.86, 0.03]]) {
    if (Math.abs(gx) > 0 ? Math.sign(gx) === nx : Math.sign(gz) === nz) continue;
    ctx.buckets.add('glow', box(w, 1.5, d, x + gx, 0.15 + 1.35, z + gz), glassCol);
  }
  ctx.buckets.add('glow', box(1.08, 0.12, 1.08, x, 0.15 + 2.28, z), PALETTE.windowCool);
  ctx.buckets.add('painted', box(0.3, 0.4, 0.2, x - nx * 0.3, 0.15 + 1.5, z - nz * 0.3), 0x16171c);
  ctx.collision.addBox(x - 0.5, 0.15, z - 0.5, x + 0.5, 2.6, z + 0.5, 'prop');
  ctx.halos.add(x, 0.15 + 2.3, z, PALETTE.windowCool, 2.4);
  ctx.reflect.push({ x, y: 0.16, z, h: 2.3, color: PALETTE.windowCool, w: 0.9, len: 5, k: 0.35 });
}

// Traffic light on a mast arm reaching over the street (nx, nz: the direction it reaches).
function trafficLight(ctx, x, z, nx, nz, phase) {
  ctx.collision.addBox(x - 0.15, 0.15, z - 0.15, x + 0.15, 6.3, z + 0.15, 'prop');
  ctx.buckets.add('steel', cylinder(0.12, 0.15, 6.2, x, 0.15 + 3.1, z, 8));
  const reach = 4.6;
  ctx.buckets.add('steel', box(Math.abs(nx) ? reach : 0.1, 0.1, Math.abs(nz) ? reach : 0.1, x + nx * reach / 2, 6.1, z + nz * reach / 2));
  const hx = x + nx * (reach - 0.3), hz = z + nz * (reach - 0.3);
  ctx.buckets.add('painted', box(0.4, 1.15, 0.4, hx, 5.35, hz), 0x1e2026);
  ctx.buckets.add('painted', box(0.5, 0.05, 0.5, hx, 5.95, hz), 0x1e2026);
  const lamps = [[PALETTE.balloon, 5.72], [PALETTE.sodium, 5.35], [PALETTE.neonCyan, 4.98]];
  const ids = lamps.map(([col, y]) => {
    for (const s of [-1, 1]) ctx.buckets.add('painted', box(Math.abs(nx) ? 0.22 : 0.02, 0.22, Math.abs(nz) ? 0.22 : 0.02, hx - nz * s * 0.21, y, hz + nx * s * 0.21), 0x0e0f13);
    return ctx.halos.add(hx, y, hz, col, 0.01);
  });
  // A small pedestrian signal on the pole.
  ctx.buckets.add('painted', box(0.3, 0.35, 0.3, x, 3.0, z), 0x1e2026);
  const walk = ctx.halos.add(x, 3.0, z, PALETTE.sodium, 0.9);
  return { ids, walk, phase };
}

function streetTree(ctx, x, z) {
  ctx.buckets.add('painted', box(1.3, 0.06, 1.3, x, 0.16, z), 0x1b1a18);
  for (const g of bareTree(ctx.rng, x, 0.15, z, ctx.rng.range(0.9, 1.25), 3)) ctx.buckets.add('painted', g, 0x201c1c);
  ctx.collision.addBox(x - 0.25, 0.15, z - 0.25, x + 0.25, 3, z + 0.25, 'tree');
}

function manhole(ctx, x, z) {
  ctx.buckets.add('painted', cylinder(0.5, 0.5, 0.04, x, 0.01, z, 18), 0x2e3139);
  ctx.buckets.add('painted', cylinder(0.38, 0.38, 0.05, x, 0.012, z, 18), 0x17181d);
  if (ctx.rng.chance(0.55)) ctx.steam.push({ x, y: 0.2, z, s: 1.25 });
}

function puddle(ctx, x, y, z, size) {
  const v = ctx.rng.int(0, 3);
  const g = new THREE.PlaneGeometry(size, size * ctx.rng.range(0.5, 0.8)).rotateX(-Math.PI / 2).rotateY(ctx.rng.range(0, Math.PI));
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5 + (v % 2) * 0.5, uv.getY(i) * 0.5 + Math.floor(v / 2) * 0.5);
  ctx.buckets.add('puddle', g.translate(x, y, z));
}

export function dressStreets(ctx) {
  const { rng } = ctx;
  const lights = [];
  const siteClear = (px, pz, r) => Object.values(SITES).every((s) => s.y > 3 || Math.hypot(s.x - px, s.z - pz) > 7 + r)
    && Math.hypot(158.7 - px, -60 - pz) > 3;
  for (const cx of GRID.centers) {
    for (const cz of GRID.centers) {
      const inAce = cx > 36 && cz < -95, inClock = cx < -36 && cz < -95;
      if (inAce || inClock) continue;
      const lampNear = (px, pz) => [-LAMP_E, 0, LAMP_E].some((lx) => [-LAMP_E, 0, LAMP_E].some((lz) => (lx || lz) && Math.hypot(cx + lx - px, cz + lz - pz) < 1.6));
      const ok = (px, pz, r) => pz < WORLD.waterZ - 5 && siteClear(px, pz, r) && !lampNear(px, pz)
        && ctx.collision.groundBelow(px, 3, pz, r) < 0.3;
      // Sidewalk edges: (nx, nz) is the outward normal toward the street.
      for (const [nx, nz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const along = { x: -nz, z: nx };
        const at = (t, off) => [cx + nx * off + along.x * t, cz + nz * off + along.z * t];
        const tryPut = (off, r, fn) => {
          for (let k = 0; k < 6; k++) {
            const t = rng.range(-18, 18);
            const [px, pz] = at(t, off);
            if (ok(px, pz, r)) { fn(px, pz); return true; }
          }
          return false;
        };
        if (rng.chance(0.55)) tryPut(CURB, 0.4, (px, pz) => hydrant(ctx, px, pz));
        if (rng.chance(0.35)) tryPut(CURB - 0.2, 1, (px, pz) => newsBoxes(ctx, px, pz, nx, nz));
        if (rng.chance(0.6)) tryPut(WALL + 0.4, 0.9, (px, pz) => trashBags(ctx, px, pz));
        if (rng.chance(0.4)) tryPut(CURB - 0.3, 0.4, (px, pz) => trashCan(ctx, px, pz));
        if (rng.chance(0.15)) tryPut(CURB - 0.2, 0.4, (px, pz) => mailbox(ctx, px, pz, nx, nz));
        if (rng.chance(0.18)) tryPut(CURB - 0.6, 1, (px, pz) => bench(ctx, px, pz, -nx, -nz));
        if (rng.chance(0.1)) tryPut(CURB - 0.5, 0.7, (px, pz) => phoneBooth(ctx, px, pz, nx, nz));
        if (districtAt(cx, cz) === 'city' && rng.chance(0.3)) tryPut(CURB - 0.4, 1.2, (px, pz) => streetTree(ctx, px, pz));
        // Puddles: a couple on the sidewalk, more in the gutter and the road.
        for (let k = 0; k < 2; k++) {
          const [px, pz] = at(rng.range(-20, 20), rng.range(20.5, 22.5));
          if (pz < WORLD.waterZ - 5 && siteClear(px, pz, 0)) puddle(ctx, px, 0.165, pz, rng.range(0.9, 1.8));
        }
        for (let k = 0; k < 3; k++) {
          const [px, pz] = at(rng.range(-24, 24), rng.range(23.6, 36));
          if (pz < WORLD.waterZ - 6) puddle(ctx, px, 0.018, pz, rng.range(1.4, 3.6));
        }
      }
      // A manhole in the street south and east of the block.
      for (const [mx, mz] of [[cx + rng.range(-16, 16), cz + 30 + rng.range(-3, 3)], [cx + 30 + rng.range(-3, 3), cz + rng.range(-16, 16)]]) {
        if (mz < WORLD.waterZ - 6 && Math.abs(mx) < WORLD.maxX - 4 && rng.chance(0.75)) manhole(ctx, mx, mz);
      }
      // Traffic light on the south-east corner, reaching into the east street.
      const tx = cx + LAMP_E, tz = cz + LAMP_E - 3.2;
      if (tz < WORLD.waterZ - 8 && cx + 30 < WORLD.maxX && siteClear(tx, tz, 1)) lights.push(trafficLight(ctx, tx, tz, 1, 0, (cx * 0.13 + cz * 0.07) % 1));
    }
  }
  // Cycle: go 5 s, amber 1.5 s, stop 5.5 s. Only the active lamp glows.
  ctx.updaters.push((t) => {
    for (const L of lights) {
      const c = ((t / 12 + L.phase) % 1 + 1) % 1 * 12;
      const on = c < 5 ? 2 : c < 6.5 ? 1 : 0;
      L.ids.forEach((id, k) => ctx.halos.setSize(id, k === on ? 1.6 : 0.01));
      ctx.halos.setSize(L.walk, on === 0 && Math.floor(t * 2) % 2 ? 0.9 : 0.01);
    }
  });
}
