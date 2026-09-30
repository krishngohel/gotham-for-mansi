// Nightwing's look, code-painted like the hero suits (createBat in characters.js): the same male
// body (hero_m.glb) and rig, but painted through vertex regions rather than a baked UV texture
// (the same path the gold suit already uses in createBat, since a fresh paint-suits.mjs pass for
// a new character was out of scope for tonight). classifyNightwing below reads bind-pose
// positions and returns a region name; paintRegions bakes that into a vertex color the toon
// material posterizes to flat comic bands, exactly like classifySuitVertex does for Batman.
//
// mode 'ally': the real Nightwing suit plus two escrima sticks.
// mode 'crasher': the same suit under a dark hooded cloak and a purple party mask, holding a
// birthday gift box, for the Party Crasher misdirect (src/allies/nightwing.js drives the reveal).
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { attachRigid } from './rig.js';
import { addRim } from './outfitParts.js';
import { makeCharacter, paintRegions, rigidMesh } from './characters.js';

// Suit colors: black with the classic bright-blue chevron (PALETTE.detective is already the
// game's one saturated "hero blue", used nowhere else on a costume, so it reads as Nightwing's
// signature color at a glance instead of Batman's grey or gold).
export const NIGHTWING_COLORS = {
  suit: 0x121218, wing: PALETTE.detective, hair: 0x0c0c14, skin: PALETTE.skin, boot: 0x0c0c12, belt: 0x232430,
};

// Region classifier (bind-pose meters, like classifySuitVertex): black suit everywhere, the
// whole arm from the shoulder to the fingers in the wing color, and a chevron on the chest that
// is wide at the collar and narrows to a point above the belt (the classic Nightwing "V").
export function classifyNightwingVertex(p, lm) {
  if (p.y > lm.neckY) {
    const front = (p.z - lm.headCenter.z) * lm.fwd;
    const face = front > lm.headRadius * 0.45 && p.y < lm.eyeY - 0.02 && p.y > lm.eyeY - 0.13;
    return face ? 'skin' : 'hair';
  }
  const ax = Math.abs(p.x);
  // The whole arm, shoulder to hand: the wing runs "down to the fingers".
  if (ax > lm.shoulderX - 0.05) return 'wing';
  if (p.y < lm.kneeY - 0.05) return 'boot';
  if (Math.abs(p.y - lm.beltY) < 0.04 && ax < lm.hipHalfWidth + 0.05) return 'belt';
  const front = (p.z - lm.chestFrontZ) * lm.fwd > -0.12;
  if (front) {
    const yTop = lm.neckY + 0.02, yBot = lm.chestY - 0.14;
    if (p.y < yTop && p.y > yBot) {
      const t = Math.max(0, Math.min(1, (yTop - p.y) / (yTop - yBot)));
      const half = (lm.shoulderX - 0.05) * (1 - t) + 0.012 * t;
      if (ax < half) return 'wing';
    }
  }
  return 'suit';
}

export function createNightwingCharacter(assets, mode = 'ally') {
  const ch = makeCharacter(assets, 'm');
  const { body, eyes, brows, lm } = ch;
  paintRegions(body, classifyNightwingVertex, NIGHTWING_COLORS, lm);
  body.material = addRim(
    toonMaterial({ vertexColors: true, normalMap: body.material.normalMap, normalScale: 0.45, palette: Object.values(NIGHTWING_COLORS) }),
    0x9fc3ff, 0.55,
  );
  body.castShadow = true;
  eyes.visible = false;
  brows.visible = false;
  addHullOutline(body, 0.011);

  // Domino mask: a flat blue band across the eyes, the single most readable Nightwing tell at
  // gameplay distance besides the chevron.
  const maskMat = addRim(toonMaterial({ color: NIGHTWING_COLORS.wing }));
  const maskGeo = new THREE.SphereGeometry(lm.headRadius * 1.05, 20, 10, Math.PI * 0.06, Math.PI * 0.88, Math.PI * 0.3, Math.PI * 0.16);
  const mask = rigidMesh(maskGeo, maskMat, lm.headCenter.clone().add(new THREE.Vector3(0, 0.012, 0.012 * lm.fwd)), new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0));
  attachRigid(body, 'Head', mask);
  addHullOutline(mask, 0.005);

  // Short black hair: a low dome over the crown, no cowl.
  const hairMat = toonMaterial({ color: NIGHTWING_COLORS.hair });
  const hairGeo = new THREE.SphereGeometry(lm.headRadius * 1.04, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const hair = rigidMesh(hairGeo, hairMat, lm.headCenter.clone().add(new THREE.Vector3(0, 0.018, -0.006 * lm.fwd)));
  attachRigid(body, 'Head', hair);
  addHullOutline(hair, 0.005);

  // Escrima sticks: thin blue-glowing batons, one rigidly held in each hand.
  const stickMat = new THREE.MeshBasicMaterial({ color: NIGHTWING_COLORS.wing });
  const sticks = [];
  for (const [bone, side] of [['hand_l', -1], ['hand_r', 1]]) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.42, 8), stickMat);
    stick.rotation.z = Math.PI / 2;
    stick.position.set(side * 0.16, -0.01, 0.05 * lm.fwd);
    attachRigid(body, bone, stick);
    sticks.push(stick);
  }
  ch.sticks = sticks;

  if (mode === 'crasher') {
    // Party Crasher disguise: a dark hooded cloak and a purple party mask over the same suit.
    const cloakMat = addRim(toonMaterial({ color: 0x171320, side: THREE.DoubleSide }));
    const cloakGeo = new THREE.ConeGeometry(lm.hipHalfWidth * 1.7, lm.neckY - lm.beltY + 0.55, 12, 1, true);
    const cloak = rigidMesh(cloakGeo, cloakMat, new THREE.Vector3(0, lm.beltY + (lm.neckY - lm.beltY) * 0.5, -0.02 * lm.fwd));
    attachRigid(body, 'spine_03', cloak);
    addHullOutline(cloak, 0.008);
    const hoodMat = addRim(toonMaterial({ color: 0x171320 }));
    const hood = rigidMesh(new THREE.SphereGeometry(lm.headRadius * 1.3, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hoodMat, lm.headCenter.clone().add(new THREE.Vector3(0, 0.06, -0.025 * lm.fwd)));
    attachRigid(body, 'Head', hood);
    addHullOutline(hood, 0.006);
    const partyMaskMat = addRim(toonMaterial({ color: PALETTE.jokerPurple }));
    const partyMaskGeo = new THREE.SphereGeometry(lm.headRadius * 1.12, 16, 10, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.22, Math.PI * 0.48);
    const partyMask = rigidMesh(partyMaskGeo, partyMaskMat, lm.headCenter.clone().add(new THREE.Vector3(0, -0.006, 0.016 * lm.fwd)), new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0));
    attachRigid(body, 'Head', partyMask);
    addHullOutline(partyMask, 0.005);
    ch.disguise = { cloak, hood, partyMask };

    // A birthday gift box, carried in front.
    const box = new THREE.Group();
    const boxMat = toonMaterial({ color: PALETTE.frosting });
    const lidMat = toonMaterial({ color: PALETTE.signal });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.05, 0.27), lidMat);
    lid.position.y = 0.145;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), boxMat);
    box.add(base, lid);
    addHullOutline(base, 0.004);
    addHullOutline(lid, 0.004);
    box.position.set(0, -0.42, 0.32 * lm.fwd);
    attachRigid(body, 'spine_03', box);
    ch.giftBox = box;
  }

  ch.mode = mode;
  ch.colors = NIGHTWING_COLORS;
  ch.animator.play('Idle_Loop');
  ch.dressed();
  return ch;
}
