// Ink lines for Rope-a-Dope: the grapple line flying from Batman's hand through each goon, then
// the wraps that hold a tied bundle together. One LineSegments on the FX layer (one draw call);
// the preallocated buffer is rewritten only while something shows.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';

export const CHAIN_FX_MAX = 256; // vertices
const LOOP = 8;                  // segments per wrap loop
const LINGER = 1.5;              // a fired line that never gets tied fades after this

export function createChainFx(scene) {
  const pos = new Float32Array(CHAIN_FX_MAX * 3);
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', attr);
  // A zero-length segment at the origin, so the run-start prewarm draw compiles the program.
  geo.setDrawRange(0, 2);
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: PALETTE.ink }));
  lines.name = 'chainTether';
  lines.layers.set(LAYER_FX);
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);

  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  const q0 = new THREE.Vector3(), q1 = new THREE.Vector3();
  let n = 0;
  let flying = null; // { from, targets, dur, t }
  const bundles = []; // { members }

  function seg(a, b) {
    if (n + 2 > CHAIN_FX_MAX) return;
    const i = n * 3;
    pos[i] = a.x; pos[i + 1] = a.y; pos[i + 2] = a.z;
    pos[i + 3] = b.x; pos[i + 4] = b.y; pos[i + 5] = b.z;
    n += 2;
  }
  // WebGL lines are 1 px; a second pass 3 cm higher reads as an inked stroke.
  function ink(a, b) {
    seg(a, b);
    q0.set(a.x, a.y + 0.03, a.z);
    q1.set(b.x, b.y + 0.03, b.z);
    seg(q0, q1);
  }
  function loop(c, r) {
    for (let k = 0; k < LOOP; k++) {
      const a0 = (k / LOOP) * Math.PI * 2, a1 = ((k + 1) / LOOP) * Math.PI * 2;
      q0.set(c.x + Math.cos(a0) * r, c.y + Math.sin(a0 * 2) * 0.06, c.z + Math.sin(a0) * r);
      q1.set(c.x + Math.cos(a1) * r, c.y + Math.sin(a1 * 2) * 0.06, c.z + Math.sin(a1) * r);
      seg(q0, q1);
    }
  }
  // The middle of the body, standing or lying: halfway between the feet and the head.
  function mid(e, out) {
    e.ch.headWorld(out, 0);
    return out.set((out.x + e.pos.x) / 2, Math.max(e.pos.y + 0.25, (out.y + e.pos.y) / 2), (out.z + e.pos.z) / 2);
  }
  const bound = (m) => m.alive && m.state === 'tied' && !!m.ch.root.parent;

  return {
    // The line flies from fromFn(out) through each target in turn over `dur` seconds.
    fire(from, targets, dur = 0.22) { flying = { from, targets, dur, t: 0 }; },
    // Wraps a tied bundle until every member is knocked out, gets up or is despawned.
    bind(members) { flying = null; bundles.push({ members }); if (bundles.length > 3) bundles.shift(); },
    clear() { flying = null; bundles.length = 0; n = 0; lines.visible = false; },
    get active() { return !!flying || bundles.length > 0; },
    update(dt) {
      if (!flying && !bundles.length) { if (lines.visible) lines.visible = false; return; }
      n = 0;
      if (flying) {
        flying.t += dt;
        if (flying.t > flying.dur + LINGER) flying = null;
        else {
          const legs = flying.targets.length;
          const reach = Math.min(1, flying.t / flying.dur) * legs;
          flying.from(pa);
          for (let j = 0; j < legs && reach > j; j++) {
            mid(flying.targets[j], pb);
            if (reach < j + 1) pb.lerpVectors(pa, pb, reach - j);
            else loop(pb, 0.3);
            ink(pa, pb);
            pa.copy(pb);
          }
        }
      }
      for (let b = bundles.length - 1; b >= 0; b--) {
        let have = false;
        for (const m of bundles[b].members) {
          if (!bound(m)) continue;
          mid(m, pb);
          loop(pb, 0.34);
          if (have) {
            ink(pc, pb);
            q0.set(pc.x, pc.y + 0.14, pc.z); q1.set(pb.x, pb.y - 0.1, pb.z); seg(q0, q1);
            q0.set(pc.x, pc.y - 0.1, pc.z); q1.set(pb.x, pb.y + 0.14, pb.z); seg(q0, q1);
          }
          pc.copy(pb);
          have = true;
        }
        if (!have) bundles.splice(b, 1);
      }
      geo.setDrawRange(0, n);
      attr.needsUpdate = true;
      lines.visible = n > 0;
    },
  };
}
