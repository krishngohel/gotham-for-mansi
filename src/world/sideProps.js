// Side content props, all authored in code: the glowing bat pillars that start challenges, the
// ink hoops of the ring courses, the crime van and the robbery loot.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_XRAY } from '../render/layers.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { batOutline } from '../config/batShape.js';

let batGeo = null, torusGeo = null, wheelGeo = null, sackGeo = null;
function batGeometry() {
  if (!batGeo) {
    const shape = new THREE.Shape(batOutline().map(([x, y]) => new THREE.Vector2(x / 100, y / 100)));
    batGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }).translate(0, 0, -0.04);
  }
  return batGeo;
}

// A dark post with a yellow band and a spinning bat on top. The x-ray bat shows through walls
// in detective vision.
export function createPillar() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 10).translate(0, 1.2, 0), toonMaterial({ color: 0x2a2f3d }));
  addHullOutline(post, 0.03);
  const glow = new THREE.MeshBasicMaterial({ color: PALETTE.signal });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10, 1, true).translate(0, 2.25, 0), glow);
  const bat = new THREE.Mesh(batGeometry(), glow);
  bat.position.y = 3.1;
  bat.scale.setScalar(1.5);
  const xray = new THREE.Mesh(batGeometry(), new THREE.MeshBasicMaterial({ color: PALETTE.signal, transparent: true, opacity: 0.85, depthTest: false }));
  xray.position.y = 3.1;
  xray.scale.setScalar(1.8);
  xray.layers.set(LAYER_XRAY);
  g.add(post, band, bat, xray);
  g.userData.bat = bat;
  g.userData.xray = xray;
  return g;
}

// A unit-radius inked hoop; the runner scales it to the ring's radius. 'next' is signal
// yellow, 'later' paper white, 'done' hidden.
export function createRingMesh() {
  torusGeo ??= new THREE.TorusGeometry(1, 0.09, 8, 48);
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.signal });
  const hoop = new THREE.Mesh(torusGeo, mat);
  addHullOutline(hoop, 0.035);
  const g = new THREE.Group();
  g.add(hoop);
  g.userData.base = 1;
  g.userData.setState = (s) => {
    g.visible = s !== 'done';
    mat.color.setHex(s === 'next' ? PALETTE.signal : PALETTE.paper);
  };
  return g;
}

// A purple delivery van with its back doors hanging open. Length runs along local z.
export function createVan() {
  const g = new THREE.Group();
  const paint = toonMaterial({ color: 0x6b5b95 });
  const dark = toonMaterial({ color: PALETTE.ink });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.2, 3.6).translate(0, 1.5, -0.6), paint);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 1.5).translate(0, 1.2, 1.9), paint);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 0.05).translate(0, 1.65, 2.66), new THREE.MeshBasicMaterial({ color: 0x1c2433 }));
  for (const m of [body, cab]) addHullOutline(m, 0.03);
  wheelGeo ??= new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12).rotateZ(Math.PI / 2);
  for (const [x, z] of [[-1, -1.7], [1, -1.7], [-1, 1.8], [1, 1.8]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(x, 0.42, z);
    g.add(w);
  }
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.9, 0.06).translate(s * 0.51, 0, 0), paint);
    door.position.set(-s * 1.05, 1.5, -2.42);
    door.rotation.y = s * 1.9;
    g.add(door);
  }
  g.add(body, cab, glass);
  return g;
}

// Three swag sacks and a split crate by a shop door.
export function createLootBags() {
  const g = new THREE.Group();
  const sack = toonMaterial({ color: 0xb59a6a });
  sackGeo ??= new THREE.SphereGeometry(0.4, 12, 10).scale(1, 1.2, 1);
  for (const [x, z, s] of [[0.6, 0.2, 1], [-0.5, 0.5, 0.8], [0.1, -0.6, 0.9]]) {
    const m = new THREE.Mesh(sackGeo, sack);
    m.position.set(x, 0.45 * s, z);
    m.scale.setScalar(s);
    addHullOutline(m, 0.02);
    g.add(m);
  }
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8).translate(0, 0.3, 0), toonMaterial({ color: 0x7a5a3a }));
  crate.position.set(-0.9, 0, -0.5);
  crate.rotation.y = 0.5;
  addHullOutline(crate, 0.02);
  g.add(crate);
  return g;
}
