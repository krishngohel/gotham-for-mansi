import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from './layers.js';

const vertexShader = /* glsl */ `
attribute float aEnd;
attribute float aSeed;
uniform float uTime, uArea, uHeight, uSpeed, uLen;
uniform vec3 uCenter;
uniform vec2 uSlant;
varying float vA;
void main() {
  float speed = uSpeed * (0.8 + 0.4 * aSeed);
  float y = mod(position.y - uTime * speed, uHeight);
  vec3 p;
  p.x = uCenter.x + mod(position.x - uCenter.x, uArea) - uArea * 0.5 + uSlant.x * y;
  p.z = uCenter.z + mod(position.z - uCenter.z, uArea) - uArea * 0.5 + uSlant.y * y;
  p.y = uCenter.y - uHeight * 0.45 + y;
  p += vec3(uSlant.x, 1.0, uSlant.y) * uLen * aEnd;
  vA = 1.0 - aEnd;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() { gl_FragColor = vec4(uColor, uOpacity * vA); }
`;

export function createRain(count, { area = 36, height = 24 } = {}) {
  const pos = new Float32Array(count * 6);
  const end = new Float32Array(count * 2);
  const seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * area, y = Math.random() * height, z = Math.random() * area, s = Math.random();
    pos.set([x, y, z, x, y, z], i * 6);
    end.set([0, 1], i * 2);
    seed.set([s, s], i * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = {
    uTime: { value: 0 }, uArea: { value: area }, uHeight: { value: height }, uSpeed: { value: 22 }, uLen: { value: 0.6 },
    uCenter: { value: new THREE.Vector3() }, uSlant: { value: new THREE.Vector2(0.18, 0.06) },
    uColor: { value: new THREE.Color(PALETTE.paper) }, uOpacity: { value: 0.27 },
  };
  const mesh = new THREE.LineSegments(geo, new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false }));
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_FX);
  mesh.renderOrder = 10;
  return { mesh, update(t, center) { uniforms.uTime.value = t; uniforms.uCenter.value.copy(center); } };
}
