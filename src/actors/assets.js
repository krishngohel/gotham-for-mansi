import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sanitizeClip } from './animator.js';

export async function loadAssets(base = './assets/', onProgress = () => {}) {
  const loader = new GLTFLoader();
  const names = ['hero_m.glb', 'hero_f.glb', 'hair_long.glb', 'anims1.glb', 'anims2.glb', 'outfits.glb'];
  let done = 0;
  const [m, f, hair, a1, a2, outfits] = await Promise.all(names.map((n) => loader.loadAsync(base + n).then((g) => { onProgress(++done / names.length); return g; })));
  const clips = new Map();
  for (const clip of [...a1.animations, ...a2.animations]) clips.set(clip.name, sanitizeClip(clip));
  return { bodies: { m: m.scene, f: f.scene }, hair: hair.scene, outfits: outfits.scene, clips };
}
