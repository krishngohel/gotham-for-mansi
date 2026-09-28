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

// Splashes: small ink-white rings that pop on the ground around the player.
const splashVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime, uArea, uGround, uRate;
uniform vec3 uCenter;
varying vec2 vUv;
varying float vAge;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float cyc = uTime * uRate + aSeed * 17.0;
  float age = fract(cyc);
  float id = floor(cyc) + aSeed * 131.0;
  vec2 p = uCenter.xz + (vec2(hash(id), hash(id + 7.3)) - 0.5) * uArea;
  float size = 0.08 + 0.3 * age;
  vec3 w = vec3(p.x + position.x * size, uGround + 0.04, p.y + position.y * size * 0.9);
  vUv = position.xy;
  vAge = age;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;
const splashFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vAge;
void main() {
  float r = length(vUv) * 2.0;
  float ring = smoothstep(0.62, 0.82, r) * (1.0 - smoothstep(0.86, 1.0, r));
  float a = ring * (1.0 - vAge) * step(vAge, 0.7) * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

function createSplashes(count) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  const seed = new Float32Array(count).map(() => Math.random());
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  geo.instanceCount = count;
  const uniforms = {
    uTime: { value: 0 }, uArea: { value: 22 }, uGround: { value: 0 }, uRate: { value: 1.6 },
    uCenter: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(PALETTE.paper) }, uOpacity: { value: 0.45 },
  };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: splashVertex, fragmentShader: splashFragment, transparent: true, depthWrite: false }));
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_FX);
  mesh.renderOrder = 9;
  return { mesh, uniforms };
}

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
  // Splashes ride along as a child so callers keep adding a single mesh.
  const splash = createSplashes(Math.round(count / 20));
  mesh.add(splash.mesh);
  return {
    mesh,
    // ground: the surface height under the player, or null to hide splashes (in the air).
    update(t, center, ground = null) {
      uniforms.uTime.value = t;
      uniforms.uCenter.value.copy(center);
      splash.uniforms.uTime.value = t;
      splash.mesh.visible = ground !== null;
      if (ground !== null) { splash.uniforms.uGround.value = ground; splash.uniforms.uCenter.value.copy(center); }
    },
  };
}
