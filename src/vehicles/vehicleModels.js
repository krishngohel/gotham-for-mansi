// Code-built vehicle meshes: boxes, cylinders and one extruded canopy, all in the game's ink
// or toon materials. No asset files, no textures beyond the shared toon gradient.
import * as THREE from 'three';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';

let wheelGeo = null, tireGeo = null;
function wheelGeometry() {
  tireGeo ??= new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14).rotateZ(Math.PI / 2);
  return tireGeo;
}
function hubGeometry() {
  wheelGeo ??= new THREE.CylinderGeometry(0.2, 0.2, 0.34, 8).rotateZ(Math.PI / 2);
  return wheelGeo;
}

// A glowing disc used for the rear jet, cannon tracer and shell bursts: unlit, additive, so it
// reads as light rather than a lit toon surface. `strength` is the base opacity of the core.
function glowMaterial(color, strength = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: strength, blending: THREE.AdditiveBlending, depthWrite: false });
}

// One driven wheel: a pivot (steers on Y) holding a spinning tire (rolls on local X). Returns
// { pivot, spin, front }. `spin.rotation.x` is the caller's to drive from distance travelled.
function createWheel(front) {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(wheelGeometry(), toonMaterial({ color: 0x101114 }));
  const hub = new THREE.Mesh(hubGeometry(), toonMaterial({ color: 0x53575f }));
  addHullOutline(tire, 0.02);
  spin.add(tire, hub);
  pivot.add(spin);
  return { pivot, spin, front };
}

// Low, wide, black armour with a cockpit canopy and a big glowing rear jet. Local +Z is forward
// (matches bat.face / the follow camera's forward convention). Returns
// { group, wheels, jetGlow, setBoost(on) }.
export function createBatmobile() {
  const group = new THREE.Group();
  const armour = toonMaterial({ color: 0x0c0d10 });
  const trim = toonMaterial({ color: 0x1c2a3a });
  const canopyMat = toonMaterial({ color: 0x141a22 });

  // Main tub: low and wide.
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.62, 4.6), armour);
  hull.position.set(0, 0.62, 0.1);
  addHullOutline(hull, 0.028);
  group.add(hull);

  // Tapered nose (a scaled box reads fine at arcade speed and keeps the silhouette wide/low).
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.3), armour);
  nose.position.set(0, 0.55, 2.55);
  nose.scale.set(0.78, 1, 1);
  addHullOutline(nose, 0.025);
  group.add(nose);
  const noseBlade = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.4), trim);
  noseBlade.position.set(0, 0.34, 3.05);
  group.add(noseBlade);

  // Cockpit canopy: an extruded bat-wing silhouette bubble over the driver.
  const canopyShape = new THREE.Shape();
  canopyShape.moveTo(-0.55, 0);
  canopyShape.quadraticCurveTo(-0.62, 0.55, -0.2, 0.62);
  canopyShape.lineTo(0.2, 0.62);
  canopyShape.quadraticCurveTo(0.62, 0.55, 0.55, 0);
  canopyShape.lineTo(-0.55, 0);
  const canopy = new THREE.Mesh(new THREE.ExtrudeGeometry(canopyShape, { depth: 1.5, bevelEnabled: false }), canopyMat);
  canopy.rotation.y = Math.PI / 2;
  canopy.position.set(0.75, 0.98, -0.15);
  addHullOutline(canopy, 0.02);
  group.add(canopy);

  // Side pontoons flanking the canopy, and rear diffuser fins.
  for (const s of [-1, 1]) {
    const pont = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 3.4), armour);
    pont.position.set(s * 1.1, 0.6, 0.2);
    addHullOutline(pont, 0.022);
    group.add(pont);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 1.2), trim);
    fin.position.set(s * 0.9, 0.85, -2.15);
    fin.rotation.z = s * 0.18;
    group.add(fin);
  }
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.28, 0.5), trim);
  diffuser.position.set(0, 0.35, -2.5);
  group.add(diffuser);

  // Big rear jet: a dark housing ring plus a glowing core and a soft additive halo.
  const jetRing = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.6, 0.6, 16).rotateX(Math.PI / 2), trim);
  jetRing.position.set(0, 0.62, -2.55);
  group.add(jetRing);
  const jetGlow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), glowMaterial(0xff8a3d, 1));
  jetGlow.position.set(0, 0.62, -2.86);
  jetGlow.rotation.y = Math.PI;
  jetGlow.layers.set(LAYER_FX);
  group.add(jetGlow);
  const jetHalo = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), glowMaterial(0xff8a3d, 0.35));
  jetHalo.position.copy(jetGlow.position);
  jetHalo.rotation.y = Math.PI;
  jetHalo.layers.set(LAYER_FX);
  group.add(jetHalo);

  // Wheels: wide stance, low profile. Front pair steers.
  const wheels = [];
  for (const [x, z, front] of [[-1.28, 1.55, true], [1.28, 1.55, true], [-1.32, -1.55, false], [1.32, -1.55, false]]) {
    const w = createWheel(front);
    w.pivot.position.set(x, 0.42, z);
    group.add(w.pivot);
    wheels.push(w);
  }

  return {
    group, wheels, jetGlow, jetHalo,
    radius: 2.0, halfLength: 2.6, halfWidth: 1.35,
    setBoost(on) {
      jetGlow.material.opacity = on ? 1 : 0.55;
      jetGlow.scale.setScalar(on ? 1.5 : 1);
      jetHalo.scale.setScalar(on ? 2 : 1);
    },
  };
}

// A simple civilian sedan or van, code-built from boxes. `kind` is 'sedan' or 'van'.
export function createStreetCar(color = 0x2f3f5a, kind = 'sedan') {
  const group = new THREE.Group();
  const paint = toonMaterial({ color });
  const glass = new THREE.MeshBasicMaterial({ color: 0x1c2433 });
  const dark = toonMaterial({ color: 0x14151a });
  if (kind === 'van') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.7, 4.2), paint);
    body.position.set(0, 1.0, 0);
    addHullOutline(body, 0.026);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.5, 1.1), paint);
    cab.position.set(0, 1.95, 1.4);
    group.add(body, cab);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 0.05), glass);
    windshield.position.set(0, 1.55, 2.05);
    group.add(windshield);
    for (const [x, z] of [[-1.05, 1.35], [1.05, 1.35], [-1.05, -1.35], [1.05, -1.35]]) {
      const w = new THREE.Mesh(wheelGeometry(), dark);
      w.position.set(x, 0.42, z);
      group.add(w);
    }
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 4.1).translate(0, 0.66, -0.1), paint);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.9).translate(0, 1.28, 0.1), paint);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 0.05), glass);
    windshield.position.set(0, 1.24, 1.05);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 0.05), glass);
    rear.position.set(0, 1.24, -0.85);
    addHullOutline(body, 0.024);
    addHullOutline(cabin, 0.02);
    group.add(body, cabin, windshield, rear);
    for (const [x, z] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
      const w = new THREE.Mesh(wheelGeometry(), dark);
      w.position.set(x, 0.4, z);
      group.add(w);
    }
  }
  return { group, radius: kind === 'van' ? 2.3 : 2.1 };
}

// The Joker's getaway van: the civilian van shape repainted purple and green, with a spinning
// warning beacon so it reads as his at a glance.
export function createJokerVan() {
  const car = createStreetCar(0x6b2f8f, 'van');
  const stripe = toonMaterial({ color: 0x3fae4a });
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.32, 4.22), stripe);
  band.position.set(0, 0.55, 0);
  addHullOutline(band, 0.02);
  car.group.add(band);
  const beaconMat = glowMaterial(0x8a2fbf, 1);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 10), beaconMat);
  beacon.position.set(0, 2.35, 1.3);
  beacon.layers.set(LAYER_FX);
  car.group.add(beacon);
  car.beacon = beacon;
  return car;
}

// A Joker drone tank: tracked box hull with a turret and a barrel that can be aimed at Batman.
export function createDroneTank() {
  const group = new THREE.Group();
  const hullMat = toonMaterial({ color: 0x4a2a5a });
  const trackMat = toonMaterial({ color: 0x14151a });
  const turretMat = toonMaterial({ color: 0x3fae4a });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 3.2), hullMat);
  hull.position.y = 0.55;
  addHullOutline(hull, 0.026);
  group.add(hull);
  for (const s of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 3.5), trackMat);
    track.position.set(s * 1.15, 0.32, 0);
    addHullOutline(track, 0.02);
    group.add(track);
  }
  const turretPivot = new THREE.Group();
  turretPivot.position.set(0, 0.9, 0);
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.6, 10), turretMat);
  turret.position.y = 0.3;
  addHullOutline(turret, 0.02);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 10).rotateX(Math.PI / 2), hullMat);
  barrel.position.set(0, 0.3, 1.1);
  turretPivot.add(turret, barrel);
  group.add(turretPivot);
  return { group, turretPivot, barrel, radius: 1.9, health: 3, dead: false };
}

// A thin glowing tracer line, reused each shot (position updated, not recreated).
export function createTracer(color = 0x7fd6ff) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geo, mat);
  line.layers.set(LAYER_FX);
  line.frustumCulled = false;
  line.visible = false;
  return line;
}

// A slow, dodgeable shell: a small glowing sphere.
export function createShell(color = 0x8a2fbf) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), glowMaterial(color, 1));
  mesh.layers.set(LAYER_FX);
  mesh.visible = false;
  return mesh;
}
