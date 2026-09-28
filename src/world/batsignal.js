import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';

export function createBatsignal(lampPos, target) {
  const group = new THREE.Group();
  const dir = target.clone().sub(lampPos).normalize();
  const length = target.distanceTo(lampPos) * 0.9;

  const mount = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), toonMaterial({ color: PALETTE.slate }));
  mount.position.copy(lampPos).add(new THREE.Vector3(0, -0.6, 0));
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 1.8, 24), toonMaterial({ color: 0x3a4150 }));
  housing.position.copy(lampPos);
  housing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(1.08, 28), new THREE.MeshBasicMaterial({ color: PALETTE.signal }));
  lens.position.copy(lampPos).addScaledVector(dir, 0.92);
  lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

  const beamGeo = new THREE.CylinderGeometry(30, 1.05, length, 32, 1, true).translate(0, length / 2, 0);
  // Flat graphic wedge, not a soft glow: the ink shader's mid-tone dots do the shading.
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: PALETTE.signal, opacity: 0.18, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  beam.position.copy(lampPos);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  beam.layers.set(LAYER_FX);
  beam.frustumCulled = false;

  group.add(mount, housing, lens, beam);
  return { group, update() {} };
}
