// Hand-placed cables across the longest roof gaps. Ends are real roof ids' centers, nudged
// toward each other by buildZiplines, which snaps them to the roof edge and a post top 2.2 m
// above the roof (an end can override that with its own `lift`, when the roof's parapet sits
// close enough to the 2 m mark that the default post is too short to clear it on the way out).
import * as THREE from 'three';
import { addZipline, zipSag } from './climbables.js';
import { solid } from './cityBuilder.js';
import { LAYER_FX } from '../render/layers.js';

export const ZIP_ROUTES = [
  // [from {x,z}, to {x,z}]  (world coordinates of a roof each end sits on)
  [{ x: -60, z: 180 }, { x: -120, z: 182 }],   // Docks: warehouse 3 to warehouse 2
  [{ x: -60, z: 120 }, { x: -120, z: 120 }],   // Docks: cold storage to warehouse 5
  [{ x: 120, z: -48 }, { x: 120, z: 0 }],      // Neon Row: pawn shop down to the Gazette
  [{ x: 120, z: 112 }, { x: 180, z: 115 }],    // Neon Row: across the avenue, south block
  [{ x: 120, z: 0 }, { x: 180, z: -9 }],       // Neon Row: the Gazette across to the 24h diner block (shares the Gazette roof with the route above, at a different edge; intentional)
  [{ x: 140, z: -172 }, { x: 180, z: -118 }],  // Ace factory roof to the vat deck
  [{ x: -120, z: -150 }, { x: -190.5, z: -130.5 }], // Cathedral to the clock-district tower
  [{ x: 0, z: 0 }, { x: -60, z: 0 }],          // GCPD roof west into downtown
  // Neon Row: the fire-escape roof (checkpoint 2's ledge) down to the pawn shop (checkpoint 3).
  // The near post needs a taller lift than the default 2.2 m: at 2.2 m the outgoing cable's first
  // few metres still cross the roof's own low parapet before the line has dropped clear of it.
  [{ x: 75, z: 3, lift: 6 }, { x: 120, z: -48 }],
];

function roofAt(ctx, x, z) {
  let best = null, bd = Infinity;
  for (const r of ctx.roofs) {
    const d = Math.hypot(r.x - x, r.z - z);
    if (d < bd && Math.abs(x - r.x) <= r.w / 2 + 6 && Math.abs(z - r.z) <= r.d / 2 + 6) { best = r; bd = d; }
  }
  return best;
}

function postTop(ctx, r, toward, lift = 2.2) {
  // Stand the post 2 m in from the roof edge facing the other end (or `lift` m up, if given).
  const dx = toward.x - r.x, dz = toward.z - r.z;
  const k = Math.min((r.w / 2 - 2) / Math.max(Math.abs(dx), 1e-3), (r.d / 2 - 2) / Math.max(Math.abs(dz), 1e-3));
  const x = r.x + dx * Math.min(1, k), z = r.z + dz * Math.min(1, k);
  const ground = ctx.collision.groundBelow(x, r.y + 3, z, 0.3);
  return { x, y: (ground > -Infinity ? ground : r.y) + lift, z };
}

export function buildZiplines(ctx) {
  const pts = [];
  for (const [fa, fb] of ZIP_ROUTES) {
    const ra = roofAt(ctx, fa.x, fa.z), rb = roofAt(ctx, fb.x, fb.z);
    if (!ra || !rb) { console.warn('zipline: no roof near', fa, fb); continue; }
    let a = postTop(ctx, ra, rb, fa.lift ?? 2.2), b = postTop(ctx, rb, ra, fb.lift ?? 2.2);
    if (b.y > a.y) [a, b] = [b, a]; // always ride downhill
    // Skip cables that would pass through a building.
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = Math.hypot(d.x, d.y, d.z);
    const hit = ctx.collision.raycast({ x: a.x, y: a.y - 0.3, z: a.z }, { x: d.x / len, y: d.y / len, z: d.z / len }, len - 1);
    if (hit) { console.warn('zipline blocked', fa, fb, hit.box.tag); continue; }
    const line = addZipline(ctx.climbables, a, b);
    // The far post (b) is a normal solid obstacle. The near post (a) carries the grapple point
    // 1.2 m below its top, and pruneGrapples rejects a grapple point with a solid box reaching
    // above p.y + 0.5 (= a.y - 0.7) in the headroom window above it; a full-height post collider
    // there would shadow its own point out of the grapple list. So post a's mesh still draws full
    // height, but its collider only runs from the roof up to a.y - 0.8 (comfortably under the
    // a.y - 0.7 line), which still blocks walking through the post's base.
    solid(ctx, 'steel', new THREE.CylinderGeometry(0.09, 0.12, 2.2, 6).translate(a.x, a.y - 1.1, a.z), { collide: false });
    ctx.collision.addBox(a.x - 0.12, a.y - 2.2, a.z - 0.12, a.x + 0.12, a.y - 0.8, a.z + 0.12, 'zipPost');
    solid(ctx, 'steel', new THREE.CylinderGeometry(0.09, 0.12, 2.2, 6).translate(b.x, b.y - 1.1, b.z));
    // The cable sags (zipSag, shared with the rider and the catch check) in the middle; drawn as
    // an ink line strip.
    const n = 24, arr = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      arr.push(new THREE.Vector3(a.x + d.x * k, a.y + d.y * k - zipSag(line, k * len), a.z + d.z * k));
    }
    const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr), new THREE.LineBasicMaterial({ color: 0x0b0b12 }));
    cable.layers.set(LAYER_FX);
    ctx.scene.add(cable);
    ctx.grapple.push({ x: a.x, y: a.y - 1.2, z: a.z, nx: 0, nz: 0, perch: true, zip: line });
    pts.push(line);
  }
  return pts;
}
