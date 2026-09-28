// Numeric pose probe for authoring: prints where key bones land for candidate poses, with the
// left ball pinned like the kick clips. Usage:
//   node tools/pose-probe.mjs '{"name": {"thigh_r": {"f": 1.8}, "calf_r": {"f": 0.1}}, ...}'
import * as THREE from 'three';
import { loadGlb } from './rigNode.mjs';
import { sanitizeClip } from '../src/actors/animator.js';
import { sampleRest, discoverFrames, applyPose, plantRef } from '../src/actors/poseAuthor.js';
const m = await loadGlb('public/assets/hero_m.glb');
const a1 = await loadGlb('public/assets/anims1.glb', { stripTextures: false });
const model = m.scene;
const idle = sanitizeClip(a1.animations.find((c) => c.name === 'Idle_Loop'));
const rest = sampleRest(model, idle, 0);
const frames = discoverFrames(model, 1);
const ref = plantRef(model, rest, 'ball_l');
const P = (n) => { const v = model.getObjectByName(n).getWorldPosition(new THREE.Vector3()); model.worldToLocal(v); return `(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)})`; };
const POSES = JSON.parse(process.argv[2]);
for (const [name, pose] of Object.entries(POSES)) {
  applyPose(model, frames, rest, pose, { plant: 'ball_l', ref });
  console.log(name.padEnd(10), 'pelvis', P('pelvis'), 'head', P('Head'), 'kneeR', P('calf_r'), 'footR', P('foot_r'), 'ballR', P('ball_r'), 'ballL', P('ball_l'), 'heelL', P('foot_l'), 'handL', P('hand_l'), 'handR', P('hand_r'));
}
