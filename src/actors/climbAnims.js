// Climb/hang/zip/wall-run/dive animations authored in code on the shared skeleton.
// Same approach as src/actors/kicks.js: bone axes are discovered numerically so the
// clips don't depend on the rig's conventions.
import * as THREE from 'three';
import { samplePose, axisToward, track } from './rigTools.js';

export function buildClimbClips(model, clips, fwd = 1) {
  const idle = clips.get('Idle_Loop');
  const { pose, dispose } = samplePose(model, idle, 0);
  const bone = (n) => model.getObjectByName(n);
  const forward = new THREE.Vector3(0, 0, fwd), up = new THREE.Vector3(0, 1, 0);
  const ax = {
    armUpR: axisToward(model, bone('upperarm_r'), bone('lowerarm_r'), up),
    armUpL: axisToward(model, bone('upperarm_l'), bone('lowerarm_l'), up),
    elbowR: axisToward(model, bone('lowerarm_r'), bone('hand_r'), up),
    elbowL: axisToward(model, bone('lowerarm_l'), bone('hand_l'), up),
    thighFwdR: axisToward(model, bone('thigh_r'), bone('calf_r'), forward),
    thighFwdL: axisToward(model, bone('thigh_l'), bone('calf_l'), forward),
    kneeR: axisToward(model, bone('calf_r'), bone('foot_r'), forward.clone().negate()),
    kneeL: axisToward(model, bone('calf_l'), bone('foot_l'), forward.clone().negate()),
    spineFwd: axisToward(model, bone('spine_02'), bone('neck_01'), forward),
    spineSide: axisToward(model, bone('spine_02'), bone('neck_01'), new THREE.Vector3(1, 0, 0)),
  };
  dispose();
  const r = (n) => pose.get(n);
  const T = (n, a, k) => track(n, r(n), ax[a], k);
  const clip = (name, dur, tracks) => new THREE.AnimationClip(name, dur, tracks);
  // elbowR's angle 0 is the Idle_Loop rest pose, where the right elbow already sits bent by
  // about 0.76 rad; -0.76 straightens it out. Colinearity of forearm and upper arm depends only
  // on lowerarm_r's own local rotation, so this offset is independent of armUpR -- that's why
  // the same constant straightens the arm at every armUpR angle (verified numerically against
  // the rig). Every elbowR keyframe below is the original design value (0 = straight-ish,
  // higher = bent for a pulling grip) shifted by -0.76 to recenter on that true "straight" pose.
  // elbowL didn't need this: its rest bend already reads close to straight when the arm is
  // raised, so those keyframes are unshifted.

  // The base pose under the ladder IK (src/actors/traverse/ladder.js + src/actors/limbIK.js): the
  // IK moves every hand and foot onto its rung. Every limb bone the IK turns is keyed here, so the
  // mixer re-poses them each frame and the IK never builds on its own previous answer. The chest
  // leans in a little, toward the rungs.
  const ladderHold = clip('Ladder_Hold', 1, [
    T('upperarm_r', 'armUpR', [[0, 2.3], [1, 2.3]]), T('upperarm_l', 'armUpL', [[0, 2.3], [1, 2.3]]),
    T('lowerarm_r', 'elbowR', [[0, 0.2], [1, 0.2]]), T('lowerarm_l', 'elbowL', [[0, 1.0], [1, 1.0]]),
    T('thigh_r', 'thighFwdR', [[0, 0.9], [1, 0.9]]), T('thigh_l', 'thighFwdL', [[0, 0.9], [1, 0.9]]),
    T('calf_r', 'kneeR', [[0, 1.2], [1, 1.2]]), T('calf_l', 'kneeL', [[0, 1.2], [1, 1.2]]),
    T('spine_02', 'spineFwd', [[0, 0.1], [1, 0.1]]),
  ]);
  // Both arms straight up, legs dangling with a slight sway.
  const hang = clip('Hang_Idle', 2, [
    T('upperarm_r', 'armUpR', [[0, 2.9], [2, 2.9]]), T('upperarm_l', 'armUpL', [[0, 2.9], [2, 2.9]]),
    T('lowerarm_r', 'elbowR', [[0, -0.61], [2, -0.61]]), T('lowerarm_l', 'elbowL', [[0, 0.15], [2, 0.15]]),
    T('thigh_r', 'thighFwdR', [[0, 0.15], [1, -0.1], [2, 0.15]]), T('thigh_l', 'thighFwdL', [[0, -0.1], [1, 0.15], [2, -0.1]]),
    T('calf_r', 'kneeR', [[0, 0.3], [2, 0.3]]), T('calf_l', 'kneeL', [[0, 0.35], [2, 0.35]]),
  ]);
  // Shimmy: arms alternate reaching sideways (the control mirrors it for the other direction).
  const shimmy = clip('Shimmy', 0.8, [
    T('upperarm_r', 'armUpR', [[0, 2.9], [0.4, 2.5], [0.8, 2.9]]), T('upperarm_l', 'armUpL', [[0, 2.5], [0.4, 2.9], [0.8, 2.5]]),
    T('lowerarm_r', 'elbowR', [[0, -0.61], [0.4, -0.26], [0.8, -0.61]]), T('lowerarm_l', 'elbowL', [[0, 0.5], [0.4, 0.15], [0.8, 0.5]]),
    T('spine_02', 'spineSide', [[0, 0.08], [0.4, -0.08], [0.8, 0.08]]),
    T('thigh_r', 'thighFwdR', [[0, 0.2], [0.4, -0.05], [0.8, 0.2]]), T('calf_r', 'kneeR', [[0, 0.4], [0.8, 0.4]]),
  ]);
  // One hand on the handle, the other out for balance, knees tucked.
  const zip = clip('Zip_Hang', 1, [
    T('upperarm_r', 'armUpR', [[0, 3.0], [1, 3.0]]), T('lowerarm_r', 'elbowR', [[0, -0.66], [1, -0.66]]),
    T('upperarm_l', 'armUpL', [[0, 1.3], [0.5, 1.45], [1, 1.3]]),
    T('thigh_r', 'thighFwdR', [[0, 1.0], [1, 1.0]]), T('thigh_l', 'thighFwdL', [[0, 0.8], [1, 0.8]]),
    T('calf_r', 'kneeR', [[0, 1.4], [1, 1.4]]), T('calf_l', 'kneeL', [[0, 1.2], [1, 1.2]]),
  ]);
  // Sprint cycle with the torso leaning away from the wall (the control tilts the whole body).
  const wallRun = clip('WallRun_Loop', 0.5, [
    T('thigh_r', 'thighFwdR', [[0, 1.3], [0.25, -0.4], [0.5, 1.3]]), T('thigh_l', 'thighFwdL', [[0, -0.4], [0.25, 1.3], [0.5, -0.4]]),
    T('calf_r', 'kneeR', [[0, 1.2], [0.25, 0.4], [0.5, 1.2]]), T('calf_l', 'kneeL', [[0, 0.4], [0.25, 1.2], [0.5, 0.4]]),
    T('upperarm_r', 'armUpR', [[0, 0.6], [0.25, 1.4], [0.5, 0.6]]), T('upperarm_l', 'armUpL', [[0, 1.4], [0.25, 0.6], [0.5, 1.4]]),
    T('spine_02', 'spineFwd', [[0, 0.35], [0.5, 0.35]]),
  ]);
  // Dive bomb: arms swept back, legs together, head first.
  const dive = clip('Dive', 1, [
    T('upperarm_r', 'armUpR', [[0, -0.5], [1, -0.5]]), T('upperarm_l', 'armUpL', [[0, -0.5], [1, -0.5]]),
    T('thigh_r', 'thighFwdR', [[0, -0.15], [1, -0.15]]), T('thigh_l', 'thighFwdL', [[0, -0.15], [1, -0.15]]),
    T('spine_02', 'spineFwd', [[0, 0.4], [1, 0.4]]),
  ]);
  // Ledge takedown: both hands reach up and yank down hard.
  const yank = clip('Ledge_Yank', 0.9, [
    T('upperarm_r', 'armUpR', [[0, 2.9], [0.25, 3.1], [0.55, 1.2], [0.9, 2.9]]), T('upperarm_l', 'armUpL', [[0, 2.9], [0.25, 3.1], [0.55, 1.2], [0.9, 2.9]]),
    T('lowerarm_r', 'elbowR', [[0, -0.61], [0.25, -0.66], [0.55, 0.64], [0.9, -0.61]]), T('lowerarm_l', 'elbowL', [[0, 0.15], [0.25, 0.1], [0.55, 1.4], [0.9, 0.15]]),
    T('spine_02', 'spineFwd', [[0, 0], [0.55, 0.45], [0.9, 0]]),
  ]);
  return [ladderHold, hang, shimmy, zip, wallRun, dive, yank];
}
