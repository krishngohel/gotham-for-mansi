// A throwaway cast drawn once under the loading screen so every character shader variant, outfit
// texture and suit texture is ready before play: the painted and the gold Batsuit (with cape and
// the female hair), one goon of each type and the Joker. Nothing here is kept; the real characters
// are built later and reuse the compiled programs and uploaded textures.
import * as THREE from 'three';
import { createBat, createGoon, createJoker } from '../actors/characters.js';
import { createCape } from '../actors/cape.js';

export function createWarmCast(assets) {
  const group = new THREE.Group();
  group.name = 'warmCast';
  const add = (ch, x) => { ch.root.position.set(x, -50, 0); group.add(ch.root); return ch; };
  const bat = add(createBat(assets, 'm'), 0);
  add(createBat(assets, 'f'), 2);
  add(createBat(assets, 'gold'), 4);
  group.add(createCape(bat, bat.colors.cape).mesh);
  for (const [i, type] of ['grunt', 'knife', 'brute'].entries()) add(createGoon(assets, { type }), 6 + i * 2);
  add(createJoker(assets), 12);
  return group;
}
