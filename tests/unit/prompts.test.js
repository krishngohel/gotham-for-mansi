import { describe, it, expect } from 'vitest';
import { promptText, createPromptQueue, PROMPT_IDS, chainLockedText, chainCostText, QUIET_CONTROLS, CHAIN_STEALTH_CLAUSE } from '../../src/ui/prompts.js';
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

  it('the locked hint names the live cheapest cost (6 by default, 4 with Efficient Chains), then the stealth clause', () => {
    expect(chainLockedText()).toBe(`Chain takedowns unlock at a 6 hit combo. ${CHAIN_STEALTH_CLAUSE}`);
    expect(chainLockedText([6, 9, 12])).toBe(`Chain takedowns unlock at a 6 hit combo. ${CHAIN_STEALTH_CLAUSE}`);
    expect(chainLockedText([4, 7, 10])).toBe(`Chain takedowns unlock at a 4 hit combo. ${CHAIN_STEALTH_CLAUSE}`);
    expect(chainLockedText([8, 11, 14])).toBe(`Chain takedowns unlock at an 8 hit combo. ${CHAIN_STEALTH_CLAUSE}`);
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

describe('createPromptQueue: quiet during takedowns', () => {
  function makeHud() {
    const calls = [];
    return { hint: (text, ms) => calls.push(['hint', text]), hideHint: () => calls.push(['hide']), calls };
  }
  it('holds a queued card while busy and shows it once the moment ends', () => {
    const hud = makeHud();
    let busy = true;
    const queue = createPromptQueue(hud, () => DEFAULT_BINDINGS, () => true, () => busy);
    queue.show(['silent']);
    queue.update(0.1);
    queue.update(1);
    expect(hud.calls).toEqual([]);
    busy = false;
    queue.update(0.1);
    expect(hud.calls).toEqual([['hint', promptText('silent', DEFAULT_BINDINGS)]]);
  });
  it('takes a card that is already up down, and shows it again afterwards', () => {
    const hud = makeHud();
    let busy = false;
    const queue = createPromptQueue(hud, () => DEFAULT_BINDINGS, () => true, () => busy);
    queue.show(['perchDrop', 'distract']);
    queue.update(0.1);
    busy = true;
    queue.update(3);
    expect(hud.calls.at(-1)).toEqual(['hide']);
    busy = false;
    queue.update(0.1);
    expect(hud.calls.at(-1)).toEqual(['hint', promptText('perchDrop', DEFAULT_BINDINGS)]);
  });
});

describe('promptText: stealth copy matches the rules', () => {
  const DASH_RE = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
  it('the silent takedown card gives the real noise radius', async () => {
    const { STEALTH } = await import('../../src/stealth/vision.js');
    expect(STEALTH.noise.takedown).toBe(3);
    expect(promptText('silent', DEFAULT_BINDINGS)).toContain('within three meters');
  });
  it('the distraction card tells a player without the batarang equipped to pick it first', () => {
    const wheel = keyLabel(DEFAULT_BINDINGS.gadgetWheel[0]), fire = keyLabel(DEFAULT_BINDINGS.batarang[0]);
    for (const eq of [null, 'batarang']) {
      const text = promptText('distract', DEFAULT_BINDINGS, eq);
      expect(text).toMatch(/^Throw a batarang/);
      expect(text).toContain(fire);
    }
    for (const eq of ['gel', 'remote', 'smoke']) {
      const text = promptText('distract', DEFAULT_BINDINGS, eq);
      expect(text).toMatch(/^Pick the batarang on the gadget wheel/);
      expect(text).toContain(wheel);
      expect(text).toContain(fire);
      expect(text).not.toMatch(DASH_RE);
    }
  });
  it('the queue asks which gadget is equipped when a card goes up', () => {
    const calls = [];
    const hud = { hint: (text) => calls.push(text), hideHint() {} };
    let eq = 'gel';
    const queue = createPromptQueue(hud, () => DEFAULT_BINDINGS, () => true, () => false, () => eq);
    queue.show(['distract']);
    queue.update(0.1);
    expect(calls[0]).toBe(promptText('distract', DEFAULT_BINDINGS, 'gel'));
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

describe('createPromptQueue: quiet during chains and the Bat Swarm', () => {
  it('QUIET_CONTROLS covers the stealth takedowns, the chain takedowns and the swarm', () => {
    for (const name of ['silent', 'perchDrop', 'chain', 'swarm']) expect(QUIET_CONTROLS.has(name), name).toBe(true);
  });
});

describe('the chain copy carries the stealth clause', () => {
  it('matches CHAIN_RULES and has no digits or dashes', async () => {
    const { CHAIN_RULES } = await import('../../src/combat/chains.js');
    expect(CHAIN_RULES.stealthMin).toBe(2);
    expect(CHAIN_RULES.stealthRadius).toBe(6);
    expect(CHAIN_RULES.hearRadius).toBe(8);
    expect(CHAIN_STEALTH_CLAUSE).toContain('within six meters of two goons');
    expect(CHAIN_STEALTH_CLAUSE).toContain('free and silent');
    expect(CHAIN_STEALTH_CLAUSE).toContain('within eight meters');
    expect(CHAIN_STEALTH_CLAUSE).not.toMatch(/\d/);
    const dash = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
    for (const text of [promptText('chain', DEFAULT_BINDINGS), chainLockedText(), chainLockedText([4, 7, 10])]) {
      expect(text).toContain(CHAIN_STEALTH_CLAUSE);
      expect(text).not.toMatch(dash);
    }
  });
});
