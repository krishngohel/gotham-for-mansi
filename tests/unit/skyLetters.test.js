import { describe, it, expect } from 'vitest';
import { GLYPHS, textLines, letterPoints, birthdayLine } from '../../src/gadgets/skyLetters.js';

const inked = (ch) => GLYPHS[ch].join('').split('').filter((c) => c === '#').length;

describe('sky letters', () => {
  it('every glyph is 5 by 7', () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, ch).toHaveLength(7);
      for (const r of rows) expect(r, ch).toMatch(/^[#.]{5}$/);
    }
    expect(Object.keys(GLYPHS).filter((k) => /[A-Z]/.test(k))).toHaveLength(26);
  });
  it('one point per inked cell, centered on the origin', () => {
    const { points, width, height } = letterPoints('HI', { cell: 1 });
    expect(points).toHaveLength(inked('H') + inked('I'));
    expect(width).toBe(11);
    expect(height).toBe(7);
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs));
    expect(Math.min(...ys)).toBeCloseTo(-Math.max(...ys));
  });
  it('wraps the birthday line into two lines', () => {
    expect(birthdayLine('Mansi')).toBe('HAPPY BIRTHDAY MANSI!');
    expect(textLines('HAPPY BIRTHDAY MANSI!')).toEqual(['HAPPY BIRTHDAY', 'MANSI!']);
    expect(letterPoints('HAPPY BIRTHDAY MANSI!', { cell: 1 }).height).toBe(16);
  });
  it('unknown characters are blank, and the total stays under the confetti budget', () => {
    expect(letterPoints('A~A', { cell: 1 }).points).toHaveLength(inked('A') * 2);
    expect(letterPoints(birthdayLine('Mansi')).points.length).toBeLessThan(560);
  });
});
