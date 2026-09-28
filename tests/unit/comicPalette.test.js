import { describe, it, expect } from 'vitest';
import { DISTRICT_PALETTES, DISTRICT_CENTERS, paletteAt, snapColor } from '../../src/render/comicPalette.js';

const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('comic palettes', () => {
  it('has six swatches per district', () => {
    for (const p of Object.values(DISTRICT_PALETTES)) expect(p).toHaveLength(6);
    expect(Object.keys(DISTRICT_CENTERS).sort()).toEqual(Object.keys(DISTRICT_PALETTES).sort());
  });
  it('returns a district palette at its center', () => {
    const c = DISTRICT_CENTERS.neon;
    const p = paletteAt(c.x, c.z);
    expect(p).toHaveLength(18);
    const want = rgb(DISTRICT_PALETTES.neon[1]);
    expect(p[3]).toBeCloseTo(want[0], 2);
    expect(p[4]).toBeCloseTo(want[1], 2);
  });
  it('blends between districts', () => {
    const a = DISTRICT_CENTERS.gcpd, b = DISTRICT_CENTERS.neon;
    const p = paletteAt((a.x + b.x) / 2, (a.z + b.z) / 2);
    const ga = rgb(DISTRICT_PALETTES.gcpd[1])[0], nb = rgb(DISTRICT_PALETTES.neon[1])[0];
    expect(p[3]).toBeGreaterThan(Math.min(ga, nb) - 1e-6);
    expect(p[3]).toBeLessThan(Math.max(ga, nb) + 1e-6);
  });
  it('snaps hue toward the nearest swatch but keeps luminance', () => {
    const pal = paletteAt(DISTRICT_CENTERS.docks.x, DISTRICT_CENTERS.docks.z);
    const c = [0.5, 0.3, 0.25]; // a rusty brown
    const s = snapColor(c, pal, 1);
    expect(luma(s)).toBeCloseTo(luma(c), 3);
    expect(snapColor(c, pal, 0)).toEqual(c);
  });
  it('leaves near-black alone', () => {
    const pal = paletteAt(0, 0);
    expect(snapColor([0.01, 0.01, 0.02], pal, 1)).toEqual([0.01, 0.01, 0.02]);
  });
});
