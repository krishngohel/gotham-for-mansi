import { PALETTE } from '../config/palette.js';

// Per-vertex region rules, evaluated on bind-pose (T-pose) positions in meters, Y up.
export function classifySuitVertex(p, lm) {
  if (p.y > lm.neckY) {
    const front = (p.z - lm.headCenter.z) * lm.fwd;
    const face = front > lm.headRadius * 0.45 && p.y < lm.eyeY - 0.02 && p.y > lm.eyeY - 0.13;
    return face ? 'skin' : 'cowl';
  }
  const ax = Math.abs(p.x);
  if (ax > lm.elbowX) return 'glove';
  if (p.y < lm.kneeY - 0.05) return 'boot';
  if (Math.abs(p.y - lm.beltY) < 0.045 && ax < lm.hipHalfWidth + 0.06) return 'belt';
  return 'suit';
}

export function classifyGoonVertex(p, lm) {
  if (p.y > lm.neckY) return 'skin';
  if (Math.abs(p.x) > lm.shoulderX + 0.14) return 'skin';
  if (p.y < lm.ankleY + 0.06) return 'boot';
  if (p.y < lm.beltY) return 'pants';
  return 'shirt';
}

export const SUIT_COLORS = {
  m: { suit: PALETTE.suitGrey, cowl: PALETTE.cowl, skin: PALETTE.skin, belt: PALETTE.belt, glove: PALETTE.cowl, boot: PALETTE.cowl, emblem: PALETTE.ink, cape: PALETTE.cowl },
  f: { suit: PALETTE.suitDark, cowl: PALETTE.cowl, skin: PALETTE.skin, belt: PALETTE.belt, glove: PALETTE.belt, boot: PALETTE.cowl, emblem: PALETTE.signal, cape: PALETTE.cowl },
};

export const GOON_COLORS = {
  skin: PALETTE.skinGoon, shirt: PALETTE.stripe, pants: PALETTE.pants, boot: PALETTE.ink,
};

// The shirt region is striped in the shader, alternating with this color every half period.
export const GOON_STRIPES = { color: PALETTE.stripe, alt: PALETTE.jokerPurple, period: 0.13 };

// The Joker: white face with red lips, purple suit, green vest over an orange shirt.
export function classifyJokerVertex(p, lm) {
  const front = (p.z - lm.headCenter.z) * lm.fwd;
  if (p.y > lm.neckY) {
    const mouth = front > lm.headRadius * 0.55 && p.y < lm.eyeY - 0.055 && p.y > lm.eyeY - 0.1;
    return mouth ? 'lips' : 'face';
  }
  const ax = Math.abs(p.x);
  if (ax > lm.elbowX + 0.18) return 'face';
  if (p.y < lm.ankleY + 0.06) return 'boot';
  const chestFront = (p.z - lm.chestFrontZ) * lm.fwd > -0.09;
  if (p.y > lm.beltY - 0.05 && p.y < lm.neckY && chestFront) {
    if (ax < 0.045) return 'shirt';
    if (ax < 0.13) return 'vest';
  }
  return 'suit';
}

export const JOKER_COLORS = {
  face: 0xf4f1e8, lips: 0xc8323c, suit: PALETTE.jokerPurple, vest: PALETTE.jokerGreen, shirt: PALETTE.sodium, boot: 0x3a2a24,
};
