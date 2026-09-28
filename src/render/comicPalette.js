// Each district is "coloured" by a different colourist: six swatches, blended by where the
// camera is. snapColor mirrors the ink shader's snap so it can be tested.
export const DISTRICT_PALETTES = {
  gcpd: [0x1c2433, 0x3a4a66, 0x5b6f8e, 0x2e3a4f, 0xc9a54a, 0xd9dfe9],
  docks: [0x1d2426, 0x8a4a2e, 0x2f6b6e, 0x3b3531, 0xd98c3a, 0xe6d8c0],
  neon: [0x1b1426, 0x8a2f6e, 0x3d2a5c, 0x2a2433, 0x9be23c, 0xf2c6e6],
  ace: [0x161c16, 0x4f6b2e, 0x5a3a78, 0x2d3326, 0xb9e04a, 0xdfe8c8],
  cathedral: [0x1e1c1c, 0x6e675e, 0x4f4a44, 0x34302c, 0xe8a23f, 0xefe1c4],
};
export const DISTRICT_CENTERS = {
  gcpd: { x: 0, z: 0 },
  docks: { x: -20, z: 200 },
  neon: { x: 150, z: 0 },
  ace: { x: 130, z: -160 },
  cathedral: { x: -90, z: -150 },
};

const toRgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const RGB = Object.fromEntries(Object.entries(DISTRICT_PALETTES).map(([k, v]) => [k, v.map(toRgb)]));

export function paletteAt(x, z, out = new Array(18).fill(0)) {
  let wsum = 0;
  out.fill(0);
  for (const [id, c] of Object.entries(DISTRICT_CENTERS)) {
    const d2 = (x - c.x) ** 2 + (z - c.z) ** 2;
    const w = 1 / (d2 + 400) ** 1.5; // sharp near a center, smooth between
    wsum += w;
    RGB[id].forEach((s, i) => { out[i * 3] += s[0] * w; out[i * 3 + 1] += s[1] * w; out[i * 3 + 2] += s[2] * w; });
  }
  for (let i = 0; i < 18; i++) out[i] /= wsum;
  return out;
}

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Same maths as snapPalette() in the ink shader: compare chroma (colour / luminance), take
// the nearest swatch's chroma, keep the pixel's luminance.
export function snapColor(c, pal, amount) {
  const L = luma(c[0], c[1], c[2]);
  if (amount <= 0 || L < 0.02) return c;
  const cn = c.map((v) => v / Math.max(L, 1e-3));
  let best = null, bd = Infinity;
  for (let i = 0; i < 6; i++) {
    const p = [pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2]];
    const pl = Math.max(luma(p[0], p[1], p[2]), 1e-3);
    const pn = p.map((v) => v / pl);
    const d = (cn[0] - pn[0]) ** 2 + (cn[1] - pn[1]) ** 2 + (cn[2] - pn[2]) ** 2;
    if (d < bd) { bd = d; best = pn; }
  }
  const k = amount * Math.min(1, Math.max(0, (L - 0.02) / 0.06));
  return c.map((v, i) => v + (best[i] * L - v) * k);
}
