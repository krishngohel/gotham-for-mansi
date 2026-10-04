// tests/unit/edgeGlyph.test.js
import { describe, it, expect } from 'vitest';
import { edgeGlyph } from '../../src/ui/edgeGlyph.js';

const W = 1280, H = 720, PAD = 56;

describe('edgeGlyph', () => {
  it('leaves an on-screen goon where he is', () => {
    expect(edgeGlyph(400, 300, false, W, H)).toEqual({ x: 400, y: 300, edge: false, angle: 0 });
  });
  it('pins a goon off the right edge to the right edge, at the same height ratio', () => {
    const g = edgeGlyph(3000, 360, false, W, H);
    expect(g.edge).toBe(true);
    expect(g.x).toBeCloseTo(W - PAD);
    expect(g.y).toBeCloseTo(360);
    expect(g.angle).toBeCloseTo(0);
  });
  it('pins a goon off the top to the top edge, pointing up', () => {
    const g = edgeGlyph(640, -900, false, W, H);
    expect(g.y).toBeCloseTo(PAD);
    expect(g.angle).toBeCloseTo(-Math.PI / 2);
  });
  it('mirrors a goon behind the camera and puts him on the bottom half', () => {
    // Behind and to her left projects to the right of the screen, mirrored.
    const g = edgeGlyph(1000, 200, true, W, H);
    expect(g.edge).toBe(true);
    expect(g.x).toBeLessThan(W / 2);
    expect(g.y).toBeGreaterThan(H / 2);
    expect(g.x >= PAD - 1e-6 && g.x <= W - PAD + 1e-6 && g.y >= PAD - 1e-6 && g.y <= H - PAD + 1e-6).toBe(true);
  });
  it('a goon dead behind her points straight down', () => {
    const g = edgeGlyph(640, 360, true, W, H);
    expect(g.x).toBeCloseTo(W / 2);
    expect(g.y).toBeCloseTo(H - PAD);
    expect(g.angle).toBeCloseTo(Math.PI / 2);
  });
  it('a head near the top edge goes to the edge when the bolt above it would not fit', () => {
    expect(edgeGlyph(640, 70, false, W, H).edge).toBe(false);
    const g = edgeGlyph(640, 70, false, W, H, PAD, 84);
    expect(g.edge).toBe(true);
    expect(g.y).toBeCloseTo(PAD);
  });
  it('a goon behind the camera that projects on screen still goes to the edge', () => {
    const g = edgeGlyph(500, 400, true, W, H);
    expect(g.edge).toBe(true);
  });
});
