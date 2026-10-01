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

// Lofts a closed, faceted solid through cross-sections along local Z (forward). Each station is
// { z, y0, hw, ym, yt, tw }: the bottom at y0 (half width hw - 0.1), the widest point hw at ym,
// and a flat top of half width tw at yt, so every section is an octagon-ish armour profile and
// the body can taper in plan and in height from station to station (an extrusion can't).
// Returns { fill, line }: flat-shaded geometry for the hard armour facets, and a welded, smooth
// copy for the ink outline shell (a shell built from split normals cracks open at every edge).
function loftGeometry(stations) {
  const ring = (s) => {
    const b = Math.max(0.05, s.hw - 0.12);
    return [[-b, s.y0], [-s.hw, s.y0 + 0.12], [-s.hw, s.ym], [-s.tw, s.yt], [s.tw, s.yt], [s.hw, s.ym], [s.hw, s.y0 + 0.12], [b, s.y0]];
  };
  const pos = [], idx = [];
  const n = 8;
  stations.forEach((s) => { for (const [x, y] of ring(s)) pos.push(x, y, s.z); });
  for (let k = 0; k < stations.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const a = k * n + i, b = k * n + ((i + 1) % n), c = (k + 1) * n + i, d = (k + 1) * n + ((i + 1) % n);
      // Wound so the faces point outward (stations run from nose, +z, to tail).
      idx.push(a, b, c, b, d, c);
    }
  }
  // End caps (fans), facing out of each end.
  const last = (stations.length - 1) * n;
  for (let i = 1; i < n - 1; i++) { idx.push(0, i + 1, i); idx.push(last, last + i, last + i + 1); }
  const line = new THREE.BufferGeometry();
  line.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  line.setIndex(idx);
  line.computeVertexNormals();
  const fill = line.toNonIndexed();
  fill.computeVertexNormals();
  return { fill, line };
}

// A lofted armour part: flat-shaded fill plus an ink shell from its smooth twin.
function loftPart(stations, material, outline) {
  const { fill, line } = loftGeometry(stations);
  const mesh = new THREE.Mesh(fill, material);
  if (outline) {
    const carrier = new THREE.Mesh(line, material);
    const hull = addHullOutline(carrier, outline);
    carrier.remove(hull);
    mesh.add(hull);
  }
  return mesh;
}

// A swept tail fin in the side (YZ) plane: a raked blade whose trailing edge is scalloped like a
// bat wing (two clean bites, not the emblem's jagged outline, which reads as a scribble at speed).
function finGeometry(len = 1.3, h = 0.9, thick = 0.06) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);                       // root, front
  s.lineTo(-len * 0.55, h);             // leading edge, raked back to the tip
  s.lineTo(-len * 0.8, h * 0.95);       // tip
  s.quadraticCurveTo(-len * 0.78, h * 0.62, -len * 0.9, h * 0.55); // first scallop
  s.quadraticCurveTo(-len * 0.92, h * 0.25, -len, h * 0.2);         // second scallop
  s.lineTo(-len, 0);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  return g.rotateY(Math.PI / 2); // shape x (length) now runs along -z, thickness along x
}

// The Batmobile: Arkham-style, a narrow armoured central body that tapers to a pointed nose, a
// low faceted canopy set into it, and four big armour pods over the wheels, joined to the body,
// so the tyres sit inside the car instead of hanging off its sides. Swept scalloped fins rise off
// the rear pods; the jet sits recessed in a nozzle at the tail. Gunmetal, not black, so the
// facets read in the night city. Local +Z is forward. Every static part is merged down to a few
// draw calls (mergeStaticParts); the wheels and the jet glow stay separate to spin and pulse.
// Returns { group, wheels, jetGlow, jetHalo, radius, halfLength, halfWidth, setBoost(on) }.
export function createBatmobile() {
  const group = new THREE.Group();
  const body = addRim(toonMaterial({ color: 0x1f2228 }), 0x7fa8e8, 0.6, [0.8, 0.92], 0.2);
  const pod = addRim(toonMaterial({ color: 0x18191e }), 0x7fa8e8, 0.55, [0.8, 0.92], 0.18);
  const trim = toonMaterial({ color: 0x15171c });
  const glass = new THREE.MeshBasicMaterial({ color: 0x1d4466, transparent: true, opacity: 0.92 });

  // Central body: pointed nose, broad shoulders over the cockpit, a long deck, a tapered tail.
  group.add(loftPart([
    { z: 3.15, y0: 0.26, hw: 0.28, ym: 0.36, yt: 0.4, tw: 0.16 },
    { z: 2.5, y0: 0.2, hw: 0.62, ym: 0.5, yt: 0.6, tw: 0.4 },
    { z: 1.4, y0: 0.18, hw: 0.84, ym: 0.62, yt: 0.78, tw: 0.56 },
    { z: 0.55, y0: 0.18, hw: 0.9, ym: 0.7, yt: 0.86, tw: 0.62 },
    { z: -1.1, y0: 0.18, hw: 0.95, ym: 0.72, yt: 0.9, tw: 0.68 },
    { z: -2.5, y0: 0.2, hw: 0.86, ym: 0.66, yt: 0.8, tw: 0.56 },
    { z: -3.1, y0: 0.28, hw: 0.62, ym: 0.56, yt: 0.64, tw: 0.4 },
  ], body, 0.03));

  // Canopy: low faceted glass set into the body's top, its windscreen raked well back.
  group.add(loftPart([
    { z: 1.05, y0: 0.84, hw: 0.5, ym: 0.86, yt: 0.88, tw: 0.42 },
    { z: 0.45, y0: 0.84, hw: 0.56, ym: 1.02, yt: 1.2, tw: 0.36 },
    { z: -0.55, y0: 0.86, hw: 0.56, ym: 1.02, yt: 1.18, tw: 0.36 },
    { z: -1.05, y0: 0.88, hw: 0.5, ym: 0.92, yt: 0.95, tw: 0.4 },
  ], glass, 0.018));

  // Wheel pods: armour over each wheel, joined to the body by a strut, the front pair raked
  // forward into the nose, the rear pair bigger and squarer.
  const WX = 1.38;
  for (const s of [-1, 1]) {
    for (const [cz, front] of [[1.55, true], [-1.55, false]]) {
      const L = front ? 0.95 : 1.05, top = front ? 1.0 : 1.08;
      const p = loftPart([
        { z: cz + L, y0: 0.42, hw: 0.3, ym: 0.62, yt: 0.7, tw: 0.2 },
        { z: cz + L * 0.55, y0: 0.5, hw: 0.42, ym: 0.86, yt: top, tw: 0.3 },
        { z: cz - L * 0.55, y0: 0.5, hw: 0.42, ym: 0.86, yt: top, tw: 0.3 },
        { z: cz - L, y0: 0.42, hw: 0.32, ym: 0.66, yt: 0.76, tw: 0.22 },
      ], pod, 0.026);
      p.position.x = s * WX;
      group.add(p);
      // Strut joining the pod to the body, low and thick.
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, L * 1.2), pod);
      strut.position.set(s * (WX - 0.55), 0.5, cz);
      addHullOutline(strut, 0.02);
      group.add(strut);
    }
    // Headlight slit on the front of each front pod, tail light on the back of each rear pod.
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.05), glowMaterial(0xf4f6ff, 1, false));
    head.position.set(s * WX, 0.66, 1.55 + 0.97);
    head.rotation.x = -0.35;
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.05), glowMaterial(0xd41c2c, 1, false));
    tail.position.set(s * WX, 0.72, -1.55 - 1.07);
    group.add(tail);
    // Swept fin off the rear pod.
    const fin = new THREE.Mesh(finGeometry(1.2, 0.72, 0.07), trim);
    fin.position.set(s * WX, 0.98, -0.95);
    fin.rotation.z = s * 0.18;  // canted out into a V
    fin.rotation.x = -0.32;     // raked back along the deck
    addHullOutline(fin, 0.016);
    group.add(fin);
  }

  // Front splitter between the front pods, and a dark nose intake under the point.
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.07, 0.42), trim);
  splitter.position.set(0, 0.2, 2.75);
  addHullOutline(splitter, 0.016);
  group.add(splitter);
  // Panel lines along the hood and deck.
  for (const s of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 1.3), trim);
    line.position.set(s * 0.32, 0.8, 1.75);
    line.rotation.x = 0.16;
    group.add(line);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.9), trim);
    vent.position.set(s * 0.4, 0.9, -1.8);
    group.add(vent);
  }

  // The jet: a recessed nozzle at the tail, its glow inside it rather than a disc stuck on.
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.5, 16, 1, true).rotateX(Math.PI / 2), trim);
  nozzle.material.side = THREE.DoubleSide;
  nozzle.position.set(0, 0.5, -3.15);
  addHullOutline(nozzle, 0.02);
  group.add(nozzle);

  mergeStaticParts(group);

  const jetGlow = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), glowMaterial(0xffb020, 1));
  jetGlow.position.set(0, 0.5, -3.2);
  jetGlow.rotation.y = Math.PI;
  jetGlow.layers.set(LAYER_FX);
  group.add(jetGlow);
  const jetHalo = new THREE.Mesh(new THREE.CircleGeometry(0.26, 20), glowMaterial(0xff8a3d, 0.3));
  jetHalo.position.set(0, 0.5, -3.24);
  jetHalo.rotation.y = Math.PI;
  jetHalo.layers.set(LAYER_FX);
  group.add(jetHalo);

  // Wheels inside the pods: big, wide tyres at the corners (spin and steer, so not merged).
  const dark = toonMaterial({ color: 0x101114 });
  const hubMat = toonMaterial({ color: 0x5a5f68 });
  const capMat = toonMaterial({ color: 0x8f97a3 });
  const wheels = [];
  for (const [x, z, front] of [[-WX, 1.55, true], [WX, 1.55, true], [-WX, -1.55, false], [WX, -1.55, false]]) {
    const w = createWheel(front, dark, hubMat, capMat);
    w.pivot.position.set(x, 0.5, z);
    w.pivot.scale.set(1.45, 1.1, 1.1); // wide tyres: the scale's x is the tyre's width
    group.add(w.pivot);
    wheels.push(w);
  }

  return {
    group, wheels, jetGlow, jetHalo,
    radius: 2.05, halfLength: 3.2, halfWidth: 1.45,
    setBoost(on) {
      jetGlow.material.color.setHex(on ? 0xfff2c0 : 0xffb020);
      jetGlow.material.opacity = on ? 1 : 0.85;
      jetGlow.scale.setScalar(on ? 1.5 : 1);
      jetHalo.scale.setScalar(on ? 1.9 : 1);
      jetHalo.material.opacity = on ? 0.55 : 0.3;
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
  // Night glass: a cool sky blue, light enough to read against any paint.
  const glass = new THREE.MeshBasicMaterial({ color: 0x5b7a9c });
  const trimMat = toonMaterial({ color: 0x1a1b20 });
  const dark = toonMaterial({ color: 0x101114 });
  const hubMat = toonMaterial({ color: 0x45484e });
  const capMat = toonMaterial({ color: 0x6a6e76 });
  const headMat = glowMaterial(0xf4f6ff, 1, false);
  const tailMat = glowMaterial(0xc41c2c, 1, false);
  const archMat = toonMaterial({ color: 0x0e0f12, side: THREE.DoubleSide });

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

  // Glass, laid on the body's own surface (it used to sit just inside it, hidden: the cars had no
  // windows at all). Windscreen and rear screen follow the profile's own slopes (`profile` points
  // are [length, height] with the body lifted 0.4), nudged out along the slope's normal; the side
  // windows are one flat pane per flank following the greenhouse, just proud of the flank.
  const slopePane = (p0, p1, inset = 0.82) => {
    const z0 = p0[0], y0 = p0[1] + 0.4, z1 = p1[0], y1 = p1[1] + 0.4;
    const len = Math.hypot(z1 - z0, y1 - y0) * inset;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(width - 0.3, len, 0.03), glass);
    let nz = -(y1 - y0), ny = z1 - z0; // a normal of the segment; make it point up and out
    if (ny < 0) { nz = -nz; ny = -ny; }
    const nl2 = Math.hypot(nz, ny) || 1;
    pane.position.set(0, (y0 + y1) / 2 + (ny / nl2) * 0.05, (z0 + z1) / 2 + (nz / nl2) * 0.05);
    pane.rotation.x = -Math.atan2(y1 - y0, z1 - z0) + Math.PI / 2;
    group.add(pane);
  };
  if (isVan) {
    slopePane(profile[0], profile[1], 0.7);                 // the steep van windscreen
    const back = new THREE.Mesh(new THREE.BoxGeometry(width - 0.5, 0.6, 0.03), glass);
    back.position.set(0, 1.55, -2.1);
    group.add(back);
  } else {
    slopePane(profile[1], profile[2]);                      // windscreen (hood to roof)
    slopePane(profile[3], profile[4]);                      // rear screen (roof to boot)
  }
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape();
    const pts = isVan
      ? [[1.75, 1.05], [1.62, 1.75], [0.7, 1.78], [0.7, 1.05]]
      : [[0.95, 1.08], [0.72, 1.48], [-0.32, 1.52], [-0.86, 1.1]];
    shape.moveTo(pts[0][0], pts[0][1]);
    for (const [z, y] of pts.slice(1)) shape.lineTo(z, y);
    const side = new THREE.Mesh(new THREE.ShapeGeometry(shape), glass);
    side.material.side = THREE.DoubleSide;
    side.rotation.y = -Math.PI / 2; // shape x (length) along +z
    side.position.x = sx * (width / 2 + 0.06);
    group.add(side);
  }

  // Bumpers front and back, a dark grille between the headlamps, and a door seam on each flank.
  for (const z of [isVan ? 2.12 : 2.1, isVan ? -2.12 : -2.1]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.18, 0.16), trimMat);
    bumper.position.set(0, 0.42, z);
    group.add(bumper);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(width * 0.42, 0.16, 0.04), trimMat);
  grille.position.set(0, 0.62, isVan ? 2.1 : 2.08);
  group.add(grille);
  for (const sx of [-1, 1]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.55, 0.02), trimMat);
    seam.position.set(sx * (width / 2 + 0.045), 0.8, isVan ? 0.6 : 0.05);
    group.add(seam);
  }

  // Wheel arches: a dark half-ring proud of the flank over each wheel, its axis across the car
  // (rotated about z only: the extra y turn laid it along the car, a black blade over each tyre).
  const archGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 14, 1, true, 0, Math.PI);
  const wheelPos = isVan ? [[-0.98, 1.35], [0.98, 1.35], [-0.98, -1.35], [0.98, -1.35]] : [[-0.9, 1.25], [0.9, 1.25], [-0.9, -1.2], [0.9, -1.2]];
  for (const [x, z] of wheelPos) {
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.rotation.z = Math.PI / 2;
    arch.position.set(Math.sign(x) * (width / 2 + 0.02), 0.42, z);
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

// A Joker drone tank: an unmanned, armoured little tank in the Joker's purple and green. A sloped
// hull (lofted, like the Batmobile's body), tracks with road wheels and a track guard, a faceted
// turret with a glowing red sensor eye where a crew hatch would be, a long barrel with a muzzle
// brake, an antenna with a blinking tip, and a painted grin on the glacis. The hull and the turret
// are each merged (mergeStaticParts) so a squad of six stays cheap; the turret keeps its own
// pivot so it can still turn to aim at Batman. Returns { group, turretPivot, barrel, radius, ... }.
export function createDroneTank() {
  const group = new THREE.Group();
  const hullMat = toonMaterial({ color: 0x4f2a66 });
  const trackMat = toonMaterial({ color: 0x15161b });
  const wheelMat = toonMaterial({ color: 0x3a3d45 });
  const turretMat = toonMaterial({ color: 0x3fae4a });
  const trim = toonMaterial({ color: 0x24262c });
  const grinMat = toonMaterial({ color: 0xe8e2d4 });
  const eyeMat = glowMaterial(0xff3040, 1, false);

  const hullParts = new THREE.Group();
  // Hull: a sloped glacis at the front, flat deck, a short sloped rear.
  hullParts.add(loftPart([
    { z: 1.7, y0: 0.35, hw: 0.8, ym: 0.5, yt: 0.58, tw: 0.62 },
    { z: 1.1, y0: 0.3, hw: 0.98, ym: 0.72, yt: 0.95, tw: 0.82 },
    { z: -1.2, y0: 0.3, hw: 0.98, ym: 0.72, yt: 0.95, tw: 0.82 },
    { z: -1.65, y0: 0.35, hw: 0.86, ym: 0.62, yt: 0.78, tw: 0.66 },
  ], hullMat, 0.026));
  for (const sx of [-1, 1]) {
    // Track: a dark belt with a guard over it and five road wheels showing on the outside.
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 3.5), trackMat);
    track.position.set(sx * 1.12, 0.3, 0);
    addHullOutline(track, 0.02);
    hullParts.add(track);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 3.6), trim);
    guard.position.set(sx * 1.12, 0.6, 0);
    hullParts.add(guard);
    for (let k = 0; k < 5; k++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12).rotateZ(Math.PI / 2), wheelMat);
      wheel.position.set(sx * 1.36, 0.27, -1.3 + k * 0.65);
      hullParts.add(wheel);
    }
  }
  // A painted grin across the glacis: a white crescent with teeth lines, the Joker's calling card.
  const grin = new THREE.Shape();
  grin.moveTo(-0.55, 0.08); grin.quadraticCurveTo(0, -0.32, 0.55, 0.08); grin.quadraticCurveTo(0, -0.12, -0.55, 0.08);
  const grinGeo = new THREE.ShapeGeometry(grin);
  grinGeo.rotateX(-0.62).translate(0, 0.78, 1.42);
  hullParts.add(new THREE.Mesh(grinGeo, grinMat));
  mergeStaticParts(hullParts);
  group.add(hullParts);

  const turretPivot = new THREE.Group();
  turretPivot.position.set(0, 0.95, -0.15);
  const turretParts = new THREE.Group();
  turretParts.add(loftPart([
    { z: 0.75, y0: 0, hw: 0.45, ym: 0.18, yt: 0.32, tw: 0.32 },
    { z: 0.3, y0: 0, hw: 0.7, ym: 0.3, yt: 0.5, tw: 0.5 },
    { z: -0.75, y0: 0, hw: 0.72, ym: 0.3, yt: 0.48, tw: 0.52 },
    { z: -0.95, y0: 0, hw: 0.55, ym: 0.22, yt: 0.36, tw: 0.4 },
  ], turretMat, 0.02));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.7, 12).rotateX(Math.PI / 2), trim);
  barrel.position.set(0, 0.28, 1.5);
  addHullOutline(barrel, 0.014);
  turretParts.add(barrel);
  const brake = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.22), trim);
  brake.position.set(0, 0.28, 2.38);
  addHullOutline(brake, 0.012);
  turretParts.add(brake);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.9, 6), trim);
  mast.position.set(-0.42, 0.9, -0.6);
  turretParts.add(mast);
  mergeStaticParts(turretParts);
  turretPivot.add(turretParts);
  // The sensor eye and the antenna tip glow on their own (unmerged, unlit).
  const eye = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), eyeMat);
  eye.position.set(0.22, 0.36, 0.62);
  eye.rotation.x = -0.35;
  turretPivot.add(eye);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glowMaterial(0x6dff7a, 1, false));
  tip.position.set(-0.42, 1.36, -0.6);
  turretPivot.add(tip);
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
