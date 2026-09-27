import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PALETTE } from '../config/palette.js';
import { batOutline } from '../config/batShape.js';
import { toonMaterial, addHullOutline, addXray } from '../render/toon.js';
import { createAnimator } from './animator.js';
import { attachRigid, measureBody, surfaceFrontZ } from './rig.js';
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
  const ch = {
    root, tilt, model, lm, animator, ...parts, yaw: 0,
    bone: (name) => model.getObjectByName(name),
    face(yaw) { ch.yaw = yaw; root.rotation.y = yaw + (lm.fwd < 0 ? Math.PI : 0); },
    forward: (out = new THREE.Vector3()) => out.set(Math.sin(ch.yaw), 0, Math.cos(ch.yaw)),
    headWorld(out, lift = 0) { ch.bone('Head').getWorldPosition(out); out.y += lift; return out; },
  };
  return ch;
}

function rigidMesh(geometry, material, pos, rotation = new THREE.Euler()) {
  const m = new THREE.Mesh(geometry, material);
  m.position.copy(pos);
  m.rotation.copy(rotation);
  m.castShadow = true;
  return m;
}

export function createBat(assets, suit = 'm') {
  const ch = makeCharacter(assets, suit);
  const { body, eyes, brows, lm } = ch;
  const colors = SUIT_COLORS[suit];
  paintRegions(body, classifySuitVertex, colors, lm);
  body.material = toonMaterial({ vertexColors: true, normalMap: body.material.normalMap, palette: Object.values(colors) });
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

  const cowlMat = toonMaterial({ color: colors.cowl });
  for (const side of [-1, 1]) {
    const ear = rigidMesh(
      new THREE.ConeGeometry(0.022, 0.11, 10), cowlMat,
      new THREE.Vector3(side * lm.headRadius * 0.55, lm.headTop + 0.035, lm.headCenter.z),
      new THREE.Euler(0, 0, -side * 0.12),
    );
    attachRigid(body, 'Head', ear);
    addHullOutline(ear, 0.006);
  }

  const shape = new THREE.Shape(batOutline().map(([x, y]) => new THREE.Vector2(x, y)));
  // The female body's emblem sits above the bust, on the flat of the upper chest.
  const emblemY = lm.chestY + (suit === 'f' ? 0.085 : 0);
  const emblemZ = suit === 'f' ? surfaceFrontZ(body, emblemY, lm.fwd) : lm.chestFrontZ;
  const emblemGeo = new THREE.ShapeGeometry(shape).scale(suit === 'f' ? 0.0021 : 0.0026, suit === 'f' ? 0.0021 : 0.0026, 1);
  const emblem = rigidMesh(
    emblemGeo,
    new THREE.MeshBasicMaterial({ color: colors.emblem, polygonOffset: true, polygonOffsetFactor: -2 }),
    new THREE.Vector3(0, emblemY, emblemZ + 0.012 * lm.fwd),
    new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0),
  );
  emblem.castShadow = false;
  attachRigid(body, 'spine_03', emblem);

  if (suit === 'f') {
    const src = [];
    assets.hair.traverse((o) => { if (o.isMesh) src.push(o); });
    for (const h of src) {
      // Shrink toward the head center so the cowl covers the crown and only the long fall shows.
      const c = lm.headCenter;
      const geo = h.geometry.clone().translate(-c.x, -c.y, -c.z).scale(0.9, 0.9, 0.95).translate(c.x, c.y - 0.01, c.z - 0.01 * lm.fwd);
      const hair = rigidMesh(geo, toonMaterial({ color: PALETTE.hairRed }), new THREE.Vector3());
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

const STRIPE_ALTS = [PALETTE.jokerPurple, PALETTE.jokerGreen, 0x8a2a2a];
const BEANIES = [PALETTE.pants, 0x3a2a24, 0x2f3f5a, 0x4a3a52];

// type: 'grunt' | 'knife' | 'brute'
export function createGoon(assets, { type = 'grunt', rng = null } = {}) {
  const pick = (arr) => arr[Math.floor((rng ? rng.next() : Math.random()) * arr.length)];
  const ch = makeCharacter(assets, 'm');
  const { body, eyes, brows, lm } = ch;
  const brute = type === 'brute';
  const colors = brute ? { ...GOON_COLORS, shirt: 0x3a3f4a } : GOON_COLORS;
  paintRegions(body, classifyGoonVertex, colors, lm);
  body.material = toonMaterial({
    vertexColors: true, normalMap: body.material.normalMap, normalScale: brute ? 0.9 : 0.5,
    palette: Object.values(colors), stripes: brute ? null : { ...GOON_STRIPES, alt: type === 'knife' ? PALETTE.jokerGreen : pick(STRIPE_ALTS) },
  });
  body.castShadow = true;
  eyes.visible = false;
  brows.visible = false;
  addHullOutline(body, brute ? 0.013 : 0.011);
  ch.xray = addXray(body);
  if (brute) ch.root.scale.setScalar(1.25);

  const r = lm.headRadius * 1.12;
  const maskGeo = new THREE.SphereGeometry(r, 24, 16, Math.PI * 0.025, Math.PI * 0.95, Math.PI * 0.2, Math.PI * 0.55);
  const kind = brute ? 'hockey' : pick(['smile', 'smile', 'sad', 'zigzag']);
  const mask = rigidMesh(
    maskGeo, toonMaterial({ map: maskTex(kind) }),
    lm.headCenter.clone().add(new THREE.Vector3(0, -0.01, 0.012 * lm.fwd)),
    new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0),
  );
  attachRigid(body, 'Head', mask);
  addHullOutline(mask, 0.005);

  if (type === 'knife') {
    // Bandana instead of a beanie, and the knife itself.
    const band = rigidMesh(new THREE.CylinderGeometry(r * 1.03, r * 1.05, 0.06, 20, 1, true), toonMaterial({ color: PALETTE.balloon, side: THREE.DoubleSide }), lm.headCenter.clone().add(new THREE.Vector3(0, 0.045, 0)));
    attachRigid(body, 'Head', band);
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
  } else if (!brute) {
    const beanie = rigidMesh(
      new THREE.SphereGeometry(r * 1.02, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      toonMaterial({ color: pick(BEANIES) }),
      lm.headCenter.clone().add(new THREE.Vector3(0, 0.03, 0)),
    );
    attachRigid(body, 'Head', beanie);
    addHullOutline(beanie, 0.006);
  }
  ch.type = type;
  ch.animator.play('Idle_Loop');
  return ch;
}

export function createJoker(assets) {
  const ch = makeCharacter(assets, 'm');
  const { body, eyes, brows, lm } = ch;
  paintRegions(body, classifyJokerVertex, JOKER_COLORS, lm);
  body.material = toonMaterial({ vertexColors: true, normalMap: body.material.normalMap, normalScale: 0.4, palette: Object.values(JOKER_COLORS) });
  body.castShadow = true;
  brows.visible = false;
  eyes.material = new THREE.MeshBasicMaterial({ color: 0xd8f0c0 });
  addHullOutline(body, 0.012);
  ch.xray = addXray(body, PALETTE.jokerGreen);
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
