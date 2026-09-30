// src/game/gcpdLobby.js
// GCPD lobby dressing that needs live game state, not boot-time geometry: a few idle Joker goons
// behind bars (reused character bodies, non-hostile: no combat hook at all) and the trophy case,
// which fills in with the rescued gifts as party.js's own guests join (src/game/partyStory.js's
// step-to-guest map, the same pure hook the party uses). The room shell itself (walls, the front
// desk, the evidence board, the cell bars, the case's own glass shelf) is boot-time geometry in
// src/world/interiors.js.
import * as THREE from 'three';
import { createGoon } from '../actors/characters.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { PALETTE } from '../config/palette.js';
import { createRng } from '../core/rng.js';
import { guestsUpTo } from './partyStory.js';
import { STEPS } from './story.js';

// Inside the three holding cells (src/world/interiors.js buildGCPDLobby: x 15.5 to 18, z bands
// -9..-5, -3.5..0.5, 1.5..5.5), facing the bars (-x, into the lobby).
const CELL_SLOTS = [
  { x: 16.8, z: -7 }, { x: 16.8, z: -1.5 }, { x: 16.8, z: 3.5 },
];

// One small, code-built trophy per guest: whatever they were rescued with, a stand-in for the
// real prop (which stays wherever the story already put it). Shown once that guest has joined.
const mat = (color) => toonMaterial({ color });
const trophyProp = (geo, color) => { const m = new THREE.Mesh(geo, mat(color)); addHullOutline(m, 0.008); return m; };
const TROPHY_BUILDERS = {
  dj: () => trophyProp(new THREE.TorusGeometry(0.16, 0.05, 8, 16), 0x4fe3ff), // a vinyl record
  baker: () => trophyProp(new THREE.ConeGeometry(0.18, 0.22, 16), PALETTE.frosting), // a cake slice
  band: () => trophyProp(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), 0x5a3a24), // a drumstick
  nightwing: () => trophyProp(new THREE.CircleGeometry(0.16, 3), PALETTE.detective), // a chevron
  gordon: () => trophyProp(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 20), 0xd9a92c), // a badge
  alfred: () => trophyProp(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 20), 0xd8dde6), // a tray
  kids: () => trophyProp(new THREE.ConeGeometry(0.13, 0.3, 12), PALETTE.signal), // a party hat
};
const TROPHY_ORDER = ['dj', 'baker', 'band', 'nightwing', 'gordon', 'alfred', 'kids'];

// The lobby sits inside the GCPD building, around the roof's centre (0, 0) at street level.
export const LOBBY_VIEW_DIST = 60;
export function lobbyInView(cam, dist = LOBBY_VIEW_DIST) {
  return Math.hypot(cam.x, cam.y - 3, cam.z) <= dist;
}

export function createGCPDLobby({ scene, assets, events, progress }) {
  const rng = createRng(71166);
  const group = new THREE.Group();
  group.name = 'gcpdLobby';
  scene.add(group);

  const cellGoons = [];
  for (const slot of CELL_SLOTS) {
    const ch = createGoon(assets, { type: 'grunt', rng });
    ch.root.position.set(slot.x, 0, slot.z);
    ch.root.rotation.y = -Math.PI / 2; // faces -x, into the lobby, toward the bars
    ch.animator.play('Idle_Loop', { fade: 0 });
    group.add(ch.root);
    cellGoons.push(ch);
  }

  const trophies = {};
  let x = -2.5;
  for (const id of TROPHY_ORDER) {
    const t = TROPHY_BUILDERS[id]();
    t.position.set(x, 1.7, -2);
    t.rotation.x = -0.3;
    t.visible = false;
    group.add(t);
    trophies[id] = t;
    x += 0.85;
  }

  function refresh(stepIndex) {
    const joined = new Set(guestsUpTo(stepIndex, STEPS));
    for (const id of TROPHY_ORDER) trophies[id].visible = joined.has(id);
  }
  refresh(progress?.step ?? 0);
  events.on('step', ({ index }) => refresh(index));

  return {
    refresh,
    // Idle-only: no locomotion, no combat, just their own animator ticking over so they read as
    // alive instead of frozen in a bind pose. Past LOBBY_VIEW_DIST the whole room's runtime set
    // hides: the goons' ink outlines are never frustum-culled, so they would otherwise draw from
    // anywhere in the city, through the building's walls.
    update(dt, camPos) {
      if (camPos) group.visible = lobbyInView(camPos);
      if (!group.visible) return;
      for (const ch of cellGoons) ch.animator.update(dt);
    },
  };
}
