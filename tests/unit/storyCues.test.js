import { describe, it, expect } from 'vitest';
import { bannerText, createGate } from '../../src/game/storyCues.js';

describe('bannerText', () => {
  it('fires for goals, not for radio, cutscene, crasher or ally beats', () => {
    expect(bannerText({ text: 'Go' }, null)).toBe('Go');
    for (const type of ['fight', 'collect', 'board', 'chase', 'battle', 'interior', 'boss']) expect(bannerText({ type, text: 'X' }, null)).toBe('X');
    for (const type of ['radio', 'cutscene', 'crasher', 'ally', 'credits']) expect(bannerText({ type, text: 'X' }, null)).toBe(null);
  });
  it('does not repeat the goal already shown, and needs text', () => {
    expect(bannerText({ text: 'Same' }, 'Same')).toBe(null);
    expect(bannerText({ type: 'fight' }, null)).toBe(null);
  });
});

describe('createGate', () => {
  it('holds a cue until it can show, then shows it once', () => {
    let ok = false;
    const shown = [];
    const g = createGate({ canShow: () => ok, show: (x) => shown.push(x) });
    g.set('a');
    g.update();
    expect(shown).toEqual([]);
    ok = true;
    g.update();
    g.update();
    expect(shown).toEqual(['a']);
  });
  it('a newer cue replaces one still waiting; clear drops it', () => {
    const g = createGate({ canShow: () => false, show: () => {} });
    g.set('a');
    g.set('b');
    expect(g.pending).toBe('b');
    g.clear();
    expect(g.pending).toBe(null);
  });
});
