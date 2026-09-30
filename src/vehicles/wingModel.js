// src/vehicles/wingModel.js
// Code-built Batwing mesh: a swept bat-shaped planform (the bat emblem outline stretched into a
// delta wing), a raised cockpit canopy, twin tail fins and twin engine glows. All flat colour /
// toon materials with an ink hull outline, matching the rest of the cast. No asset files.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { batOutline } from '../config/batShape.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';

// Outline units to metres. SZ > SX stretches the bat emblem's nose-to-tail axis into a longer
// jet fuselage than the logo itself (which reads squat when used at 1:1). Sized like a small
// fighter jet (~14 m wingspan), not a building, next to a rooftop or Batman.
const SX = 0.145, SZ = 0.205, THICK = 1.0;

function buildBody() {
  const pts = batOutline().map(([x, y]) => new THREE.Vector2(x * SX, -y * SZ));
  const shape = new THREE.Shape(pts);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 1 }).rotateX(-Math.PI / 2);
  geo.translate(0, -THICK / 2, 0);
  // Black, but not so black the ink rim disappears against the night city: a hair of blue-grey.
  const mat = toonMaterial({ color: 0x181b24 });
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = false;
  // A lighter slate rim (not plain ink) so the silhouette pops against dark buildings and sky.
  addHullOutline(body, 0.07, 0x4b586e);
  return body;
}

// A raised, lighter spine down the centreline: reads as a panel highlight from above and behind.
function buildSpine() {
  const shape = new THREE.Shape([
    new THREE.Vector2(-0.42, -4.6), new THREE.Vector2(-0.3, 4.6), new THREE.Vector2(0.3, 4.6), new THREE.Vector2(0.42, -4.6),
  ]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x333c4c });
  const spine = new THREE.Mesh(geo, mat);
  spine.position.y = THICK * 0.52;
  return spine;
}

// Small aviation nav lights at the wingtips (red left, green right) and a white tail light: a
// cheap, unmistakable "this is a plane" read even in silhouette.
function buildNavLights() {
  const g = new THREE.Group();
  const mk = (color, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color })); m.position.set(x, y, z); return m; };
  const tipX = 49 * SX, tipZ = 23 * SZ;
  g.add(mk(0xff3b3b, -tipX, THICK * 0.1, tipZ * 0.85));
  g.add(mk(0x3bff6a, tipX, THICK * 0.1, tipZ * 0.85));
  g.add(mk(0xf2f2f2, 0, THICK * 0.2, -21 * SZ - 0.2));
  return g;
}

function buildCanopy() {
  const geo = new THREE.SphereGeometry(0.62, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const mat = toonMaterial({ color: PALETTE.glass, emissive: 0x0c1420, emissiveIntensity: 0.6 });
  const canopy = new THREE.Mesh(geo, mat);
  canopy.scale.set(1, 0.62, 1.7);
  canopy.position.set(0, THICK * 0.42, 2.6);
  addHullOutline(canopy, 0.02);
  return canopy;
}

function buildFin(side) {
  const shape = new THREE.Shape([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.15, 1.35), new THREE.Vector2(1.15, 0.15), new THREE.Vector2(1.0, 0),
  ]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
  const mat = toonMaterial({ color: 0x0e0f14 });
  const fin = new THREE.Mesh(geo, mat);
  fin.position.set(side * 2.6, THICK * 0.15, -3.1);
  fin.rotation.y = side > 0 ? Math.PI : 0;
  fin.rotation.z = -side * 0.18;
  addHullOutline(fin, 0.02);
  return fin;
}

function buildEngine(side) {
  const g = new THREE.Group();
  g.position.set(side * 1.9, -THICK * 0.1, -2.9);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xd8f2ff });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), coreMat);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x4fb4ff, transparent: true, opacity: 0.5, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), haloMat);
  halo.layers.set(LAYER_FX);
  // An exhaust flame trailing back off the tail: a bright translucent cone, nozzle-first.
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x6fd4ff, transparent: true, opacity: 0.55, depthWrite: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.0, 10, 1, true), flameMat);
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = -1.1;
  flame.layers.set(LAYER_FX);
  g.add(core, halo, flame);
  return g;
}

// Returns { mesh, engines: [core-only pulse targets] } so batwing.js can animate the glow.
export function buildBatwingMesh() {
  const group = new THREE.Group();
  group.name = 'batwing';
  group.add(buildBody(), buildSpine(), buildCanopy(), buildFin(-1), buildFin(1), buildNavLights());
  const eL = buildEngine(-1), eR = buildEngine(1);
  group.add(eL, eR);
  group.visible = false;
  return { mesh: group, engines: [eL, eR] };
}

export const WING_RADIUS = 5.6;
export const WING_HEIGHT = 2.2;

// A Joker balloon: a toon sphere body, a knot and a simple grin (an arc) plus two dot eyes so it
// reads at a glance, purple or green.
export function buildBalloonMesh(kind) {
  const color = kind === 'green' ? PALETTE.jokerGreen : PALETTE.jokerPurple;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12).scale(1, 1.18, 1), toonMaterial({ color, emissive: 0x140a1a, emissiveIntensity: 0.5 }));
  addHullOutline(body, 0.03);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 8).rotateX(Math.PI), toonMaterial({ color }));
  knot.position.y = -1.0;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b0b12 });
  const eyeGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.27, 0.28, 0.78);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.27, 0.28, 0.78);
  const grinGeo = new THREE.TorusGeometry(0.32, 0.05, 6, 12, Math.PI * 0.85);
  const grin = new THREE.Mesh(grinGeo, eyeMat);
  grin.position.set(0, 0.02, 0.82);
  grin.rotation.set(0, 0, Math.PI * 1.075);
  g.add(body, knot, eyeL, eyeR, grin);
  return g;
}

// A small bat-dart tracer fired with punch while flying: a thin black dart with a cyan tip glow.
export function buildDartMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0x101116 }));
  body.rotation.x = Math.PI / 2;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0x6fe0ff }));
  tip.position.z = 0.4;
  g.add(body, tip);
  g.visible = false;
  return g;
}
