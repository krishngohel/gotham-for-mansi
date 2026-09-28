import { describe, it, expect } from 'vitest';
import { GADGETS, GADGET_IDS, gadgetById, isUnlocked, unlockedIds } from '../../src/gadgets/gadgetDefs.js';
import { createGadgetState } from '../../src/gadgets/gadgetState.js';
import { STEPS } from '../../src/game/story.js';

const stepOf = (id) => STEPS.findIndex((s) => s.id === id);
const prog = (o = {}) => ({ step: 0, finished: false, ...o });

describe('gadget registry', () => {
  it('has the eight gadgets in wheel order', () => {
    expect(GADGET_IDS).toEqual(['batarang', 'remote', 'gel', 'smoke', 'launcher', 'claw', 'freeze', 'popper']);
    GADGETS.forEach((g, i) => expect(g.slot).toBe(i));
    expect(gadgetById('gel').name).toBe('Explosive Gel');
    expect(gadgetById('nope')).toBe(null);
  });
  it('every unlock step exists in the story, and the copy has no dashes', () => {
    for (const g of GADGETS) {
      if (g.unlock?.step) expect(stepOf(g.unlock.step), g.id).toBeGreaterThan(0);
      for (const s of [g.name, g.unlockText, g.cardText]) expect(s).not.toMatch(/[–—]/);
    }
  });
  it('unlocks follow the story, the popper waits for the credits', () => {
    expect(unlockedIds(prog(), STEPS)).toEqual(['batarang']);
    expect(unlockedIds(prog({ step: stepOf('toYard') }), STEPS)).toEqual(['batarang', 'claw']);
    expect(unlockedIds(prog({ step: stepOf('toVat') }), STEPS)).toEqual(['batarang', 'remote', 'gel', 'smoke', 'launcher', 'claw', 'freeze']);
    expect(isUnlocked(gadgetById('popper'), prog({ step: STEPS.length - 1 }), STEPS)).toBe(false);
    expect(unlockedIds(prog({ finished: true }), STEPS)).toEqual(GADGET_IDS);
  });
  it('sticky unlocks survive a new game (step back to 0)', () => {
    expect(unlockedIds(prog(), STEPS, ['gel', 'popper'])).toEqual(['batarang', 'gel', 'popper']);
  });
});

describe('gadget state', () => {
  it('starts on the batarang and only equips unlocked gadgets', () => {
    const s = createGadgetState();
    expect(s.equipped).toBe('batarang');
    expect(s.equip('gel')).toBe(false);
    expect(s.unlock(['gel', 'batarang'])).toEqual(['gel']);
    expect(s.equip('gel')).toBe(true);
    expect(s.equipped).toBe('gel');
  });
  it('a saved equip of a locked gadget falls back to the batarang', () => {
    expect(createGadgetState({ equipped: 'popper', unlocked: ['batarang'] }).equipped).toBe('batarang');
  });
  it('the batarang is free', () => {
    const s = createGadgetState();
    for (let i = 0; i < 5; i++) expect(s.use('batarang')).toBe(true);
    expect(s.ready('batarang')).toBe(true);
  });
  it('cooldowns count down in game time', () => {
    const s = createGadgetState({ unlocked: ['batarang', 'smoke'] });
    expect(s.use('smoke')).toBe(true);
    expect(s.ready('smoke')).toBe(false);
    expect(s.use('smoke')).toBe(false);
    s.tick(11.9);
    expect(s.ready('smoke')).toBe(false);
    s.tick(0.2);
    expect(s.ready('smoke')).toBe(true);
  });
  it('the live effects object overrides a cooldown (Quick Smoke)', () => {
    const tune = { smokeCooldown: 12 };
    const s = createGadgetState({ unlocked: ['smoke'], tune });
    tune.smokeCooldown = 7;
    s.use('smoke');
    s.tick(7.01);
    expect(s.ready('smoke')).toBe(true);
  });
  it('charges refill one at a time', () => {
    const s = createGadgetState({ unlocked: ['gel'] });
    for (let i = 0; i < 3; i++) expect(s.use('gel')).toBe(true);
    expect(s.ready('gel')).toBe(false);
    s.tick(5.01);
    expect(s.status('gel').charges).toBe(1);
    s.tick(10.02);
    expect(s.status('gel').charges).toBe(3);
    s.tick(30);
    expect(s.status('gel').charges).toBe(3);
  });
  it('status reads for the wheel and the HUD', () => {
    const s = createGadgetState({ unlocked: ['gel', 'smoke'] });
    expect(s.status('gel')).toMatchObject({ id: 'gel', kind: 'charges', ready: true, charges: 3, max: 3, text: '3 of 3 charges' });
    s.use('smoke');
    s.tick(4.5);
    expect(s.status('smoke')).toMatchObject({ ready: false, text: 'Ready in 8 s' });
    expect(s.status('smoke').frac).toBeCloseTo(7.5 / 12);
    expect(s.status('batarang').text).toBe('Ready');
  });
  it('the HUD code only changes when the display would', () => {
    const s = createGadgetState({ unlocked: ['smoke'] });
    const a = s.hudCode('smoke');
    s.use('smoke');
    const b = s.hudCode('smoke');
    expect(b).not.toBe(a);
    s.tick(0.1);
    expect(s.hudCode('smoke')).toBe(b);
    s.tick(0.2);
    expect(s.hudCode('smoke')).not.toBe(b);
  });
  it('status reuses the object it is given', () => {
    const s = createGadgetState();
    const out = {};
    expect(s.status('batarang', out)).toBe(out);
  });
});
