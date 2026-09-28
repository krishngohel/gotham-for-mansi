import { describe, it, expect } from 'vitest';
import {
  CHAINS, chainForAction, chainCost, chainEligible, stealthChainReady, chainAvailability, comboAfter,
  selectChainTargets, chainHearers, tiedGroup, chainOutcome, chainHudKey, strikeSpot, midSpot, pileCenter, backSpot, lungePoint,
} from '../../src/combat/chains.js';
import { createCombo } from '../../src/combat/combo.js';

const goon = (id, x, z, o = {}) => ({ id, type: 'grunt', def: {}, alive: true, down: false, air: false, aware: true, state: 'engage', pos: { x, y: 0, z }, ...o });
const brute = (id, x, z, o = {}) => goon(id, x, z, { type: 'brute', def: { armored: true }, ...o });
const joker = (id, x, z, o = {}) => goon(id, x, z, { type: 'joker', def: { boss: true }, ...o });
const unaware = (id, x, z) => goon(id, x, z, { aware: false, state: 'idle' });
const O = { x: 0, y: 0, z: 0 };
const AHEAD = { x: 0, z: 1 };
const see = () => true;

describe('chain table', () => {
  it('has the three chains on keys 1 to 3 costing 6, 9 and 12', () => {
    expect(CHAINS.map((c) => [c.n, c.id, c.cost, c.action])).toEqual([[1, 'rope', 6, 'chain1'], [2, 'head', 9, 'chain2'], [3, 'domino', 12, 'chain3']]);
    expect(chainForAction('chain2').id).toBe('head');
    expect(chainForAction('punch')).toBe(null);
  });
  it('a discount lowers the cost but never below 1', () => {
    expect(chainCost(CHAINS[0], 2)).toBe(4);
    expect(chainCost(CHAINS[0], 99)).toBe(1);
  });
});

describe('chainEligible', () => {
  it('takes standing goons and brutes, never the Joker or anyone down, flying, held or tied', () => {
    expect(chainEligible(goon('a', 1, 1))).toBe(true);
    expect(chainEligible(brute('b', 1, 1))).toBe(true);
    expect(chainEligible(joker('j', 1, 1))).toBe(false);
    for (const o of [{ alive: false }, { down: true }, { air: true }, { state: 'grabbed' }, { state: 'chained' }, { state: 'tied' }]) {
      expect(chainEligible(goon('x', 1, 1, o)), JSON.stringify(o)).toBe(false);
    }
  });
});

describe('chainAvailability in a fight', () => {
  const squad = [goon('a', 2, 0), goon('b', 4, 0), goon('c', -3, 2)];
  it('stays hidden below combo 6', () => {
    const a = chainAvailability({ combo: 5, origin: O, enemies: squad });
    expect(a.show).toBe(false);
    expect(a.affordable).toEqual([false, false, false]);
  });
  it('lights each chain as the combo reaches its cost', () => {
    expect(chainAvailability({ combo: 6, origin: O, enemies: squad }).affordable).toEqual([true, false, false]);
    expect(chainAvailability({ combo: 9, origin: O, enemies: squad }).affordable).toEqual([true, true, false]);
    expect(chainAvailability({ combo: 12, origin: O, enemies: squad }).affordable).toEqual([true, true, true]);
  });
  it('shows the icons but lights none with fewer than 2 goons in reach', () => {
    const a = chainAvailability({ combo: 12, origin: O, enemies: [goon('a', 2, 0), goon('far', 20, 0)] });
    expect(a.show).toBe(true);
    expect(a.affordable).toEqual([false, false, false]);
  });
  it('needs a goon that can go first: two brutes are not enough', () => {
    expect(chainAvailability({ combo: 12, origin: O, enemies: [brute('a', 2, 0), brute('b', 3, 0)] }).affordable).toEqual([false, false, false]);
  });
  it('ignores goons on another floor', () => {
    const upstairs = goon('b', 3, 0, { pos: { x: 3, y: 4, z: 0 } });
    expect(chainAvailability({ combo: 12, origin: O, enemies: [goon('a', 2, 0), upstairs] }).affordable[0]).toBe(false);
  });
  it('a discount lowers the thresholds', () => {
    const a = chainAvailability({ combo: 4, origin: O, enemies: squad, discount: 2 });
    expect(a.show).toBe(true);
    expect(a.affordable).toEqual([true, false, false]);
  });
});

describe('chainAvailability from stealth', () => {
  it('two unaware goons within 6 m make every chain free', () => {
    const a = chainAvailability({ combo: 0, origin: O, enemies: [unaware('a', 3, 0), unaware('b', 0, 5)] });
    expect(a).toMatchObject({ show: true, stealth: true, affordable: [true, true, true] });
  });
  it('one of them at 7 m does not count', () => {
    expect(stealthChainReady(O, [unaware('a', 3, 0), unaware('b', 7, 0)])).toBe(false);
  });
  it('aware goons, the Joker and downed goons do not count', () => {
    expect(stealthChainReady(O, [unaware('a', 3, 0), goon('b', 2, 0)])).toBe(false);
    expect(stealthChainReady(O, [unaware('a', 3, 0), joker('j', 2, 0, { aware: false })])).toBe(false);
    expect(stealthChainReady(O, [unaware('a', 3, 0), { ...unaware('b', 2, 0), down: true }])).toBe(false);
  });
});

describe('spending combo', () => {
  it('comboAfter spends the cost in a fight and keeps the rest', () => {
    expect(comboAfter(10, CHAINS[0])).toBe(4);
    expect(comboAfter(12, CHAINS[2])).toBe(0);
  });
  it('comboAfter is free from stealth', () => {
    expect(comboAfter(3, CHAINS[2], { stealth: true })).toBe(3);
  });
  it('combo.take removes that many hits, keeps the rest and restarts the timeout', () => {
    const c = createCombo({ timeout: 1.5 });
    for (let i = 0; i < 10; i++) c.hit();
    c.tick(1.4);
    c.take(6);
    expect(c.value).toBe(4);
    c.tick(1.4);
    expect(c.value).toBe(4);
    c.take(9);
    expect(c.value).toBe(0);
  });
});

describe('selectChainTargets', () => {
  it('needs at least 2 goons', () => {
    expect(selectChainTargets(O, AHEAD, [goon('a', 2, 0)], { canSee: see })).toBe(null);
  });
  it('takes up to 3: the best first target, then hops to the nearest remaining', () => {
    const list = [goon('far', 8, 0), goon('near', 2, 0), goon('mid', 4, 0), goon('x', -7, 0), goon('y', 0, 8.5)];
    expect(selectChainTargets(O, { x: 1, z: 0 }, list, { canSee: see }).map((e) => e.id)).toEqual(['near', 'mid', 'far']);
  });
  it('never picks anyone beyond 9 m, out of sight, or the Joker', () => {
    const list = [goon('a', 2, 0), goon('hidden', 3, 0), goon('far', 9.5, 0), joker('j', 1, 0), goon('b', 0, 3)];
    const got = selectChainTargets(O, AHEAD, list, { canSee: (e) => e.id !== 'hidden' }).map((e) => e.id);
    expect(got.sort()).toEqual(['a', 'b']);
  });
  it('can chain a brute but never starts on one', () => {
    expect(selectChainTargets(O, AHEAD, [brute('br', 0, 1), goon('g', 0, 3)], { canSee: see }).map((e) => e.id)).toEqual(['g', 'br']);
  });
  it('gives up when only brutes could go first', () => {
    expect(selectChainTargets(O, AHEAD, [brute('a', 1, 0), brute('b', 2, 0)], { canSee: see })).toBe(null);
  });
  it('prefers the goon Batman faces when two are equally close', () => {
    expect(selectChainTargets(O, AHEAD, [goon('behind', 0, -3), goon('front', 0, 3)], { canSee: see })[0].id).toBe('front');
  });
  it('from stealth takes only goons that have not noticed Batman', () => {
    const list = [goon('aw', 1, 0), goon('u1', 2, 0, { aware: false }), goon('u2', 3, 0, { aware: false })];
    expect(selectChainTargets(O, AHEAD, list, { canSee: see, onlyUnaware: true }).map((e) => e.id)).toEqual(['u1', 'u2']);
  });
  it('only checks line of sight for goons already in reach', () => {
    const seen = [];
    selectChainTargets(O, AHEAD, [goon('a', 1, 0), goon('b', 2, 0), goon('far', 30, 0)], { canSee: (e) => { seen.push(e.id); return true; } });
    expect(seen).not.toContain('far');
  });
});

describe('after the chain', () => {
  it('chainHearers wakes unaware goons within 8 m that were not in the chain', () => {
    const a = goon('a', 1, 0, { aware: false }), b = goon('b', 7, 0, { aware: false }), c = goon('c', 9, 0, { aware: false }), d = goon('d', 2, 0);
    expect(chainHearers(O, [a, b, c, d], [a]).map((e) => e.id)).toEqual(['b']);
  });
  it('tiedGroup is everyone still tied with the goon that was hit', () => {
    const a = goon('a', 0, 0, { state: 'tied', down: true }), b = goon('b', 1, 0, { state: 'tied', down: true }), c = goon('c', 2, 0, { state: 'ko', alive: false });
    a.tiedWith = [b, c]; b.tiedWith = [a, c];
    expect(tiedGroup(a).map((e) => e.id)).toEqual(['a', 'b']);
    expect(tiedGroup(goon('free', 0, 0))).toEqual([]);
  });
  it('chainOutcome knocks out goons and only knocks down brutes', () => {
    expect(chainOutcome(goon('g', 0, 0))).toBe('ko');
    expect(chainOutcome(brute('b', 0, 0))).toBe('knockdown');
  });
  it('chainHudKey changes only when what the icons show changes', () => {
    expect(chainHudKey({ show: false, stealth: false, affordable: [true, false, false] })).toBe('off');
    expect(chainHudKey({ show: true, stealth: false, affordable: [true, false, false] })).toBe('c100');
    expect(chainHudKey({ show: true, stealth: true, affordable: [true, true, true] })).toBe('s111');
  });
});

describe('lunge maths', () => {
  it('strikeSpot stops short on the line to the target, or stays put when already close', () => {
    expect(strikeSpot(O, { x: 5, y: 0, z: 0 }, 1)).toEqual({ x: 4, y: 0, z: 0 });
    expect(strikeSpot(O, { x: 0.5, y: 0, z: 0 }, 1)).toEqual({ x: 0, y: 0, z: 0 });
  });
  it('midSpot, pileCenter and backSpot', () => {
    expect(midSpot({ x: 0, y: 0, z: 0 }, { x: 4, y: 1, z: 2 })).toEqual({ x: 2, y: 0, z: 1 });
    expect(pileCenter([{ x: 0, y: 1, z: 0 }, { x: 3, y: 0, z: 3 }, { x: 0, y: 0, z: 3 }])).toEqual({ x: 1, y: 0, z: 2 });
    const b = backSpot(O, { x: 0, y: 0, z: 10 }, 3);
    expect(b.x).toBeCloseTo(0);
    expect(b.z).toBeCloseTo(3);
  });
  it('lungePoint runs from start to end with the arc at the middle', () => {
    const a = { x: 0, y: 0, z: 0 }, b = { x: 4, y: 0, z: 0 };
    expect(lungePoint(a, b, 0, 2)).toEqual({ x: 0, y: 0, z: 0 });
    expect(lungePoint(a, b, 1, 2)).toMatchObject({ x: 4, z: 0 });
    expect(lungePoint(a, b, 1, 2).y).toBeCloseTo(0);
    expect(lungePoint(a, b, 0.5, 2).y).toBeCloseTo(2);
    expect(lungePoint(a, b, 0.5, 0).x).toBeCloseTo(3);                  // eases out
    expect(lungePoint(a, b, 0.5, 0, undefined, 'in').x).toBeCloseTo(1); // dives ease in
    expect(lungePoint(a, b, 2, 0).x).toBe(4);                           // clamped
  });
});
