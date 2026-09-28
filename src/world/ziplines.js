// Hand-placed cables across the longest roof gaps. Ends are real roof ids' centers, nudged
// toward each other by buildZiplines, which snaps them to the roof edge and a post top 2.2 m
// above the roof.
import * as THREE from 'three';
import { addZipline } from './climbables.js';
import { solid } from './cityBuilder.js';

export const ZIP_ROUTES = [
  // [from {x,z}, to {x,z}]  (world coordinates of a roof each end sits on)
  [{ x: -60, z: 180 }, { x: -120, z: 182 }],   // Docks: warehouse 3 to warehouse 2
  [{ x: -60, z: 120 }, { x: -120, z: 120 }],   // Docks: cold storage to warehouse 5
  [{ x: 120, z: -48 }, { x: 120, z: 0 }],      // Neon Row: pawn shop down to the Gazette
  [{ x: 120, z: 112 }, { x: 180, z: 115 }],    // Neon Row: across the avenue, south block
  [{ x: 120, z: 0 }, { x: 180, z: -9 }],       // Neon Row: the Gazette across to the 24h diner block
  [{ x: 140, z: -172 }, { x: 180, z: -118 }],  // Ace factory roof to the vat deck
  [{ x: -120, z: -150 }, { x: -190.5, z: -130.5 }], // Cathedral to the clock-district tower
  [{ x: 0, z: 0 }, { x: -60, z: 0 }],          // GCPD roof west into downtown
];

function roofAt(ctx, x, z) {
  let best = null, bd = Infinity;
  for (const r of ctx.roofs) {
    const d = Math.hypot(r.x - x, r.z - z);
    if (d < bd && Math.abs(x - r.x) <= r.w / 2 + 6 && Math.abs(z - r.z) <= r.d / 2 + 6) { best = r; bd = d; }
  }
  return best;
}

function postTop(ctx, r, toward) {
  // Stand the post 2 m in from the roof edge facing the other end.
  const dx = toward.x - r.x, dz = toward.z - r.z;
  const k = Math.min((r.w / 2 - 2) / Math.max(Math.abs(dx), 1e-3), (r.d / 2 - 2) / Math.max(Math.abs(dz), 1e-3));
  const x = r.x + dx * Math.min(1, k), z = r.z + dz * Math.min(1, k);
  const ground = ctx.collision.groundBelow(x, r.y + 3, z, 0.3);
  return { x, y: (ground > -Infinity ? ground : r.y) + 2.2, z };
}

export function buildZiplines(ctx) {
  const pts = [];
  for (const [fa, fb] of ZIP_ROUTES) {
    const ra = roofAt(ctx, fa.x, fa.z), rb = roofAt(ctx, fb.x, fb.z);
    if (!ra || !rb) { console.warn('zipline: no roof near', fa, fb); continue; }
    let a = postTop(ctx, ra, rb), b = postTop(ctx, rb, ra);
    if (b.y > a.y) [a, b] = [b, a]; // always ride downhill
    // Skip cables that would pass through a building.
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = Math.hypot(d.x, d.y, d.z);
    const hit = ctx.collision.raycast({ x: a.x, y: a.y - 0.3, z: a.z }, { x: d.x / len, y: d.y / len, z: d.z / len }, len - 1);
    if (hit) { console.warn('zipline blocked', fa, fb, hit.box.tag); continue; }
    const line = addZipline(ctx.climbables, a, b);
    // Purely a visual post: no collider, so it never shadows its own grapple point (which sits
    // right below the post top) out of pruneGrapples' head-clearance check.
    for (const p of [a, b]) solid(ctx, 'steel', new THREE.CylinderGeometry(0.09, 0.12, 2.2, 6).translate(p.x, p.y - 1.1, p.z), { collide: false });
    // The cable sags 3% in the middle; drawn as an ink line strip.
    const n = 24, arr = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      arr.push(new THREE.Vector3(a.x + d.x * k, a.y + d.y * k - Math.sin(k * Math.PI) * len * 0.03, a.z + d.z * k));
    }
    const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr), new THREE.LineBasicMaterial({ color: 0x0b0b12 }));
    ctx.scene.add(cable);
    ctx.grapple.push({ x: a.x, y: a.y - 1.2, z: a.z, nx: 0, nz: 0, perch: true, zip: line });
    pts.push(line);
  }
  return pts;
}
