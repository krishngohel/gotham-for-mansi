import { describe, it, expect } from 'vitest';
import { createNudge } from '../../src/game/nudge.js';

// Steps the timer in half seconds; `dist` is a number or a function of elapsed time.
const run = (n, secs, dist, running = true) => {
  let fired = 0;
  for (let t = 0; t < secs; t += 0.5) if (n.update(0.5, typeof dist === 'function' ? dist(t) : dist, running)) fired++;
  return fired;
};

describe('idle nudge', () => {
  it('fires after 45 s without getting 5 m closer', () => {
    const n = createNudge();
    expect(run(n, 44.5, 100)).toBe(0);
    expect(run(n, 1, 100)).toBe(1);
  });
  it('heading for the marker keeps resetting it', () => {
    const n = createNudge();
    expect(run(n, 200, (t) => 300 - t)).toBe(0);
  });
  it('a few metres of shuffling does not count as progress', () => {
    const n = createNudge();
    expect(run(n, 46, (t) => 100 - (t % 4))).toBe(1);
  });
  it('stops after 3 nudges and starts over on reset', () => {
    const n = createNudge();
    expect(run(n, 500, 100)).toBe(3);
    n.reset();
    expect(run(n, 46, 100)).toBe(1);
  });
  it('does not count time while not running', () => {
    const n = createNudge();
    expect(run(n, 100, 100, false)).toBe(0);
    expect(run(n, 44, 100)).toBe(0);
  });
});
