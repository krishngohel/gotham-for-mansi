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
