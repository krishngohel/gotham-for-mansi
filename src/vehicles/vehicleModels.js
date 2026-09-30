// Code-built vehicle meshes: extruded side-profile bodies (a real silhouette, not stacked
// boxes), cylinders and the bat emblem for the tail fins, all in the game's ink or toon
// materials. No asset files, no textures beyond the shared toon gradient.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { addRim } from '../actors/outfitParts.js';
import { batOutline } from '../config/batShape.js';
import { LAYER_FX } from '../render/layers.js';

let tireGeo = null, hubGeo = null, capGeo = null;
function tireGeometry() { tireGeo ??= new THREE.CylinderGeometry(0.46, 0.46, 0.36, 16); return tireGeo; }
function hubGeometry() { hubGeo ??= new THREE.CylinderGeometry(0.24, 0.24, 0.5, 10); return hubGeo; }
function capGeometry() { capGeo ??= new THREE.CylinderGeometry(0.1, 0.1, 0.52, 8); return capGeo; }

// A glowing disc used for the rear jet, headlights, cannon tracer and shell bursts: unlit,
// additive, so it reads as light rather than a lit toon surface. `strength` is the base opacity.
function glowMaterial(color, strength = 1, additive = true) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: strength, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
}

// Builds a real body silhouette from a side-profile (x = length, nose at +x; y = height), bevelled
// so the edges catch a highlight, then rotates it so local +Z is forward (the same convention
// bat.face and the follow camera use) and local X is left/right, centered on the car's spine.
function extrudedBody(profile, width, material, bevel = 0.035) {
  const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 2, steps: 1, curveSegments: 6 });
  geo.translate(0, 0, -width / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.y = -Math.PI / 2;
  return mesh;
}

// A flat bat-emblem cutout used as a tail fin's blade. The emblem's wide axis (its wingspan,
// -49..49) becomes the extrude's local Y so the fin stands `h` meters tall once mounted; its
// short axis (-21..23) becomes local X, a shorter fore-aft sweep. The caller rotates the mesh
// rotation.y = 90deg so the thin extrude depth (the blade's thickness) faces sideways instead of
// fore-aft: full width from the side, a thin edge from the front or back, like a shark fin.
function batFinGeometry(h = 1.1, thickness = 0.05) {
  const s = h / 98;
  const shape = new THREE.Shape(batOutline().map(([x, y]) => new THREE.Vector2(y * s, x * s)));
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
}

// A wheel with a chunky tyre and a hub that visibly protrudes past both sidewalls, plus a small
// bright cap so the hub itself reads as a shape and not just a darker tyre-colored disc.
function createWheel(front, dark, hubMat, capMat) {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(tireGeometry().clone().rotateZ(Math.PI / 2), dark);
  const hub = new THREE.Mesh(hubGeometry().clone().rotateZ(Math.PI / 2), hubMat);
  const cap = new THREE.Mesh(capGeometry().clone().rotateZ(Math.PI / 2), capMat);
  addHullOutline(tire, 0.022);
  addHullOutline(hub, 0.012);
  spin.add(tire, hub, cap);
  pivot.add(spin);
  return { pivot, spin, front };
}

// Low, long and tapered: a raked nose, a canopy set well forward, a longer flat rear deck and a
// pair of swept bat-wing tail fins. Local +Z is forward. Returns
// { group, wheels, jetGlow, jetHalo, radius, setBoost(on) }.
export function createBatmobile() {
  const group = new THREE.Group();
  const armour = addRim(toonMaterial({ color: 0x0c0d10 }), 0x5f8fd6, 0.55, [0.55, 0.72], 0.22);
  const armourLite = addRim(toonMaterial({ color: 0x14161c }), 0x5f8fd6, 0.5, [0.55, 0.72], 0.24);
  const trim = toonMaterial({ color: 0x22262e });
  const panel = toonMaterial({ color: 0x33373f });
  const canopyMat = new THREE.MeshBasicMaterial({ color: 0x1f3f5c, transparent: true, opacity: 0.88 });

  // The hull: a single extruded side profile, nose at +z (station 2.75) to tail (-2.8). Low flat
  // belly, a steep raked nose, a forward canopy bump, then a longer, flatter rear deck tapering
  // down to a low tail where the fins root.
  const profile = [
    [2.75, 0.18],    // nose tip
    [2.05, 0.32],
    [1.15, 0.5],      // hood base, windshield rakes up from here
    [0.85, 0.92],     // canopy front (forward of the midpoint)
    [-0.2, 0.96],     // canopy back / roofline
    [-0.7, 0.66],     // rear deck starts
    [-1.85, 0.58],    // rear deck (engine housing) top
    [-2.7, 0.4],      // tail top, fin root
    [-2.8, 0.12],     // tail tip
    [-1.9, 0.06],
    [1.4, 0.06],      // long flat low belly
    [2.55, 0.08],
  ];
  const hull = extrudedBody(profile, 2.05, armour, 0.045);
  hull.position.y = 0.34;
  addHullOutline(hull, 0.03);
  group.add(hull);

  // Cockpit canopy: a rounded bubble, set forward over the front half of the car.
  const canopyShape = new THREE.Shape();
  canopyShape.moveTo(-0.5, 0);
  canopyShape.quadraticCurveTo(-0.56, 0.42, -0.18, 0.48);
  canopyShape.lineTo(0.62, 0.42);
  canopyShape.quadraticCurveTo(0.86, 0.3, 0.82, 0);
  canopyShape.lineTo(-0.5, 0);
  const canopy = new THREE.Mesh(new THREE.ExtrudeGeometry(canopyShape, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 2 }), canopyMat);
  canopy.rotation.y = Math.PI / 2;
  canopy.position.set(0.75, 1.02, -0.15);
  addHullOutline(canopy, 0.016, 0x0b0b12);
  group.add(canopy);

  // Side skirts flanking the hull (armour reads thicker from behind/the side) and mid-grey panel
  // lines along the hood and doors, laid just proud of the hull surface.
  for (const s of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 3.1), armourLite);
    skirt.position.set(s * 1.08, 0.32, -0.1);
    addHullOutline(skirt, 0.018);
    group.add(skirt);
    const hoodLine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 1.6), panel);
    hoodLine.position.set(s * 0.4, 0.72, 1.5);
    hoodLine.rotation.z = -0.12 * s;
    group.add(hoodLine);
    const doorLine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.02), panel);
    doorLine.position.set(s * 1.03, 0.5, -0.55);
    group.add(doorLine);
  }

  // Tail fins: the bat emblem, mounted as a pair of raked blades standing off the rear deck
  // (rotation.y turns its thin extrude depth to face sideways; see batFinGeometry).
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(batFinGeometry(1.3, 0.05), trim);
    fin.position.set(s * 0.5, 1.08, -2.3);
    fin.rotation.y = Math.PI / 2;
    fin.rotation.z = s * 0.1;  // a slight outward cant
    fin.rotation.x = -0.22;    // swept back
    addHullOutline(fin, 0.014);
    group.add(fin);
  }

  // Big rear jet: a dark housing ring plus a glowing core and a soft additive halo, both sized
  // to sit inside the ring rather than swallow the whole back of the car.
  const jetRing = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.4, 16).rotateX(Math.PI / 2), trim);
  jetRing.position.set(0, 0.42, -2.75);
  addHullOutline(jetRing, 0.018);
  group.add(jetRing);
  const jetGlow = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), glowMaterial(0xffb020, 1));
  jetGlow.position.set(0, 0.42, -2.95);
  jetGlow.rotation.y = Math.PI;
  jetGlow.layers.set(LAYER_FX);
  group.add(jetGlow);
  const jetHalo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), glowMaterial(0xff8a3d, 0.32));
  jetHalo.position.copy(jetGlow.position);
  jetHalo.rotation.y = Math.PI;
  jetHalo.layers.set(LAYER_FX);
  group.add(jetHalo);

  // Lights: two white headlamps low on the nose, a thin red strip across the tail.
  const headMat = glowMaterial(0xf4f6ff, 1, false);
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.06), headMat);
    lamp.position.set(s * 0.7, 0.34, 2.78);
    group.add(lamp);
  }
  const tailStrip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.05), glowMaterial(0xd41c2c, 1, false));
  tailStrip.position.set(0, 0.5, -2.82);
  group.add(tailStrip);

  // Wheels: wide stance, low profile, chunky visible hubs. Front pair steers.
  const dark = toonMaterial({ color: 0x101114 });
  const hubMat = toonMaterial({ color: 0x5a5f68 });
  const capMat = toonMaterial({ color: 0x8f97a3 });
  const wheels = [];
  for (const [x, z, front] of [[-1.15, 1.6, true], [1.15, 1.6, true], [-1.2, -1.6, false], [1.2, -1.6, false]]) {
    const w = createWheel(front, dark, hubMat, capMat);
    w.pivot.position.set(x, 0.46, z);
    group.add(w.pivot);
    wheels.push(w);
  }

  return {
    group, wheels, jetGlow, jetHalo,
    radius: 1.9, halfLength: 2.8, halfWidth: 1.25,
    setBoost(on) {
      jetGlow.material.color.setHex(on ? 0xfff2c0 : 0xffb020);
      jetGlow.material.opacity = on ? 1 : 0.85;
      jetGlow.scale.setScalar(on ? 1.7 : 1);
      jetHalo.scale.setScalar(on ? 2.2 : 1);
      jetHalo.material.opacity = on ? 0.6 : 0.4;
    },
  };
}

// Bakes a static model (nothing inside it animates on its own) into one mesh per fill material
// plus one ink outline per outline width, all relative to `group`, and swaps them in for the
// original parts. A street car goes from 34 draw calls to about 11, and its outlines become
// frustum-culled (addHullOutline turns culling off, since it can't know a mesh's final bounds).
function mergeStaticParts(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const fills = new Map(), hulls = new Map();
  const m = new THREE.Matrix4();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const outline = o.material.userData.outline;
    const buckets = outline ? hulls : fills;
    const key = outline ? outline.value : o.material;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material: o.material, layers: o.layers.mask, geos: [] }));
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    b.geos.push(g);
  });
  while (group.children.length) group.remove(group.children[0]);
  for (const buckets of [fills, hulls]) {
    for (const b of buckets.values()) {
      const geo = mergeGeometries(b.geos, false);
      for (const g of b.geos) g.dispose();
      geo.computeBoundingSphere();
      if (buckets === hulls) geo.boundingSphere.radius += 0.05; // the outline pushes out past the hull
      const mesh = new THREE.Mesh(geo, b.material);
      mesh.layers.mask = b.layers;
      group.add(mesh);
    }
  }
}

// A civilian sedan or van: an extruded body silhouette (not stacked boxes), inset glass, wheel
// arches, headlights and tail lights, in a few paint colours. `kind` is 'sedan' or 'van'.
export function createStreetCar(color = 0x2f3f5a, kind = 'sedan') {
  const group = new THREE.Group();
  const paint = toonMaterial({ color });
  const glass = new THREE.MeshBasicMaterial({ color: 0x1c2433 });
  const dark = toonMaterial({ color: 0x101114 });
  const hubMat = toonMaterial({ color: 0x45484e });
  const capMat = toonMaterial({ color: 0x6a6e76 });
  const headMat = glowMaterial(0xf4f6ff, 1, false);
  const tailMat = glowMaterial(0xc41c2c, 1, false);
  const archMat = toonMaterial({ color: 0x0e0f12 });

  const isVan = kind === 'van';
  // Side profile: x = length (nose at +x), y = height. A van keeps a boxier cabin; a sedan has a
  // sloped hood and a fastback roofline.
  const profile = isVan
    ? [[2.05, 0.42], [1.85, 1.55], [-1.85, 1.6], [-2.05, 1.35], [-2.05, 0.1], [1.7, 0.1]]
    : [[2.05, 0.42], [1.55, 0.62], [0.85, 1.15], [-0.35, 1.2], [-0.95, 0.68], [-2.0, 0.58], [-2.05, 0.12], [1.8, 0.08]];
  const width = isVan ? 1.95 : 1.85;
  const body = extrudedBody(profile, width, paint, isVan ? 0.03 : 0.04);
  body.position.y = 0.4;
  addHullOutline(body, 0.024);
  group.add(body);

  // Glass: a windscreen, a rear screen, and a thin side-window band on each flank.
  const wsAngle = isVan ? -0.35 : -0.55;
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(width - 0.14, isVan ? 1.1 : 0.5, 0.04), glass);
  windshield.position.set(0, isVan ? 1.0 : 1.15, isVan ? 1.3 : 1.05);
  windshield.rotation.x = wsAngle;
  group.add(windshield);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(width - 0.14, isVan ? 0.9 : 0.4, 0.04), glass);
  rearGlass.position.set(0, isVan ? 1.05 : 1.12, isVan ? -1.55 : -0.75);
  rearGlass.rotation.x = isVan ? 0.15 : 0.5;
  group.add(rearGlass);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, isVan ? 0.55 : 0.32, isVan ? 2.9 : 1.35), glass);
    side.position.set(s * (width / 2 - 0.01), isVan ? 1.15 : 1.05, isVan ? -0.15 : 0.1);
    group.add(side);
  }

  // Wheel arches: a dark flattened half-cylinder proud of the hull above each wheel.
  const archGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.16, 12, 1, false, 0, Math.PI);
  const wheelPos = isVan ? [[-0.98, 1.35], [0.98, 1.35], [-0.98, -1.35], [0.98, -1.35]] : [[-0.9, 1.25], [0.9, 1.25], [-0.9, -1.2], [0.9, -1.2]];
  for (const [x, z] of wheelPos) {
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(Math.sign(x) * (width / 2 - 0.05), 0.55, z);
    group.add(arch);
    const w = createWheel(false, dark, hubMat, capMat);
    w.pivot.scale.setScalar(0.86);
    w.pivot.position.set(x, 0.42, z);
    group.add(w.pivot);
  }

  // Lights.
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.05), headMat);
    lamp.position.set(s * (width / 2 - 0.25), 0.5, isVan ? 2.08 : 2.06);
    group.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.04), tailMat);
    tail.position.set(s * (width / 2 - 0.22), 0.55, isVan ? -2.08 : -2.06);
    group.add(tail);
  }

  mergeStaticParts(group);
  return { group, radius: isVan ? 2.3 : 2.1 };
}

// The Joker's getaway van: the civilian van shape repainted purple and green, with a spinning
// warning beacon so it reads as his at a glance.
export function createJokerVan() {
  const car = createStreetCar(0x6b2f8f, 'van');
  const stripe = toonMaterial({ color: 0x3fae4a });
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.32, 3.5), stripe);
  band.position.set(0, 0.55, -0.2);
  addHullOutline(band, 0.02);
  car.group.add(band);
  const beaconMat = glowMaterial(0x8a2fbf, 1);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 10), beaconMat);
  beacon.position.set(0, 1.9, 1.3);
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
