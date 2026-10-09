// tests/unit/movePrompts.test.js: the tutorial teaches every movement combo.
import { describe, it, expect } from 'vitest';
import { promptText, PROMPT_FOR_MOVE } from '../../src/ui/prompts.js';
import { DEFAULT_BINDINGS, keyLabel } from '../../src/core/bindings.js';
import { MOVE_TABLE } from '../../src/combat/moveSelect.js';
import { STEPS } from '../../src/game/story.js';

const dash = new RegExp(String.fromCharCode(0x2014) + '|' + String.fromCharCode(0x2013));
const KEYS = {
  movesDirection: ['kick', 'punch'],
  movesSprint: ['sprint', 'kick', 'punch'],
  movesAir: ['jump', 'kick', 'punch', 'sprint'],
  stomp: ['kick', 'punch'],
  punch: ['punch'],
  combo: [],
};

describe('movement combo tutorial', () => {
  for (const [id, actions] of Object.entries(KEYS)) {
    it(`${id} shows its keys and has no dashes`, () => {
      const text = promptText(id, DEFAULT_BINDINGS);
      expect(text.length).toBeGreaterThan(20);
      expect(dash.test(text)).toBe(false);
      for (const a of actions) expect(text).toContain(keyLabel(DEFAULT_BINDINGS[a][0]));
    });
  }
  it('the punch card says attacks find a goon on their own', () => {
    expect(promptText('punch', DEFAULT_BINDINGS).toLowerCase()).toContain('nearest');
  });
  it('every move in the table has a tutorial card that teaches it', () => {
    for (const m of MOVE_TABLE) expect(PROMPT_FOR_MOVE[m.id], m.id).toBeTruthy();
  });
  it('the first three fights teach every movement card, in order of difficulty', () => {
    const tips = (id) => STEPS.find((s) => s.id === id).tutorial;
    expect(tips('f1')).toContain('punch');
    expect(tips('f2')).toContain('movesDirection');
    expect(tips('f2')).toContain('combo');
    expect(tips('f3')).toContain('movesSprint');
    expect(tips('f3')).toContain('movesAir');
  });
});

import { createPromptQueue } from '../../src/ui/prompts.js';
describe('learned(): doing the move skips its card', () => {
  const hud = () => { const h = { shown: [], hint(t) { h.shown.push(t); }, hideHint() { h.hidden = (h.hidden ?? 0) + 1; } }; return h; };
  it('a queued card she has already done never shows', () => {
    const h = hud();
    const q = createPromptQueue(h, () => DEFAULT_BINDINGS, () => true);
    q.show(['movesSprint']);
    q.learned('movesSprint');
    q.update(0.1);
    expect(h.shown).toEqual([]);
  });
  it('a card already on screen stays up to be read', () => {
    const h = hud();
    const q = createPromptQueue(h, () => DEFAULT_BINDINGS, () => true);
    q.show(['movesAir']);
    q.update(0.1);
    q.learned('movesAir');
    expect(h.hidden ?? 0).toBe(0);
  });
});
