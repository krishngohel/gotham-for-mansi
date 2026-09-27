import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';

const beamVertex = /* glsl */ `
varying float vAlong;
varying float vEdge;
void main() {
  vAlong = uv.y;
  vec3 n = normalize(normalMatrix * normal);
  vec3 v = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);
  vEdge = abs(dot(n, v));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying float vAlong;
varying float vEdge;
void main() {
  float a = pow(vEdge, 1.2) * pow(1.0 - vAlong, 1.6) * 0.62;
  a *= 0.9 + 0.1 * sin(uTime * 3.0 + vAlong * 40.0);
  gl_FragColor = vec4(uColor * a, a);
}
`;

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

  const uniforms = { uColor: { value: new THREE.Color(PALETTE.signal) }, uTime: { value: 0 } };
  const beamGeo = new THREE.CylinderGeometry(30, 1.05, length, 32, 1, true).translate(0, length / 2, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
    uniforms, vertexShader: beamVertex, fragmentShader: beamFragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  }));
  beam.position.copy(lampPos);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  beam.layers.set(LAYER_FX);
  beam.frustumCulled = false;

  group.add(mount, housing, lens, beam);
  return { group, update(t) { uniforms.uTime.value = t; } };
}
