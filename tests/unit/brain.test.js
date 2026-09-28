import { describe, it, expect } from 'vitest';
import { STEALTH } from '../../src/stealth/vision.js';
import {
  HOSTILE, createSquad, createMind, thinkGoon, alarmAll, thinkSquad, smokeReset, struck, noteTakedown, fearSpeed, huddles,
  LINES, pickLine, glyphCode, glyphColor, glyphFill, stateColor,
} from '../../src/stealth/brain.js';

const P = (x, y, z) => ({ x, y, z });
const see = (d, hero = P(0, 0, d)) => ({ seesAt: d, range: 25, hero, noise: null });
const blind = (noise = null) => ({ seesAt: -1, range: 25, hero: P(0, 0, 0), noise });
function run(m, squad, sense, secs, dt = 0.05) {
  const evs = [];
  for (let t = 0; t < secs - 1e-9; t += dt) { const e = thinkGoon(m, squad, sense, dt); if (e) evs.push(e); }
  return evs;
}

describe('a goon noticing Batman', () => {
  it('turns suspicious (white), then searches (yellow), then shouts (red)', () => {
    const m = createMind(), s = createSquad();
    const evs = run(m, s, see(15), 3);
    expect(evs[0]).toBe('suspect');
    expect(evs).toContain('search');
    expect(evs.at(-1)).toBe('shout');
    expect(m.alert).toBe('engage');
    expect(s.alarm).toBe(true);
    expect(s.lastKnown).toEqual(P(0, 0, 15));
  });
  it('inside 3 m of the cone it is spotted at once', () => {
    const m = createMind(), s = createSquad();
    expect(run(m, s, see(2.5), 0.05)).toEqual(['shout']);
  });
  it('a glimpse that ends fades back to patrol', () => {
    const m = createMind(), s = createSquad();
    run(m, s, see(20), 0.4);
    expect(m.alert).toBe('suspicious');
    expect(m.meter).toBeGreaterThan(0);
    expect(run(m, s, blind(), 2)).toEqual(['calm']);
    expect(m.alert).toBe('patrol');
    expect(m.meter).toBe(0);
  });
});

describe('noises and searching', () => {
  it('a noise sends a patrolling goon to search where it came from', () => {
    const m = createMind(), s = createSquad();
    const rev = m.rev;
    expect(run(m, s, blind(P(4, 0, 2)), 0.05)).toEqual(['hear']);
    expect(m.alert).toBe('search');
    expect(m.target).toEqual(P(4, 0, 2));
    expect(m.rev).toBeGreaterThan(rev);
    expect(m.searchLeft).toBe(STEALTH.searchTime);
  });
  it('a new noise while searching moves the search', () => {
    const m = createMind(), s = createSquad();
    run(m, s, blind(P(4, 0, 2)), 0.05);
    run(m, s, blind(P(-3, 0, 1)), 0.05);
    expect(m.target).toEqual(P(-3, 0, 1));
  });
  it('a search gives up after 20 s and the goon goes back to its patrol', () => {
    const m = createMind(), s = createSquad();
    run(m, s, blind(P(4, 0, 2)), 0.05);
    const evs = run(m, s, blind(), 21);
    expect(evs).toEqual(['giveUp']);
    expect(m.alert).toBe('patrol');
  });
  it('a searching goon fills faster when it sees him', () => {
    const a = createMind(), b = createMind(), s = createSquad();
    run(a, s, blind(P(0, 0, 10)), 0.05);
    a.meter = 0.5; b.meter = 0.5; b.alert = 'suspicious';
    run(a, createSquad(), see(20), 0.2);
    run(b, createSquad(), see(20), 0.2);
    expect(a.meter).toBeGreaterThan(b.meter);
  });
});

describe('the squad alarm', () => {
  it('the shout brings every other goon hunting to the last known spot', () => {
    const s = createSquad(), a = createMind(), b = createMind(), c = createMind();
    run(a, s, see(2), 0.05);
    expect(alarmAll([a, b, c], s)).toBe(2);
    for (const m of [b, c]) { expect(m.alert).toBe('hunt'); expect(m.target).toEqual(s.lastKnown); }
    expect([...HOSTILE].sort()).toEqual(['engage', 'hunt']);
  });
  it('a hunting goon engages while anyone in the squad sees Batman, and hunts again a second after', () => {
    const s = createSquad(), a = createMind(), b = createMind();
    run(a, s, see(2), 0.05);
    alarmAll([a, b], s);
    thinkGoon(b, s, blind(), 0.05);
    expect(b.alert).toBe('engage');
    s.unseenT = 1.2;
    thinkGoon(b, s, blind(), 0.05);
    expect(b.alert).toBe('hunt');
    expect(b.target).toEqual(s.lastKnown);
  });
  it('after 8 s with nobody seeing him, everyone falls back to searching', () => {
    const s = createSquad(), a = createMind(), b = createMind();
    run(a, s, see(2), 0.05);
    alarmAll([a, b], s);
    for (let i = 0; i < 79; i++) expect(thinkSquad(s, [a, b], false, 0.1)).toBe(null);
    expect(thinkSquad(s, [a, b], false, 0.2)).toBe('lost');
    expect(s.alarm).toBe(false);
    for (const m of [a, b]) { expect(m.alert).toBe('search'); expect(m.searchLeft).toBe(STEALTH.searchTime); }
  });
  it('seeing him again restarts the 8 s', () => {
    const s = createSquad(), a = createMind();
    run(a, s, see(2), 0.05);
    thinkSquad(s, [a], false, 7);
    thinkSquad(s, [a], true, 0.1);
    expect(thinkSquad(s, [a], false, 7)).toBe(null);
  });
  it('smoke resets every goon to searching around the cloud', () => {
    const s = createSquad(), a = createMind(), b = createMind();
    run(a, s, see(2), 0.05);
    alarmAll([a, b], s);
    smokeReset([a, b], s, P(9, 0, 9));
    expect(s.alarm).toBe(false);
    for (const m of [a, b]) { expect(m.alert).toBe('search'); expect(m.target).toEqual(P(9, 0, 9)); }
  });
  it('a stun sends a goon to search; a punch that lands makes it hostile', () => {
    const s = createSquad(), a = createMind(), b = createMind();
    expect(struck(a, s, P(1, 0, 1), 'stun')).toBe('search');
    expect(a.alert).toBe('search');
    expect(struck(b, s, P(1, 0, 1), 'parried')).toBe('shout');
    expect(b.alert).toBe('engage');
    expect(struck(b, s, P(1, 0, 1), 'hit')).toBe(null);
  });
});

describe('fear', () => {
  it('rises with each takedown and stops at 3', () => {
    const s = createSquad();
    expect([noteTakedown(s), noteTakedown(s), noteTakedown(s), noteTakedown(s)]).toEqual([1, 2, 3, 3]);
    expect(s.kos).toBe(4);
  });
  it('makes goons faster and huddle together at fear 2 or with two left', () => {
    expect(fearSpeed(0)).toBe(1);
    expect(fearSpeed(3)).toBeCloseTo(1.36);
    expect(huddles(1, 3)).toBe(false);
    expect(huddles(2, 3)).toBe(true);
    expect(huddles(1, 2)).toBe(true);
  });
});

describe('lines and the HUD', () => {
  it('every line is short, lettered and free of dashes', () => {
    for (const [kind, list] of Object.entries(LINES)) {
      expect(list.length, kind).toBeGreaterThan(0);
      for (const l of list) { expect(l).not.toMatch(/[–—]/); expect(l.length).toBeLessThan(40); }
    }
    expect(pickLine('fear2', 0)).toBe(LINES.fear2[0]);
    expect(pickLine('fear2', LINES.fear2.length)).toBe(LINES.fear2[0]);
    expect(LINES.fear2).toContain('Where is it?!');
  });
  it('glyph codes: nothing on a calm patrol, white while noticing, yellow searching, red hostile', () => {
    const m = createMind();
    expect(glyphCode(m)).toBe(0);
    m.alert = 'suspicious'; m.meter = 0.25;
    expect(glyphColor(glyphCode(m))).toBe('white');
    expect(glyphFill(glyphCode(m))).toBeCloseTo(8 / 31, 2);
    m.alert = 'search'; m.meter = 0.6;
    expect(glyphColor(glyphCode(m))).toBe('yellow');
    m.alert = 'hunt';
    expect(glyphColor(glyphCode(m))).toBe('red');
    expect(glyphFill(glyphCode(m))).toBe(1);
  });
  it('detective vision colours: patrolling, searching, hostile', () => {
    const m = createMind();
    expect(stateColor(m)).toBe(0);
    m.alert = 'suspicious'; expect(stateColor(m)).toBe(0);
    m.alert = 'search'; expect(stateColor(m)).toBe(1);
    m.alert = 'engage'; expect(stateColor(m)).toBe(2);
  });
});
