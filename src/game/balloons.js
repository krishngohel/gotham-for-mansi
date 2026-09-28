// The 12 birthday balloons hidden around Gotham, easiest first. Each pops a message from
// mansi.config.js. Detective vision shows them through walls.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_XRAY } from '../render/layers.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';

export const BALLOONS = [
  { x: 12, y: 46.2, z: 12, where: 'On the GCPD stair hut' },
  { x: -52, y: 24.6, z: 172, where: 'On a docks water tower' },
  { x: -20, y: 33.8, z: 215, where: 'At the end of a crane boom' },
  { x: -44, y: 33.8, z: 221.5, where: 'On the freighter funnel' },
  { x: 140, y: 31.4, z: 270, where: 'On top of the lighthouse' },
  { x: 120, y: 40, z: 19, where: 'On the Gazette billboard' },
  { x: 158.7, y: 2.2, z: -60, where: 'Under the Monarch marquee' },
  { x: 186, y: 24, z: -52, where: 'Behind the Monarch stage' },
  { x: 112, y: 57.8, z: -191, where: 'On an Ace Chemicals smokestack' },
  { x: 135, y: 11.2, z: -118, where: 'Over the chemical vats' },
  { x: -129, y: 49.4, z: -125.6, where: 'On a cathedral tower' },
  { x: -120, y: 38.8, z: -165, where: 'On the cathedral roof ridge' },
];

export function createBalloons(scene, found = []) {
  const items = [];
  const bodyGeo = new THREE.SphereGeometry(0.55, 20, 16).scale(1, 1.2, 1);
  const knotGeo = new THREE.ConeGeometry(0.1, 0.18, 8).rotateX(Math.PI);
  const xrayMat = new THREE.MeshBasicMaterial({ color: PALETTE.balloon, transparent: true, opacity: 0.7, depthTest: false });
  BALLOONS.forEach((b, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, toonMaterial({ color: PALETTE.balloon, emissive: 0x5a0a14, emissiveIntensity: 1 }));
    const knot = new THREE.Mesh(knotGeo, toonMaterial({ color: PALETTE.balloon }));
    knot.position.y = -0.7;
    addHullOutline(body, 0.04);
    const string = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([0, 1, 2, 3, 4].map((k) => new THREE.Vector3(Math.sin(k) * 0.06, -0.78 - k * 0.22, 0))),
      new THREE.LineBasicMaterial({ color: PALETTE.ink }),
    );
    const xray = new THREE.Mesh(bodyGeo, xrayMat);
    xray.layers.set(LAYER_XRAY);
    g.add(body, knot, string, xray);
    g.position.set(b.x, b.y, b.z);
    g.visible = !found.includes(i);
    scene.add(g);
    items.push({ ...b, index: i, group: g, taken: found.includes(i), phase: i * 1.7 });
  });
  return {
    items,
    // Returns the index of a balloon the hero just touched, or -1.
    update(t, heroPos) {
      let hit = -1;
      for (const it of items) {
        if (it.taken) continue;
        it.group.position.y = it.y + Math.sin(t * 1.6 + it.phase) * 0.18;
        it.group.rotation.y = Math.sin(t * 0.7 + it.phase) * 0.4;
        const dx = heroPos.x - it.x, dy = heroPos.y + 1 - it.group.position.y, dz = heroPos.z - it.z;
        if (dx * dx + dy * dy * 0.5 + dz * dz < 2.2 * 2.2) { it.taken = true; it.group.visible = false; hit = it.index; }
      }
      return hit;
    },
    get count() { return items.filter((i) => i.taken).length; },
  };
}
