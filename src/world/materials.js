import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';
import { facadeTextures, storefrontTextures, noiseTexture, yardTexture, woodTexture, asphaltTexture, roofTexture, sidewalkTexture, puddleTexture } from './textures.js';

export const FACADE_STYLES = ['brick', 'stone', 'deco', 'concrete', 'warehouse', 'factory', 'steel'];
// Meters covered by one texture repeat horizontally, per style (matches the window grid).
export const FACADE_METERS = { brick: 28, stone: 24, deco: 30, concrete: 32, warehouse: 40, factory: 30, steel: 24 };
export const FLOOR_METERS = 54.4;

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
  m.storefront.userData.shops = sf.shops;
  m.trim = toonMaterial({ color: PALETTE.trim });
  m.roof = toonMaterial({ map: roofTexture(rng) });
  m.asphalt = toonMaterial({ map: asphaltTexture(rng) });
  m.sidewalk = toonMaterial({ map: sidewalkTexture(rng) });
  m.yard = toonMaterial({ map: yardTexture(rng) });
  m.concrete = toonMaterial({ map: noiseTexture(rng, 0x4d5056, 0.02, 256, 1200) });
  m.steel = toonMaterial({ color: PALETTE.steel });
  m.rust = toonMaterial({ color: PALETTE.rust });
  m.wood = toonMaterial({ map: woodTexture(rng) });
  m.glass = toonMaterial({ color: PALETTE.glass, emissive: 0x1a2436, emissiveIntensity: 1 });
  m.painted = toonMaterial({ vertexColors: true });
  m.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.glow.userData.noShadow = true;
  m.lane = new THREE.MeshBasicMaterial({ color: PALETTE.laneMark, polygonOffset: true, polygonOffsetFactor: -2 });
  m.lane.userData = { noShadow: true, layer: LAYER_FX, global: true };
  m.pool = new THREE.MeshBasicMaterial({ map: poolTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 });
  m.pool.userData = { noShadow: true, layer: LAYER_FX, global: true };
  m.puddle = new THREE.MeshBasicMaterial({ map: puddleTexture(rng), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.puddle.userData = { noShadow: true, layer: LAYER_FX, global: true };
  // Lamp light shafts: additive, strongest at the lamp and along the silhouette of the cone.
  m.cone = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(PALETTE.sodium) }, uFogDensity: { value: 0.0062 } },
    vertexShader: `varying float vA; varying float vE; varying float vF; uniform float uFogDensity;
      void main() { vA = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal);
      vE = abs(dot(n, normalize(-mv.xyz))); float d = -mv.z; vF = exp(-pow(uFogDensity * d, 2.0)) * (1.0 - smoothstep(60.0, 110.0, d)) * smoothstep(1.5, 5.0, d);
      gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; varying float vE; varying float vF;
      void main() { float a = pow(vE, 2.0) * (0.25 + 0.75 * vA * vA) * 0.3 * vF; gl_FragColor = vec4(uColor * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  m.cone.userData = { noShadow: true, layer: LAYER_FX, global: true };
  m.chem = new THREE.MeshBasicMaterial({ color: PALETTE.chem });
  m.chem.userData.noShadow = true;
  // Light materials go city-wide in one mesh each: the draw calls cost more than the few vertices
  // that frustum culling would save. The heavy prop materials (painted, steel) stay chunked.
  for (const [key, mat] of Object.entries(m)) if (key !== 'painted' && key !== 'steel') mat.userData.global = true;
  return m;
}
