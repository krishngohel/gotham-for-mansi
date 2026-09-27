import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { batOutline } from '../config/batShape.js';
import { LAYER_FX } from '../render/layers.js';

export const SIGNAL_DIR = new THREE.Vector3(-0.35, 0.72, -0.6).normalize();

function batTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#fff';
  g.beginPath();
  batOutline().forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, 128 + x * 2.05, 128 - y * 2.05));
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uTop, uHorizon, uGlow, uSignal, uInk, uSignalDir;
uniform sampler2D tBat;
uniform float uTime;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.1, 1.0);
  vec3 col = mix(uGlow, uHorizon, smoothstep(0.0, 0.12, h));
  col = mix(col, uTop, smoothstep(0.12, 0.6, h));

  vec2 cp = d.xz / max(d.y, 0.05) * 1.1 + vec2(uTime * 0.012, uTime * 0.005);
  float c = fbm(cp);
  float cloud = floor(smoothstep(0.42, 0.78, c) * 3.0) / 3.0 * smoothstep(0.02, 0.2, h);
  vec3 cloudCol = mix(uHorizon * 1.5, uGlow, 1.0 - smoothstep(0.05, 0.45, h));
  col = mix(col, cloudCol, cloud * 0.85);

  vec3 sd = normalize(uSignalDir);
  float cosA = dot(d, sd);
  vec3 right = normalize(cross(sd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, sd);
  vec2 q = vec2(dot(d, right), dot(d, up)) / max(cosA, 0.001);
  vec2 e = q / 0.17 * vec2(1.0, 1.3);
  float rad = length(e);
  float front = step(0.0, cosA);
  float inside = step(rad, 1.0) * front;
  float bat = texture2D(tBat, e * 0.5 + 0.5).r;
  float haze = smoothstep(1.6, 0.9, rad) * front;
  col = mix(col, uSignal * 0.55, haze * 0.3 * (0.4 + cloud));
  col = mix(col, mix(uSignal, uInk, bat), inside * (0.6 + 0.4 * cloud));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function createSkyDome() {
  const uniforms = {
    uTop: { value: new THREE.Color(0x0e1422) },
    uHorizon: { value: new THREE.Color(PALETTE.gotham) },
    uGlow: { value: new THREE.Color(0x6b4a3a) },
    uSignal: { value: new THREE.Color(PALETTE.signal) },
    uInk: { value: new THREE.Color(PALETTE.ink) },
    uSignalDir: { value: SIGNAL_DIR.clone() },
    tBat: { value: batTexture() },
    uTime: { value: 0 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(450, 48, 24),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  mesh.layers.set(LAYER_FX);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return { mesh, update(t, cameraPos) { uniforms.uTime.value = t; mesh.position.copy(cameraPos); } };
}
