// Soft additive glow sprites for every lamp, sign and headlight, drawn as one Points object.
import * as THREE from 'three';
import { LAYER_FX } from '../render/layers.js';

const vertexShader = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
varying vec3 vColor;
uniform float uScale;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;
const fragmentShader = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p) * 2.0;
  float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.85, 1.0, d));
  float core = exp(-d * d * 40.0);
  gl_FragColor = vec4(vColor * a * 0.75 + vec3(core * 0.5), a);
}
`;

export function createHalos(capacity = 4096) {
  const pos = new Float32Array(capacity * 3);
  const col = new Float32Array(capacity * 3);
  const size = new Float32Array(capacity);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setDrawRange(0, 0);
  const uniforms = { uScale: { value: 600 } };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.layers.set(LAYER_FX);
  points.frustumCulled = false;
  points.renderOrder = 5;
  let count = 0;
  const c = new THREE.Color();

  return {
    points,
    add(x, y, z, color, s = 2) {
      if (count >= capacity) return -1;
      const i = count++;
      pos.set([x, y, z], i * 3);
      c.set(color);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = s;
      geo.setDrawRange(0, count);
      geo.attributes.position.needsUpdate = geo.attributes.aColor.needsUpdate = geo.attributes.aSize.needsUpdate = true;
      return i;
    },
    set(i, x, y, z, s) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      if (s !== undefined) size[i] = s;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
    setSize(i, s) { size[i] = s; geo.attributes.aSize.needsUpdate = true; },
    resize(height, fovDeg) { uniforms.uScale.value = height / (2 * Math.tan((fovDeg * Math.PI) / 360)); },
    get count() { return count; },
  };
}
