// Objective marker: a diamond with the distance, pinned to the screen edge as an arrow when the
// objective is off screen or behind the camera.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';

export function createWaypoint(root) {
  const el = document.createElement('div');
  el.className = 'waypoint';
  el.innerHTML = `
    <svg class="wp-diamond" viewBox="0 0 40 40"><path d="M20 2 L38 20 L20 38 L2 20 Z"/><path class="wp-core" d="M20 11 L29 20 L20 29 L11 20 Z"/></svg>
    <svg class="wp-arrow" viewBox="0 0 40 40"><path d="M6 8 L36 20 L6 32 L13 20 Z"/></svg>
    <span class="wp-dist"></span>`;
  root.appendChild(el);
  const dist = el.querySelector('.wp-dist');
  const arrow = el.querySelector('.wp-arrow');
  const v = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  return {
    update(target, camera, heroPos) {
      if (!target) { el.style.display = 'none'; return; }
      el.style.display = '';
      const meters = Math.round(Math.hypot(target.x - heroPos.x, target.y - heroPos.y, target.z - heroPos.z));
      dist.textContent = `${meters} m`;
      v.set(target.x, target.y + 1.5, target.z);
      camera.getWorldDirection(camDir);
      const behind = v.clone().sub(camera.position).dot(camDir) < 0;
      v.project(camera);
      let x = v.x, y = v.y;
      if (behind) { x = -x; y = -y; }
      const W = innerWidth, H = innerHeight;
      const margin = 0.88;
      const off = behind || Math.abs(x) > margin || Math.abs(y) > margin;
      if (off) {
        const len = Math.max(Math.abs(x) / margin, Math.abs(y) / margin) || 1;
        x /= len; y /= len;
        if (behind && Math.abs(y) < 0.3 && Math.abs(x) < 0.3) y = -margin;
      }
      // Stay clear of the objective box in the top corner.
      if (off && y > 0.62) y = 0.62;
      el.classList.toggle('off', off);
      el.style.left = `${(x * 0.5 + 0.5) * W}px`;
      el.style.top = `${(-y * 0.5 + 0.5) * H}px`;
      arrow.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
    },
    hide() { el.style.display = 'none'; },
  };
}

// A tall column of yellow ink light over the objective, fading as the hero gets close.
export function createBeacon(scene) {
  const uniforms = { uColor: { value: new THREE.Color(PALETTE.signal) }, uTime: { value: 0 }, uFade: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime, uFade; varying vec2 vUv;
      void main(){
        float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float a = pow(edge, 1.5) * (1.0 - vUv.y) * 0.55 * uFade;
        a *= 0.8 + 0.2 * sin(uTime * 3.0 - vUv.y * 30.0);
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const geo = new THREE.CylinderGeometry(1.4, 1.4, 180, 16, 1, true).translate(0, 90, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.layers.set(LAYER_FX);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return {
    set(pos) { mesh.visible = !!pos; if (pos) mesh.position.set(pos.x, pos.y, pos.z); },
    update(t, heroPos) {
      uniforms.uTime.value = t;
      if (!mesh.visible) return;
      const d = Math.hypot(heroPos.x - mesh.position.x, heroPos.z - mesh.position.z);
      uniforms.uFade.value = THREE.MathUtils.smoothstep(d, 8, 40);
    },
  };
}
