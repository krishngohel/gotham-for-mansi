// Things that move: traffic on the streets, the GCPD blimp, searchlights sweeping the clouds.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';
import { toonMaterial } from '../render/toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD } from './mapData.js';

const LINES = [-210, -150, -90, -30, 30, 90, 150, 210];
const CAR_COLORS = [0x6d2f2f, 0x2f3f5a, 0x39473a, 0x5a5146, 0x1e2026, 0x7a6a44, 0x4a3a52, 0xc9a227];

function beamMaterial(color, strength = 0.22) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: 'varying float vA; varying float vE; void main(){ vA = uv.y; vec3 n = normalize(normalMatrix * normal); vec3 v = normalize(-(modelViewMatrix * vec4(position,1.0)).xyz); vE = abs(dot(n, v)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; varying float vA; varying float vE; void main(){ float a = pow(vE, 1.3) * (1.0 - vA) * ${strength.toFixed(2)}; gl_FragColor = vec4(uColor * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// One car in its own space (origin on the road, nose toward +x): body, cabin, a dark bumper line
// and wheels merged into a single instanced mesh. Vertex colors keep the trim dark while the
// instance color paints the body.
function carGeometry() {
  const parts = [];
  const add = (g, hex) => {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]), 3));
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  add(new THREE.BoxGeometry(4.3, 0.85, 1.9).translate(0, 0.8, 0), 0xffffff);
  add(new THREE.BoxGeometry(2.2, 0.7, 1.7).translate(-0.2, 1.5, 0), 0xffffff);
  add(new THREE.BoxGeometry(4.42, 0.22, 1.96).translate(0, 0.5, 0), 0x1a1b20);
  for (const [a, b] of [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]]) add(new THREE.CylinderGeometry(0.37, 0.37, 0.28, 10).rotateX(Math.PI / 2).translate(a, 0.37, b), 0x16171b);
  return mergeGeometries(parts);
}

function createTraffic(scene, halos, rng, count = 44) {
  const body = new THREE.InstancedMesh(carGeometry(), toonMaterial({ vertexColors: true }), count);
  const glass = new THREE.InstancedMesh(new THREE.BoxGeometry(2.25, 0.45, 1.55).translate(-0.2, 1.52, 0), toonMaterial({ color: PALETTE.glass }), count);
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.16, 1.5).translate(2.17, 0.85, 0), new THREE.MeshBasicMaterial({ color: 0xfff3d0 }), count);
  const c = new THREE.Color();
  const cars = [];
  for (let i = 0; i < count; i++) {
    const alongX = rng.chance(0.5);
    // z = -150 now runs straight through both hollow interiors (Part I): the funhouse's centre
    // and the Ace hall's south wall. x = 150 also cuts straight through the Ace hall (its office
    // and vat rows). Both dropped from the pick (never from the rng.pick() call count, only from
    // the array it draws): traffic elsewhere is unaffected.
    const line = rng.pick(LINES.filter((l) => alongX ? (l < WORLD.waterZ - 20 && l !== -150) : l !== 150));
    const dir = rng.chance(0.5) ? 1 : -1;
    const min = alongX ? WORLD.minX : WORLD.minZ, max = alongX ? WORLD.maxX : WORLD.waterZ - 8;
    cars.push({ alongX, line, dir, t: rng.range(min, max), min, max, speed: rng.range(9, 15), cur: 0, head: [halos.add(0, 0, 0, 0xfff3d0, 2), halos.add(0, 0, 0, 0xfff3d0, 2)], tail: [halos.add(0, 0, 0, 0xff3030, 1.2), halos.add(0, 0, 0, 0xff3030, 1.2)] });
    c.set(rng.pick(CAR_COLORS));
    body.setColorAt(i, c);
  }
  for (const m of [body, glass, lamps]) { m.castShadow = m !== lamps; m.frustumCulled = false; scene.add(m); }
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  return {
    update(dt, hero) {
      cars.forEach((car, i) => {
        // Keep right: offset from the center line by lane direction.
        const lane = 3 * car.dir;
        const x = car.alongX ? car.t : car.line + lane;
        const z = car.alongX ? car.line - lane : car.t;
        // Brake for the hero standing in the road.
        const ahead = hero && Math.abs(hero.pos.y) < 2 && Math.hypot(hero.pos.x - (x + (car.alongX ? car.dir * 5 : 0)), hero.pos.z - (z + (car.alongX ? 0 : car.dir * 5))) < 4;
        car.cur += ((ahead ? 0 : car.speed) - car.cur) * Math.min(1, dt * (ahead ? 6 : 1.2));
        car.t += car.dir * car.cur * dt;
        if (car.t > car.max) car.t = car.min;
        if (car.t < car.min) car.t = car.max;
        const yaw = car.alongX ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        q.setFromAxisAngle(yAxis, yaw);
        mtx.compose(p.set(x, 0, z), q, s);
        body.setMatrixAt(i, mtx);
        glass.setMatrixAt(i, mtx);
        lamps.setMatrixAt(i, mtx);
        const fx = Math.cos(yaw), fz = -Math.sin(yaw);
        for (const k of [0, 1]) {
          const side = k ? 0.65 : -0.65;
          halos.set(car.head[k], x + fx * 2.2 - fz * side, 0.85, z + fz * 2.2 + fx * side);
          halos.set(car.tail[k], x - fx * 2.2 - fz * side, 0.9, z - fz * 2.2 + fx * side, car.cur < 1 ? 2 : 1.2);
        }
      });
      for (const m of [body, glass, lamps]) m.instanceMatrix.needsUpdate = true;
    },
  };
}

function createBlimp(scene, halos) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16).scale(16, 5, 5), toonMaterial({ color: 0x6a7489 }));
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#6a7489'; x.fillRect(0, 0, 512, 128);
  x.font = '96px Bangers, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#efe6cf'; x.strokeStyle = '#0b0b12'; x.lineWidth = 8;
  x.strokeText('GCPD', 256, 68); x.fillText('GCPD', 256, 68);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    side.position.set(0, 0.5, s * 5.02);
    if (s < 0) side.rotation.y = Math.PI;
    g.add(side);
  }
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 1.8), toonMaterial({ color: 0x2f3440 }));
  gondola.position.y = -5.4;
  const fins = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.3), toonMaterial({ color: 0x4a5264 }));
  fins.position.x = -14;
  const light = new THREE.Mesh(new THREE.CylinderGeometry(9, 0.5, 90, 20, 1, true).translate(0, -45, 0), beamMaterial(0xdfe8ff, 0.16));
  light.position.y = -6;
  light.rotation.z = 0.35;
  light.layers.set(LAYER_FX);
  g.add(hull, gondola, fins, light);
  const blink = halos.add(0, 0, 0, PALETTE.balloon, 3);
  scene.add(g);
  return {
    update(t) {
      const a = t * 0.03;
      g.position.set(Math.cos(a) * 190, 118, Math.sin(a) * 170 - 20);
      g.rotation.y = -a - Math.PI / 2 + Math.PI;
      light.rotation.x = Math.sin(t * 0.4) * 0.35;
      halos.set(blink, g.position.x, g.position.y + 5, g.position.z, Math.sin(t * 3) > 0 ? 3 : 0.01);
    },
  };
}

function createSearchlights(scene) {
  const beams = [[-420, -300], [380, -350], [-350, 420]].map(([x, z], i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(14, 1, 520, 20, 1, true).translate(0, 260, 0), beamMaterial(0xcfe0ff, 0.12));
    m.position.set(x, 0, z);
    m.layers.set(LAYER_FX);
    m.frustumCulled = false;
    scene.add(m);
    return { m, phase: i * 2.1 };
  });
  return {
    update(t) {
      for (const b of beams) { b.m.rotation.z = Math.sin(t * 0.21 + b.phase) * 0.45; b.m.rotation.x = Math.cos(t * 0.17 + b.phase) * 0.3; }
    },
  };
}

export function createCityLife(scene, halos, rng) {
  const traffic = createTraffic(scene, halos, rng);
  const blimp = createBlimp(scene, halos);
  const lights = createSearchlights(scene);
  return {
    update(t, dt, hero) {
      traffic.update(dt, hero);
      blimp.update(t);
      lights.update(t);
    },
  };
}
