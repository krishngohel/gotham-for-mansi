// Pure decision helpers behind Nightwing (src/allies/nightwingLogic.js): ally target choice,
// the team-takedown conditions, the dodge/stagger threat scan, and the Party Crasher flee path.
// No three.js and no game harness: these take plain numbers and enemy-shaped records only.
import { describe, it, expect } from 'vitest';
import { pickAllyTarget, canTeamTakedown, nearestThreat, fleeStep } from '../../src/allies/nightwingLogic.js';

function goon(id, x, z, o = {}) {
  return { id, type: 'grunt', def: {}, pos: { x, y: 0, z }, alive: true, down: false, state: 'engage', ...o };
}

describe('pickAllyTarget', () => {
  it('picks the nearest live, standing, non-boss goon', () => {
    const enemies = [goon('a', 10, 10), goon('b', 1, 0), goon('c', 5, 0)];
    expect(pickAllyTarget(0, 0, enemies).id).toBe('b');
  });

  it('skips a downed or dead goon', () => {
    const enemies = [goon('a', 1, 0, { down: true }), goon('b', 2, 0, { alive: false }), goon('c', 3, 0)];
    expect(pickAllyTarget(0, 0, enemies).id).toBe('c');
  });

  it('never targets the Joker', () => {
    const enemies = [goon('joker', 0.5, 0, { type: 'joker' }), goon('a', 3, 0)];
    expect(pickAllyTarget(0, 0, enemies).id).toBe('a');
  });

  it('skips a boss (def.boss) even if nearest', () => {
    const enemies = [goon('boss', 0.5, 0, { def: { boss: true } }), goon('a', 3, 0)];
    expect(pickAllyTarget(0, 0, enemies).id).toBe('a');
  });

  it('avoids Batman\'s current target when another goon is available', () => {
    const batmanTarget = goon('a', 1, 0);
    const enemies = [batmanTarget, goon('b', 4, 0)];
    expect(pickAllyTarget(0, 0, enemies, { batmanTarget }).id).toBe('b');
  });

  it('shares Batman\'s target when it is the last goon standing', () => {
    const batmanTarget = goon('a', 1, 0);
    const enemies = [batmanTarget];
    expect(pickAllyTarget(0, 0, enemies, { batmanTarget }).id).toBe('a');
  });

  it('returns null with nothing to fight', () => {
    expect(pickAllyTarget(0, 0, [])).toBeNull();
    expect(pickAllyTarget(0, 0, [goon('a', 1, 0, { alive: false })])).toBeNull();
  });
});

describe('canTeamTakedown', () => {
  const base = { heroX: 0, heroZ: 0, allyX: 0, allyZ: 2, targetX: 0, targetZ: 1, combo: 5 };

  it('allows it when both fighters are within radius and the combo is high enough', () => {
    expect(canTeamTakedown(base)).toBe(true);
  });

  it('refuses it when the combo is too low', () => {
    expect(canTeamTakedown({ ...base, combo: 4 })).toBe(false);
  });

  it('refuses it when Batman is too far from the goon', () => {
    expect(canTeamTakedown({ ...base, heroX: 10 })).toBe(false);
  });

  it('refuses it when Nightwing is too far from the goon', () => {
    expect(canTeamTakedown({ ...base, allyZ: 20 })).toBe(false);
  });

  it('respects a custom radius and combo threshold', () => {
    expect(canTeamTakedown({ ...base, allyZ: 4, radius: 5 })).toBe(true);
    expect(canTeamTakedown({ ...base, combo: 2, comboThreshold: 2 })).toBe(true);
  });
});

describe('nearestThreat', () => {
  it('finds the nearest enemy in the given state within radius', () => {
    const enemies = [goon('a', 5, 0, { state: 'windup' }), goon('b', 1, 0, { state: 'windup' }), goon('c', 0.5, 0, { state: 'engage' })];
    expect(nearestThreat(0, 0, enemies, 3, ['windup']).id).toBe('b');
  });

  it('ignores enemies outside the radius', () => {
    const enemies = [goon('a', 10, 0, { state: 'windup' })];
    expect(nearestThreat(0, 0, enemies, 3, ['windup'])).toBeNull();
  });

  it('ignores dead enemies and states not asked for', () => {
    const enemies = [goon('a', 1, 0, { state: 'windup', alive: false }), goon('b', 1, 0, { state: 'attack' })];
    expect(nearestThreat(0, 0, enemies, 3, ['windup'])).toBeNull();
  });
});

describe('fleeStep', () => {
  const from = { x: 0, y: 0, z: 0 }, to = { x: 10, y: 4, z: 0 };

  it('starts at the origin and ends exactly at the target', () => {
    const start = fleeStep(from, to, 0, 1.4);
    expect(start.x).toBeCloseTo(0);
    expect(start.done).toBe(false);
    const end = fleeStep(from, to, 1.4, 1.4);
    expect(end.x).toBeCloseTo(10);
    expect(end.z).toBeCloseTo(0);
    expect(end.done).toBe(true);
  });

  it('reports done for any time at or past the duration', () => {
    expect(fleeStep(from, to, 5, 1.4).done).toBe(true);
  });

  it('makes steady horizontal progress toward the target over time', () => {
    const early = fleeStep(from, to, 0.3, 1.4);
    const late = fleeStep(from, to, 1.0, 1.4);
    expect(late.x).toBeGreaterThan(early.x);
  });

  it('arcs above a straight line partway through the flight', () => {
    const mid = fleeStep(from, to, 0.7, 1.4);
    const straightY = from.y + (to.y - from.y) * 0.5;
    expect(mid.y).toBeGreaterThan(straightY);
  });
});
