import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';
import { createSkyDome, SIGNAL_DIR } from './sky.js';
import { createSkyline } from './skyline.js';
import { createBatsignal } from './batsignal.js';

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMaterial({ color }));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function cylinder(rt, rb, h, color, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toonMaterial({ color }));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function puddle(rng, x, z) {
  const shape = new THREE.Shape();
  const n = 10, r0 = rng.range(0.5, 1.2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = r0 * rng.range(0.6, 1.1);
    const px = Math.cos(a) * r * 1.4, py = Math.sin(a) * r;
    i ? shape.lineTo(px, py) : shape.moveTo(px, py);
  }
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: PALETTE.paper, transparent: true, opacity: 0.2, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.01, z);
  m.layers.set(LAYER_FX);
  return m;
}

export function createLookTestSet(scene, quality, rng) {
  scene.background = new THREE.Color(PALETTE.fog);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.011);

  scene.add(new THREE.HemisphereLight(0x6a7fa8, 0x14171f, 1.1));
  const moon = new THREE.DirectionalLight(0xa9bde0, 2.2);
  moon.position.set(-20, 35, 12);
  if (quality.shadows) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.02;
  }
  scene.add(moon, moon.target);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 2.6);
  rim.position.set(6, 8, -14);
  scene.add(rim);

  const roof = new THREE.Group();
  scene.add(roof);
  roof.add(box(30, 1, 30, PALETTE.slate, 0, -0.5, 0));
  for (const s of [-1, 1]) {
    roof.add(box(30.8, 0.9, 0.4, 0x3d4759, 0, 0.45, s * 15.2), box(31.2, 0.12, 0.7, 0x6a7489, 0, 0.96, s * 15.2));
    roof.add(box(0.4, 0.9, 30.8, 0x3d4759, s * 15.2, 0.45, 0), box(0.7, 0.12, 31.2, 0x6a7489, s * 15.2, 0.96, 0));
  }
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) roof.add(cylinder(0.12, 0.12, 3, 0x2d3340, -9 + lx * 1.2, 1.5, -9 + lz * 1.2, 8));
  roof.add(cylinder(1.8, 1.8, 3, PALETTE.wood, -9, 4.5, -9, 24), cylinder(0, 1.95, 1.1, 0x3a3f4a, -9, 6.55, -9, 24));
  roof.add(box(2, 1.2, 1.4, 0x6a7489, 7, 0.6, -6), box(2, 1.2, 1.4, 0x6a7489, 9.5, 0.6, -6));
  roof.add(cylinder(0.5, 0.5, 0.12, PALETTE.ink, 7, 1.26, -6, 16), cylinder(0.5, 0.5, 0.12, PALETTE.ink, 9.5, 1.26, -6, 16));
  roof.add(box(3.5, 3, 3, 0x3d4759, -10, 1.5, 7), box(1.1, 2.1, 0.05, PALETTE.ink, -10, 1.05, 8.53));
  roof.add(cylinder(0.05, 0.05, 7, 0x2d3340, 11, 3.5, 9, 6));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: PALETTE.balloon }));
  beacon.position.set(11, 7.05, 9);
  roof.add(beacon);

  roof.add(cylinder(0.06, 0.08, 3.6, 0x2d3340, 5, 1.8, 4, 8), box(1.2, 0.08, 0.08, 0x2d3340, 5.5, 3.55, 4));
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: PALETTE.sodium }));
  lampHead.position.set(6, 3.45, 4);
  roof.add(lampHead);
  const sodium = new THREE.PointLight(PALETTE.sodium, 30, 16, 2);
  sodium.position.set(6, 3.3, 4);
  roof.add(sodium);

  for (let i = 0; i < 6; i++) roof.add(puddle(rng, rng.range(-12, 12), rng.range(-12, 12)));

  scene.add(createSkyline(rng));
  const signalRoof = box(12, 40, 12, 0x2a3446, -18, -26, -30);
  scene.add(signalRoof);
  const signal = createBatsignal(new THREE.Vector3(-18, -4.6, -30), SIGNAL_DIR.clone().multiplyScalar(420));
  scene.add(signal.group);
  const sky = createSkyDome();
  scene.add(sky.mesh);

  return {
    update(t, cameraPos) {
      beacon.visible = Math.floor(t * 1.2) % 2 === 0;
      signal.update(t);
      sky.update(t, cameraPos);
    },
    setFlash(k) { moon.intensity = 2.2 + 10 * k; },
  };
}
