import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PALETTE } from '../config/palette.js';
import { batOutline } from '../config/batShape.js';
import { toonMaterial, addHullOutline, addXray } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';
import { createAnimator } from './animator.js';
import { attachRigid, measureBody, surfaceFrontZ, bindPosition } from './rig.js';
import { wear, duotone, hideBody, addRim, isSkinMaterial } from './outfitParts.js';
import { classifySuitVertex, classifyGoonVertex, classifyJokerVertex, SUIT_COLORS, GOON_COLORS, GOON_STRIPES, JOKER_COLORS } from './outfits.js';

function splitMeshes(model) {
  const meshes = [];
  model.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const eyes = meshes.find((m) => m.name === 'Eyes');
  const brows = meshes.find((m) => m.name === 'Eyebrows');
  const body = meshes.find((m) => m !== eyes && m !== brows);
  return { body, eyes, brows };
}

function paintRegions(mesh, classify, colors, lm) {
  mesh.geometry = mesh.geometry.clone();
  const pos = mesh.geometry.attributes.position;
  const out = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const p = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pos.count; i++) {
    p.x = pos.getX(i); p.y = pos.getY(i); p.z = pos.getZ(i);
    c.setHex(colors[classify(p, lm)]);
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(out, 3));
}

function makeCharacter(assets, bodyKey) {
  const root = new THREE.Group();
  // root (position, yaw) -> tilt (pitch/roll around the hips) -> model
  const tilt = new THREE.Group();
  tilt.position.y = 1;
  root.add(tilt);
  const model = SkeletonUtils.clone(assets.bodies[bodyKey]);
  model.position.y = -1;
  tilt.add(model);
  const parts = splitMeshes(model);
  const lm = measureBody(parts.body, parts.eyes);
  const animator = createAnimator(model, assets.clips);
  // Foot planting: the borrowed clips carry the hips ~4 cm lower than this body's proportions,
  // which sinks the soles into the floor. After each animation step, lift the model so the
  // lower toe sits where it does in the bind pose. Tilted poses (gliding) are left alone.
  const balls = [model.getObjectByName('ball_l'), model.getObjectByName('ball_r')];
  const ballRest = bindBallHeight(parts.body);
  const probe = new THREE.Vector3();
  let lift = 0;
  const advance = animator.update;
  animator.update = (dt) => {
    advance(dt);
    if (Math.abs(tilt.rotation.x) > 0.05 || Math.abs(tilt.rotation.z) > 0.05) { lift *= 0.8; model.position.y = -1 + lift; return; }
    root.updateMatrixWorld(true);
    let low = Infinity;
    for (const b of balls) { b.getWorldPosition(probe); root.worldToLocal(probe); low = Math.min(low, probe.y); }
    const want = Math.max(0, ballRest - (low - lift));
    lift += (want - lift) * Math.min(1, dt * 25 + 0.2);
    model.position.y = -1 + lift;
  };
  const ch = {
    root, tilt, model, lm, animator, ...parts, yaw: 0,
    bone: (name) => model.getObjectByName(name),
    face(yaw) { ch.yaw = yaw; root.rotation.y = yaw + (lm.fwd < 0 ? Math.PI : 0); },
    forward: (out = new THREE.Vector3()) => out.set(Math.sin(ch.yaw), 0, Math.cos(ch.yaw)),
    headWorld(out, lift = 0) { ch.bone('Head').getWorldPosition(out); out.y += lift; return out; },
  };
  return ch;
}

function bindBallHeight(body) {
  const i = body.skeleton.bones.findIndex((b) => b.name === 'ball_l');
  return new THREE.Vector3().setFromMatrixPosition(body.skeleton.boneInverses[i].clone().invert()).applyMatrix4(body.bindMatrixInverse).y;
}

// Moves the triangles whose vertices all satisfy pick(p) (bind-pose position) into a second
// skinned mesh that shares the body's attributes and skeleton and wears its own material.
function splitBody(body, pick, material) {
  const g = body.geometry;
  const pos = g.attributes.position;
  const idx = g.index.array;
  const sel = new Uint8Array(pos.count);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); sel[i] = pick(p) ? 1 : 0; }
  const keep = [], moved = [];
  for (let t = 0; t < idx.length; t += 3) (sel[idx[t]] && sel[idx[t + 1]] && sel[idx[t + 2]] ? moved : keep).push(idx[t], idx[t + 1], idx[t + 2]);
  g.setIndex(keep);
  const g2 = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) g2.setAttribute(name, attr);
  g2.setIndex(moved);
  const part = new THREE.SkinnedMesh(g2, material);
  part.bind(body.skeleton, body.bindMatrix);
  part.frustumCulled = false;
  part.castShadow = true;
  body.parent.add(part);
  return part;
}

function rigidMesh(geometry, material, pos, rotation = new THREE.Euler()) {
  const m = new THREE.Mesh(geometry, material);
  m.position.copy(pos);
  m.rotation.copy(rotation);
  m.castShadow = true;
  return m;
}

export function createBat(assets, suit = 'm') {
  const ch = makeCharacter(assets, suit === 'f' ? 'f' : 'm');
  const { body, eyes, brows, lm } = ch;
  const colors = SUIT_COLORS[suit];
  const paint = suit !== 'gold' ? assets.suitTex?.[suit] : null;
  if (paint) {
    body.geometry = body.geometry.clone();
    // The paint carries the muscle detail; the body's normal map only adds a little relief so it
    // does not muddy the flat comic shading.
    body.material = toonMaterial({ map: paint, normalMap: body.material.normalMap, normalScale: 0.45 });
    // The head is its own mesh: no normal map, shadows lifted so the face stays a flat skin tone,
    // and on LAYER_FX so the crease pass does not ink the nose and lips. Its silhouette comes from
    // the depth pass plus a thin hull (a wide hull pokes through at the nostrils and lip crease).
    ch.head = splitBody(body, (p) => p.y > lm.neckY - 0.02, addRim(toonMaterial({ map: paint }), 0x9fc3ff, 0.8, [0.5, 0.62], 0.55));
    ch.head.layers.set(LAYER_FX);
    addHullOutline(ch.head, 0.004);
  } else {
    paintRegions(body, classifySuitVertex, colors, lm);
    body.material = toonMaterial({ vertexColors: true, normalMap: body.material.normalMap, palette: Object.values(colors) });
  }
  body.castShadow = true;
  eyes.visible = false;
  brows.visible = false;
  addHullOutline(body, 0.011);

  // White comic lenses, slanted like a frown.
  const lensMat = new THREE.MeshBasicMaterial({ color: PALETTE.paper });
  for (const side of [-1, 1]) {
    const lens = rigidMesh(
      new THREE.CircleGeometry(1, 20).scale(0.02, 0.0085, 1), lensMat,
      new THREE.Vector3(side * lm.eyeSpread, lm.eyeY + 0.003, lm.eyeFrontZ + 0.012 * lm.fwd),
      new THREE.Euler(0, (lm.fwd < 0 ? Math.PI : 0) + side * 0.4 * lm.fwd, -side * 0.3),
    );
    lens.castShadow = false;
    attachRigid(body, 'Head', lens);
  }

  const cowlMat = addRim(toonMaterial({ color: colors.cowl }));
  // Tall, slightly swept-back ears with a flat inner face, like the classic cowl.
  const earShape = new THREE.Shape([new THREE.Vector2(-0.03, 0), new THREE.Vector2(0.03, 0), new THREE.Vector2(0.004, 0.14)]);
  const earGeo = new THREE.ExtrudeGeometry(earShape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 1 }).translate(0, 0, -0.0175);
  for (const side of [-1, 1]) {
    const ear = rigidMesh(
      earGeo, cowlMat,
      new THREE.Vector3(side * lm.headRadius * 0.58, lm.headTop - 0.035, lm.headCenter.z - 0.01 * lm.fwd),
      new THREE.Euler(-0.12 * lm.fwd, 0, -side * 0.1),
    );
    attachRigid(body, 'Head', ear);
    addHullOutline(ear, 0.006);
  }

  // Gear from the outfit pack: boots and gauntlets, recolored to the suit. The body's own
  // shins and forearms are hidden under them.
  const gear = { a: [0x0b0b12, colors.boot], b: [0x0b0b12, colors.boot] };
  const glove = { a: [0x0b0b12, colors.glove], b: [0x0b0b12, colors.glove] };
  const female = suit === 'f';
  hideBody(body, (p) => p.y < lm.kneeY - 0.14 || Math.abs(p.x) > lm.elbowX + 0.07);
  wear(ch, assets.outfits, female ? 'Female_Ranger_Feet' : 'Male_Ranger_Feet_Boots', (m) => duotone(m.map, m.normalMap, gear));
  wear(ch, assets.outfits, female ? 'Female_Ranger_Arms' : 'Male_Ranger_Arms', (m) => (isSkinMaterial(m)
    ? addRim(toonMaterial({ color: colors.glove }))
    : duotone(m.map, m.normalMap, glove)));
  // Three fins on each gauntlet.
  const finMat = addRim(toonMaterial({ color: colors.glove }));
  const finGeo = new THREE.ConeGeometry(0.018, 0.075, 3).rotateZ(Math.PI / 2);
  for (const [bone, side] of [['lowerarm_l', 1], ['lowerarm_r', -1]]) {
    const elbow = bindPosition(body, bone);
    for (let k = 0; k < 3; k++) {
      const fin = rigidMesh(finGeo, finMat, new THREE.Vector3(elbow.x + side * (0.08 + k * 0.045), elbow.y - 0.045, elbow.z - 0.01 * lm.fwd), new THREE.Euler(0, 0, side * 0.4));
      attachRigid(body, bone, fin);
      addHullOutline(fin, 0.004);
    }
  }
  // Utility belt: pouches and a buckle around the waist.
  const pouchMat = addRim(toonMaterial({ color: colors.belt }));
  const waist = lm.beltY;
  const hipZ = bindPosition(body, 'pelvis').z;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.abs(Math.cos(a)) > 0.9 && Math.cos(a) * lm.fwd > 0) continue;
    const r = lm.hipHalfWidth * 0.78;
    const pouch = rigidMesh(new THREE.BoxGeometry(0.055, 0.07, 0.035), pouchMat,
      new THREE.Vector3(Math.sin(a) * r, waist - 0.005, hipZ + Math.cos(a) * r * 0.72), new THREE.Euler(0, a, 0));
    attachRigid(body, 'pelvis', pouch);
    addHullOutline(pouch, 0.004);
  }
  const buckle = rigidMesh(new THREE.BoxGeometry(0.075, 0.055, 0.02), pouchMat,
    new THREE.Vector3(0, waist, surfaceFrontZ(body, waist, lm.fwd) + 0.012 * lm.fwd), new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0));
  attachRigid(body, 'pelvis', buckle);
  addHullOutline(buckle, 0.004);
  body.material = addRim(body.material);

  // The painted suits carry the emblem in their texture; the gold suit (vertex regions) wears a
  // flat emblem mesh on the chest instead.
  if (!paint) {
    const shape = new THREE.Shape(batOutline().map(([x, y]) => new THREE.Vector2(x, y)));
    // The female body's emblem sits above the bust, on the flat of the upper chest.
    const emblemY = lm.chestY + (suit === 'f' ? 0.085 : 0);
    const emblemZ = suit === 'f' ? surfaceFrontZ(body, emblemY, lm.fwd) : lm.chestFrontZ;
    const emblemGeo = new THREE.ShapeGeometry(shape).scale(suit === 'f' ? 0.0024 : 0.0033, suit === 'f' ? 0.0024 : 0.0033, 1);
    const emblem = rigidMesh(
      emblemGeo,
      new THREE.MeshBasicMaterial({ color: colors.emblem, polygonOffset: true, polygonOffsetFactor: -2 }),
      new THREE.Vector3(0, emblemY, emblemZ + 0.012 * lm.fwd),
      new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0),
    );
    emblem.castShadow = false;
    attachRigid(body, 'spine_03', emblem);
  }

  if (suit === 'f') {
    const src = [];
    assets.hair.traverse((o) => { if (o.isMesh) src.push(o); });
    for (const h of src) {
      // Shrink toward the head center so the cowl covers the crown and only the long fall shows.
      const c = lm.headCenter;
      const geo = h.geometry.clone().translate(-c.x, -c.y, -c.z).scale(0.9, 0.9, 0.95).translate(c.x, c.y - 0.01, c.z - 0.01 * lm.fwd);
      const hair = rigidMesh(geo, addRim(toonMaterial({ color: PALETTE.hairRed }), 0xffc9a0, 0.4), new THREE.Vector3());
      attachRigid(body, 'Head', hair);
      addHullOutline(hair, 0.006);
    }
  }

  ch.suit = suit;
  ch.colors = colors;
  ch.animator.play('Idle_Loop');
  return ch;
}

// Mask art: a few grins so a crowd of goons doesn't look cloned.
function maskTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#efe6cf';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#0b0b12';
  g.strokeStyle = '#0b0b12';
  g.lineWidth = 10;
  if (kind === 'hockey') {
    for (const [x, y, r] of [[88, 104, 16], [168, 104, 16], [128, 170, 7], [104, 190, 6], [152, 190, 6], [128, 140, 6]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#c8323c';
    for (const x of [70, 186]) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x + 14, 84); g.lineTo(x - 14, 84); g.closePath(); g.fill(); }
  } else {
    const diamond = (x) => { g.beginPath(); g.moveTo(x, 70); g.lineTo(x + 20, 104); g.lineTo(x, 138); g.lineTo(x - 20, 104); g.closePath(); g.fill(); };
    if (kind === 'sad') { for (const x of [88, 168]) { g.beginPath(); g.arc(x, 104, 16, 0, Math.PI * 2); g.fill(); g.fillRect(x - 3, 118, 6, 40); } }
    else diamond(88), diamond(168);
    g.fillStyle = '#c8323c';
    g.beginPath();
    if (kind === 'sad') { g.moveTo(70, 205); g.quadraticCurveTo(128, 150, 186, 205); g.quadraticCurveTo(128, 175, 70, 205); }
    else if (kind === 'zigzag') { g.moveTo(60, 170); for (let i = 0; i <= 8; i++) g.lineTo(60 + i * 17, 170 + (i % 2 ? 22 : 0)); g.lineTo(196, 200); g.lineTo(60, 200); }
    else { g.moveTo(64, 160); g.quadraticCurveTo(128, 238, 192, 160); g.quadraticCurveTo(128, 196, 64, 160); }
    g.closePath();
    g.fill(); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const MASK_TEXTURES = new Map();
const maskTex = (k) => { if (!MASK_TEXTURES.has(k)) MASK_TEXTURES.set(k, maskTexture(k)); return MASK_TEXTURES.get(k); };

// Goon wardrobes: outfit parts plus palette schemes ([shadow, light] for green / other texels).
const GOON_LOOKS = {
  striped: { parts: ['Male_Peasant_Body', 'Male_Peasant_Legs', 'Male_Peasant_Feet', 'Male_Peasant_Arms'], hat: 'beanie' },
  hoodie: { parts: ['Male_Ranger_Body', 'Male_Peasant_Legs', 'Male_Ranger_Feet_Boots', 'Male_Peasant_Arms', 'Male_Ranger_Head_Hood'], hat: null },
  knife: { parts: ['Male_Ranger_Body', 'Male_Ranger_Legs', 'Male_Ranger_Feet_Boots', 'Male_Ranger_Arms'], hat: 'bandana' },
  brute: { parts: ['Male_Ranger_Body', 'Male_Ranger_Legs', 'Male_Ranger_Feet_Boots', 'Male_Peasant_Arms', 'Male_Ranger_Acc_Pauldron'], hat: null },
};
const GOON_SCHEMES = [
  // [dark cloth, light cloth] per region: green-painted texels (a) and the rest (b).
  { a: [0x6c3fa3, 0x62c141], b: [0x4a2a78, 0xd8d0bc] },
  { a: [0x3c7a2a, 0x2a2a34], b: [0x2e2a40, 0x62c141] },
  { a: [0xa8323c, 0x2a2a34], b: [0x3a1a40, 0xe0d6c0] },
  { a: [0x2a3a58, 0x8fb0d8], b: [0x2c2c36, 0xa8323c] },
];
const BEANIES = [PALETTE.pants, 0x3a2a24, 0x2f3f5a, 0x4a3a52];

let goonBody = null;

// type: 'grunt' | 'knife' | 'brute'
export function createGoon(assets, { type = 'grunt', rng = null } = {}) {
  const pick = (arr) => arr[Math.floor((rng ? rng.next() : Math.random()) * arr.length)];
  const ch = makeCharacter(assets, 'm');
  const { body, eyes, brows, lm } = ch;
  const brute = type === 'brute';
  const look = GOON_LOOKS[brute ? 'brute' : type === 'knife' ? 'knife' : pick(['striped', 'striped', 'hoodie'])];
  const scheme = type === 'knife' ? GOON_SCHEMES[1] : brute ? GOON_SCHEMES[3] : pick(GOON_SCHEMES);
  // Every goon's painted, trimmed body is identical, so they all share one geometry: a new copy
  // per goon meant megabytes of vertex upload (a 30 ms hitch) each time a wave spawned.
  if (goonBody) body.geometry = goonBody;
  else {
    paintRegions(body, classifyGoonVertex, GOON_COLORS, lm);
    // Only the head and neck of the base body show; clothes (with their own hands) cover the rest.
    hideBody(body, (p) => p.y < lm.neckY - 0.02 || Math.abs(p.x) > 0.16);
    goonBody = body.geometry;
  }
  body.material = addRim(toonMaterial({ vertexColors: true, normalMap: body.material.normalMap, normalScale: 0.5, palette: Object.values(GOON_COLORS) }), 0x9fc3ff, 0.55);
  body.castShadow = true;
  eyes.visible = false;
  brows.visible = false;
  addHullOutline(body, brute ? 0.013 : 0.011);
  ch.xray = addXray(body);
  const skin = addRim(toonMaterial({ color: PALETTE.skinGoon }), 0x9fc3ff, 0.5);
  const clothes = [];
  for (const part of look.parts) {
    clothes.push(...wear(ch, assets.outfits, part, (m) => (isSkinMaterial(m) ? skin : duotone(m.map, m.normalMap, scheme)), { outline: brute ? 0.012 : 0.009 }));
  }
  for (const m of clothes) addXray(m);
  if (brute) ch.root.scale.setScalar(1.25);

  const r = lm.headRadius * 1.12;
  const maskGeo = new THREE.SphereGeometry(r, 24, 16, Math.PI * 0.025, Math.PI * 0.95, Math.PI * 0.2, Math.PI * 0.55);
  const kind = brute ? 'hockey' : pick(['smile', 'smile', 'sad', 'zigzag']);
  const mask = rigidMesh(
    maskGeo, addRim(toonMaterial({ map: maskTex(kind) }), 0xffffff, 0.35),
    lm.headCenter.clone().add(new THREE.Vector3(0, -0.01, 0.012 * lm.fwd)),
    new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0),
  );
  attachRigid(body, 'Head', mask);
  addHullOutline(mask, 0.005);

  if (look.hat === 'bandana') {
    const band = rigidMesh(new THREE.CylinderGeometry(r * 1.03, r * 1.05, 0.06, 20, 1, true), toonMaterial({ color: PALETTE.balloon, side: THREE.DoubleSide }), lm.headCenter.clone().add(new THREE.Vector3(0, 0.045, 0)));
    attachRigid(body, 'Head', band);
  } else if (look.hat === 'beanie') {
    const beanie = rigidMesh(
      new THREE.SphereGeometry(r * 1.02, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      addRim(toonMaterial({ color: pick(BEANIES) })),
      lm.headCenter.clone().add(new THREE.Vector3(0, 0.03, 0)),
    );
    attachRigid(body, 'Head', beanie);
    addHullOutline(beanie, 0.006);
  }
  if (type === 'knife') {
    const hand = ch.bone('hand_r');
    const handPos = new THREE.Vector3().setFromMatrixPosition(body.skeleton.boneInverses[body.skeleton.bones.indexOf(hand)].clone().invert());
    const knife = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.035, 0.26).translate(0, 0, 0.17), toonMaterial({ color: 0xd8dde6 }));
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.1), toonMaterial({ color: PALETTE.ink }));
    knife.add(blade, grip);
    knife.position.copy(handPos).add(new THREE.Vector3(-0.05 * lm.fwd, -0.02, 0.02 * lm.fwd));
    if (lm.fwd < 0) knife.rotation.y = Math.PI;
    attachRigid(body, 'hand_r', knife);
    addHullOutline(blade, 0.004);
  }
  ch.type = type;
  ch.animator.play('Idle_Loop');
  return ch;
}

export function createJoker(assets) {
  const ch = makeCharacter(assets, 'm');
  const { body, eyes, brows, lm } = ch;
  paintRegions(body, classifyJokerVertex, JOKER_COLORS, lm);
  body.material = addRim(toonMaterial({ vertexColors: true, normalMap: body.material.normalMap, normalScale: 0.4, palette: Object.values(JOKER_COLORS) }), 0xc8ffb0, 0.5);
  body.castShadow = true;
  brows.visible = false;
  eyes.material = new THREE.MeshBasicMaterial({ color: 0xd8f0c0 });
  // A purple coat over a green vest, and gloved hands.
  hideBody(body, (p) => p.y < lm.neckY - 0.02 || Math.abs(p.x) > 0.16);
  addHullOutline(body, 0.012);
  ch.xray = addXray(body, PALETTE.jokerGreen);
  const suitScheme = { a: [0x3c8a2a, 0x7fd65a], b: [0x6c3fa3, 0xe8923a] };
  const glove = addRim(toonMaterial({ color: 0x8f5fcf }));
  for (const part of ['Male_Ranger_Body', 'Male_Ranger_Legs', 'Male_Peasant_Feet', 'Male_Ranger_Arms']) {
    for (const m of wear(ch, assets.outfits, part, (src) => (isSkinMaterial(src) ? glove : duotone(src.map, src.normalMap, suitScheme)))) addXray(m, PALETTE.jokerGreen);
  }
  // Spiky green hair from a crown of cones.
  const hairMat = toonMaterial({ color: 0x3f9e34 });
  const c = lm.headCenter;
  const r = lm.headRadius;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const back = Math.cos(a) * lm.fwd < 0.2;
    if (!back && i % 2) continue;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 6), hairMat);
    const dir = new THREE.Vector3(Math.sin(a) * 0.8, 0.9, Math.cos(a) * 0.8 - 0.25 * lm.fwd).normalize();
    cone.position.set(c.x + Math.sin(a) * r * 0.7, c.y + r * 0.7, c.z + Math.cos(a) * r * 0.7 - 0.02 * lm.fwd);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    attachRigid(body, 'Head', cone);
    addHullOutline(cone, 0.005);
  }
  const cap = rigidMesh(new THREE.SphereGeometry(r * 1.04, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hairMat, c.clone().add(new THREE.Vector3(0, 0.02, -0.01 * lm.fwd)));
  attachRigid(body, 'Head', cap);
  addHullOutline(cap, 0.005);
  // A flower in the lapel, naturally.
  const flower = rigidMesh(new THREE.IcosahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: PALETTE.neonPink }), new THREE.Vector3(0.1, lm.chestY + 0.06, lm.chestFrontZ + 0.02 * lm.fwd));
  attachRigid(body, 'spine_03', flower);
  ch.animator.play('Idle_FoldArms_Loop');
  return ch;
}
