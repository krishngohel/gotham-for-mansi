import { describe, it, expect, vi } from 'vitest';
import { createGadgetSystem } from '../../src/gadgets/gadgetSystem.js';
import { createTimeControl } from '../../src/core/time.js';
import { createEvents } from '../../src/core/events.js';
import { upgradeEffects } from '../../src/progress/upgrades.js';
import { DEFAULT_BINDINGS } from '../../src/core/bindings.js';
import { STEPS } from '../../src/game/story.js';

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
function setup({ unlocked = [], step = 0 } = {}) {
  const events = createEvents(), time = createTimeControl(), input = fakeInput();
  const wheelUi = { show: vi.fn(), setPick: vi.fn(), setInfo: vi.fn(), hide: vi.fn(), warm() {} };
  const gadgetHud = { set: vi.fn() };
  const fired = [];
  const stub = (id) => () => ({ id, fire: () => { fired.push(id); return true; } });
  const factories = { batarang: stub('batarang'), gel: stub('gel'), smoke: stub('smoke') };
  const progress = { step, finished: false, gadgets: { equipped: 'batarang', unlocked, broken: [], caches: [] } };
  const save = vi.fn();
  const flags = { playing: true };
  const hero = { dead: false, state: 'ground', grounded: true, control: null, pos: { x: 0, y: 0, z: 0 }, bat: { animator: { play() {} } } };
  const sys = createGadgetSystem({
    hero, combat: { gadgetApi: {}, enemies: [], consumeInput() {} }, follow: {}, time, events, input, fx: {}, gfx: {}, breakables: {},
    progress, save, collision: {}, camera: {}, effects: upgradeEffects([]), wheelUi, gadgetHud,
    getBindings: () => DEFAULT_BINDINGS, isPlaying: () => flags.playing, factories,
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
  it('never opens while dead, while play is stopped, mid chain takedown or in a challenge countdown', () => {
    const cases = [
      (t) => { t.hero.dead = true; },
      (t) => { t.flags.playing = false; },
      (t) => { t.hero.control = { name: 'chain' }; },
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
