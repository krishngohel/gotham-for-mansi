// Firework bursts over Gotham: rising shells that pop into falling, fading sparks.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';

const COLORS = [PALETTE.signal, PALETTE.balloon, PALETTE.neonPink, PALETTE.neonCyan, PALETTE.jokerGreen, PALETTE.paper, PALETTE.sodium];
const MAX = 3000;

const vertexShader = /* glsl */ `
attribute vec3 aColor;
attribute float aLife;
uniform float uScale;
varying vec3 vColor;
varying float vLife;
void main() {
  vColor = aColor;
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (1.4 + 4.5 * aLife) * uScale / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;
const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (vLife <= 0.0 || d > 1.0) discard;
  float a = (1.0 - d * d) * vLife;
  gl_FragColor = vec4(vColor * a + vec3(0.6) * pow(1.0 - d, 6.0) * vLife, a);
}
`;

export function createFireworks(scene, rng, onBurst = () => {}) {
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), life = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3), decay = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  const uniforms = { uScale: { value: 700 } };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false;
  points.layers.set(LAYER_FX);
  scene.add(points);
  let next = 0;
  const shells = [];
  const c = new THREE.Color();

  function burst(at) {
    const n = rng.int(140, 220);
    const color = rng.pick(COLORS);
    const color2 = rng.pick(COLORS);
    const speed = rng.range(20, 32);
    for (let k = 0; k < n; k++) {
      const i = next++ % MAX;
      // Uniform on a sphere, slightly flattened.
      const u = rng.range(-1, 1), a = rng.range(0, Math.PI * 2), r = Math.sqrt(1 - u * u);
      const s = speed * rng.range(0.85, 1.05);
      pos.set([at.x, at.y, at.z], i * 3);
      vel.set([Math.cos(a) * r * s, u * s * 0.9, Math.sin(a) * r * s], i * 3);
      c.set(k % 3 ? color : color2);
      col.set([c.r, c.g, c.b], i * 3);
      life[i] = 1;
      decay[i] = rng.range(0.45, 0.75);
    }
    onBurst(at);
  }

  return {
    launch(from, to) { shells.push({ p: from.clone(), to: to.clone(), t: 0, dur: rng.range(1.1, 1.6) }); },
    burst,
    resize(height, fov) { uniforms.uScale.value = height / (2 * Math.tan((fov * Math.PI) / 360)); },
    update(dt) {
      for (let s = shells.length - 1; s >= 0; s--) {
        const sh = shells[s];
        sh.t += dt;
        const k = Math.min(1, sh.t / sh.dur);
        // A trail of sparks behind the rising shell.
        const i = next++ % MAX;
        pos.set([sh.p.x + (sh.to.x - sh.p.x) * k, sh.p.y + (sh.to.y - sh.p.y) * (1 - (1 - k) * (1 - k)), sh.p.z + (sh.to.z - sh.p.z) * k], i * 3);
        vel.set([0, -2, 0], i * 3);
        col.set([1, 0.8, 0.5], i * 3);
        life[i] = 0.6;
        decay[i] = 1.6;
        if (k >= 1) { burst(sh.to); shells.splice(s, 1); }
      }
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) continue;
        life[i] -= decay[i] * dt;
        vel[i * 3 + 1] -= 9 * dt;
        vel[i * 3] *= 1 - dt * 0.8; vel[i * 3 + 1] *= 1 - dt * 0.8; vel[i * 3 + 2] *= 1 - dt * 0.8;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = geo.attributes.aColor.needsUpdate = geo.attributes.aLife.needsUpdate = true;
    },
  };
}
