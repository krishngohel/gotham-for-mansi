// A throwaway cast drawn once under the loading screen so every character shader variant, outfit
// texture and suit texture is ready before play: the painted and the gold Batsuit (with cape and
// the female hair), every goon look, the civilian bystander, the Joker, and the side content
// props (challenge pillar, ink hoop, crime van, loot bags), and one of every gadget visual.
// Nothing here is kept; the real characters and props are built later and reuse the compiled
// programs and uploaded textures.
import * as THREE from 'three';
import { createBat, createGoon, createJoker } from '../actors/characters.js';
import { createNightwingCharacter } from '../actors/nightwingChar.js';
import { createHarleyCharacter } from '../actors/harleyChar.js';
import { createCape } from '../actors/cape.js';
import { createPillar, createRingMesh, createVan, createLootBags } from '../world/sideProps.js';
import { createGadgetWarm } from '../gadgets/gadgetFx.js';
import { createStealthWarm } from '../stealth/stealthFx.js';
import { createSwarmWarm } from './swarmFx.js';
import { createRopeMaterial } from './chainFx.js';
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
  for (const type of ['knife', 'brute', 'rifle']) add(createGoon(assets, { type, rng: fixed(0) }), (x += 2));
  add(createGoon(assets, { type: 'civilian', rng: fixed(0) }), (x += 2));
  // Side content props share the city's programs, but drawing them once here keeps a first
  // sighting (a new hoop, the crime van) from uploading anything mid-play.
  [createPillar(), createRingMesh(), createVan(), createLootBags()].forEach((m, i) => { m.position.set(40 + i * 5, -50, 0); group.add(m); });
  add(createJoker(assets), (x += 2));
  // Every gadget material and geometry (gel, ice, smoke, confetti, lines, debris, textured
  // breakables): drawn once here so no gadget compiles a shader on first use.
  group.add(createGadgetWarm());
  // Predator stealth visuals (src/stealth/stealthFx.js): vision cones, laser sights, tracers and
  // muzzle flashes, compiled here so the first stealth room doesn't build a program.
  group.add(createStealthWarm());
  // The Bat Swarm's flapping ink bats (src/game/swarmFx.js): their own shader, compiled here.
  group.add(createSwarmWarm());
  // The chain takedown's rope (src/game/chainFx.js): an FX-layer ribbon with vertex colours,
  // compiled here with everything else so the first Rope-a-Dope doesn't build a program.
  const ropeGeo = new THREE.BufferGeometry();
  ropeGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0.5, 0, 0, 0.05, 0], 3));
  ropeGeo.setAttribute('color', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 1, 1], 3));
  ropeGeo.setIndex([0, 1, 2]);
  const tether = new THREE.Mesh(ropeGeo, createRopeMaterial());
  tether.position.set((x += 2), -50, 0);
  tether.layers.set(LAYER_FX);
  group.add(tether);
  return group;
}

// Nightwing (both looks) and Harley Quinn: not on the loading-screen critical path. Neither
// appears until well into Act 1 (the Crasher) or Act 2 (Harley's fight), minutes of travel and
// fighting away from the title screen, so warming them can happen once, off-screen, right after
// the first real frame (game.js schedules this on idle) instead of before it. Same technique as
// createWarmCast (drawn once at y = -50, nothing kept): the first real spawn of either still
// never compiles a shader or uploads a texture, it just does not hold up boot to do it.
export function createWarmCastLate(assets) {
  const group = new THREE.Group();
  group.name = 'warmCastLate';
  const add = (ch, x) => { ch.root.position.set(x, -50, 0); group.add(ch.root); return ch; };
  add(createNightwingCharacter(assets, 'ally'), 0);
  add(createNightwingCharacter(assets, 'crasher'), 2);
  add(createHarleyCharacter(assets), 4);
  return group;
}
