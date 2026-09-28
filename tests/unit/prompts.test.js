import { describe, it, expect } from 'vitest';
import { promptText, createPromptQueue, PROMPT_IDS } from '../../src/ui/prompts.js';
import { DEFAULT_BINDINGS, keyLabel } from '../../src/core/bindings.js';

const NEW_IDS = {
  ladder: ['forward', 'back', 'sprint', 'jump'],
  ledge: ['left', 'right', 'forward', 'back', 'jump'],
  zip: ['grapple', 'jump'],
  wallrun: ['jump'],
  divebomb: ['kick'],
  takedown: ['punch'],
};

describe('promptText: traversal hints', () => {
  for (const [id, actions] of Object.entries(NEW_IDS)) {
    it(`${id} has non-empty text with no em dash and shows its bound keys`, () => {
      const text = promptText(id, DEFAULT_BINDINGS);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain('—'); // em dash
      for (const action of actions) expect(text).toContain(keyLabel(DEFAULT_BINDINGS[action][0]));
    });
  }

  it('falls back to empty string for an unknown id', () => {
    expect(promptText('nope', DEFAULT_BINDINGS)).toBe('');
  });

  // Regression: the divebomb hint was originally added under the id `dive`, silently
  // overwriting the pre-existing glide-dive tutorial (also `dive`, queued by story.js's
  // toDocks step). Object-literal duplicate keys don't error, they just clobber, so this has
  // to be asserted rather than relying on a syntax/lint error to catch it.
  it('dive (the glide tutorial) and divebomb (the new hint) are distinct prompts', () => {
    const dive = promptText('dive', DEFAULT_BINDINGS);
    const divebomb = promptText('divebomb', DEFAULT_BINDINGS);
    expect(dive).not.toBe(divebomb);
    expect(dive).toContain(keyLabel(DEFAULT_BINDINGS.sprint[0]));
    expect(dive).toContain(keyLabel(DEFAULT_BINDINGS.back[0]));
    expect(dive).not.toContain(keyLabel(DEFAULT_BINDINGS.kick[0]));
    expect(divebomb).toContain(keyLabel(DEFAULT_BINDINGS.kick[0]));
  });

  it('has no duplicate prompt ids', () => {
    expect(new Set(PROMPT_IDS).size).toBe(PROMPT_IDS.length);
  });
});

describe('createPromptQueue: traversal hints', () => {
  function makeHud() {
    const calls = [];
    return { hint: (text, ms) => calls.push([text, ms]), hideHint: () => {}, calls };
  }

  it('shows a queued hint once and does not repeat it after done', () => {
    const hud = makeHud();
    const queue = createPromptQueue(hud, () => DEFAULT_BINDINGS, () => true);
    queue.show(['ladder']);
    queue.update(0.1);
    expect(hud.calls.length).toBe(1);
    expect(hud.calls[0][0]).toBe(promptText('ladder', DEFAULT_BINDINGS));
    // The player performed the move before the hint timed out: mark it done early.
    queue.done('ladder');
    queue.show(['ladder']);
    queue.update(0.1);
    expect(hud.calls.length).toBe(1); // no second hint for the same id
  });

  it('does not double-queue an id that is already pending', () => {
    const hud = makeHud();
    const queue = createPromptQueue(hud, () => DEFAULT_BINDINGS, () => true);
    queue.show(['zip']);
    queue.show(['zip', 'divebomb']);
    queue.update(0.1); // shows zip
    queue.done('zip');
    queue.update(0.1); // shows divebomb next, not zip again
    expect(hud.calls.length).toBe(2);
    expect(hud.calls[1][0]).toBe(promptText('divebomb', DEFAULT_BINDINGS));
  });
});

import { GADGETS } from '../../src/gadgets/gadgetDefs.js';

describe('promptText: gadgets', () => {
  const IDS = {
    gadgetWheel: ['gadgetWheel', 'batarang'], gadgetRemote: ['batarang'], gadgetGel: ['batarang'], gadgetSmoke: ['batarang'],
    gadgetLauncher: ['batarang', 'jump'], gadgetClaw: ['batarang'], gadgetFreeze: ['batarang'], gadgetPopper: ['batarang'],
  };
  for (const [id, actions] of Object.entries(IDS)) {
    it(`${id} shows its keys and has no dashes`, () => {
      const text = promptText(id, DEFAULT_BINDINGS);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/[\u2013\u2014]/);
      for (const a of actions) expect(text).toContain(keyLabel(DEFAULT_BINDINGS[a][0]));
    });
  }
  it('every gadget has a prompt', () => {
    for (const g of GADGETS) expect(PROMPT_IDS).toContain(g.promptId);
  });
});

describe('promptText: predator stealth', () => {
  // Built from char codes (0x2013 en dash, 0x2014 em dash) rather than written as literal
  // escapes: the editing tools that wrote this file turn that kind of escape sequence into an
  // actual dash character, which would defeat the point of the check.
  const DASH_RE = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
  const IDS = {
    crouch: ['crouch'], silent: ['punch'], perch: ['grapple'], perchDrop: ['kick'], distract: ['batarang'],
    vent: ['crouch'], ledgeStealth: ['punch'], spotted: ['grapple'], rifle: ['dodge'],
  };
  for (const [id, actions] of Object.entries(IDS)) {
    it(`${id} shows its keys and has no dashes`, () => {
      const text = promptText(id, DEFAULT_BINDINGS);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(DASH_RE);
      for (const a of actions) expect(text).toContain(keyLabel(DEFAULT_BINDINGS[a][0]));
    });
  }
});
