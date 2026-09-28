// Steam rising from manholes, roof vents and chimneys: camera-facing puffs that swell, drift with
// the wind and fade. Flat comic shapes with a soft edge. One instanced draw call.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';

const vertexShader = /* glsl */ `
attribute vec4 aSrc;   // x, y, z, scale
attribute float aPhase;
uniform float uTime;
uniform vec2 uWind;
uniform float uFogDensity;
varying vec2 vUv;
varying float vAge;
varying float vFade;
varying float vSeed;
void main() {
  float rate = 0.16 + 0.08 * fract(aPhase * 7.13);
  float age = fract(uTime * rate + aPhase);
  float s = aSrc.w;
  vec3 p = aSrc.xyz;
  p.y += age * (2.2 + 3.2 * s);
  p.x += (uWind.x * age * age * 4.0 + sin(aPhase * 40.0 + uTime * 0.8) * 0.35 * age) * s;
  p.z += (uWind.y * age * age * 4.0 + cos(aPhase * 30.0 + uTime * 0.7) * 0.35 * age) * s;
  float size = s * (0.7 + 2.8 * age);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy;
  vAge = age;
  vSeed = aPhase;
  float d = -mv.z;
  vFade = exp(-pow(uFogDensity * d, 2.0)) * (1.0 - smoothstep(90.0, 150.0, d)) * smoothstep(3.0, 9.0, d);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor, uShade;
varying vec2 vUv;
varying float vAge;
varying float vFade;
varying float vSeed;
void main() {
  // A lumpy cloud outline: radius wobbles with angle, so each puff is a clean comic shape.
  float ang = atan(vUv.y, vUv.x);
  float r = length(vUv);
  float edge = 0.42 + 0.06 * sin(ang * 3.0 + vSeed * 17.0) + 0.04 * sin(ang * 5.0 + vSeed * 9.0);
  float body = 1.0 - smoothstep(edge - 0.1, edge, r);
  if (body < 0.01) discard;
  // Lit from above: the top of each puff is paler, the underside takes the shade tone.
  vec3 col = mix(uShade, uColor, smoothstep(-0.3, 0.3, vUv.y + 0.1));
  float life = smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(0.45, 1.0, vAge));
  gl_FragColor = vec4(col, body * life * 0.2 * vFade);
}
`;

export function createSteam(sources, { perSource = 5, fogDensity = 0.0062 } = {}) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  const n = sources.length * perSource;
  const src = new Float32Array(n * 4), phase = new Float32Array(n);
  let i = 0;
  for (const s of sources) {
    const seed = Math.abs(Math.sin(s.x * 12.9898 + s.z * 78.233)) % 1;
    for (let k = 0; k < perSource; k++, i++) {
      src.set([s.x, s.y, s.z, s.s ?? 1], i * 4);
      phase[i] = (k / perSource + seed * 0.37) % 1;
    }
  }
  geo.setAttribute('aSrc', new THREE.InstancedBufferAttribute(src, 4));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.instanceCount = n;
  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector2(0.6, 0.25) },
    uFogDensity: { value: fogDensity },
    uColor: { value: new THREE.Color(PALETTE.stripe) },
    uShade: { value: new THREE.Color(PALETTE.slate) },
  };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false }));
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_FX);
  mesh.renderOrder = 4;
  return { mesh, update(t) { uniforms.uTime.value = t; } };
}
