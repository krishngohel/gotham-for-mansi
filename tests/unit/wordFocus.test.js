// tests/unit/wordFocus.test.js: sound words stay off the action the camera is framing.
import { describe, it, expect } from 'vitest';
import { moveOffFocus, placeWord, actionFocusBox } from '../../src/ui/hud.js';

const view = { w: 1280, h: 720 };
const overlaps = (x, y, hw, hh, b) => x + hw > b.left && x - hw < b.right && y + hh > b.top && y - hh < b.bottom;

describe('sound words and the action focus', () => {
  it('the focus box is the middle of the screen, where the action camera frames the blow', () => {
    const b = actionFocusBox(view);
    expect(b.left).toBeGreaterThan(300);
    expect(b.right).toBeLessThan(980);
    expect(b.top).toBeGreaterThan(100);
    expect(b.bottom).toBeLessThan(640);
    expect(b.width).toBeCloseTo(b.right - b.left);
  });
  it('a word placed with the focus box avoided lands beside it, still on screen', () => {
    const focus = actionFocusBox(view);
    const p = placeWord(640, 360, 220, 70, 0, view, [focus]);
    expect(overlaps(p.x, p.y, 110 * 1.15, 35 * 1.15, focus)).toBe(false);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(1280);
  });
  it('words already on the action move off it; words elsewhere stay put', () => {
    const focus = actionFocusBox(view);
    const words = [
      { x: 640, y: 360, w: 200, h: 60, rot: 0 },
      { x: 120, y: 600, w: 120, h: 40, rot: 0 },
    ];
    const moves = moveOffFocus(words, focus, view, []);
    expect(moves.length).toBe(1);
    expect(moves[0].word).toBe(words[0]);
    expect(overlaps(moves[0].x, moves[0].y, 100 * 1.15, 30 * 1.15, focus)).toBe(false);
  });
});
