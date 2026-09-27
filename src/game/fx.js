// Comic-book combat effects: impact starbursts, speed-line rings, and flying batarangs.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { batOutline } from '../config/batShape.js';
import { LAYER_FX } from '../render/layers.js';

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const spikes = 11;
  g.beginPath();
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 ? 50 + Math.random() * 20 : 105 + Math.random() * 20;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = '#f2d24b';
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = '#0b0b12';
  g.stroke();
  g.beginPath();
  g.arc(128, 128, 34, 0, Math.PI * 2);
  g.fillStyle = '#efe6cf';
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createFx(scene) {
  const starTex = starTexture();
  const pool = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthTest: false }));
    m.layers.set(LAYER_FX);
    m.visible = false;
    m.renderOrder = 20;
    scene.add(m);
    pool.push({ m, t: 0, life: 0, size: 1 });
  }
  let next = 0;

  // Batarangs: bat-shaped plates that spin toward a target.
  const batShape = new THREE.Shape(batOutline().map(([x, y]) => new THREE.Vector2(x * 0.004, y * 0.004)));
  const batGeo = new THREE.ExtrudeGeometry(batShape, { depth: 0.015, bevelEnabled: false }).rotateX(-Math.PI / 2);
  const batMat = new THREE.MeshBasicMaterial({ color: PALETTE.ink });
  const rangs = [];

  return {
    impact(pos, size = 0.9) {
      const p = pool[next++ % pool.length];
      p.m.position.copy(pos);
      p.m.material.rotation = Math.random() * Math.PI;
      p.t = 0; p.life = 0.16; p.size = size;
      p.m.visible = true;
    },
    // Throws a batarang from `from` to a moving target getter; calls onHit when it arrives.
    batarang(from, getTarget, onHit) {
      const m = new THREE.Mesh(batGeo, batMat);
      m.position.copy(from);
      m.layers.set(0);
      scene.add(m);
      rangs.push({ m, getTarget, onHit, t: 0 });
    },
    update(dt) {
      for (const p of pool) {
        if (!p.m.visible) continue;
        p.t += dt;
        const k = p.t / p.life;
        if (k >= 1) { p.m.visible = false; continue; }
        const s = p.size * (0.5 + Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * 0.9);
        p.m.scale.setScalar(s);
        p.m.material.opacity = 1 - Math.max(0, k - 0.6) / 0.4;
      }
      for (let i = rangs.length - 1; i >= 0; i--) {
        const r = rangs[i];
        r.t += dt;
        const target = r.getTarget();
        const to = target.clone().sub(r.m.position);
        const d = to.length();
        const step = 38 * dt;
        r.m.rotation.y += dt * 30;
        if (d <= step || r.t > 1.5) {
          scene.remove(r.m);
          rangs.splice(i, 1);
          if (d <= step + 0.5) r.onHit();
          continue;
        }
        r.m.position.addScaledVector(to, step / d);
      }
    },
  };
}
