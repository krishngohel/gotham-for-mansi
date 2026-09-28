import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sanitizeClip } from './animator.js';

export async function loadAssets(base = './assets/', onProgress = () => {}) {
  const loader = new GLTFLoader();
  const names = ['hero_m.glb', 'hero_f.glb', 'hair_long.glb', 'anims1.glb', 'anims2.glb', 'outfits.glb'];
  let done = 0;
  const [m, f, hair, a1, a2, outfits] = await Promise.all(names.map((n) => loader.loadAsync(base + n).then((g) => { onProgress(++done / names.length); return g; })));
  // Comic suit paint for the hero bodies, laid out on the body's own UVs. Optional: a missing
  // texture falls back to the painted vertex regions.
  const texLoader = new THREE.TextureLoader();
  const suitTex = {};
  await Promise.all(['m', 'f'].map((k) => texLoader.loadAsync(`${base}tex/bat_${k}.webp`).then((t) => {
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    suitTex[k] = t;
  }).catch(() => {})));
  const clips = new Map();
  for (const clip of [...a1.animations, ...a2.animations]) clips.set(clip.name, sanitizeClip(clip));
  return { bodies: { m: m.scene, f: f.scene }, hair: hair.scene, outfits: outfits.scene, clips, suitTex };
}
