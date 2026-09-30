// Harley Quinn's look, code-painted like Nightwing (src/actors/nightwingChar.js): the female
// hero body (hero_f.glb) via the shared character factory, painted through vertex regions rather
// than a baked UV texture. A clean left/right harlequin split (one side red, one black), white
// greasepaint face, a black eye mask, two pigtails (one red-tipped, one black-tipped, built from
// primitives) and a big wooden mallet held in her right hand.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { attachRigid, bindPosition } from './rig.js';
import { addRim } from './outfitParts.js';
import { makeCharacter, paintRegions, rigidMesh } from './characters.js';

export const HARLEY_COLORS = {
  red: PALETTE.balloon, black: PALETTE.ink, belt: 0x2a2430, face: PALETTE.paper, mask: 0x14121a, hair: PALETTE.signal,
};

// Region classifier (bind-pose meters): a straight left/right split for the suit (the classic
// harlequin costume), white greasepaint on the face, a black band across the eyes, and a coarse
// diamond checker on the legs in the opposite color from that leg's base side.
export function classifyHarleyVertex(p, lm) {
  if (p.y > lm.neckY) {
    const front = (p.z - lm.headCenter.z) * lm.fwd;
    const face = front > lm.headRadius * 0.42 && p.y < lm.eyeY + 0.02 && p.y > lm.eyeY - 0.15;
    if (!face) return 'hair';
    const eyeBand = p.y < lm.eyeY + 0.03 && p.y > lm.eyeY - 0.055;
    return eyeBand ? 'mask' : 'face';
  }
  const ax = Math.abs(p.x);
  const side = p.x >= 0 ? 'red' : 'black';
  const opposite = side === 'red' ? 'black' : 'red';
  if (p.y < lm.kneeY - 0.05) return side;
  if (Math.abs(p.y - lm.beltY) < 0.04 && ax < lm.hipHalfWidth + 0.06) return 'belt';
  if (p.y < lm.beltY - 0.02 && p.y > lm.kneeY - 0.05) {
    const gx = Math.floor(p.x * 9), gy = Math.floor(p.y * 9);
    return (gx + gy) % 2 === 0 ? opposite : side;
  }
  return side;
}

export function createHarleyCharacter(assets) {
  const ch = makeCharacter(assets, 'f');
  const { body, eyes, brows, lm } = ch;
  paintRegions(body, classifyHarleyVertex, HARLEY_COLORS, lm);
  body.material = addRim(
    toonMaterial({ vertexColors: true, normalMap: body.material.normalMap, normalScale: 0.45, palette: Object.values(HARLEY_COLORS) }),
    0x9fc3ff, 0.55,
  );
  body.castShadow = true;
  eyes.visible = false;
  brows.visible = false;
  addHullOutline(body, 0.011);

  // A black domino-style band across the eyes (greasepaint, not a real mask).
  const maskMat = addRim(toonMaterial({ color: HARLEY_COLORS.mask }));
  const maskGeo = new THREE.SphereGeometry(lm.headRadius * 1.05, 20, 10, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.28, Math.PI * 0.2);
  const mask = rigidMesh(maskGeo, maskMat, lm.headCenter.clone().add(new THREE.Vector3(0, 0.01, 0.012 * lm.fwd)), new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0));
  attachRigid(body, 'Head', mask);
  addHullOutline(mask, 0.005);

  // Two pigtails: a blonde base tapering into a colored tip, red on one side, black on the other.
  const hairBaseMat = toonMaterial({ color: HARLEY_COLORS.hair });
  const tipMat = (color) => toonMaterial({ color });
  for (const [side, tipColor] of [[1, HARLEY_COLORS.red], [-1, HARLEY_COLORS.black]]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.14, 10), hairBaseMat);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.014, 0.3, 10), tipMat(tipColor));
    tip.position.y = -0.2;
    const pigtail = new THREE.Group();
    pigtail.add(base, tip);
    pigtail.position.set(side * lm.headRadius * 0.98, lm.headTop - 0.08, -0.015 * lm.fwd);
    pigtail.rotation.z = side * 0.5;
    pigtail.rotation.x = -0.25;
    attachRigid(body, 'Head', pigtail);
    addHullOutline(base, 0.005);
    addHullOutline(tip, 0.005);
  }

  // A big wooden mallet, held two-handed but rigidly parented to the right hand.
  const woodMat = toonMaterial({ color: PALETTE.wood });
  const bandMat = toonMaterial({ color: HARLEY_COLORS.red });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.78, 8), woodMat);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.36, 10), woodMat);
  head.rotation.z = Math.PI / 2;
  head.position.y = 0.44;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.05, 10), bandMat);
  band.rotation.z = Math.PI / 2;
  band.position.y = 0.44;
  const mallet = new THREE.Group();
  mallet.add(handle, head, band);
  addHullOutline(handle, 0.005);
  addHullOutline(head, 0.006);
  const handPos = bindPosition(body, 'hand_r');
  mallet.position.copy(handPos).add(new THREE.Vector3(-0.03 * lm.fwd, 0.36, 0.02 * lm.fwd));
  mallet.rotation.x = 0.12;
  attachRigid(body, 'hand_r', mallet);
  ch.mallet = mallet;

  ch.type = 'harley';
  ch.colors = HARLEY_COLORS;
  ch.animator.play('Idle_Loop');
  ch.dressed();
  return ch;
}
