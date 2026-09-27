import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';
import { facadeTextures, storefrontTextures, noiseTexture } from './textures.js';

export const FACADE_STYLES = ['brick', 'stone', 'deco', 'concrete', 'warehouse', 'factory', 'steel'];
// Meters covered by one texture repeat horizontally, per style (matches the window grid).
export const FACADE_METERS = { brick: 28, stone: 24, deco: 30, concrete: 32, warehouse: 40, factory: 30, steel: 24 };
export const FLOOR_METERS = 54.4;

function sidewalkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4d53';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#3c3f45';
  g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createCityMaterials(rng) {
  const m = {};
  for (const style of FACADE_STYLES) {
    const t = facadeTextures(style, rng);
    m[`facade_${style}`] = toonMaterial({ map: t.map, emissive: 0xffffff, emissiveMap: t.emissive, emissiveIntensity: 1.1 });
  }
  const sf = storefrontTextures(rng);
  m.storefront = toonMaterial({ map: sf.map, emissive: 0xffffff, emissiveMap: sf.emissive, emissiveIntensity: 0.9 });
  m.trim = toonMaterial({ color: PALETTE.trim });
  m.roof = toonMaterial({ map: noiseTexture(rng, PALETTE.roof, 0.05) });
  m.asphalt = toonMaterial({ map: noiseTexture(rng, PALETTE.asphalt, 0.03, 256, 7000) });
  m.sidewalk = toonMaterial({ map: sidewalkTexture() });
  m.concrete = toonMaterial({ map: noiseTexture(rng, 0x5d6066, 0.04) });
  m.steel = toonMaterial({ color: PALETTE.steel });
  m.rust = toonMaterial({ color: PALETTE.rust });
  m.wood = toonMaterial({ color: PALETTE.wood });
  m.glass = toonMaterial({ color: PALETTE.glass, emissive: 0x1a2436, emissiveIntensity: 1 });
  m.painted = toonMaterial({ vertexColors: true });
  m.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.glow.userData.noShadow = true;
  m.lane = new THREE.MeshBasicMaterial({ color: PALETTE.laneMark, polygonOffset: true, polygonOffsetFactor: -2 });
  m.lane.userData = { noShadow: true, layer: LAYER_FX };
  m.pool = new THREE.MeshBasicMaterial({ map: poolTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 });
  m.pool.userData = { noShadow: true, layer: LAYER_FX };
  m.chem = new THREE.MeshBasicMaterial({ color: PALETTE.chem });
  m.chem.userData.noShadow = true;
  return m;
}
