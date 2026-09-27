import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PALETTE } from '../config/palette.js';
import { batOutline } from '../config/batShape.js';
import { toonMaterial, addHullOutline, addXray } from '../render/toon.js';
import { createAnimator } from './animator.js';
import { attachRigid, measureBody, surfaceFrontZ } from './rig.js';
import { classifySuitVertex, classifyGoonVertex, SUIT_COLORS, GOON_COLORS, GOON_STRIPES } from './outfits.js';

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

function clownMaskTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#efe6cf';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#0b0b12';
  for (const x of [88, 168]) {
    g.beginPath();
    g.moveTo(x, 70); g.lineTo(x + 20, 104); g.lineTo(x, 138); g.lineTo(x - 20, 104);
    g.closePath(); g.fill();
  }
  g.lineWidth = 10;
  g.strokeStyle = '#0b0b12';
  g.fillStyle = '#c8323c';
  g.beginPath();
  g.moveTo(64, 160);
  g.quadraticCurveTo(128, 238, 192, 160);
  g.quadraticCurveTo(128, 196, 64, 160);
  g.fill(); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGoon(assets) {
  const ch = makeCharacter(assets, 'm');
  const { body, eyes, brows, lm } = ch;
  paintRegions(body, classifyGoonVertex, GOON_COLORS, lm);
  body.material = toonMaterial({
    vertexColors: true, normalMap: body.material.normalMap, normalScale: 0.5,
    palette: Object.values(GOON_COLORS), stripes: GOON_STRIPES,
  });
  body.castShadow = true;
  eyes.visible = false;
  brows.visible = false;
  addHullOutline(body, 0.011);
  ch.xray = addXray(body);

  const r = lm.headRadius * 1.12;
  const maskGeo = new THREE.SphereGeometry(r, 24, 16, Math.PI * 0.025, Math.PI * 0.95, Math.PI * 0.2, Math.PI * 0.55);
  const mask = rigidMesh(
    maskGeo, toonMaterial({ map: clownMaskTexture() }),
    lm.headCenter.clone().add(new THREE.Vector3(0, -0.01, 0.012 * lm.fwd)),
    new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0),
  );
  attachRigid(body, 'Head', mask);
  addHullOutline(mask, 0.005);

  const beanie = rigidMesh(
    new THREE.SphereGeometry(r * 1.02, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
    toonMaterial({ color: PALETTE.pants }),
    lm.headCenter.clone().add(new THREE.Vector3(0, 0.03, 0)),
  );
  attachRigid(body, 'Head', beanie);
  addHullOutline(beanie, 0.006);

  ch.animator.play('Idle_Loop');
  return ch;
}
