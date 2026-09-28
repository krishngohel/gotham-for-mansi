import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from './layers.js';

// Rain streaks: drawn as short, flat-shaded quads rather than GL lines so they read as
// thick inked dashes. The dash shape (length + width) is built in view space at a fixed
// screen-space angle, so it always looks the same regardless of where the camera points;
// only the dash's world position (the falling-drop placement below) uses 3D space.
const vertexShader = /* glsl */ `
attribute float aSide;
attribute float aT;
attribute float aSeed;
uniform float uTime, uArea, uHeight, uSpeed, uLen, uWidth;
uniform vec3 uCenter;
uniform vec2 uSlant;
void main() {
  float speed = uSpeed * (0.8 + 0.4 * aSeed);
  float y = mod(position.y - uTime * speed, uHeight);
  vec3 p;
  p.x = uCenter.x + mod(position.x - uCenter.x, uArea) - uArea * 0.5 + uSlant.x * y;
  p.z = uCenter.z + mod(position.z - uCenter.z, uArea) - uArea * 0.5 + uSlant.y * y;
  p.y = uCenter.y - uHeight * 0.45 + y;
  vec4 vp = viewMatrix * vec4(p, 1.0);
  // Fixed 18 degree slant in screen (view) space: dashDir is the dash's long axis,
  // widthDir its perpendicular thickness axis. Both are constant, so the dash never
  // rotates with the camera the way a true 3D line segment would.
  float ang = radians(18.0);
  vec2 dashDir = vec2(sin(ang), cos(ang));
  vec2 widthDir = vec2(-dashDir.y, dashDir.x);
  vp.xy += dashDir * (uLen * aT) + widthDir * (uWidth * aSide);
  gl_Position = projectionMatrix * vp;
}
`;
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uColor, uOpacity); }
`;

// Splashes: comic "crown" marks (three short strokes fanning up) that flash briefly on
// the ground around the player.
const splashVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime, uArea, uGround, uRate, uLife;
uniform vec3 uCenter;
varying vec2 vUv;
varying float vAge;
varying float vLive;
// A multiply/fract hash (no sin()): sin()-based hashes go degenerate in the vertex stage
// on some ANGLE/D3D backends, silently collapsing every instance to the same spot.
float hash(float n) {
  n = fract(n * 0.1031);
  n *= n + 33.33;
  n *= n + n;
  return fract(n);
}
void main() {
  float cyc = uTime * uRate + aSeed * 17.0;
  float cycAge = fract(cyc);
  float id = floor(cyc) + aSeed * 131.0;
  // Marks live for uLife seconds, then stay hidden for the rest of the spawn cycle.
  float lifeFrac = clamp(uLife * uRate, 0.001, 1.0);
  vec2 p = uCenter.xz + (vec2(hash(id), hash(id + 7.3)) - 0.5) * uArea;
  float size = 0.3;
  vec3 w = vec3(p.x + position.x * size, uGround + 0.04, p.y + position.y * size * 0.9);
  vUv = position.xy;
  vAge = clamp(cycAge / lifeFrac, 0.0, 1.0);
  vLive = step(cycAge, lifeFrac);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;
const splashFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vAge;
varying float vLive;
void main() {
  vec2 q = vUv * 2.0; q.y = -q.y;
  float a = atan(q.x, q.y);
  float r = length(q);
  float stroke = (1.0 - smoothstep(0.06, 0.12, abs(fract((a + 0.9) / 0.6) - 0.5) * r)) * step(0.35, r) * step(r, 0.95) * step(abs(a), 0.95);
  if (stroke < 0.5) discard;
  float a2 = stroke * (1.0 - vAge) * vLive * uOpacity;
  if (a2 < 0.01) discard;
  gl_FragColor = vec4(uColor, a2);
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
    uTime: { value: 0 }, uArea: { value: 22 }, uGround: { value: 0 }, uRate: { value: 1.6 }, uLife: { value: 0.18 },
    uCenter: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(PALETTE.paper) }, uOpacity: { value: 0.6 },
  };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: splashVertex, fragmentShader: splashFragment, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_FX);
  mesh.renderOrder = 9;
  return { mesh, uniforms };
}

export function createRain(count, { area = 36, height = 24 } = {}) {
  // Each streak is a quad (4 verts, 2 triangles) instead of a GL line, so it can be
  // drawn thick. Placement is weighted so density within 10 m of the player is 1.5x
  // the uniform rate and density beyond that is 0.7x, while the streak count (and thus
  // the total vertex/triangle budget) stays exactly `count`.
  const pos = new Float32Array(count * 4 * 3);
  const side = new Float32Array(count * 4);
  const t = new Float32Array(count * 4);
  const seed = new Float32Array(count * 4);
  const index = new Uint32Array(count * 6);
  const center = area / 2;
  for (let i = 0; i < count; i++) {
    let x = 0, z = 0;
    for (let tries = 0; tries < 50; tries++) {
      x = Math.random() * area; z = Math.random() * area;
      const d = Math.hypot(x - center, z - center);
      const w = d < 10 ? 1.5 : 0.7;
      if (Math.random() < w / 1.5) break;
    }
    const y = Math.random() * height, s = Math.random();
    const base = i * 4;
    for (let v = 0; v < 4; v++) pos.set([x, y, z], (base + v) * 3);
    side.set([-1, 1, -1, 1], base);
    t.set([0, 0, 1, 1], base);
    seed.set([s, s, s, s], base);
    index.set([base, base + 1, base + 2, base + 1, base + 3, base + 2], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const uniforms = {
    uTime: { value: 0 }, uArea: { value: area }, uHeight: { value: height }, uSpeed: { value: 22 },
    // 40% shorter and 1.6x thicker than the original hairline streaks.
    uLen: { value: 0.36 }, uWidth: { value: 0.032 },
    uCenter: { value: new THREE.Vector3() }, uSlant: { value: new THREE.Vector2(0.18, 0.06) },
    uColor: { value: new THREE.Color(PALETTE.paper) }, uOpacity: { value: 0.55 },
  };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
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
