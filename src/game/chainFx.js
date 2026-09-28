// Rope for Rope-a-Dope: the grapple line flying from Batman's hand through each goon, then the
// rope that holds a tied bundle together. Drawn as a camera-facing ribbon with a pale rope core
// and an ink edge on each side (WebGL lines are 1 px, too thin to read at play distance), all in
// one mesh on the FX layer (one draw call). Every buffer is preallocated: a frame only rewrites
// positions, and only while something shows.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';

export const CHAIN_FX_MAX = 256; // rope segments
export const ROPE_WIDTH = 0.055;  // metres edge to edge: about 4 px at 7 m in a 720 p frame
const CORE = 0.56;                // the pale core's share of the width; the rest is the ink edge
const ROPE_COLOR = 0xd9c49b;      // warm tan
const LOOP = 10;                  // segments per wrap
const RING = 0.27;                // wrap radius around a torso (at scale 1)
const FLAT = 0.6;                 // a lying body's wrap is this much less deep than wide
const LINGER = 1.5;               // a fired line that never gets tied fades after this
const V = 8;                      // vertices per segment: 4 across (ink, rope, rope, ink) at each end
const I = 18;                     // indices per segment: 3 bands of 2 triangles

// The one material the rope uses, shared with warmCast so the program is compiled at load.
export const createRopeMaterial = () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

export function createChainFx(scene, camera = null) {
  const pos = new Float32Array(CHAIN_FX_MAX * V * 3);
  const col = new Float32Array(CHAIN_FX_MAX * V * 3);
  const idx = new Uint16Array(CHAIN_FX_MAX * I);
  const ink = new THREE.Color(PALETTE.ink), rope = new THREE.Color(ROPE_COLOR);
  for (let s = 0; s < CHAIN_FX_MAX; s++) {
    for (let k = 0; k < V; k++) (k % 4 === 0 || k % 4 === 3 ? ink : rope).toArray(col, (s * V + k) * 3);
    const b = s * V;
    for (let band = 0; band < 3; band++) {
      const a0 = b + band, a1 = b + band + 1, b0 = b + 4 + band, b1 = b + 5 + band;
      idx.set([a0, b0, a1, a1, b0, b1], s * I + band * 6);
    }
  }
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', attr);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, createRopeMaterial());
  mesh.name = 'chainTether';
  mesh.layers.set(LAYER_FX);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);

  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  const q0 = new THREE.Vector3(), q1 = new THREE.Vector3(), head = new THREE.Vector3();
  const dir = new THREE.Vector3(), side = new THREE.Vector3(), eye = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3();
  const OFF = [-0.5, -CORE / 2, CORE / 2, 0.5];
  let n = 0;
  let flying = null; // { from, targets, dur, t }
  const bundles = []; // { members }

  // One rope segment a to b, turned to face the camera.
  function seg(a, b) {
    if (n >= CHAIN_FX_MAX) return;
    dir.subVectors(b, a);
    if (camera) eye.copy(camera.position).sub(a); else eye.set(0, 1, 0.3);
    side.crossVectors(dir, eye);
    if (side.lengthSq() < 1e-10) side.set(0, 1, 0).cross(dir);
    if (side.lengthSq() < 1e-10) side.set(1, 0, 0);
    side.normalize().multiplyScalar(ROPE_WIDTH);
    end(a, n * V * 3);
    end(b, n * V * 3 + 12);
    n += 1;
  }
  function end(p, i) {
    for (let k = 0; k < 4; k++, i += 3) { const o = OFF[k]; pos[i] = p.x + side.x * o; pos[i + 1] = p.y + side.y * o; pos[i + 2] = p.z + side.z * o; }
  }
  // A ring of rope around point c, square to the axis `ax` (a unit vector), radius r. Round a
  // standing body; flattened round a lying one (a body on its back is wider than it is deep), so
  // the rope hugs it instead of arching over it.
  function ring(c, ax, r) {
    u.set(0, 1, 0).cross(ax);
    if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
    u.normalize();
    w.crossVectors(ax, u).multiplyScalar(FLAT + (1 - FLAT) * Math.abs(ax.y));
    for (let k = 0; k < LOOP; k++) {
      const a0 = (k / LOOP) * Math.PI * 2, a1 = ((k + 1) / LOOP) * Math.PI * 2;
      q0.copy(c).addScaledVector(u, Math.cos(a0) * r).addScaledVector(w, Math.sin(a0) * r);
      q1.copy(c).addScaledVector(u, Math.cos(a1) * r).addScaledVector(w, Math.sin(a1) * r);
      seg(q0, q1);
    }
  }
  // A torso, standing or lying: `at` of the way from the feet to the head, and the body's axis.
  function torso(e, at, out, axis) {
    e.ch.headWorld(head, 0);
    axis.subVectors(head, e.pos);
    const len = axis.length();
    if (len < 1e-6) axis.set(0, 1, 0); else axis.divideScalar(len);
    out.copy(e.pos).lerp(head, at);
    out.y = Math.max(out.y, e.pos.y + 0.15);
    return out;
  }
  const bound = (m) => m.alive && m.state === 'tied' && !!m.ch.root.parent;
  const axisA = new THREE.Vector3();

  return {
    // The line flies from fromFn(out) through each target in turn over `dur` seconds.
    fire(from, targets, dur = 0.22) { flying = { from, targets, dur, t: 0 }; },
    // Wraps a tied bundle until every member is knocked out, gets up or is despawned.
    bind(members) { flying = null; bundles.push({ members }); if (bundles.length > 3) bundles.shift(); },
    clear() { flying = null; bundles.length = 0; n = 0; mesh.visible = false; },
    get active() { return !!flying || bundles.length > 0; },
    update(dt) {
      if (!flying && !bundles.length) { if (mesh.visible) mesh.visible = false; return; }
      n = 0;
      if (flying) {
        flying.t += dt;
        if (flying.t > flying.dur + LINGER) flying = null;
        else {
          const legs = flying.targets.length;
          const reach = Math.min(1, flying.t / flying.dur) * legs;
          flying.from(pa);
          for (let j = 0; j < legs && reach > j; j++) {
            const e = flying.targets[j];
            torso(e, 0.62, pb, axisA);
            if (reach < j + 1) pb.lerpVectors(pa, pb, reach - j);
            else ring(pb, axisA, RING * (e.scale ?? 1));
            seg(pa, pb);
            pa.copy(pb);
          }
        }
      }
      for (let b = bundles.length - 1; b >= 0; b--) {
        let have = false;
        for (const m of bundles[b].members) {
          if (!bound(m)) continue;
          const r = RING * (m.scale ?? 1);
          // Two turns round each torso (chest and waist), and the rope running on to the next goon.
          torso(m, 0.42, pa, axisA);
          ring(pa, axisA, r * 0.95);
          torso(m, 0.64, pb, axisA);
          ring(pb, axisA, r);
          if (have) {
            seg(pc, pb);
            q0.copy(pc).y -= 0.12; q1.copy(pa); seg(q0, q1);
          }
          pc.copy(pb);
          have = true;
        }
        if (!have) bundles.splice(b, 1);
      }
      geo.setDrawRange(0, n * I);
      attr.needsUpdate = true;
      mesh.visible = n > 0;
    },
  };
}
