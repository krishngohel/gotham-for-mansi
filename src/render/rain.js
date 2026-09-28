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
attribute float aArea;
uniform float uTime, uHeight, uSpeed, uLen, uWidth;
uniform vec3 uCenter;
uniform vec2 uSlant;
varying float vFade;
void main() {
  float speed = uSpeed * (0.8 + 0.4 * aSeed);
  float y = mod(position.y - uTime * speed, uHeight);
  vec3 p;
  // Each streak wraps within its own aArea tile, centred on the camera every frame. A
  // streak spawned uniformly across [0, aArea) stays uniformly distributed under this
  // wrap no matter where the camera sits -- unlike weighting a single shared tile, which
  // only lines the dense region up with the camera when camera.position happens to be a
  // multiple of that tile size.
  p.x = uCenter.x + mod(position.x - uCenter.x, aArea) - aArea * 0.5 + uSlant.x * y;
  p.z = uCenter.z + mod(position.z - uCenter.z, aArea) - aArea * 0.5 + uSlant.y * y;
  p.y = uCenter.y - uHeight * 0.45 + y;
  vec4 vp = viewMatrix * vec4(p, 1.0);
  // The dash's own width/length offset (below) is added in view space, i.e. before the
  // perspective divide, so a fixed view-space width blows up on screen within a couple
  // of metres of the lens (screen size grows as 1/depth). Two guards against that:
  // (1) fade the streak out entirely as it nears the camera, so nothing ever sits right
  // on the lens, and (2) taper the width itself for anything closer than the 5 m cap
  // depth, so its on-screen thickness matches the dash's normal mid-distance look
  // instead of growing without bound as depth -> 0.
  float depth = -vp.z;
  vFade = smoothstep(1.2, 2.5, depth);
  const float widthCapDepth = 5.0;
  float width = uWidth * clamp(depth / widthCapDepth, 0.0, 1.0);
  // Fixed 18 degree slant in screen (view) space: dashDir is the dash's long axis,
  // widthDir its perpendicular thickness axis. Both are constant, so the dash never
  // rotates with the camera the way a true 3D line segment would.
  float ang = radians(18.0);
  vec2 dashDir = vec2(sin(ang), cos(ang));
  vec2 widthDir = vec2(-dashDir.y, dashDir.x);
  vp.xy += dashDir * (uLen * aT) + widthDir * (width * aSide);
  gl_Position = projectionMatrix * vp;
}
`;
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() { gl_FragColor = vec4(uColor, uOpacity * vFade); }
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
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms, vertexShader: splashVertex, fragmentShader: splashFragment, transparent: true, depthWrite: false,
    // DoubleSide: the quad is a vertical PlaneGeometry remapped to lie flat on the ground
    // in the vertex shader (position.xy -> world XZ), which can leave it back-facing from
    // above depending on winding, so both faces are drawn rather than reordering indices.
    side: THREE.DoubleSide,
    // Depth-test normally (so splashes go behind walls/props) but bias them slightly
    // toward the camera to avoid z-fighting with the ground they sit right on.
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_FX);
  mesh.renderOrder = 9;
  return { mesh, uniforms };
}

export function createRain(count, { area = 36, height = 24 } = {}) {
  // Each streak is a quad (4 verts, 2 triangles) instead of a GL line, so it can be
  // drawn thick. Density is layered, not weighted: ~40% of streaks are spawned into a
  // tight 20 m tile (the near layer) and the rest into the full `area` tile (the far
  // layer); both wrap centred on the camera (see the vertex shader). Each layer is
  // uniform within its own tile, so the near layer's higher density (fewer square
  // metres, same streak count share) holds everywhere the camera goes. Total streak
  // count is unchanged -- this only redistributes where the existing streaks spawn.
  const NEAR_AREA = 20;
  const nearCount = Math.round(count * 0.4);
  const pos = new Float32Array(count * 4 * 3);
  const side = new Float32Array(count * 4);
  const t = new Float32Array(count * 4);
  const seed = new Float32Array(count * 4);
  const streakArea = new Float32Array(count * 4);
  const index = new Uint32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const a = i < nearCount ? NEAR_AREA : area;
    const x = Math.random() * a, z = Math.random() * a;
    const y = Math.random() * height, s = Math.random();
    const base = i * 4;
    for (let v = 0; v < 4; v++) pos.set([x, y, z], (base + v) * 3);
    side.set([-1, 1, -1, 1], base);
    t.set([0, 0, 1, 1], base);
    seed.set([s, s, s, s], base);
    streakArea.set([a, a, a, a], base);
    index.set([base, base + 1, base + 2, base + 1, base + 3, base + 2], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aArea', new THREE.BufferAttribute(streakArea, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const uniforms = {
    uTime: { value: 0 }, uHeight: { value: height }, uSpeed: { value: 22 },
    // 40% shorter and 1.6x thicker than the original hairline streaks.
    uLen: { value: 0.36 }, uWidth: { value: 0.032 },
    uCenter: { value: new THREE.Vector3() }, uSlant: { value: new THREE.Vector2(0.18, 0.06) },
    uColor: { value: new THREE.Color(PALETTE.paper) }, uOpacity: { value: 0.55 },
  };
  // DoubleSide: the dash quad's width offset is built in view space and can wind either
  // way depending on the camera angle, so both faces are drawn rather than tracking that.
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
