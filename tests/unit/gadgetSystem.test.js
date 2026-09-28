import { describe, it, expect, vi } from 'vitest';
import { createGadgetSystem, NEWS_CARD_S } from '../../src/gadgets/gadgetSystem.js';
import { GADGET_IDS, gadgetNewsCard } from '../../src/gadgets/gadgetDefs.js';
import { createTimeControl } from '../../src/core/time.js';
import { createEvents } from '../../src/core/events.js';
import { upgradeEffects } from '../../src/progress/upgrades.js';
import { DEFAULT_BINDINGS } from '../../src/core/bindings.js';
import { STEPS } from '../../src/game/story.js';
import { predatorNoticeReady } from '../../src/game/storyMigrate.js';

function fakeInput() {
  const down = new Set(), pressed = new Set(), released = new Set(), codes = new Set();
  return {
    look: { dx: 0, dy: 0 }, stick: { lx: 0, ly: 0 }, codes,
    down: (a) => down.has(a), pressed: (a) => pressed.has(a), released: (a) => released.has(a),
    codePressed: (c) => codes.has(c), swallow: (c) => codes.delete(c),
    hold(a) { down.add(a); pressed.add(a); }, letGo(a) { down.delete(a); released.add(a); }, key(c) { codes.add(c); },
    endFrame() { pressed.clear(); released.clear(); codes.clear(); this.look.dx = 0; this.look.dy = 0; },
  };
}
function setup({ unlocked = [], step = 0, devAll = false, finished = false, progress: given = null, extra = {} } = {}) {
  const events = createEvents(), time = createTimeControl(), input = fakeInput();
  const wheelUi = { show: vi.fn(), setPick: vi.fn(), setInfo: vi.fn(), hide: vi.fn(), warm() {} };
  const gadgetHud = { set: vi.fn() };
  const fired = [];
  const stub = (id) => () => ({ id, fire: () => { fired.push(id); return true; } });
  const factories = { batarang: stub('batarang'), gel: stub('gel'), smoke: stub('smoke'), ...extra };
  const progress = given ?? { step, finished, gadgets: { equipped: 'batarang', unlocked, broken: [], caches: [], wheelUsed: false } };
  const save = vi.fn();
  const flags = { playing: true };
  const hero = { dead: false, state: 'ground', grounded: true, control: null, pos: { x: 0, y: 0, z: 0 }, bat: { animator: { play() {} } } };
  const sys = createGadgetSystem({
    hero, combat: { gadgetApi: {}, enemies: [], consumeInput() {} }, follow: {}, time, events, input, fx: {}, gfx: {}, breakables: {},
    progress, save, collision: {}, camera: {}, effects: upgradeEffects([]), wheelUi, gadgetHud,
    getBindings: () => DEFAULT_BINDINGS, isPlaying: () => flags.playing, factories, devAll,
  });
  const frame = (dt = 0.016) => { const ctx = {}; sys.update(dt, time.scale(dt), ctx); input.endFrame(); return ctx; };
  return { sys, input, time, events, wheelUi, gadgetHud, fired, progress, save, frame, flags, hero };
}

describe('gadget wheel', () => {
  it('holding the wheel key opens it, slows time to 20% and locks combat input', () => {
    const t = setup({ unlocked: ['gel'] });
    t.input.hold('gadgetWheel');
    const ctx = t.frame();
    expect(t.sys.wheelOpen).toBe(true);
    expect(ctx.lockInput).toBe(true);
    expect(t.time.held).toBeCloseTo(0.2);
    expect(t.wheelUi.show).toHaveBeenCalledTimes(1);
  });
  it('1 to 8 pick while open and are swallowed; letting go equips and saves', () => {
    const t = setup({ unlocked: ['gel'] });
    t.input.hold('gadgetWheel');
    t.frame();
    t.input.key('Digit3');
    t.sys.update(0.016, 0.003, {});
    expect(t.input.codes.has('Digit3')).toBe(false);
    t.input.endFrame();
    t.input.letGo('gadgetWheel');
    t.frame();
    expect(t.sys.wheelOpen).toBe(false);
    expect(t.time.held).toBe(1);
    expect(t.sys.state.equipped).toBe('gel');
    expect(t.progress.gadgets.equipped).toBe('gel');
    expect(t.save).toHaveBeenCalled();
  });
  it('a locked pick keeps the current gadget', () => {
    const t = setup();
    t.input.hold('gadgetWheel'); t.frame();
    t.input.key('Digit8'); t.frame();
    t.input.letGo('gadgetWheel'); t.frame();
    expect(t.sys.state.equipped).toBe('batarang');
  });
  it('the mouse picks by direction', () => {
    const t = setup({ unlocked: ['gel'] });
    t.input.hold('gadgetWheel'); t.frame();
    t.input.look.dx = 120; t.frame();
    t.input.letGo('gadgetWheel'); t.frame();
    expect(t.sys.state.equipped).toBe('gel');
  });
  it('the right stick picks too', () => {
    const t = setup({ unlocked: ['smoke'] });
    t.input.hold('gadgetWheel'); t.frame();
    t.input.stick.lx = 0.7; t.input.stick.ly = 0.7; t.frame();
    t.input.stick.lx = 0; t.input.stick.ly = 0;
    t.input.letGo('gadgetWheel'); t.frame();
    expect(t.sys.state.equipped).toBe('smoke');
  });
});

describe('firing and unlocks', () => {
  it('fires the equipped gadget and spends it; a cooling gadget hints instead', () => {
    const t = setup({ unlocked: ['smoke'] });
    const hints = [];
    t.events.on('hint', (h) => hints.push(h));
    t.sys.equip('smoke');
    expect(t.sys.fire({}, { inAir: false })).toBe(true);
    expect(t.sys.fire({}, { inAir: false })).toBe(true);
    expect(t.fired).toEqual(['smoke']);
    expect(hints).toEqual([{ id: 'gadget-cooldown', arg: 'Smoke Pellet' }]);
  });
  it('announces each gadget once as the story reaches it, and keeps it for a new game', () => {
    const t = setup();
    const seen = [];
    t.events.on('gadgetUnlocked', ({ id }) => seen.push(id));
    t.progress.step = STEPS.findIndex((s) => s.id === 'toYard');
    t.events.emit('step', {});
    t.events.emit('step', {});
    expect(seen).toEqual(['claw']);
    expect(t.progress.gadgets.unlocked).toContain('claw');
  });
  it('the HUD panel is only redrawn when it changes', () => {
    const t = setup();
    t.frame(); t.frame(); t.frame();
    expect(t.gadgetHud.set).toHaveBeenCalledTimes(1);
  });
});

// Review rulings: a time hold never outlives the wheel, a pause, a death, a cutscene or a run,
// and the wheel never opens where it can't be used.
describe('the wheel and its slow time never linger', () => {
  const openWheel = (t) => { t.input.hold('gadgetWheel'); t.frame(); expect(t.time.held).toBeCloseTo(0.2); };

  it('a pause (halt) closes the wheel without equipping and releases every hold', () => {
    const t = setup({ unlocked: ['gel'] });
    openWheel(t);
    t.time.hold('remote', 0.3);
    t.input.key('Digit3'); t.frame();
    t.sys.halt();
    expect(t.sys.wheelOpen).toBe(false);
    expect(t.time.held).toBe(1);
    expect(t.sys.state.equipped).toBe('batarang');
    expect(t.wheelUi.hide).toHaveBeenCalled();
  });
  it('play stopping (a cutscene, the finale, the end of a run) closes it and releases every hold', () => {
    const t = setup();
    openWheel(t);
    t.time.hold('remote', 0.3);
    t.sys.interrupt();
    expect(t.sys.wheelOpen).toBe(false);
    expect(t.time.held).toBe(1);
  });
  it('closes by itself as soon as play stops, even with the key still held', () => {
    const t = setup();
    openWheel(t);
    t.flags.playing = false;
    const ctx = t.frame();
    expect(t.sys.wheelOpen).toBe(false);
    expect(ctx.lockInput).toBe(false);
    expect(t.time.held).toBe(1);
  });
  it('dying closes it and releases every hold', () => {
    const t = setup();
    openWheel(t);
    t.time.hold('remote', 0.3);
    t.hero.dead = true;
    t.events.emit('heroDown', {});
    expect(t.sys.wheelOpen).toBe(false);
    expect(t.time.held).toBe(1);
  });
  it('cutscenes and photo mode release every hold', () => {
    for (const [ev, data] of [['cutscene', { name: 'x', on: true }], ['photoOpen', undefined]]) {
      const t = setup();
      openWheel(t);
      t.time.hold('remote', 0.3);
      t.events.emit(ev, data);
      expect(t.sys.wheelOpen).toBe(false);
      expect(t.time.held).toBe(1);
    }
  });
  it('never opens while dead, while play is stopped, mid chain takedown or Bat Swarm, or in a challenge countdown', () => {
    const cases = [
      (t) => { t.hero.dead = true; },
      (t) => { t.flags.playing = false; },
      (t) => { t.hero.control = { name: 'chain' }; },
      (t) => { t.hero.control = { name: 'swarm' }; },
      (t) => { t.hero.control = { name: 'countdown' }; },
    ];
    for (const block of cases) {
      const t = setup();
      block(t);
      t.input.hold('gadgetWheel');
      const ctx = t.frame();
      expect(t.sys.wheelOpen).toBe(false);
      expect(ctx.lockInput).toBe(false);
      expect(t.time.held).toBe(1);
      expect(t.wheelUi.show).not.toHaveBeenCalled();
    }
  });
  it('never opens mid silent takedown or perch drop, even in their chain window', () => {
    for (const name of ['silent', 'perchDrop']) {
      const t = setup();
      t.hero.control = { name, combat: true, canChain: () => true };
      t.input.hold('gadgetWheel');
      const ctx = t.frame();
      expect(t.sys.wheelOpen).toBe(false);
      expect(ctx.lockInput).toBe(false);
      expect(t.time.held).toBe(1);
      expect(t.wheelUi.show).not.toHaveBeenCalled();
    }
  });
  it('a chain starting under the wheel closes it', () => {
    const t = setup();
    openWheel(t);
    t.hero.control = { name: 'chain' };
    t.frame();
    expect(t.sys.wheelOpen).toBe(false);
    expect(t.time.held).toBe(1);
  });
  it('a small trackpad nudge is enough to pick a slot', () => {
    const t = setup({ unlocked: ['gel'] });
    openWheel(t);
    t.input.look.dx = 30; t.frame();
    t.input.letGo('gadgetWheel'); t.frame();
    expect(t.sys.state.equipped).toBe('gel');
  });
  it('a fire press while the wheel is open does nothing and is used up', () => {
    const t = setup();
    openWheel(t);
    expect(t.sys.fire({}, {})).toBe(true);
    expect(t.fired).toEqual([]);
  });
});

describe('fix round 1', () => {
  it('?gadgets=all never writes the save: open, pick, equip, fire, unlock', () => {
    const t = setup({ devAll: true });
    const seen = [];
    t.events.on('gadgetUnlocked', ({ id }) => seen.push(id));
    t.input.hold('gadgetWheel'); t.frame();
    t.input.key('Digit3'); t.frame();
    t.input.letGo('gadgetWheel'); t.frame();
    expect(t.sys.state.equipped).toBe('gel');
    t.sys.equip('smoke');
    t.sys.fire({}, {});
    t.progress.step = STEPS.findIndex((s) => s.id === 'toYard');
    t.events.emit('step', {});
    t.sys.unlockCheck();
    for (let i = 0; i < 5; i++) t.frame(1);
    expect(t.save).not.toHaveBeenCalled();
    expect(t.progress.gadgets.equipped).toBe('batarang');
    expect(t.progress.gadgets.unlocked).toEqual([]);
    expect(seen).toEqual([]);
  });
  it('a key pick is not overwritten by a mouse cursor resting on another slot', () => {
    const t = setup({ unlocked: ['remote', 'gel'] });
    t.input.hold('gadgetWheel'); t.frame();
    // Up and to the right: slot 1 (remote).
    t.input.look.dx = 50; t.input.look.dy = -50; t.frame();
    expect(t.sys.debug.pick).toBe(1);
    t.input.key('Digit3'); t.frame();
    t.frame(); // the cursor has not moved
    t.input.letGo('gadgetWheel'); t.frame();
    expect(t.sys.state.equipped).toBe('gel');
  });
  it('the wheel tutorial only counts as seen once the wheel has been on screen for a frame', () => {
    const t = setup();
    const events = [];
    t.events.on('wheelSeen', () => events.push('seen'));
    // A press and release inside one frame never draws the wheel.
    t.input.hold('gadgetWheel'); t.input.letGo('gadgetWheel'); t.frame();
    expect(t.sys.wheelOpen).toBe(false);
    expect(events).toEqual([]);
    // Held across a frame, it was drawn once: now it counts, once.
    t.input.hold('gadgetWheel'); t.frame();
    expect(events).toEqual([]);
    t.frame(); t.frame();
    expect(events).toEqual(['seen']);
    t.input.letGo('gadgetWheel'); t.frame();
    expect(events).toEqual(['seen']);
  });
});

// Final review I1: a save from before gadgets existed (the live game) is past every unlock step,
// or finished. It must hear about them once, with the party popper getting its own moment.
describe('returning players', () => {
  const listen = (t) => {
    const log = [];
    t.events.on('gadgetNews', ({ ids }) => log.push(['news', ids]));
    t.events.on('gadgetUnlocked', ({ id }) => log.push(['unlocked', id]));
    t.events.on('gadgetWheelTip', () => log.push(['tip']));
    return log;
  };
  const others = GADGET_IDS.filter((id) => id !== 'batarang' && id !== 'popper');

  it('an old finished save gets exactly one summary, then the popper card, and neither repeats', () => {
    const t = setup({ finished: true });
    const log = listen(t);
    // Nothing is announced or written until live play (a comic, the title, a pause).
    expect(t.save).not.toHaveBeenCalled();
    t.flags.playing = false;
    t.frame(); t.frame();
    expect(log).toEqual([]);
    t.flags.playing = true;
    t.frame();
    expect(log).toEqual([['tip'], ['news', others]]);
    expect(t.progress.gadgets.unlocked).toEqual(others);
    expect(t.save).toHaveBeenCalled();
    // The popper waits for the summary card to go.
    for (let i = 0; i < NEWS_CARD_S - 1; i++) t.frame(1);
    expect(log.length).toBe(2);
    t.frame(1.5);
    expect(log).toEqual([['tip'], ['news', others], ['unlocked', 'popper']]);
    expect(t.progress.gadgets.unlocked).toContain('popper');
    for (let i = 0; i < 30; i++) t.frame(1);
    expect(log.length).toBe(3);
    // The next load of the same save: nothing new to tell.
    const again = setup({ progress: t.progress });
    const log2 = listen(again);
    for (let i = 0; i < 30; i++) again.frame(1);
    expect(log2.filter(([k]) => k !== 'tip')).toEqual([]);
  });
  it('a save that earned a single gadget gets its normal unlock card instead of a summary', () => {
    const t = setup({ step: STEPS.findIndex((s) => s.id === 'toYard') });
    const log = listen(t);
    t.frame();
    expect(log).toEqual([['tip'], ['unlocked', 'claw']]);
    expect(t.progress.gadgets.unlocked).toEqual(['claw']);
  });
  it('a finished save that already knew the other gadgets gets the popper card alone', () => {
    const t = setup({ finished: true, unlocked: [...others] });
    const log = listen(t);
    t.frame();
    expect(log.filter(([k]) => k !== 'tip')).toEqual([['unlocked', 'popper']]);
  });
  it('a step change before the first live frame never writes the untold gadgets', () => {
    const t = setup({ finished: true });
    t.events.emit('step', {});
    expect(t.progress.gadgets.unlocked).toEqual([]);
  });
  it('?gadgets=all never announces and never writes, even on a finished save', () => {
    const t = setup({ finished: true, devAll: true });
    const log = listen(t);
    t.input.hold('gadgetWheel'); t.frame(); t.frame();
    t.input.letGo('gadgetWheel');
    for (let i = 0; i < 20; i++) t.frame(1);
    expect(log).toEqual([]);
    expect(t.save).not.toHaveBeenCalled();
    expect(t.progress.gadgets).toEqual({ equipped: 'batarang', unlocked: [], broken: [], caches: [], wheelUsed: false });
  });
  it('the summary card names the gadgets with the live wheel key and no dashes', () => {
    const c = gadgetNewsCard(others, 'Tab');
    expect(c.title).toBe('WAYNETECH DELIVERY!');
    expect(c.text).toContain('Remote Batarang, Explosive Gel, Smoke Pellet, Line Launcher, Batclaw and Freeze Blast.');
    expect(c.text).toContain('Hold Tab');
    const dash = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
    expect(c.title + c.text).not.toMatch(dash);
    expect(gadgetNewsCard(['gel'], 'Tab').text).toContain(': Explosive Gel.');
  });
});

describe('the wheel tutorial', () => {
  it('shows once per run while more than one gadget is unlocked and the wheel was never opened', () => {
    const t = setup();
    const tips = [];
    t.events.on('gadgetWheelTip', () => tips.push(1));
    t.frame(); t.frame();
    expect(tips).toEqual([]);
    t.sys.state.unlock(['gel']);
    t.frame(); t.frame();
    expect(tips).toEqual([1]);
  });
  it('opening the wheel saves wheelUsed, and after that the tip never shows', () => {
    const t = setup({ unlocked: ['gel'] });
    t.flags.playing = false;
    t.frame();
    t.flags.playing = true;
    t.input.hold('gadgetWheel'); t.frame(); t.frame();
    expect(t.progress.gadgets.wheelUsed).toBe(true);
    expect(t.save).toHaveBeenCalled();
    const again = setup({ progress: t.progress });
    const tips = [];
    again.events.on('gadgetWheelTip', () => tips.push(1));
    again.frame(); again.frame();
    expect(tips).toEqual([]);
  });
});

describe('fix round: the boss fight and mid-combo gadgets', () => {
  it('the Joker step equips the batarang for the fight without saving it', () => {
    const t = setup({ unlocked: ['gel'] });
    t.sys.equip('gel');
    t.save.mockClear();
    const boss = STEPS.find((s) => s.type === 'boss');
    t.progress.step = STEPS.indexOf(boss);
    t.events.emit('step', { step: boss, index: t.progress.step });
    expect(t.sys.state.equipped).toBe('batarang');
    expect(t.progress.gadgets.equipped).toBe('gel');
    t.frame();
    expect(t.gadgetHud.set.mock.lastCall[0].id).toBe('batarang');
    expect(t.progress.gadgets.equipped).toBe('gel');
  });
  it('a gadget pose replaces a strike in its chain window, but never a chain takedown', () => {
    const poser = () => ({ id: 'smoke', fire: (sys) => { sys.pose('Sword_Regular_B', 0.35, 1.7); return true; } });
    const t = setup({ unlocked: ['smoke'], extra: { smoke: poser } });
    const plays = [];
    t.hero.bat.animator.play = (clip) => plays.push(clip);
    t.sys.equip('smoke');
    t.hero.control = { name: 'strike', combat: true, canChain: () => true };
    t.sys.fire({}, {});
    expect(t.hero.control.name).toBe('gadgetPose');
    expect(plays).toEqual(['Sword_Regular_B']);
    const chain = { name: 'chain', combat: true, canChain: () => false };
    t.hero.control = chain;
    t.frame(20);
    t.sys.fire({}, {});
    expect(t.hero.control).toBe(chain);
    expect(plays).toEqual(['Sword_Regular_B']);
  });
});

describe('returning players: the gadget cards and the predator notice share the card slot', () => {
  // game.js's wiring, in miniature: hud.card has one slot and no queue (a new card replaces the
  // one up), the gadget handlers show the WayneTech delivery for NEWS_CARD_S less 0.7 s and the
  // popper's card for 7 s, and the predator notice is checked before gadgets.update each frame.
  function fakeHud(clock) {
    const shown = [];
    let until = 0;
    return {
      shown,
      card(title, text, ms) {
        const prev = shown.at(-1);
        if (prev && clock.t < until) prev.cut = true;
        shown.push({ title, at: clock.t, ms, cut: false });
        until = clock.t + ms / 1000;
      },
      get cardShowing() { return clock.t < until; },
    };
  }
  it('a finished old save between the rooms sees the delivery, the popper and the notice, each in full', () => {
    const t = setup({ finished: true });
    const clock = { t: 0 };
    const hud = fakeHud(clock);
    t.events.on('gadgetNews', ({ ids }) => hud.card(gadgetNewsCard(ids, 'Tab').title, '', NEWS_CARD_S * 1000 - 700));
    t.events.on('gadgetUnlocked', ({ id }) => hud.card(`NEW GADGET: ${id}`, '', 7000));
    const progress = { predatorNotice: 'due' };
    const noticeSaved = vi.fn();
    const step = (dt) => {
      clock.t += dt;
      if (progress.predatorNotice === 'due' && predatorNoticeReady(progress.predatorNotice, true, hud.cardShowing, t.sys.newsPending)) {
        progress.predatorNotice = 'shown';
        noticeSaved(clock.t);
        hud.card('MEANWHILE IN GOTHAM', '', 9000);
      }
      t.frame(dt);
    };
    step(0.016);
    // The first live frame: both are due, the delivery goes first and the notice waits.
    expect(hud.shown.map((c) => c.title)).toEqual(['WAYNETECH DELIVERY!']);
    expect(progress.predatorNotice).toBe('due');
    expect(noticeSaved).not.toHaveBeenCalled();
    for (let i = 0; i < 40 * 10; i++) step(0.1);
    expect(hud.shown.map((c) => c.title)).toEqual(['WAYNETECH DELIVERY!', 'NEW GADGET: popper', 'MEANWHILE IN GOTHAM']);
    expect(hud.shown.every((c) => !c.cut)).toBe(true);
    // Saved once, at the moment the notice actually went up.
    expect(noticeSaved).toHaveBeenCalledTimes(1);
    expect(noticeSaved.mock.calls[0][0]).toBeCloseTo(hud.shown[2].at);
    expect(hud.shown[2].at).toBeGreaterThanOrEqual(hud.shown[1].at + 7);
    // The popper was saved as seen with its card, not with the delivery's.
    expect(t.progress.gadgets.unlocked).toContain('popper');
  });
  it('newsPending covers the gap between the delivery and the popper, then clears', () => {
    const t = setup({ finished: true });
    t.flags.playing = false;
    t.frame();
    expect(t.sys.newsPending).toBe(true);
    t.flags.playing = true;
    t.frame();
    expect(t.sys.newsPending).toBe(true);
    expect(t.progress.gadgets.unlocked).not.toContain('popper');
    for (let i = 0; i < NEWS_CARD_S + 1; i++) t.frame(1);
    expect(t.sys.newsPending).toBe(false);
    expect(t.progress.gadgets.unlocked).toContain('popper');
  });
  it('the notice goes up on the first live frame when there is no gadget news', () => {
    expect(predatorNoticeReady('due', true, false, false)).toBe(true);
    expect(predatorNoticeReady('due', true, false, true)).toBe(false);
    expect(predatorNoticeReady('due', true, true, false)).toBe(false);
    expect(predatorNoticeReady('due', false, false, false)).toBe(false);
    expect(predatorNoticeReady('shown', true, false, false)).toBe(false);
    expect(predatorNoticeReady(null, true, false, false)).toBe(false);
  });
});
