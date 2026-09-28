import { describe, it, expect } from 'vitest';
import { buildChainTimeline, chainClipNames, CHAIN_BEATS, STOCK_BEATS, EFFECTS } from '../../src/combat/chainTimeline.js';

const BEATS = { Kick_Front: { duration: 0.66, contact: 0.29 }, Kick_Flying: { duration: 0.7, contact: 0.3 } };
const ALL = { ...STOCK_BEATS, ...CHAIN_BEATS, ...BEATS };
const build = (id, n) => buildChainTimeline(id, n, BEATS);

describe('every chain timeline', () => {
  for (const id of ['rope', 'head', 'domino']) for (const n of [2, 3]) {
    it(`${id} with ${n} targets is well formed`, () => {
      const tl = build(id, n);
      expect(tl.count).toBe(n);
      let start = 0;
      for (const s of tl.steps) {
        expect(s.start).toBeCloseTo(start);
        expect(s.target === 'pile' || (Number.isInteger(s.target) && s.target < n)).toBe(true);
        expect(s.contact).toBeGreaterThanOrEqual(s.lunge);
        expect(s.clipStart).toBeGreaterThanOrEqual(0);
        expect(s.clipStart).toBeLessThanOrEqual(s.contact + 1e-9);
        expect(s.dur).toBeGreaterThanOrEqual(s.contact);
        expect(s.effect === null || EFFECTS.includes(s.effect)).toBe(true);
        expect(s.word ?? '').not.toContain('—');
        start += s.dur;
      }
      expect(tl.duration).toBeCloseTo(start);
      expect(tl.duration).toBeGreaterThan(1);
      expect(tl.duration).toBeLessThan(3);
      const fin = tl.steps.filter((s) => s.finisher);
      expect(fin.length).toBe(1);
      expect(fin[0].hitStop).toBeGreaterThanOrEqual(0.12);
      expect(fin[0].word).toBeTruthy();
    });
  }

  it('starts each authored clip so its contact frame lands on the step contact', () => {
    for (const id of ['rope', 'head', 'domino']) for (const s of build(id, 3).steps) {
      const b = s.clip && ALL[s.clip];
      if (!b || !s.effect) continue;
      const beat = s.beat ? b[s.beat] : b.contact;
      expect(s.clipStart + beat / s.speed, `${id} ${s.clip}`).toBeCloseTo(s.contact, 6);
    }
  });
});

describe('Rope-a-Dope', () => {
  it('strikes each goon in order, fires the line, yanks, then ties them as the finisher', () => {
    const tl = build('rope', 3);
    expect(tl.steps.map((s) => s.effect)).toEqual(['stagger', 'stagger', 'stagger', 'tether', 'yank', 'tie']);
    expect(tl.steps.slice(0, 3).map((s) => s.target)).toEqual([0, 1, 2]);
    expect(tl.steps[3]).toMatchObject({ clip: 'OverhandThrow', at: 'back', target: 'pile' });
    expect(tl.steps.at(-1)).toMatchObject({ effect: 'tie', finisher: true, word: 'TANGLED!' });
  });
  it('uses only as many strikes as there are goons', () => {
    expect(build('rope', 2).steps.filter((s) => s.effect === 'stagger').length).toBe(2);
  });
});

describe('Headbanger', () => {
  it('grabs between the first two and smashes their heads together as the finisher', () => {
    const tl = build('head', 2);
    expect(tl.steps.map((s) => s.effect)).toEqual(['stagger', 'grab', 'headSmash']);
    expect(tl.steps[1]).toMatchObject({ target: 1, at: 'between', clip: 'Chain_GrabHeads' });
    expect(tl.steps[2]).toMatchObject({ word: 'KONK!', finisher: true, clip: null });
  });
  it('the smash lands on the grab clip contact frame', () => {
    const [, grab, smash] = build('head', 2).steps;
    expect(grab.dur - grab.clipStart + smash.contact).toBeCloseTo(CHAIN_BEATS.Chain_GrabHeads.contact, 6);
  });
  it('flips over the pile into a heel strike on a third goon', () => {
    const tl = build('head', 3);
    const heel = tl.steps.at(-1);
    expect(heel).toMatchObject({ target: 2, effect: 'heel', clip: 'Kick_Flying', finisher: false });
    expect(heel.arc).toBeGreaterThan(1);
    expect(heel.contact).toBeCloseTo(heel.lunge);
    expect(tl.steps.find((s) => s.finisher).effect).toBe('headSmash');
  });
});

describe('Domino Drop', () => {
  it('stomps every head in order, bounces high, then dive-bombs the pile', () => {
    const tl = build('domino', 3);
    expect(tl.steps.map((s) => s.effect)).toEqual(['stomp', 'stomp', 'stomp', null, 'diveBomb']);
    expect(tl.steps.slice(0, 3).map((s) => [s.target, s.at])).toEqual([[0, 'head'], [1, 'head'], [2, 'head']]);
    for (const s of tl.steps.slice(0, 3)) expect(s.contact).toBeCloseTo(s.lunge);
    expect(tl.steps[3]).toMatchObject({ at: 'apex', target: 'pile' });
    expect(tl.steps[3].stop).toBeGreaterThan(4);
    expect(tl.steps[4]).toMatchObject({ at: 'pile', ease: 'in', word: 'KA-BLAM!', finisher: true, thenClip: 'NinjaJump_Land' });
  });
});

describe('limits and clip list', () => {
  it('uses at most 3 targets and refuses fewer than 2 or an unknown chain', () => {
    expect(build('rope', 5).count).toBe(3);
    expect(() => build('rope', 1)).toThrow();
    expect(() => build('swarm', 3)).toThrow();
  });
  it('chainClipNames lists every hero clip any chain plays', () => {
    const names = chainClipNames();
    for (const n of ['Chain_GrabHeads', 'Chain_Yank', 'Chain_Stomp', 'OverhandThrow', 'Kick_Flying', 'NinjaJump_Land', 'Dive']) expect(names).toContain(n);
    expect(new Set(names).size).toBe(names.length);
  });
});
