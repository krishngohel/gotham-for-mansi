// The harbor: flat dark water with drifting ink ripple lines and streaks of reflected city light.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { WORLD } from './mapData.js';

const vertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uWater, uInk, uPaper, uGlow, uFog, uCam;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec2 p = vWorld.xz;
  float n = noise(vec2(p.x * 0.05, p.y * 0.35 + uTime * 0.25)) * 0.6 + noise(vec2(p.x * 0.2 + uTime * 0.1, p.y * 1.1)) * 0.4;
  float ripple = smoothstep(0.035, 0.0, abs(fract(n * 5.0) - 0.5) - 0.44);
  vec3 col = uWater;
  // City glow reflected near the waterfront, broken into horizontal slivers.
  float shore = exp(-(p.y - 205.0) / 55.0);
  float streak = smoothstep(0.55, 0.9, noise(vec2(p.x * 0.35, 0.0))) * smoothstep(0.3, 0.7, noise(vec2(p.x * 0.3, p.y * 1.6 - uTime * 0.6)));
  col += uGlow * streak * shore * 0.9;
  col = mix(col, uPaper * 0.35, ripple * 0.35);
  col = mix(col, uInk, smoothstep(0.62, 0.7, n) * 0.35);
  float d = length(vWorld - uCam);
  col = mix(col, uFog, 1.0 - exp(-d * 0.0045));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function createWater() {
  const uniforms = {
    uTime: { value: 0 },
    uWater: { value: new THREE.Color(PALETTE.water) },
    uInk: { value: new THREE.Color(PALETTE.ink) },
    uPaper: { value: new THREE.Color(PALETTE.paper) },
    uGlow: { value: new THREE.Color(PALETTE.sodium) },
    uFog: { value: new THREE.Color(PALETTE.fog) },
    uCam: { value: new THREE.Vector3() },
  };
  const geo = new THREE.PlaneGeometry(1800, 1000).rotateX(-Math.PI / 2).translate(0, -0.6, WORLD.waterZ + 500);
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader }));
  mesh.receiveShadow = false;
  return { mesh, update(t, cam) { uniforms.uTime.value = t; uniforms.uCam.value.copy(cam); } };
}
