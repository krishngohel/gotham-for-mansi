// The remote batarang handler (src/gadgets/g/remote.js), exercised directly with stubbed deps
// (the pattern gadget, batarang.js, has no handler-level test either; gadgetSystem.test.js only
// ever stubs handlers out). Covers two things a full playthrough won't reliably catch: a goon
// staying in range across many frames is only stunned once per flight, and every way the flight
// can end (its 3 s timer, a wall, and an external cancel) leaves the camera back in the player's
// hands.
import { describe, it, expect, vi } from 'vitest';
import { createRemoteHandler } from '../../src/gadgets/g/remote.js';

// A fixed, level throw straight down -Z (as if the camera never moved) keeps the flight math
// simple: pos.x and pos.y never change, only pos.z counts down at SPEED (24 m/s) x dt.
function makeSys({ raycast = () => null, enemies = [] } = {}) {
  const events = [];
  const sys = {
    hero: {
      state: 'ground', grounded: true, control: null, dead: false,
      bat: {
        bone: () => ({ getWorldPosition: (out) => out.set(0, 0, 0) }),
        face: () => {},
        animator: { play: () => {} },
      },
    },
    hint: () => {},
    follow: { lookDir: (out) => out.set(0, 0, -1) },
    time: { hold: vi.fn(), release: vi.fn() },
    gfx: { trail: { start: () => {}, push: () => {}, stop: () => {} } },
    cameraFocus: null,
    cameraMode: null,
    events: { emit: (name, data) => events.push({ name, data }) },
    combat: { enemies, consumeInput: vi.fn() },
    collision: { raycast },
    breakables: { aimed: () => null, smash: vi.fn(), forNear: () => {} },
    api: { landHit: vi.fn() },
    fx: { impact: vi.fn() },
  };
  return { sys, events };
}

const ctx = { input: { pressed: () => false } };

describe('remote batarang handler', () => {
  it('stuns a goon it stays in range of for many frames only once', () => {
    const enemy = { id: 'e0', alive: true, def: { boss: false }, pos: { x: 0, y: -1.2, z: -3 }, state: 'idle' };
    const { sys } = makeSys({ enemies: [enemy] });
    const h = createRemoteHandler();
    expect(h.fire(sys)).toBe(true);
    // 30 frames at 24 m/s covers a good 12 m, so the goon at z -3 sits well inside the 1.3 m hit
    // radius for several consecutive frames, not just one.
    for (let i = 0; i < 30; i++) h.update(sys, 1 / 60, 1 / 60, ctx);
    expect(sys.api.landHit).toHaveBeenCalledTimes(1);
    expect(sys.api.landHit).toHaveBeenCalledWith('remote', enemy);
  });

  it('never touches the Joker (def.boss)', () => {
    const joker = { id: 'joker', alive: true, def: { boss: true }, pos: { x: 0, y: -1.2, z: -3 }, state: 'idle' };
    const { sys } = makeSys({ enemies: [joker] });
    const h = createRemoteHandler();
    h.fire(sys);
    for (let i = 0; i < 30; i++) h.update(sys, 1 / 60, 1 / 60, ctx);
    expect(sys.api.landHit).not.toHaveBeenCalled();
  });

  it('its 3 s timer ends the flight and hands the camera back', () => {
    const { sys, events } = makeSys();
    const h = createRemoteHandler();
    h.fire(sys);
    expect(sys.cameraMode).toBe('remote');
    h.update(sys, 3.1, 3.1, ctx);
    expect(h.active).toBe(false);
    expect(sys.cameraMode).toBeNull();
    expect(sys.cameraFocus).toBeNull();
    expect(sys.time.release).toHaveBeenCalledWith('remote');
    expect(events.some((e) => e.name === 'remoteEnd' && e.data.why === 'time')).toBe(true);
  });

  it('a wall ends the flight and hands the camera back', () => {
    const { sys, events } = makeSys({ raycast: () => ({ t: 0.3, box: {}, normal: { x: 0, y: 0, z: 1 } }) });
    const h = createRemoteHandler();
    h.fire(sys);
    h.update(sys, 1 / 60, 1 / 60, ctx);
    expect(h.active).toBe(false);
    expect(sys.cameraMode).toBeNull();
    expect(sys.cameraFocus).toBeNull();
    expect(events.some((e) => e.name === 'remoteEnd' && e.data.why === 'wall')).toBe(true);
  });

  it('cancel() ends an in-flight batarang and hands the camera back, and is a safe no-op after', () => {
    const { sys, events } = makeSys();
    const h = createRemoteHandler();
    h.fire(sys);
    h.cancel(sys);
    expect(h.active).toBe(false);
    expect(sys.cameraMode).toBeNull();
    expect(sys.cameraFocus).toBeNull();
    expect(events.filter((e) => e.name === 'remoteEnd')).toHaveLength(1);
    // gadgets.interrupt() calls cancel() every frame while play is stopped or paused: it must
    // stay cheap and not re-fire end() once the batarang is already inactive.
    h.cancel(sys);
    h.cancel(sys);
    expect(events.filter((e) => e.name === 'remoteEnd')).toHaveLength(1);
  });
});
