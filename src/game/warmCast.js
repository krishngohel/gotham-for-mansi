// A throwaway cast drawn once under the loading screen so every character shader variant, outfit
// texture and suit texture is ready before play: the painted and the gold Batsuit (with cape and
// the female hair), every goon look and the Joker. Nothing here is kept; the real characters
// are built later and reuse the compiled programs and uploaded textures.
import * as THREE from 'three';
import { createBat, createGoon, createJoker } from '../actors/characters.js';
import { createCape } from '../actors/cape.js';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';

export function createWarmCast(assets) {
  const group = new THREE.Group();
  group.name = 'warmCast';
  const add = (ch, x) => { ch.root.position.set(x, -50, 0); group.add(ch.root); return ch; };
  const bat = add(createBat(assets, 'm'), 0);
  add(createBat(assets, 'f'), 2);
  add(createBat(assets, 'gold'), 4);
  group.add(createCape(bat, bat.colors.cape).mesh);
  // Every goon outfit, hat and mask: each outfit part is its own geometry, and on Windows (ANGLE
  // on D3D11) the first draw of a part never drawn before stalled the GPU process for ~130 ms,
  // most likely building a shader variant for that vertex layout.
  // A fixed "random" value steers the picks: 0 gives the striped look with the smile mask, 0.6
  // striped with the sad mask, 0.9 the hoodie with the zigzag mask.
  const fixed = (v) => ({ next: () => v });
  let x = 6;
  for (const v of [0, 0.6, 0.9]) add(createGoon(assets, { type: 'grunt', rng: fixed(v) }), (x += 2));
  for (const type of ['knife', 'brute']) add(createGoon(assets, { type, rng: fixed(0) }), (x += 2));
  add(createJoker(assets), (x += 2));
  // The chain takedown's ink tether (src/game/chainFx.js): an FX-layer LineSegments in ink,
  // compiled here with everything else so the first Rope-a-Dope doesn't build a program.
  const tether = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0.5, 0)]),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  tether.position.set((x += 2), -50, 0);
  tether.layers.set(LAYER_FX);
  group.add(tether);
  return group;
}
