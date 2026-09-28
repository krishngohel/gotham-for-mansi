// Retargets Meshy auto-rig mocap clips (24-bone Mixamo-style skeleton bound to the game's own
// Batman body) onto the game's 65-bone Quaternius skeleton, and packs them into one GLB.
//
//   node scripts/retarget-mocap.mjs [--out public/assets/anims_mocap.glb] [--fps 30] [--keep-travel]
//        Kick_Round=C:/path/roundhouse.glb [Kick_Front=... ...]
//
// Both rigs skin the same mesh in the same bind pose, so rotations transfer as world-space
// deltas: delta = Qsrc(t) * inv(Qsrc(bind)); Qtgt(t) = delta * Qtgt(bind), then back to target
// local space through the target hierarchy. Unmapped target bones (root, fingers, toe leaves)
// keep the game's Idle_Loop pose. Hips translation drives pelvis position relative to the
// idle pelvis (vertical kept; net horizontal travel removed unless --keep-travel). Output is
// resampled to --fps, trimmed to the motion, and eased into and out of Idle_Loop's first frame.
// Prints each clip's duration and an estimated contact frame (kicking foot's farthest reach).
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';

const args = process.argv.slice(2);
const opt = { out: 'public/assets/anims_mocap.glb', fps: 30, keepTravel: false, target: 'public/assets/hero_m.glb', idle: 'public/assets/anims1.glb' };
const jobs = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') opt.out = args[++i];
  else if (a === '--fps') opt.fps = Number(args[++i]);
  else if (a === '--keep-travel') opt.keepTravel = true;
  else if (a === '--target') opt.target = args[++i];
  else if (a.includes('=')) { const [name, file] = a.split('='); jobs.push({ name, file }); }
}
if (!jobs.length) { console.error('no clips given (Name=file.glb)'); process.exit(1); }

// Source bone -> target bone. Meshy names its spine chain from the top down: Spine02 sits on
// the hips and Spine carries the shoulders.
const MAP = {
  Hips: 'pelvis', Spine02: 'spine_01', Spine01: 'spine_02', Spine: 'spine_03', neck: 'neck_01', Head: 'Head',
  LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
  RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r', RightToeBase: 'ball_r',
};
const KICK_FOOT = 'ball_r';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const V = (a) => new THREE.Vector3(...a), Q = (a) => new THREE.Quaternion(...a);
// Rotation of a possibly scaled matrix (the Meshy armature carries a 0.01 unit scale).
const rotationOf = (m) => { const q = new THREE.Quaternion(); m.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; };

// ---- rig description from a glTF document: joints, parents, rest TRS, bind world matrices ----
function describeRig(doc) {
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const info = new Map();
  const byNode = new Map();
  joints.forEach((node, i) => {
    const m = new THREE.Matrix4().fromArray(ibm.getElement(i, [])).invert();
    const bindPos = new THREE.Vector3(), bindRot = new THREE.Quaternion(), s = new THREE.Vector3();
    m.decompose(bindPos, bindRot, s);
    const j = { name: node.getName(), node, parent: null, children: [], t: V(node.getTranslation()), r: Q(node.getRotation()), s: V(node.getScale()), bindRot, bindPos };
    info.set(j.name, j);
    byNode.set(node, j);
  });
  for (const j of info.values()) {
    const p = j.node.getParentNode();
    j.parent = p && byNode.has(p) ? byNode.get(p) : null;
    if (j.parent) j.parent.children.push(j);
    // Transform of the joint's non-joint ancestors (armature scale, etc.).
    j.above = new THREE.Matrix4();
    let a = j.parent ? null : p;
    while (a) { j.above.premultiply(new THREE.Matrix4().compose(V(a.getTranslation()), Q(a.getRotation()), V(a.getScale()))); a = a.getParentNode(); }
  }
  const order = [];
  const visit = (j) => { order.push(j); for (const c of j.children) visit(c); };
  for (const j of info.values()) if (!j.parent) visit(j);
  return { info, order, roots: order.filter((j) => !j.parent) };
}

// ---- animation sampling ----
function channelsOf(anim) {
  const chans = new Map();
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode().getName(), path = ch.getTargetPath();
    const s = ch.getSampler();
    const times = Array.from(s.getInput().getArray()), values = Array.from(s.getOutput().getArray());
    chans.set(`${node}.${path}`, { times, values, size: s.getOutput().getElementSize(), interp: s.getInterpolation() });
  }
  return chans;
}
function sample(ch, t, out) {
  const { times, values, size, interp } = ch;
  let i = 0;
  while (i < times.length - 1 && times[i + 1] <= t) i++;
  const j = Math.min(i + 1, times.length - 1);
  const k = interp === 'STEP' || j === i ? 0 : THREE.MathUtils.clamp((t - times[i]) / (times[j] - times[i]), 0, 1);
  if (size === 4) {
    const a = new THREE.Quaternion().fromArray(values, i * 4), b = new THREE.Quaternion().fromArray(values, j * 4);
    return out.copy(a).slerp(b, k);
  }
  const a = new THREE.Vector3().fromArray(values, i * 3), b = new THREE.Vector3().fromArray(values, j * 3);
  return out.copy(a).lerp(b, k);
}

// World rotation of every source joint at time t (rotations only; uniform armature scale
// does not change them).
function sourceWorldRotations(rig, chans, t) {
  const world = new Map();
  const q = new THREE.Quaternion();
  for (const j of rig.order) {
    const rot = chans.get(`${j.name}.rotation`);
    const local = rot ? sample(rot, t, q).clone() : j.r.clone();
    const parent = j.parent ? world.get(j.parent.name) : rotationOf(j.above);
    world.set(j.name, parent.clone().multiply(local));
  }
  return world;
}
function sourceHipsPosition(rig, chans, t) {
  const hips = rig.info.get('Hips');
  const tr = chans.get('Hips.translation');
  const local = tr ? sample(tr, t, new THREE.Vector3()) : hips.t.clone();
  return local.applyMatrix4(hips.above);
}

// ---- target ----
const targetDoc = await io.read(opt.target);
const target = describeRig(targetDoc);
const idleDoc = await io.read(opt.idle);
const idleAnim = idleDoc.getRoot().listAnimations().find((a) => a.getName() === 'Idle_Loop');
const idleChans = channelsOf(idleAnim);
const idleRot = new Map(), idlePos = new Map();
for (const j of target.order) {
  const r = idleChans.get(`${j.name}.rotation`);
  idleRot.set(j.name, r ? new THREE.Quaternion().fromArray(r.values, 0) : j.r.clone());
  const p = idleChans.get(`${j.name}.translation`);
  idlePos.set(j.name, p ? new THREE.Vector3().fromArray(p.values, 0) : j.t.clone());
}
const pelvis = target.info.get('pelvis');
const rootRot = target.roots[0].bindRot.clone();
const idlePelvisWorld = idlePos.get('pelvis').clone().applyQuaternion(rootRot);
const bindRotOf = (name) => target.info.get(name).bindRot;

// Mixamo-style pose -> target local rotations for one frame. `yaw` turns the whole pose
// about the vertical axis (used to aim the kick straight ahead).
function retargetFrame(srcRig, chans, t, yaw = 0) {
  const srcWorld = sourceWorldRotations(srcRig, chans, t);
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const world = new Map();
  const locals = new Map();
  const srcOf = new Map(Object.entries(MAP).map(([s, tg]) => [tg, s]));
  for (const j of target.order) {
    const parentWorld = j.parent ? world.get(j.parent.name) : new THREE.Quaternion();
    const src = srcOf.get(j.name);
    let local, w;
    if (src && srcRig.info.has(src)) {
      const sj = srcRig.info.get(src);
      const delta = srcWorld.get(src).clone().multiply(sj.bindRot.clone().invert());
      w = yawQ.clone().multiply(delta).multiply(bindRotOf(j.name));
      local = parentWorld.clone().invert().multiply(w);
    } else {
      local = idleRot.get(j.name).clone();
      w = parentWorld.clone().multiply(local);
    }
    world.set(j.name, w);
    locals.set(j.name, local.normalize());
  }
  return { locals, world };
}

// Positions of target joints for a frame (for contact and planting diagnostics).
function targetPositions(locals, pelvisLocalPos) {
  const pos = new Map(), worldQ = new Map();
  for (const j of target.order) {
    const local = locals.get(j.name);
    if (!j.parent) { pos.set(j.name, j.t.clone()); worldQ.set(j.name, local.clone()); continue; }
    const pq = worldQ.get(j.parent.name), pp = pos.get(j.parent.name);
    const tr = j.name === 'pelvis' ? pelvisLocalPos : j.t;
    pos.set(j.name, tr.clone().applyQuaternion(pq).add(pp));
    worldQ.set(j.name, pq.clone().multiply(local));
  }
  return pos;
}

const ease = (k) => k * k * (3 - 2 * k);
const idleLocalPelvis = idlePelvisWorld.clone().applyQuaternion(rootRot.clone().invert());
const idleLowestToe = (() => { const p = targetPositions(idleRot, idleLocalPelvis); return Math.min(p.get('ball_l').y, p.get('ball_r').y); })();

async function retargetClip(name, file) {
  const doc = await io.read(file);
  const rig = describeRig(doc);
  const anim = doc.getRoot().listAnimations()[0];
  const chans = channelsOf(anim);
  let dur = 0;
  for (const c of chans.values()) dur = Math.max(dur, c.times[c.times.length - 1]);
  const dt = 1 / opt.fps;
  const n = Math.floor(dur / dt) + 1;
  // Pass A: full-rate frames, unyawed, to find the move and the kick direction.
  const raw = [];
  for (let i = 0; i < n; i++) raw.push({ t: i * dt, locals: retargetFrame(rig, chans, i * dt).locals, hips: sourceHipsPosition(rig, chans, i * dt) });
  const energy = raw.map((f, i) => {
    if (i === 0) return 0;
    let e = 0;
    for (const j of target.order) e += Math.abs(f.locals.get(j.name).angleTo(raw[i - 1].locals.get(j.name)));
    return e + f.hips.distanceTo(raw[i - 1].hips) * 10;
  });
  const peak = Math.max(...energy);
  const active = energy.map((e) => e > peak * 0.4);
  let first = active.indexOf(true), last = active.lastIndexOf(true);
  if (first < 0) { first = 0; last = n - 1; }
  const start = Math.max(0, first - Math.round(0.1 * opt.fps));
  const end = Math.min(n - 1, last + Math.round(0.15 * opt.fps));
  const idx = [];
  for (let i = start; i <= end; i++) idx.push(i);
  const h0 = raw[start].hips.clone();
  const pelvisLocalAt = (hips, dy = 0) => {
    const d = hips.clone().sub(h0);
    if (!opt.keepTravel) { d.x = 0; d.z = 0; }
    d.y += dy;
    return idlePelvisWorld.clone().add(d).applyQuaternion(rootRot.clone().invert());
  };
  let contactIdx = 0, best = -1;
  idx.forEach((i, k) => {
    const p = targetPositions(raw[i].locals, pelvisLocalAt(raw[i].hips));
    const d = p.get(KICK_FOOT).clone().sub(p.get('pelvis')); d.y = 0;
    if (d.length() > best) { best = d.length(); contactIdx = k; }
  });
  const pc = targetPositions(raw[idx[contactIdx]].locals, pelvisLocalAt(raw[idx[contactIdx]].hips));
  const aim = pc.get(KICK_FOOT).clone().sub(pc.get('pelvis'));
  const yaw = -Math.atan2(aim.x, aim.z);
  // Pass B: yawed so the kick lands straight ahead, then aligned so the lowest planted toe
  // sits where the idle's does (joint pivots differ between the two rigs).
  const lead = Math.round(0.08 * opt.fps), tail = Math.round(0.15 * opt.fps);
  const kept = idx.map((i) => ({ locals: retargetFrame(rig, chans, i * dt, yaw).locals, hips: raw[i].hips }));
  let lowest = Infinity;
  kept.forEach((f, k) => {
    if (k < lead || k > kept.length - 1 - tail) return;
    const p = targetPositions(f.locals, pelvisLocalAt(f.hips));
    lowest = Math.min(lowest, p.get('ball_l').y, p.get('ball_r').y);
  });
  const dy = idleLowestToe - lowest;
  const times = [], rot = new Map(target.order.map((j) => [j.name, []])), pelvisPos = [], posFrames = [];
  kept.forEach((f, k) => {
    times.push(k * dt);
    const w = k < lead ? ease(k / lead) : k > kept.length - 1 - tail ? ease((kept.length - 1 - k) / tail) : 1;
    const pLocal = idleLocalPelvis.clone().lerp(pelvisLocalAt(f.hips, dy), w);
    pelvisPos.push(pLocal);
    const locals = new Map();
    for (const j of target.order) {
      const q = w >= 1 ? f.locals.get(j.name).clone() : idleRot.get(j.name).clone().slerp(f.locals.get(j.name), w);
      // Keep neighbouring keys on the same hemisphere so slerp never takes the long way.
      const prev = rot.get(j.name)[k - 1];
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      rot.get(j.name).push(q);
      locals.set(j.name, q);
    }
    posFrames.push(targetPositions(locals, pLocal));
  });
  const contact = times[contactIdx];
  const lowestToe = posFrames.map((p) => Math.min(p.get('ball_l').y, p.get('ball_r').y));
  console.log(`${name}: source ${dur.toFixed(2)} s, kept ${times[times.length - 1].toFixed(2)} s (frames ${start}-${end} of ${n}), contact ~${contact.toFixed(2)} s, reach ${best.toFixed(2)} m, yaw ${THREE.MathUtils.radToDeg(yaw).toFixed(0)} deg, toe lift ${dy.toFixed(3)} m`);
  if (process.env.DEBUG_T) {
    console.log(`  energy: ${energy.map((e) => e.toFixed(2)).join(' ')}`);
    console.log(`  lowest toe y: ${lowestToe.map((v) => v.toFixed(2)).join(' ')}`);
    console.log(`  ball_l xz: ${posFrames.map((p) => `${p.get('ball_l').x.toFixed(2)},${p.get('ball_l').z.toFixed(2)}`).join(' ')}`);
    console.log(`  ball_r xz: ${posFrames.map((p) => `${p.get('ball_r').x.toFixed(2)},${p.get('ball_r').z.toFixed(2)}`).join(' ')}`);
  }
  return { name, times, rot, pelvisPos, duration: times[times.length - 1], contact };
}

// ---- output document: the target joint hierarchy (no mesh) plus one animation per clip ----
const out = new Document();
const buffer = out.createBuffer();
const scene = out.createScene('Scene');
const nodes = new Map();
for (const j of target.order) {
  const node = out.createNode(j.name).setTranslation(j.t.toArray()).setRotation(j.r.toArray()).setScale(j.s.toArray());
  nodes.set(j.name, node);
  if (j.parent) nodes.get(j.parent.name).addChild(node);
}
const armature = out.createNode('Armature');
for (const r of target.roots) armature.addChild(nodes.get(r.name));
scene.addChild(armature);

const results = [];
for (const job of jobs) results.push(await retargetClip(job.name, job.file));
for (const clip of results) {
  const anim = out.createAnimation(clip.name);
  const input = out.createAccessor().setType('SCALAR').setArray(new Float32Array(clip.times)).setBuffer(buffer);
  for (const j of target.order) {
    const qs = clip.rot.get(j.name);
    const arr = new Float32Array(qs.length * 4);
    qs.forEach((q, i) => arr.set([q.x, q.y, q.z, q.w], i * 4));
    const output = out.createAccessor().setType('VEC4').setArray(arr).setBuffer(buffer);
    const sampler = out.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
    const channel = out.createAnimationChannel().setTargetNode(nodes.get(j.name)).setTargetPath('rotation').setSampler(sampler);
    anim.addSampler(sampler).addChannel(channel);
  }
  const parr = new Float32Array(clip.pelvisPos.length * 3);
  clip.pelvisPos.forEach((p, i) => parr.set([p.x, p.y, p.z], i * 3));
  const poutput = out.createAccessor().setType('VEC3').setArray(parr).setBuffer(buffer);
  const psampler = out.createAnimationSampler().setInput(input).setOutput(poutput).setInterpolation('LINEAR');
  anim.addSampler(psampler).addChannel(out.createAnimationChannel().setTargetNode(nodes.get('pelvis')).setTargetPath('translation').setSampler(psampler));
}
await io.write(opt.out, out);
console.log(`wrote ${opt.out}: ${results.map((r) => `${r.name} ${r.duration.toFixed(2)}s contact ${r.contact.toFixed(2)}s`).join('; ')}`);
