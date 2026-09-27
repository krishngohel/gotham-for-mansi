// The only color constants in the game. Everything else derives from these.
export const PALETTE = {
  ink: 0x0b0b12,
  paper: 0xefe6cf,
  gotham: 0x243248,
  slate: 0x4b586e,
  fog: 0x1a2436,
  sodium: 0xe8923a,
  signal: 0xf2d24b,
  jokerGreen: 0x62c141,
  jokerPurple: 0x6c3fa3,
  detective: 0x49b4ff,
  skin: 0xc99a7c,
  skinGoon: 0xb88a6d,
  suitGrey: 0x5b6474,
  suitDark: 0x2c2b3a,
  cowl: 0x17181e,
  belt: 0xd9a92c,
  hairRed: 0x8e2a1f,
  pants: 0x2a2436,
  stripe: 0xb9b2a0,
  wood: 0x5a4636,
  window: 0xe8a653,
  windowCool: 0xcfd7e6,
  balloon: 0xc8323c,
};

export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
