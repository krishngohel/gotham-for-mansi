import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, hex } from '../config/palette.js';
import { toonMaterial } from '../render/toon.js';

const ROOF_UV = [0.5, 0.97];

function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#10141d';
  g.fillRect(0, 0, 256, 512);
  const cols = 8, rows = 16, cw = 256 / cols, rh = 480 / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const lit = rng.chance(0.2);
      g.globalAlpha = lit ? rng.range(0.55, 1) : 1;
      g.fillStyle = lit ? hex(rng.chance(0.7) ? PALETTE.window : PALETTE.windowCool) : '#1b2230';
      g.fillRect(k * cw + 8, 32 + r * rh + 8, cw - 16, rh - 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function tower(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) { uv.setXY(i, ...ROOF_UV); continue; }
      const span = f < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * span / 11, uv.getY(i) * h / 17);
    }
  }
  return g;
}

function flatUV(g) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ...ROOF_UV);
  return g;
}

export function createSkyline(rng) {
  const geos = [];
  for (let i = 0; i < 190; i++) {
    const a = rng.range(0, Math.PI * 2);
    const dist = rng.range(40, 230);
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    const w = rng.range(7, 18), d = rng.range(7, 18);
    // Mostly at or below the roof so the sky stays open; a few landmark towers.
    const top = rng.chance(0.08) ? rng.range(35, 75) : rng.range(-26, dist < 80 ? 8 : 22);
    const h = top + 40;
    geos.push(tower(w, h, d).translate(x, top - h / 2, z));
    if (rng.chance(0.3)) {
      const h2 = rng.range(6, 18);
      geos.push(tower(w * 0.6, h2, d * 0.6).translate(x, top + h2 / 2, z));
      if (rng.chance(0.5)) geos.push(flatUV(new THREE.ConeGeometry(w * 0.35, 10, 4)).rotateY(Math.PI / 4).translate(x, top + h2 + 5, z));
    }
  }
  const tex = windowTexture(rng);
  const mesh = new THREE.Mesh(
    mergeGeometries(geos),
    toonMaterial({ color: 0x2a3446, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9 }),
  );
  mesh.receiveShadow = false;
  return mesh;
}
