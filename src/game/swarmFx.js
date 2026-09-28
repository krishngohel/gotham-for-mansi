// The Bat Swarm: a couple of hundred inked bats, drawn like comic bats: each one turned to show the
// camera its silhouette, head up and leaning into its flight, with a thin moonlit rim so a crowd
// of them reads as bats rather than an ink blot. They pour down out of the sky, whirl around each
// held goon and in a wide ring around the whole squad, then burst up and away on the finisher.
// Two instanced meshes (ink and rim) share one geometry and one matrix buffer: two draw calls. The
// wings flap in the vertex shader from one per-bat value. Everything is written into preallocated
// arrays: nothing is created after the build, and nothing is drawn while no swarm is up.
import * as THREE from 'three';
import { batOutline } from '../config/batShape.js';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';

export const SWARM_BATS = 220;
const RING = 0.35;         // share of the bats that circle the whole squad rather than one goon
const DIVE = 0.55;         // seconds for the last bat to arrive from the sky
const LEAVE = 0.9;         // seconds the bats keep flying off after the swarm ends
const SPAN = 0.0062;       // emblem units to metres: a 0.62 m wingspan at full size
const LEAN = 1.1;          // how far a bat's head tips from up toward where it is flying

let GEO = null;
function batGeo() {
  // In the XY plane, head up (+y), facing +z: the swarm turns +z toward the camera.
  if (!GEO) GEO = new THREE.ShapeGeometry(new THREE.Shape(batOutline().map(([x, y]) => new THREE.Vector2(x * SPAN, y * SPAN))));
  return GEO;
}
// Each mesh gets its own copy of the shape with its own per-bat flap attribute.
function geoWith(count) {
  const g = batGeo().clone();
  const flap = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  flap.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aFlap', flap);
  return g;
}
// Flat colour, both sides. aFlap (-1..1) swings each wing about the body, seen face on: a V on
// the upstroke, a drooping arch on the down, the wingtips pulling in as they fold. The rim is the
// same bat grown a little and set a hair behind. The cache keys keep the warm cast and the swarm on
// the same two programs.
function batMaterial(rim) {
  const m = new THREE.MeshBasicMaterial({ color: rim ? PALETTE.windowCool : PALETTE.ink, side: THREE.DoubleSide });
  const grow = rim ? '\ntransformed.xy *= 1.1;\ntransformed.z -= 0.02;' : '';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFlap;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float wing = abs(transformed.x);
transformed.y += wing * aFlap * 0.8;
transformed.x *= 1.0 - 0.3 * abs(aFlap);${grow}`);
  };
  m.customProgramCacheKey = () => (rim ? 'swarmBatRim' : 'swarmBat');
  return m;
}

export function createSwarmWarm() {
  const g = new THREE.Group();
  g.name = 'swarmWarm';
  const geo = geoWith(1);
  for (const rim of [false, true]) {
    const m = new THREE.InstancedMesh(geo, batMaterial(rim), 1);
    m.layers.set(LAYER_FX);
    g.add(m);
  }
  g.position.y = -50;
  return g;
}

export function createSwarmFx(scene, { count: N = SWARM_BATS, random = Math.random } = {}) {
  const geo = geoWith(N);
  const flapAttr = geo.getAttribute('aFlap');
  const flap = flapAttr.array;
  const mesh = new THREE.InstancedMesh(geo, batMaterial(false), N);
  mesh.name = 'batSwarm';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const rimMesh = new THREE.InstancedMesh(geo, batMaterial(true), N);
  rimMesh.name = 'batSwarmRim';
  rimMesh.instanceMatrix = mesh.instanceMatrix;
  for (const m of [mesh, rimMesh]) { m.frustumCulled = false; m.layers.set(LAYER_FX); m.visible = false; }
  const m4 = new THREE.Matrix4(), s = new THREE.Vector3();
  const nx = new THREE.Vector3(), ny = new THREE.Vector3(), nz = new THREE.Vector3(), cam = new THREE.Vector3();
  // Per bat, fixed at build: orbit phase, radius, height, angular speed, size, flap rate, a tilt
  // off square-on to the camera, and when it arrives. Per bat, live: position, last position,
  // velocity (the burst), and the last heading (kept while it hangs still).
  const phase = new Float32Array(N), radius = new Float32Array(N), height = new Float32Array(N), speed = new Float32Array(N);
  const size = new Float32Array(N), rate = new Float32Array(N), tilt = new Float32Array(N * 3), delay = new Float32Array(N);
  const owner = new Int8Array(N), spawn = new Float32Array(N * 3), pos = new Float32Array(N * 3), last = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  const head = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    phase[i] = random() * Math.PI * 2;
    radius[i] = 0.6 + random() * 1.0;
    height[i] = 0.25 + random() * 2.3;
    speed[i] = (3.2 + random() * 3.2) * (i % 2 ? 1 : -1);
    size[i] = 0.6 + random() * 0.55;
    rate[i] = 16 + random() * 10;
    delay[i] = random() * DIVE * 0.7;
    tilt[i * 3] = (random() - 0.5) * 0.5; tilt[i * 3 + 1] = (random() - 0.5) * 0.5; tilt[i * 3 + 2] = (random() - 0.5) * 0.5;
    head[i * 3 + 1] = 1;
  }
  // The squad's middle and how far it spreads: the outer ring circles them all.
  const center = new THREE.Vector3();
  let spread = 1;
  let targets = [], mode = 0, t = 0, leaveT = 0;

  // Face (+z) toward the camera, tipped a little off square by the bat's own tilt; head (+y) up,
  // leaning hard into the flight (so a bat crossing the screen banks, a diving one points down);
  // wings (+x) across. The comic emblem reads best near upright.
  function place(i, sc) {
    const j = i * 3;
    nz.set(cam.x - pos[j], cam.y - pos[j + 1], cam.z - pos[j + 2]).normalize();
    nz.x += tilt[j]; nz.y += tilt[j + 1]; nz.z += tilt[j + 2];
    nz.normalize();
    const dx = pos[j] - last[j], dy = pos[j + 1] - last[j + 1], dz = pos[j + 2] - last[j + 2];
    const d = Math.hypot(dx, dy, dz);
    if (d > 1e-6) { head[j] = dx / d; head[j + 1] = dy / d; head[j + 2] = dz / d; }
    ny.set(head[j] * LEAN, 1 + head[j + 1] * LEAN, head[j + 2] * LEAN);
    ny.addScaledVector(nz, -ny.dot(nz));
    if (ny.lengthSq() < 1e-6) ny.set(0, 1, 0).addScaledVector(nz, -nz.y);
    ny.normalize();
    nx.crossVectors(ny, nz);
    m4.makeBasis(nx, ny, nz).scale(s.setScalar(sc * size[i])).setPosition(pos[j], pos[j + 1], pos[j + 2]);
    mesh.setMatrixAt(i, m4);
  }
  function updateCenter() {
    let x = 0, y = 0, z = 0;
    for (const e of targets) { x += e.pos.x; y += e.pos.y; z += e.pos.z; }
    const n = targets.length || 1;
    center.set(x / n, y / n, z / n);
    spread = 0;
    for (const e of targets) spread = Math.max(spread, Math.hypot(e.pos.x - center.x, e.pos.z - center.z));
  }

  scene.add(mesh, rimMesh);
  const fx = {
    mesh,
    get active() { return mode !== 0; },
    // The bats pour in from high over the squad, from the side the camera sees.
    start(list, from = null) {
      targets = list;
      mode = 1; t = 0;
      updateCenter();
      const ox = from ? from.x : center.x, oz = from ? from.z : center.z;
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        owner[i] = i < N * RING ? -1 : i % list.length;
        spawn[j] = ox + (center.x - ox) * 0.4 + (random() - 0.5) * 14;
        spawn[j + 1] = center.y + 6 + random() * 7;
        spawn[j + 2] = oz + (center.z - oz) * 0.4 + (random() - 0.5) * 14;
        pos[j] = last[j] = spawn[j]; pos[j + 1] = last[j + 1] = spawn[j + 1]; pos[j + 2] = last[j + 2] = spawn[j + 2];
      }
      mesh.visible = rimMesh.visible = true;
    },
    // The finisher: every bat bursts up and out from where it is.
    rise() {
      if (mode !== 1) return;
      mode = 2;
      t = 0;
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        const ax = pos[j] - center.x, az = pos[j + 2] - center.z, d = Math.hypot(ax, az) || 1;
        const out = 4 + random() * 6;
        vel[j] = (ax / d) * out + (random() - 0.5) * 3;
        vel[j + 1] = 6 + random() * 9;
        vel[j + 2] = (az / d) * out + (random() - 0.5) * 3;
      }
    },
    // The swarm is over: the bats keep flying off and shrink away, then the mesh goes dark.
    // Safe to call more than once, and from any phase.
    stop() {
      if (mode === 0 || mode === 3) return;
      if (mode === 1) fx.rise();
      mode = 3;
      leaveT = 0;
      targets = [];
    },
    // camPos: where the bats turn their faces (the view camera).
    update(dt, camPos) {
      if (!mode) return;
      t += dt;
      if (mode === 3) {
        leaveT += dt;
        if (leaveT >= LEAVE) { mode = 0; mesh.visible = rimMesh.visible = false; return; }
      }
      if (camPos) cam.copy(camPos);
      if (mode === 1) updateCenter();
      const fade = mode === 3 ? 1 - leaveT / LEAVE : 1;
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        last[j] = pos[j]; last[j + 1] = pos[j + 1]; last[j + 2] = pos[j + 2];
        let sc = 1;
        if (mode === 1) {
          const k = owner[i];
          const a = phase[i] + t * speed[i] * (k < 0 ? 0.55 : 1);
          let gx, gy, gz, r;
          if (k < 0) { gx = center.x; gy = center.y; gz = center.z; r = spread + 1.2 + radius[i] * 1.6; }
          else { const g = targets[k].pos; gx = g.x; gy = g.y; gz = g.z; r = radius[i]; }
          const ox = gx + Math.cos(a) * r, oy = gy + height[i] + Math.sin(t * 5 + i) * 0.18, oz = gz + Math.sin(a) * r;
          // Diving in from the sky: eased from the spawn point to the orbit, arriving at speed.
          const d = Math.min(1, Math.max(0, (t - delay[i]) / (DIVE - delay[i] * 0.5)));
          const e = d * d * (3 - 2 * d);
          pos[j] = spawn[j] + (ox - spawn[j]) * e;
          pos[j + 1] = spawn[j + 1] + (oy - spawn[j + 1]) * e;
          pos[j + 2] = spawn[j + 2] + (oz - spawn[j + 2]) * e;
          sc = 0.6 + 0.4 * e;
        } else {
          vel[j + 1] += 5 * dt;
          pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
          sc = fade;
        }
        flap[i] = Math.sin(t * rate[i] * (mode === 1 ? 1 : 1.4) + phase[i] * 3);
        place(i, sc);
      }
      mesh.instanceMatrix.needsUpdate = true;
      flapAttr.needsUpdate = true;
    },
  };
  return fx;
}
