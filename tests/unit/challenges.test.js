import { describe, it, expect } from 'vitest';
import {
  CHALLENGES, ARENA_FIGHT, withNormals, pillarPos, ringPass, createRingRun, createCheckpointRun, createArenaScore,
  medalFor, isBetter, recordResult, allGold, suggestThresholds, formatTime, formatResult,
} from '../../src/game/challenges.js';

const ring = (z, extra = {}) => ({ x: 0, y: 1, z, r: 4, ...extra });

describe('courses', () => {
  it('has three ring courses, a parkour run and an arena, with valid medals', () => {
    expect(CHALLENGES.map((c) => c.kind)).toEqual(['rings', 'rings', 'rings', 'parkour', 'arena', 'parkour', 'rings']);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) {
      const m = c.medals;
      if (c.kind === 'arena') expect(m.gold > m.silver && m.silver > m.bronze).toBe(true);
      else { expect(m.gold < m.silver && m.silver < m.bronze && m.bronze < c.limit).toBe(true); }
      expect(c.name).not.toMatch(/[–—]/);
      expect(c.blurb).not.toMatch(/[–—]/);
    }
  });
  it('gives every ring and checkpoint a unit normal', () => {
    for (const c of CHALLENGES) for (const p of [...(c.rings ?? []), ...(c.checkpoints ?? [])]) {
      expect(Math.hypot(p.nx, p.ny, p.nz)).toBeCloseTo(1, 6);
    }
    for (const p of CHALLENGES.find((c) => c.kind === 'parkour').checkpoints) expect(p.ny).toBe(0);
  });
  it('needs a ladder, a ledge, a zipline and a wall run on the parkour run', () => {
    const needs = CHALLENGES.find((c) => c.kind === 'parkour').checkpoints.map((c) => c.needs).filter(Boolean);
    expect(needs.sort()).toEqual(['ladder', 'ledge', 'wallrun', 'zipline']);
  });
  it('puts the pillar beside (right) and behind the start pose, not on the camera line', () => {
    const p = pillarPos({ start: { x: 10, y: 5, z: 10, yaw: 0 } });
    expect(p).toEqual({ x: 7.8, y: 5, z: 9.4 });
  });
  it('lets a challenge override the side or behind distance', () => {
    const p = pillarPos({ start: { x: 10, y: 5, z: 10, yaw: 0 }, pillarSide: 1.5, pillarBehind: 0 });
    expect(p).toEqual({ x: 8.5, y: 5, z: 10 });
  });
  it('keeps every real challenge pillar off the camera-to-hero line (a real sideways offset)', () => {
    for (const c of CHALLENGES) {
      const p = pillarPos(c);
      const { yaw } = c.start;
      const rx = -Math.cos(yaw), rz = Math.sin(yaw);
      const side = (p.x - c.start.x) * rx + (p.z - c.start.z) * rz;
      expect(Math.abs(side)).toBeGreaterThanOrEqual(1);
    }
  });
  it('fights the arena in three waves', () => {
    expect(ARENA_FIGHT.waves).toHaveLength(3);
  });
});

describe('ring pass', () => {
  const [r] = withNormals([ring(0)], { x: 0, y: 1, z: -10 });
  it('passes through the middle and near the edge, either way', () => {
    expect(ringPass(r, { x: 0, y: 1, z: -1 }, { x: 0, y: 1, z: 1 })).toBe(true);
    expect(ringPass(r, { x: 3.5, y: 1, z: -1 }, { x: 3.5, y: 1, z: 1 })).toBe(true);
    expect(ringPass(r, { x: 0, y: 1, z: 1 }, { x: 0, y: 1, z: -1 })).toBe(true);
  });
  it('misses outside the radius, short of the plane, or parallel to it', () => {
    expect(ringPass(r, { x: 4.5, y: 1, z: -1 }, { x: 4.5, y: 1, z: 1 })).toBe(false);
    expect(ringPass(r, { x: 0, y: 1, z: -3 }, { x: 0, y: 1, z: -1 })).toBe(false);
    expect(ringPass(r, { x: -1, y: 1, z: 0 }, { x: 1, y: 1, z: 0 })).toBe(false);
  });
  it('counts a segment ending on the plane once, not again from the plane', () => {
    expect(ringPass(r, { x: 0, y: 1, z: -1 }, { x: 0, y: 1, z: 0 })).toBe(true);
    expect(ringPass(r, { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 1 })).toBe(false);
  });
});

describe('ring run', () => {
  const course = { rings: withNormals([ring(10), ring(20), ring(30)], { x: 0, y: 1, z: 0 }) };
  it('finishes after every ring in order and times it', () => {
    const run = createRingRun(course);
    const out = [];
    for (let z = 0; z < 30; z++) out.push(run.update(0.1, { x: 0, y: 1, z }, { x: 0, y: 1, z: z + 1 }));
    expect(out.filter(Boolean)).toEqual(['ring', 'ring', 'finish']);
    expect(run.time).toBeCloseTo(3, 6);
    expect(run.done).toBe(true);
  });
  it('ignores a later ring out of order', () => {
    const run = createRingRun(course);
    expect(run.update(0.1, { x: 0, y: 1, z: 19.5 }, { x: 0, y: 1, z: 20.5 })).toBe(null);
    expect(run.next).toBe(0);
  });
  it('re-arms a missed ring until you fly back through it', () => {
    const run = createRingRun(course);
    expect(run.update(0.1, { x: 10, y: 1, z: 9 }, { x: 10, y: 1, z: 11 })).toBe(null);
    expect(run.update(0.1, { x: 0, y: 1, z: 11 }, { x: 0, y: 1, z: 9 })).toBe('ring');
    expect(run.next).toBe(1);
  });
});

describe('checkpoint run', () => {
  const course = { checkpoints: [
    { x: 10, y: 0, z: 0, r: 3, h: 4, needs: null },
    { x: 20, y: 0, z: 0, r: 3, h: 4, needs: 'ladder' },
  ] };
  const A = { x: 10, y: 0, z: 0 }, B = { x: 20, y: 0, z: 0 }, out = { x: 50, y: 0, z: 0 };
  it('needs the move after the previous checkpoint, and says so once per visit', () => {
    const run = createCheckpointRun(course);
    expect(run.update(1, A)).toBe('checkpoint');
    expect(run.update(1, B)).toBe('needs');
    expect(run.update(1, B)).toBe(null);
    run.noteMove('ladder');
    expect(run.update(1, B)).toBe('finish');
    expect(run.time).toBe(4);
  });
  it('does not count a move made before the previous checkpoint', () => {
    const run = createCheckpointRun(course);
    run.noteMove('ladder');
    expect(run.update(1, A)).toBe('checkpoint');
    expect(run.update(1, B)).toBe('needs');
    expect(run.update(1, out)).toBe(null);
    expect(run.update(1, B)).toBe('needs');
  });
  it('ignores checkpoints far above or below', () => {
    const run = createCheckpointRun(course);
    expect(run.update(1, { x: 10, y: 9, z: 0 })).toBe(null);
  });
});

describe('arena score', () => {
  it('scores hits times the multiplier, variety, finishers and counters', () => {
    const s = createArenaScore();
    expect(s.hit('punch')).toBe(60);
    expect(s.hit('punch')).toBe(10);
    expect(s.hit('kick')).toBe(60);
    expect(s.hit('punch')).toBe(20);
    expect(s.multiplier).toBe(2);
    expect(s.hit('heavy')).toBe(120);
    expect(s.hit('counter')).toBe(145);
    expect(s.score).toBe(415);
    expect(s.variety).toBe(3);
  });
  it('resets the multiplier and variety when hit, and after a pause', () => {
    const s = createArenaScore();
    for (let i = 0; i < 8; i++) s.hit('punch');
    s.hurt();
    expect(s.multiplier).toBe(1);
    expect(s.hit('punch')).toBe(60);
    s.tick(1.9);
    expect(s.streak).toBe(1);
    s.tick(0.2);
    expect(s.streak).toBe(0);
    expect(s.hit('kick')).toBe(60);
  });
  it('ignores unknown moves and caps the multiplier at 8', () => {
    const s = createArenaScore();
    expect(s.hit('wave')).toBe(0);
    expect(s.streak).toBe(0);
    for (let i = 0; i < 40; i++) s.hit('punch');
    expect(s.multiplier).toBe(8);
  });
});

describe('medals and results', () => {
  const timed = { id: 't', kind: 'rings', medals: { gold: 10, silver: 12, bronze: 15 } };
  const arena = { id: 'a', kind: 'arena', medals: { gold: 6000, silver: 4000, bronze: 2000 } };
  it('awards medals, lower is better for times and higher for scores', () => {
    expect([9.9, 10, 11, 14.9, 15.1].map((v) => medalFor(timed, v))).toEqual(['gold', 'gold', 'silver', 'bronze', null]);
    expect([6000, 3999, 1999].map((v) => medalFor(arena, v))).toEqual(['gold', 'bronze', null]);
    expect(isBetter(timed, 9, 10)).toBe(true);
    expect(isBetter(arena, 9, 10)).toBe(false);
    expect(isBetter(arena, 1, null)).toBe(true);
  });
  it('records bests and never takes a medal away', () => {
    let r = recordResult({}, timed, 11);
    expect(r).toEqual({ entry: { best: 11, medal: 'silver' }, newBest: true, medal: 'silver' });
    r = recordResult({ t: r.entry }, timed, 13);
    expect(r).toEqual({ entry: { best: 11, medal: 'silver' }, newBest: false, medal: 'bronze' });
    r = recordResult({ t: { best: 11, medal: 'gold' } }, timed, 11.5);
    expect(r.entry).toEqual({ best: 11, medal: 'gold' });
    expect(recordResult({}, arena, 6500).entry).toEqual({ best: 6500, medal: 'gold' });
  });
  it('knows when every challenge is gold', () => {
    const list = [timed, arena];
    expect(allGold({ t: { best: 1, medal: 'gold' } }, list)).toBe(false);
    expect(allGold({ t: { best: 1, medal: 'gold' }, a: { best: 1, medal: 'gold' } }, list)).toBe(true);
  });
  it('suggests thresholds from scripted runs', () => {
    expect(suggestThresholds('rings', [10, 12, 11])).toEqual({ gold: 11, silver: 13, bronze: 16, limit: 30 });
    expect(suggestThresholds('arena', [4000, 5000, 4600])).toEqual({ gold: 5750, silver: 3900, bronze: 2300 });
  });
  it('formats times and scores', () => {
    expect(formatTime(41.23)).toBe('41.2 s');
    expect(formatTime(75.3)).toBe('1:15.3');
    expect(formatTime(62.5)).toBe('1:02.5');
    expect(formatTime(119.97)).toBe('2:00.0');
    expect(formatResult(arena, 5750.4)).toBe('5,750 pts');
    expect(formatResult(timed, 9.04)).toBe('9.0 s');
  });
});
