// tests/unit/wingArmada.test.js
import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng.js';
import { makeArmadaBalloons, driftArmada, popArmadaNear, armadaPoppedCount, armadaAllPopped } from '../../src/vehicles/wingArmada.js';

const region = { cx: 0, cy: 60, cz: 0, rx: 40, ry: 15, rz: 40 };

describe('makeArmadaBalloons', () => {
  it('spawns the requested count, alternating purple and green, inside the region', () => {
    const balloons = makeArmadaBalloons(createRng(1), 12, region);
    expect(balloons).toHaveLength(12);
    expect(balloons.filter((b) => b.kind === 'purple')).toHaveLength(6);
    expect(balloons.filter((b) => b.kind === 'green')).toHaveLength(6);
    for (const b of balloons) {
      expect(Math.abs(b.x - region.cx)).toBeLessThanOrEqual(region.rx);
      expect(Math.abs(b.y - region.cy)).toBeLessThanOrEqual(region.ry);
      expect(Math.abs(b.z - region.cz)).toBeLessThanOrEqual(region.rz);
      expect(b.popped).toBe(false);
    }
  });

  it('is deterministic for a given seed (the city rule: never touch its own rng draw count, always use our own)', () => {
    const a = makeArmadaBalloons(createRng(5), 6, region);
    const b = makeArmadaBalloons(createRng(5), 6, region);
    expect(a).toEqual(b);
  });
});

describe('popArmadaNear / counting', () => {
  it('pops only balloons within radius and counts them once', () => {
    const balloons = [
      { id: 0, x: 0, y: 0, z: 0, popped: false },
      { id: 1, x: 10, y: 0, z: 0, popped: false },
      { id: 2, x: 100, y: 0, z: 0, popped: false },
    ];
    const n = popArmadaNear(balloons, 0, 0, 0, 12);
    expect(n).toBe(2);
    expect(armadaPoppedCount(balloons)).toBe(2);
    expect(balloons[2].popped).toBe(false);
    // Popping again near the same spot doesn't double count.
    const again = popArmadaNear(balloons, 0, 0, 0, 12);
    expect(again).toBe(0);
    expect(armadaPoppedCount(balloons)).toBe(2);
  });

  it('reports allPopped only once every balloon is gone', () => {
    const balloons = [
      { id: 0, x: 0, y: 0, z: 0, popped: false },
      { id: 1, x: 1, y: 0, z: 0, popped: false },
    ];
    expect(armadaAllPopped(balloons)).toBe(false);
    popArmadaNear(balloons, 0, 0, 0, 5);
    expect(armadaAllPopped(balloons)).toBe(true);
  });

  it('an empty armada is not considered all-popped (nothing to pop yet)', () => {
    expect(armadaAllPopped([])).toBe(false);
  });
});

describe('driftArmada', () => {
  it('moves live balloons and bounces them off the region box', () => {
    const balloons = [{ id: 0, x: region.cx + region.rx - 0.1, y: region.cy, z: region.cz, vx: 5, vy: 0, vz: 0, popped: false }];
    driftArmada(balloons, 1, region);
    expect(balloons[0].vx).toBeLessThan(0); // bounced back after crossing the +rx edge
  });

  it('never moves a popped balloon', () => {
    const balloons = [{ id: 0, x: 0, y: 0, z: 0, vx: 5, vy: 0, vz: 0, popped: true }];
    driftArmada(balloons, 1, region);
    expect(balloons[0].x).toBe(0);
  });
});
