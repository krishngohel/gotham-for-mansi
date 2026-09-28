// Keyframe authoring for code-made clips on the shared skeleton.
//
// Every bone gets a small anatomical frame discovered numerically on the rig (rotate, see where
// the child goes), so keys are written as readable angles: `f` (forward swing: hip flexion,
// spine bend, arm raise, ankle point), `s` (sideways: abduction, lean, shrug) and `tw` (twist
// about the bone: hip turnover, torso and head turn). Keys are sparse and eased per segment,
// then baked to dense quaternion tracks (60 keys/s) so arcs stay smooth under slerp.
//
// A "plant" foot keeps the support foot pinned: after the rotations are baked, the pelvis is
// moved each frame so that foot's ball stays exactly where it was on frame 0. That is what
// makes the support leg bend, heel pivot and hip drive read as weight instead of sliding.
import * as THREE from 'three';

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

// Idle rotations for every bone plus the pelvis position at time t of the clip.
export function sampleRest(model, clip, t = 0) {
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.setTime(t);
  model.updateMatrixWorld(true);
  const quats = new Map();
  model.traverse((o) => { if (o.isBone) quats.set(o.name, o.quaternion.clone()); });
  const pelvis = model.getObjectByName('pelvis');
  const rest = { quats, pelvisPos: pelvis.position.clone() };
  action.stop();
  mixer.uncacheRoot(model);
  applyRest(model, rest);
  return rest;
}

export function applyRest(model, rest) {
  model.traverse((o) => { if (o.isBone && rest.quats.has(o.name)) o.quaternion.copy(rest.quats.get(o.name)); });
  model.getObjectByName('pelvis').position.copy(rest.pelvisPos);
  model.updateMatrixWorld(true);
}

// Among `candidates` (local unit axes, both signs), the one that moves the bone-local point
// `local` most toward world direction `dir` under a small rotation.
function bestAxis(model, bone, local, dir, candidates) {
  const q0 = bone.quaternion.clone();
  const base = model.worldToLocal(bone.localToWorld(local.clone()));
  let best = null, bestGain = -Infinity;
  for (const axis of candidates) {
    for (const sign of [1, -1]) {
      bone.quaternion.copy(q0).multiply(new THREE.Quaternion().setFromAxisAngle(axis, 0.3 * sign));
      bone.updateMatrixWorld(true);
      const gain = model.worldToLocal(bone.localToWorld(local.clone())).sub(base).dot(dir);
      if (gain > bestGain) { bestGain = gain; best = axis.clone().multiplyScalar(sign); }
    }
  }
  bone.quaternion.copy(q0);
  bone.updateMatrixWorld(true);
  return best;
}

// Per-bone frames. `fwd` is the model's facing sign on Z; +X is the character's left.
export function discoverFrames(model, fwd = 1) {
  const bone = (n) => model.getObjectByName(n);
  const F = new THREE.Vector3(0, 0, fwd), U = new THREE.Vector3(0, 1, 0), L = new THREE.Vector3(1, 0, 0);
  const R = L.clone().negate(), D = U.clone().negate();
  const world = (n) => bone(n).getWorldPosition(new THREE.Vector3());
  const frames = {};
  const define = (name, { child, fDir, sDir, twProbe = null, twDir = null, fProbe = null, sProbe = null }) => {
    const b = bone(name);
    const along = child ? bone(child).position.clone().normalize() : new THREE.Vector3(0, 1, 0);
    // Twist runs along the bone; f and s use the two axes across it.
    const twistAxis = AXES.reduce((a, c) => (Math.abs(c.dot(along)) > Math.abs(a.dot(along)) ? c : a));
    const across = AXES.filter((a) => a !== twistAxis);
    const localOf = (worldOffset) => b.worldToLocal(world(name).add(worldOffset));
    const fPoint = fProbe ? localOf(fProbe) : bone(child).position.clone();
    const sPoint = sProbe ? localOf(sProbe) : bone(child).position.clone();
    // Torso and head turn first, then lean and bend in the turned frame; limbs swing out,
    // then forward within that plane, then twist about their own length.
    const order = /thigh|calf|foot|arm|clavicle/.test(name) ? ['s', 'f', 'tw'] : ['tw', 's', 'f'];
    const fr = { f: bestAxis(model, b, fPoint, fDir, across), s: bestAxis(model, b, sPoint, sDir, across), tw: null, order };
    if (twProbe) fr.tw = bestAxis(model, b, localOf(twProbe), twDir, [twistAxis]);
    frames[name] = fr;
  };
  const side = (n) => (n.endsWith('_l') ? L : R);
  // Twist probes: a point on the front of the bone or on its right side, so a positive twist
  // always means the same thing on both sides: turn left for the torso and head, external
  // rotation (knee/elbow turning outward) for limbs.
  const right = R.clone().multiplyScalar(0.1), front = F.clone().multiplyScalar(0.1), top = U.clone().multiplyScalar(0.1);
  define('pelvis', { child: 'spine_01', fDir: F, sDir: L, twProbe: right, twDir: F });
  define('spine_01', { child: 'spine_02', fDir: F, sDir: L, twProbe: right, twDir: F });
  define('spine_02', { child: 'spine_03', fDir: F, sDir: L, twProbe: right, twDir: F });
  define('spine_03', { child: 'neck_01', fDir: F, sDir: L, twProbe: right, twDir: F });
  define('neck_01', { child: 'Head', fDir: F, sDir: L, twProbe: right, twDir: F });
  define('Head', { child: null, fDir: D, fProbe: front, sDir: L, sProbe: top, twProbe: right, twDir: F });
  for (const s of ['l', 'r']) {
    const out = side('_' + s);
    define(`clavicle_${s}`, { child: `upperarm_${s}`, fDir: F, sDir: U });
    define(`upperarm_${s}`, { child: `lowerarm_${s}`, fDir: F, sDir: out, twProbe: front, twDir: out });
    define(`lowerarm_${s}`, { child: `hand_${s}`, fDir: world(`upperarm_${s}`).sub(world(`hand_${s}`)).normalize(), sDir: out });
    define(`thigh_${s}`, { child: `calf_${s}`, fDir: F, sDir: out, twProbe: front, twDir: out });
    define(`calf_${s}`, { child: `foot_${s}`, fDir: world(`thigh_${s}`).sub(world(`foot_${s}`)).normalize(), sDir: out });
    define(`foot_${s}`, { child: `ball_${s}`, fDir: D, sDir: out });
  }
  return frames;
}

// Apply one pose ({ <bone>: { f, s, tw } }) on top of the rest pose, then pin `plant`'s ball
// back to `ref` (model space) with weight w by moving the pelvis. Returns nothing; read bone
// world positions afterwards.
export function applyPose(model, frames, rest, pose, { plant = null, ref = null, w = 1, hips = null, out = null } = {}) {
  const q = new THREE.Quaternion(), r = new THREE.Quaternion();
  const now = new THREE.Vector3(), pw = new THREE.Vector3();
  applyRest(model, rest);
  for (const [b, v] of Object.entries(pose)) {
    const fr = frames[b];
    if (!fr) continue;
    q.copy(rest.quats.get(b));
    for (const axis of fr.order) if (v[axis] && fr[axis]) q.multiply(r.setFromAxisAngle(fr[axis], v[axis]));
    model.getObjectByName(b).quaternion.copy(q);
    out?.set(b, q.clone());
  }
  const pelvis = model.getObjectByName('pelvis');
  model.updateMatrixWorld(true);
  if (plant && ref) {
    model.worldToLocal(model.getObjectByName(plant).getWorldPosition(now));
    pelvis.getWorldPosition(pw);
    model.worldToLocal(pw).add(now.subVectors(ref, now).multiplyScalar(w));
    pelvis.position.copy(pelvis.parent.worldToLocal(model.localToWorld(pw)));
  }
  // Authored hip offsets are in model space (x left, y up, z forward).
  if (hips && (hips[0] || hips[1] || hips[2])) {
    pelvis.getWorldPosition(pw);
    model.worldToLocal(pw).add(now.set(hips[0], hips[1], hips[2]));
    pelvis.position.copy(pelvis.parent.worldToLocal(model.localToWorld(pw)));
  }
  model.updateMatrixWorld(true);
}

const EASE = {
  lin: (t) => t,
  in: (t) => t * t,
  inCub: (t) => t * t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  snap: (t) => 1 - (1 - t) ** 3,
  whip: (t) => 1 - (1 - t) ** 4,
  io: (t) => t * t * (3 - 2 * t),
};

// Expand sparse keys into per-channel key lists. Keys: { t, ease, hold, hips: [x,y,z], plant: w,
// <bone>: { f, s, tw } }. `hold` repeats every channel of the previous key.
function channelKeys(keys, duration) {
  const chans = new Map();
  const add = (name, t, v, ease) => {
    if (!chans.has(name)) chans.set(name, []);
    chans.get(name).push({ t, v, ease });
  };
  let prev = null;
  for (const key of keys) {
    const ease = key.ease ?? 'io';
    const src = key.hold ? { ...prev, ...key, hold: false } : key;
    for (const [k, val] of Object.entries(src)) {
      if (k === 't' || k === 'ease' || k === 'hold') continue;
      if (k === 'hips') { ['x', 'y', 'z'].forEach((a, i) => add(`hips.${a}`, key.t, val[i], ease)); continue; }
      if (k === 'plant') { add('plant.w', key.t, val, ease); continue; }
      for (const [axis, v] of Object.entries(val)) add(`${k}.${axis}`, key.t, v, ease);
    }
    prev = src;
  }
  const lastEase = keys[keys.length - 1]?.ease ?? 'io';
  for (const [name, list] of chans) {
    list.sort((a, b) => a.t - b.t);
    const base = name === 'plant.w' ? 1 : 0;
    if (list[0].t > 0) list.unshift({ t: 0, v: base, ease: 'lin' });
    if (list[list.length - 1].t < duration) list.push({ t: duration, v: base, ease: lastEase });
  }
  return chans;
}

function evalChannel(list, t) {
  if (t <= list[0].t) return list[0].v;
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    if (t <= b.t) {
      const span = b.t - a.t;
      const k = span > 1e-6 ? EASE[b.ease](THREE.MathUtils.clamp((t - a.t) / span, 0, 1)) : 1;
      return a.v + (b.v - a.v) * k;
    }
  }
  return list[list.length - 1].v;
}

// Where the planted foot's ball sits (model space) in the rest pose.
export function plantRef(model, rest, plant) {
  applyRest(model, rest);
  return model.worldToLocal(model.getObjectByName(plant).getWorldPosition(new THREE.Vector3()));
}

// Bake keys to a clip. Every bone in `rest` gets a track (constant at rest when unauthored)
// so the clip fully defines the pose. `plant` names the support foot's ball bone.
export function compileClip(name, duration, keys, { model, frames, rest, plant = null, fps = 60 }) {
  const chans = channelKeys(keys, duration);
  const authored = new Set([...chans.keys()].map((c) => c.split('.')[0]).filter((b) => frames[b]));
  const n = Math.max(2, Math.round(duration * fps) + 1);
  const times = new Float32Array(n);
  for (let i = 0; i < n; i++) times[i] = (i / (n - 1)) * duration;
  const values = new Map([...authored].map((b) => [b, new Float32Array(n * 4)]));
  const hipValues = new Float32Array(n * 3);
  const pelvis = model.getObjectByName('pelvis');
  const val = (c, t) => (chans.has(c) ? evalChannel(chans.get(c), t) : c === 'plant.w' ? 1 : 0);
  const ref = plant ? plantRef(model, rest, plant) : null;
  const quats = new Map();
  for (let i = 0; i < n; i++) {
    const t = times[i];
    const pose = {};
    for (const b of authored) pose[b] = { s: val(`${b}.s`, t), f: val(`${b}.f`, t), tw: val(`${b}.tw`, t) };
    applyPose(model, frames, rest, pose, { plant, ref, w: val('plant.w', t), hips: [val('hips.x', t), val('hips.y', t), val('hips.z', t)], out: quats });
    for (const b of authored) { const q = quats.get(b); values.get(b).set([q.x, q.y, q.z, q.w], i * 4); }
    hipValues.set([pelvis.position.x, pelvis.position.y, pelvis.position.z], i * 3);
  }
  applyRest(model, rest);
  const tracks = [];
  for (const [b, v] of values) tracks.push(new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, v));
  tracks.push(new THREE.VectorKeyframeTrack('pelvis.position', times, hipValues));
  for (const [b, rq] of rest.quats) {
    if (authored.has(b)) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, [0, duration], [rq.x, rq.y, rq.z, rq.w, rq.x, rq.y, rq.z, rq.w]));
  }
  return new THREE.AnimationClip(name, duration, tracks);
}
