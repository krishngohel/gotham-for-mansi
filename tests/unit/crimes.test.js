import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng.js';
import { districtAt } from '../../src/world/mapData.js';
import {
  CRIME_SPOTS, CRIME_KINDS, createCrimeScheduler, pickSpot, crimeBlocked, crimeFight, crimeTitle, isCrimeId,
} from '../../src/game/crimes.js';

const fixed = (v) => ({ next: () => v });
// 60 to 180 m from every spot except the two GCPD ones (the GCPD steps are 31 m away, inside minDist).
const far = { x: 30, z: 20 };
const ctx = (extra = {}) => ({ blocked: false, visited: ['neon'], heroPos: far, avoid: null, ...extra });

describe('crime spots', () => {
  it('sit in the district they claim, two per district', () => {
    for (const s of CRIME_SPOTS) expect(districtAt(s.x, s.z), s.id).toBe(s.district);
    for (const d of ['gcpd', 'docks', 'neon', 'ace', 'clock']) expect(CRIME_SPOTS.filter((s) => s.district === d)).toHaveLength(2);
  });
});

describe('crime scheduler', () => {
  it('waits at least 2 minutes before the first crime', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    expect(s.update(119, ctx())).toBe(null);
    const r = s.update(1, ctx());
    expect(r.type).toBe('spawn');
    expect(r.crime.spot.district).toBe('neon');
    expect(r.crime.fightId).toBe(`crime:${r.crime.id.slice(5)}`);
  });
  it('spawns by 4 minutes at the latest', () => {
    const s = createCrimeScheduler({ rng: fixed(0.999) });
    expect(s.update(239, ctx())).toBe(null);
    expect(s.update(1, ctx())?.type).toBe('spawn');
  });
  it('only uses visited districts, and retries when none fit', () => {
    const s = createCrimeScheduler({ rng: createRng(3) });
    const r = s.update(300, ctx({ visited: ['docks'] }));
    expect(r.crime.spot.district).toBe('docks');
    const t = createCrimeScheduler({ rng: fixed(0) });
    expect(t.update(300, ctx({ visited: [] }))).toBe(null);
    expect(t.timer).toBe(20);
  });
  it('skips spots too close to the hero or to the current objective', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    expect(s.update(300, ctx({ visited: ['gcpd'], heroPos: { x: 0, z: 0 } }))).toBe(null);
    const spot = pickSpot(CRIME_SPOTS, ['neon'], far, fixed(0), { avoid: { x: 150, z: -20 } });
    expect(spot.id).toBe('neonDiner');
  });
  it('runs one crime at a time and expires it after 3 minutes', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    s.update(120, ctx());
    for (let i = 0; i < 179; i++) expect(s.update(1, ctx())).toBe(null);
    const r = s.update(1, ctx());
    expect(r.type).toBe('expire');
    expect(s.active).toBe(null);
    expect(s.update(119, ctx())).toBe(null);
    expect(s.update(1, ctx())?.type).toBe('spawn');
  });
  it('never expires a crime you are fighting nearby', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    const r = s.update(120, ctx());
    s.engage();
    const near = { x: r.crime.spot.x, z: r.crime.spot.z };
    expect(s.update(1000, ctx({ heroPos: near }))).toBe(null);
    expect(s.active.engaged).toBe(true);
  });
  it('drops an engaged crime after 80 m away for 10 s, and holds it while closer or briefer', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    const r = s.update(120, ctx());
    s.engage();
    const far = { x: r.crime.spot.x + 100, z: r.crime.spot.z };
    const near = { x: r.crime.spot.x, z: r.crime.spot.z };
    // Under 10 s away: still held.
    expect(s.update(9, ctx({ heroPos: far }))).toBe(null);
    expect(s.active?.engaged).toBe(true);
    // Stepping back inside 80 m resets the away clock.
    expect(s.update(1, ctx({ heroPos: near }))).toBe(null);
    expect(s.active?.engaged).toBe(true);
    expect(s.update(9.9, ctx({ heroPos: far }))).toBe(null);
    expect(s.active?.engaged).toBe(true);
    // 10 s continuously away: the crime is abandoned.
    const drop = s.update(0.2, ctx({ heroPos: far }));
    expect(drop.type).toBe('abandon');
    expect(drop.crime.id).toBe(r.crime.id);
    expect(s.active).toBe(null);
  });
  it('exactly 80 m away does not start the away clock', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    const r = s.update(120, ctx());
    s.engage();
    const edge = { x: r.crime.spot.x + 80, z: r.crime.spot.z };
    expect(s.update(1000, ctx({ heroPos: edge }))).toBe(null);
    expect(s.active?.engaged).toBe(true);
  });
  it('pauses both clocks while blocked', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    expect(s.update(500, ctx({ blocked: true }))).toBe(null);
    expect(s.update(119, ctx())).toBe(null);
    expect(s.update(1, ctx())?.type).toBe('spawn');
    expect(s.update(500, ctx({ blocked: true }))).toBe(null);
    expect(s.active.age).toBe(0);
  });
  it('spaces the next crime 2 to 4 minutes after one ends', () => {
    const s = createCrimeScheduler({ rng: createRng(8) });
    s.update(300, ctx());
    s.resolve();
    expect(s.timer).toBeGreaterThanOrEqual(120);
    expect(s.timer).toBeLessThanOrEqual(240);
  });
  it('can be forced for scripted runs', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    s.force({ kind: 'van', spotId: 'aceGate' });
    const r = s.update(0.016, ctx({ visited: [] }));
    expect(r.crime.kind).toBe('van');
    expect(r.crime.spot.id).toBe('aceGate');
  });
});

describe('blocked modes', () => {
  const base = { mode: 'play', stepType: 'reach', challenge: false, fightId: null, photo: false };
  it('allows free roam and reach or collect steps', () => {
    expect(crimeBlocked(base)).toBe(false);
    expect(crimeBlocked({ ...base, stepType: 'collect' })).toBe(false);
    expect(crimeBlocked({ ...base, stepType: 'credits' })).toBe(false);
    expect(crimeBlocked({ ...base, fightId: 'crime:4' })).toBe(false);
  });
  it('blocks the boss, the finale, fights, cutscenes, challenges and photo mode', () => {
    expect(crimeBlocked({ ...base, stepType: 'boss' })).toBe(true);
    expect(crimeBlocked({ ...base, stepType: 'fight' })).toBe(true);
    expect(crimeBlocked({ ...base, stepType: 'cutscene' })).toBe(true);
    expect(crimeBlocked({ ...base, mode: 'finale' })).toBe(true);
    expect(crimeBlocked({ ...base, mode: 'cutscene' })).toBe(true);
    expect(crimeBlocked({ ...base, mode: 'dead' })).toBe(true);
    expect(crimeBlocked({ ...base, challenge: true })).toBe(true);
    expect(crimeBlocked({ ...base, fightId: 'challenge:bash' })).toBe(true);
    expect(crimeBlocked({ ...base, photo: true })).toBe(true);
  });
  it('recognises crime fight ids', () => {
    expect(isCrimeId('crime:1')).toBe(true);
    expect(isCrimeId('monarch')).toBe(false);
    expect(isCrimeId(null)).toBe(false);
  });
});

describe('squads', () => {
  it('sends 3 to 5 goons in a ring around the spot', () => {
    const seen = new Set();
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createRng(seed);
      const kind = CRIME_KINDS[seed % 3];
      const f = crimeFight(kind, { x: 10, y: 0, z: 20 }, rng);
      const goons = f.waves.flat();
      seen.add(goons.length);
      expect(goons.length).toBeGreaterThanOrEqual(3);
      expect(goons.length).toBeLessThanOrEqual(5);
      expect(f.site).toEqual({ x: 10, y: 0, z: 20 });
      for (const q of goons) expect(Math.hypot(q.dx, q.dz)).toBeLessThanOrEqual(5.01);
      if (goons.length === 5) expect(f.waves.map((w) => w.length)).toEqual([3, 2]);
      else expect(f.waves).toHaveLength(1);
      if (kind === 'mugging') expect(goons.some((q) => q.type === 'knife')).toBe(false);
      if (kind === 'van' && goons.length === 5) expect(goons.some((q) => q.type === 'brute')).toBe(true);
    }
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });
  it('names the crime for the radio', () => {
    expect(crimeTitle('robbery', 'neon')).toBe('Robbery on Neon Row');
    expect(crimeTitle('mugging', 'docks')).toBe('Civilian cornered at the Docks');
    expect(crimeTitle('van', 'gcpd')).toBe('Van break-in outside GCPD');
    for (const k of CRIME_KINDS) for (const d of ['gcpd', 'docks', 'neon', 'ace', 'clock']) expect(crimeTitle(k, d)).not.toMatch(/[–—]/);
  });
});
