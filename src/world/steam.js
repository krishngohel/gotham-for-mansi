// Steam rising from manholes, roof vents and chimneys: camera-facing puffs that swell, drift with
// the wind and fade. Flat comic shapes with a soft edge. One instanced draw call per look: the
// look (opacity, rise, drift, growth, near fade, inked rim, breathing) is uniforms only, so every
// instance shares one shader program and the boot prewarm compiles it once.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';

const vertexShader = /* glsl */ `
attribute vec4 aSrc;   // x, y, z, scale
attribute float aPhase;
uniform float uTime;
uniform vec2 uWind;
uniform float uFogDensity;
uniform float uRise, uDrift, uGrow;
uniform vec2 uNear;
varying vec2 vUv;
varying float vAge;
varying float vFade;
varying float vSeed;
void main() {
  float rate = 0.16 + 0.08 * fract(aPhase * 7.13);
  float age = fract(uTime * rate + aPhase);
  float s = aSrc.w;
  vec3 p = aSrc.xyz;
  p.y += age * (2.2 + 3.2 * s) * uRise;
  p.x += (uWind.x * age * age * 4.0 * uDrift + sin(aPhase * 40.0 + uTime * 0.8) * 0.35 * age) * s;
  p.z += (uWind.y * age * age * 4.0 * uDrift + cos(aPhase * 30.0 + uTime * 0.7) * 0.35 * age) * s;
  float size = s * (0.7 + uGrow * age);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy;
  vAge = age;
  vSeed = aPhase;
  float d = -mv.z;
  vFade = exp(-pow(uFogDensity * d, 2.0)) * (1.0 - smoothstep(90.0, 150.0, d)) * smoothstep(uNear.x, uNear.y, d);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor, uShade;
uniform float uTime, uAlpha, uRim, uPulse;
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
  // An inked rim (0 for the city's soft steam) so a puff reads as a drawn cloud.
  col = mix(col, uShade * 0.45, uRim * smoothstep(edge - 0.07, edge - 0.03, r));
  float life = smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(0.45, 1.0, vAge));
  // Breathing: the whole source swells and thins on a slow cycle (0 for the city's steam).
  float breath = 1.0 - uPulse * (0.5 + 0.5 * sin(uTime * 1.7 + vSeed * 2.0));
  gl_FragColor = vec4(col, body * life * uAlpha * breath * vFade);
}
`;

// look: { alpha, rise, drift, grow, near: [start, full], rim, pulse, color, shade }. The defaults
// are the city's steam.
export function createSteam(sources, { perSource = 5, fogDensity = 0.0062, look = {} } = {}) {
  const L = { alpha: 0.2, rise: 1, drift: 1, grow: 2.8, near: [3, 9], rim: 0, pulse: 0, color: PALETTE.stripe, shade: PALETTE.slate, ...look };
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
    uAlpha: { value: L.alpha }, uRise: { value: L.rise }, uDrift: { value: L.drift }, uGrow: { value: L.grow },
    uNear: { value: new THREE.Vector2(L.near[0], L.near[1]) }, uRim: { value: L.rim }, uPulse: { value: L.pulse },
    uColor: { value: new THREE.Color(L.color) },
    uShade: { value: new THREE.Color(L.shade) },
  };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false }));
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_FX);
  mesh.renderOrder = 4;
  return { mesh, update(t) { uniforms.uTime.value = t; } };
}
