// tests/unit/vehicleChallenges.test.js
import { describe, it, expect } from 'vitest';
import { CHALLENGES, pillarPos } from '../../src/game/challenges.js';
import { debugWinVehicleChallenge } from '../../src/game/vehicleChallenges.js';
import { WORLD } from '../../src/world/mapData.js';

// Matches src/vehicles/vehicles.js's own LINES: the street grid's clear centrelines.
const LINES = [-210, -150, -90, -30, 30, 90, 150, 210];
const onLine = (v, tol = 0.01) => LINES.some((l) => Math.abs(v - l) < tol);

const grandPrix = CHALLENGES.find((c) => c.id === 'gothamGrandPrix');
const wingWalk = CHALLENGES.find((c) => c.id === 'wingWalk');

describe('gothamGrandPrix (the Batmobile race)', () => {
  it('exists, is a parkour-kind course, and is inside the CHALLENGES list', () => {
    expect(grandPrix).toBeDefined();
    expect(grandPrix.kind).toBe('parkour');
  });

  it('has about eight gates, none needing a traversal move (a car cannot ladder or zipline)', () => {
    expect(grandPrix.checkpoints.length).toBeGreaterThanOrEqual(8);
    for (const c of grandPrix.checkpoints) expect(c.needs).toBeNull();
  });

  it('sits on real, clear street lines: every gate has an x or a z on the grid', () => {
    for (const c of grandPrix.checkpoints) expect(onLine(c.x) || onLine(c.z)).toBe(true);
    expect(onLine(grandPrix.start.x) || onLine(grandPrix.start.z)).toBe(true);
  });

  it('is near street level, not up on a roof or below the ground', () => {
    for (const c of [grandPrix.start, ...grandPrix.checkpoints]) {
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(3);
    }
  });

  it('is reachable: no leg between consecutive gates is an unreasonable jump', () => {
    let prev = grandPrix.start;
    for (const c of grandPrix.checkpoints) {
      const d = Math.hypot(c.x - prev.x, c.z - prev.z);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(200); // one block-grid leg, generously
      prev = c;
    }
  });

  it('stays inside the world bounds', () => {
    for (const c of grandPrix.checkpoints) {
      expect(c.x).toBeGreaterThan(WORLD.minX);
      expect(c.x).toBeLessThan(WORLD.maxX);
      expect(c.z).toBeGreaterThan(WORLD.minZ);
      expect(c.z).toBeLessThan(WORLD.maxZ);
    }
  });

  it('has sane, ascending medal thresholds under the time limit', () => {
    const m = grandPrix.medals;
    expect(m.gold).toBeLessThan(m.silver);
    expect(m.silver).toBeLessThan(m.bronze);
    expect(m.bronze).toBeLessThan(grandPrix.limit);
  });
});

describe('wingWalk (the Batwing ring course)', () => {
  it('exists, is a rings-kind course', () => {
    expect(wingWalk).toBeDefined();
    expect(wingWalk.kind).toBe('rings');
  });

  it('has about ten rings', () => {
    expect(wingWalk.rings.length).toBeGreaterThanOrEqual(10);
  });

  it('is in open sky, well above the clock tower roof (58 m)', () => {
    for (const r of wingWalk.rings) expect(r.y).toBeGreaterThan(58 + 5);
  });

  it('starts on the clock tower roof, not floating in open air (the pillar must be walkable to)', () => {
    expect(wingWalk.start.y).toBeCloseTo(58, 0);
  });

  it('is reachable: no leg between consecutive rings is an unreasonable jump for a plane', () => {
    let prev = wingWalk.start;
    for (const r of wingWalk.rings) {
      const d = Math.hypot(r.x - prev.x, r.y - prev.y, r.z - prev.z);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(90);
      prev = r;
    }
  });

  it('loops (the last ring is close to the first, not a dead end)', () => {
    const first = wingWalk.rings[0], last = wingWalk.rings[wingWalk.rings.length - 1];
    expect(Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z)).toBeLessThan(60);
  });

  it('stays inside the world bounds', () => {
    for (const r of wingWalk.rings) {
      expect(r.x).toBeGreaterThan(WORLD.minX);
      expect(r.x).toBeLessThan(WORLD.maxX);
      expect(r.z).toBeGreaterThan(WORLD.minZ);
      expect(r.z).toBeLessThan(WORLD.maxZ);
    }
  });

  it('has sane, ascending medal thresholds under the time limit', () => {
    const m = wingWalk.medals;
    expect(m.gold).toBeLessThan(m.silver);
    expect(m.silver).toBeLessThan(m.bronze);
    expect(m.bronze).toBeLessThan(wingWalk.limit);
  });
});

describe('both pillars', () => {
  it('sit beside their own start pose, clear of it (a real walk-up spot)', () => {
    for (const ch of [grandPrix, wingWalk]) {
      const p = pillarPos(ch);
      const d = Math.hypot(p.x - ch.start.x, p.z - ch.start.z);
      expect(d).toBeGreaterThan(1);
      expect(d).toBeLessThan(4);
    }
  });
});

describe('debugWinVehicleChallenge', () => {
  it('starts the named challenge then finishes it at gold, using a fake runner', () => {
    const calls = [];
    const fakeRunner = {
      start(id) { calls.push(['start', id]); return true; },
      finish(value) { calls.push(['finish', value]); },
    };
    const ok = debugWinVehicleChallenge(fakeRunner, 'gothamGrandPrix');
    expect(ok).toBe(true);
    expect(calls).toEqual([['start', 'gothamGrandPrix'], ['finish', grandPrix.medals.gold]]);
  });

  it('returns false, and finishes nothing, for an unknown id or a runner that refuses to start', () => {
    const calls = [];
    const fakeRunner = { start: () => { calls.push('start'); return false; }, finish: () => calls.push('finish') };
    expect(debugWinVehicleChallenge(fakeRunner, 'wingWalk')).toBe(false);
    expect(calls).toEqual(['start']);
    expect(debugWinVehicleChallenge(fakeRunner, 'notARealChallenge')).toBe(false);
  });
});
