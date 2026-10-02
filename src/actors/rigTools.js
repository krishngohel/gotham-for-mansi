// Shared helpers for authoring animation clips in code on the shared skeleton. Bone axes are
// discovered numerically (rotate a bone, see where its child goes) so the clips don't depend on
// the rig's conventions. Used by kicks.js and climbAnims.js.
import * as THREE from 'three';

export function samplePose(model, clip, t = 0) {
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.setTime(t);
  model.updateMatrixWorld(true);
  const pose = new Map();
  model.traverse((o) => { if (o.isBone) pose.set(o.name, o.quaternion.clone()); });
  return { pose, dispose: () => { action.stop(); mixer.uncacheRoot(model); } };
}

// Local axis (and sign) that swings `bone` so that `child` moves toward `dir` (model space).
export function axisToward(model, bone, child, dir) {
  const base = model.worldToLocal(child.getWorldPosition(new THREE.Vector3()));
  const q0 = bone.quaternion.clone();
  let best = null, bestGain = -Infinity;
  for (const axis of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]) {
    for (const sign of [1, -1]) {
      bone.quaternion.copy(q0).multiply(new THREE.Quaternion().setFromAxisAngle(axis, 0.3 * sign));
      model.updateMatrixWorld(true);
      const p = model.worldToLocal(child.getWorldPosition(new THREE.Vector3()));
      const gain = p.sub(base).dot(dir);
      if (gain > bestGain) { bestGain = gain; best = axis.clone().multiplyScalar(sign); }
    }
  }
  bone.quaternion.copy(q0);
  model.updateMatrixWorld(true);
  return best;
}

// Like track(), but each key turns the bone about several axes in turn: keys are
// [t, angleA, angleB, ...] for axes [axisA, axisB, ...] (e.g. an arm raised out AND swept back).
export function trackMulti(name, rest, axes, keys) {
  const times = [], values = [];
  const q = new THREE.Quaternion(), r = new THREE.Quaternion();
  for (const [t, ...angles] of keys) {
    q.copy(rest);
    axes.forEach((axis, i) => q.multiply(r.setFromAxisAngle(axis, angles[i] ?? 0)));
    times.push(t);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}

export function track(name, rest, axis, keys) {
  const times = [], values = [];
  const q = new THREE.Quaternion();
  for (const [t, angle] of keys) {
    q.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
    times.push(t);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}
