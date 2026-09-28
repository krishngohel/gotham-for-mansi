// Where a strike's limb is at its contact frame, measured from the clips themselves so the
// lunge can put the fist or foot inside the target instead of stopping short.
//
// Mocap clips carry this in MOCAP_DATA (retarget script). The Quaternius punch clips are
// sampled here at boot on the shared skeleton: the contact frame is where the striking hand
// is farthest forward, and the reach is that hand's position relative to the root.
import * as THREE from 'three';
import { MOCAP_DATA } from '../config/mocapData.js';

// Punch clips and their candidate hands.
const PUNCHES = { Punch_Jab: ['hand_l', 'hand_r'], Punch_Cross: ['hand_r', 'hand_l'], Melee_Hook: ['hand_r', 'hand_l'] };

// { clip: { contact, limb, reach: { x, y, z }, root: [x, z, ...] | null, fps } }
export function buildReachTable(model, clips, fwd = 1) {
  const table = {};
  for (const [name, d] of Object.entries(MOCAP_DATA)) {
    if (!clips.has(name)) continue;
    table[name] = { contact: d.contact, limb: d.limb, reach: { ...d.reach }, root: d.root, fps: d.fps, duration: d.duration };
  }
  const mixer = new THREE.AnimationMixer(model);
  const p = new THREE.Vector3();
  for (const [name, hands] of Object.entries(PUNCHES)) {
    const clip = clips.get(name);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.play();
    let best = { z: -Infinity }, any = { z: -Infinity };
    // Only the first 60% of a punch clip is the strike; the rest is the return to guard.
    const span = clip.duration * 0.6;
    for (let t = 0; t <= span; t += 1 / 60) {
      mixer.setTime(t);
      model.updateMatrixWorld(true);
      for (const h of hands) {
        model.worldToLocal(model.getObjectByName(h).getWorldPosition(p));
        const z = p.z * fwd;
        const s = { z, x: p.x, y: p.y, t, limb: h };
        if (z > any.z) any = s;
        // A punch lands at torso height; a hand swung low is a wind-up, not the blow.
        if (p.y >= 0.9 && z > best.z) best = s;
      }
    }
    action.stop();
    mixer.uncacheClip(clip);
    // A clip that never lifts a hand to torso height still gets its farthest frame.
    if (best.z === -Infinity) best = any;
    if (best.z === -Infinity) continue;
    table[name] = { contact: +best.t.toFixed(3), limb: best.limb, reach: { x: +best.x.toFixed(3), y: +best.y.toFixed(3), z: +best.z.toFixed(3) }, root: null, fps: 0, duration: clip.duration };
  }
  mixer.uncacheRoot(model);
  return table;
}

// Root motion of a clip at clip time t (metres, [x, z] in the clip's facing), linearly
// interpolated between baked frames; zero for clips without any.
export function rootMotionAt(entry, t, out = [0, 0]) {
  const r = entry?.root;
  if (!r || r.length < 4) { out[0] = 0; out[1] = 0; return out; }
  const f = Math.max(0, t * entry.fps);
  const i = Math.min(Math.floor(f), r.length / 2 - 2);
  const k = Math.min(1, f - i);
  out[0] = r[i * 2] + (r[i * 2 + 2] - r[i * 2]) * k;
  out[1] = r[i * 2 + 1] + (r[i * 2 + 3] - r[i * 2 + 1]) * k;
  return out;
}
