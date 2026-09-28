import { describe, it, expect } from 'vitest';
import { promptText, createPromptQueue, PROMPT_IDS, chainLockedText, chainCostText } from '../../src/ui/prompts.js';
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

describe('promptText: chain takedowns', () => {
  const CHAIN_IDS = { chain: ['chain1', 'chain2', 'chain3'], chainTied: ['punch', 'kick'] };
  for (const [id, actions] of Object.entries(CHAIN_IDS)) {
    it(`${id} shows its keys and has no em dash`, () => {
      const text = promptText(id, DEFAULT_BINDINGS);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain('—');
      for (const a of actions) expect(text).toContain(keyLabel(DEFAULT_BINDINGS[a][0]));
    });
  }
});

describe('chain prompt and hints with Efficient Chains (merge of 4E and 5FG)', () => {
  it('the chain prompt names no combo number, since Efficient Chains lowers the threshold', () => {
    const text = promptText('chain', DEFAULT_BINDINGS).replace(/<kbd>[^<]*<\/kbd>/g, '');
    expect(text).not.toMatch(/\d/);
    expect(text).toContain('chain icon');
  });

  it('the locked hint names the live cheapest cost: 6 by default, 4 with Efficient Chains', () => {
    expect(chainLockedText()).toBe('Chain takedowns unlock at a 6 hit combo.');
    expect(chainLockedText([6, 9, 12])).toBe('Chain takedowns unlock at a 6 hit combo.');
    expect(chainLockedText([4, 7, 10])).toBe('Chain takedowns unlock at a 4 hit combo.');
    expect(chainLockedText([8, 11, 14])).toBe('Chain takedowns unlock at an 8 hit combo.');
  });

  it('the cost hint names the costs it is given: the upgraded 4 / 7 / 10', () => {
    expect(chainCostText()).toBe('Not enough combo. Rope-a-Dope costs 6, Headbanger 9, Domino Drop 12.');
    expect(chainCostText([4, 7, 10])).toBe('Not enough combo. Rope-a-Dope costs 4, Headbanger 7, Domino Drop 10.');
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

describe('promptText: WayneTech', () => {
  it('wayneTech points at the pause key and has no dashes', () => {
    const text = promptText('wayneTech', DEFAULT_BINDINGS);
    expect(text).toContain(keyLabel(DEFAULT_BINDINGS.pause[0]));
    expect(text).not.toMatch(/[–—]/);
  });
});

describe('promptText: Bat Swarm', () => {
  it('swarm shows its key', () => {
    const text = promptText('swarm', DEFAULT_BINDINGS);
    expect(text).toContain(keyLabel(DEFAULT_BINDINGS.chain4[0]));
    expect(text).not.toMatch(/[–—]/);
    // No cost in it: every owner has Efficient Chains (the tier before), so a number would mislead.
    expect(text.replace(/<kbd>[^<]*<\/kbd>/g, '')).not.toMatch(/\d/);
  });
});
