// Kick animations authored in code on the shared skeleton. Bone axes are discovered numerically
// (rotate a bone, see where its child goes) so the clips don't depend on the rig's conventions.
import * as THREE from 'three';

function samplePose(model, clip, t = 0) {
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
function axisToward(model, bone, child, dir) {
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

function track(name, rest, axis, keys) {
  const times = [], values = [];
  const q = new THREE.Quaternion();
  for (const [t, angle] of keys) {
    q.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
    times.push(t);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}

export function buildKickClips(model, clips, fwd = 1) {
  const idle = clips.get('Idle_Loop');
  const { pose, dispose } = samplePose(model, idle, 0);
  const bone = (n) => model.getObjectByName(n);
  const forward = new THREE.Vector3(0, 0, fwd);
  const up = new THREE.Vector3(0, 1, 0);
  const outR = new THREE.Vector3(-fwd, 0, 0);

  const ax = {
    thighFwdR: axisToward(model, bone('thigh_r'), bone('calf_r'), forward),
    thighFwdL: axisToward(model, bone('thigh_l'), bone('calf_l'), forward),
    thighOutR: axisToward(model, bone('thigh_r'), bone('calf_r'), outR),
    kneeBendR: axisToward(model, bone('calf_r'), bone('foot_r'), forward.clone().negate()),
    kneeBendL: axisToward(model, bone('calf_l'), bone('foot_l'), forward.clone().negate()),
    spineBack: axisToward(model, bone('spine_02'), bone('neck_01'), forward.clone().negate()),
    pelvisTurn: axisToward(model, bone('pelvis'), bone('thigh_r'), forward),
    armUpR: axisToward(model, bone('upperarm_r'), bone('lowerarm_r'), up),
    armUpL: axisToward(model, bone('upperarm_l'), bone('lowerarm_l'), up),
  };
  dispose();
  const rest = (n) => pose.get(n);
  const idleTracks = (exclude) => idle.tracks.filter((t) => !exclude.some((n) => t.name.startsWith(n + '.')));

  // Front snap kick: chamber, extend, retract.
  const front = new THREE.AnimationClip('Kick_Front', 0.62, [
    ...idleTracks(['thigh_r', 'calf_r', 'spine_02']).map((t) => t.clone()),
    track('thigh_r', rest('thigh_r'), ax.thighFwdR, [[0, 0], [0.12, 1.15], [0.24, 1.55], [0.4, 1.2], [0.62, 0]]),
    track('calf_r', rest('calf_r'), ax.kneeBendR, [[0, 0], [0.12, 1.7], [0.24, 0.05], [0.4, 1.4], [0.62, 0]]),
    track('spine_02', rest('spine_02'), ax.spineBack, [[0, 0], [0.24, 0.35], [0.62, 0]]),
  ]);

  // Roundhouse: hips turn over, the leg sweeps out and across.
  const round = new THREE.AnimationClip('Kick_Round', 0.72, [
    ...idleTracks(['thigh_r', 'calf_r', 'pelvis', 'spine_02']).map((t) => t.clone()),
    track('pelvis', rest('pelvis'), ax.pelvisTurn, [[0, 0], [0.2, 0.9], [0.34, 1.1], [0.72, 0]]),
    track('thigh_r', rest('thigh_r'), ax.thighOutR, [[0, 0], [0.16, 0.8], [0.3, 1.45], [0.46, 1.0], [0.72, 0]]),
    track('calf_r', rest('calf_r'), ax.kneeBendR, [[0, 0], [0.16, 1.6], [0.3, 0.1], [0.46, 1.2], [0.72, 0]]),
    track('spine_02', rest('spine_02'), ax.spineBack, [[0, 0], [0.3, 0.45], [0.72, 0]]),
  ]);

  // Flying jump-kick: lead leg straight out, rear leg tucked, arms up for balance.
  const flying = new THREE.AnimationClip('Kick_Flying', 0.7, [
    track('thigh_r', rest('thigh_r'), ax.thighFwdR, [[0, 0.6], [0.2, 1.5], [0.55, 1.5], [0.7, 0.4]]),
    track('calf_r', rest('calf_r'), ax.kneeBendR, [[0, 1.4], [0.2, 0.05], [0.55, 0.05], [0.7, 1.0]]),
    track('thigh_l', rest('thigh_l'), ax.thighFwdL, [[0, 0.2], [0.2, -0.4], [0.7, 0.1]]),
    track('calf_l', rest('calf_l'), ax.kneeBendL, [[0, 1.0], [0.2, 1.9], [0.7, 1.0]]),
    track('spine_02', rest('spine_02'), ax.spineBack, [[0, 0.1], [0.2, 0.5], [0.7, 0.2]]),
    track('upperarm_r', rest('upperarm_r'), ax.armUpR, [[0, 0], [0.2, 0.9], [0.7, 0.3]]),
    track('upperarm_l', rest('upperarm_l'), ax.armUpL, [[0, 0], [0.2, 0.9], [0.7, 0.3]]),
  ]);
  return [front, round, flying];
}
