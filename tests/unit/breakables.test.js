// createBreakables draws its materials through canvas textures, so these tests stub just enough
// of `document`/`Path2D` for that to run headless (tests run under vitest's `node` environment,
// with no DOM). The stub is a permissive proxy: any property read that isn't already a stored
// value comes back as a no-op function, which is all `bricks`/`signTex`/etc. (src/world/breakables.js)
// need from a 2D context.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBreakables } from '../../src/world/breakables.js';
import { createEvents } from '../../src/core/events.js';

function fakeCtx() {
  const store = {};
  return new Proxy(store, {
    get: (t, prop) => (prop in t ? t[prop] : () => {}),
    set: (t, prop, v) => { t[prop] = v; return true; },
  });
}
function fakeDocument() {
  return { createElement: (tag) => (tag === 'canvas' ? { width: 0, height: 0, getContext: () => fakeCtx() } : {}) };
}

// A collision stub good enough to build every real breakable (src/world/breakableSpots.js):
// addBox hands back a fresh, unique key each call (what byBox needs); query returns nothing, so
// the two railing spots (which need a real roof under them) politely skip themselves instead of
// throwing; nothing else here is exercised by smash()/update().
function fakeCollision() {
  let n = 0;
  return {
    addBox: () => ({ n: n++ }),
    removeBox: () => {},
    query: () => [],
    groundBelow: () => 0,
    raycast: () => null,
  };
}

function setup({ dev = false } = {}) {
  const progress = { gadgets: { broken: [], caches: [] } };
  const save = vi.fn();
  const events = createEvents();
  const seen = [];
  events.on('*', (name, data) => seen.push([name, data?.id]));
  const gfx = { debris: { burst: vi.fn() } };
  const breakables = createBreakables({
    scene: { add: () => {} }, collision: fakeCollision(), climbables: { ladders: [] },
    progress, save, events, gfx, dev,
  });
  return { breakables, progress, save, seen, gfx };
}

describe('breakables dev-run save gate', () => {
  beforeEach(() => { vi.stubGlobal('document', fakeDocument()); vi.stubGlobal('Path2D', class { constructor(d) { this.d = d; } }); });
  afterEach(() => vi.unstubAllGlobals());

  it('a normal run records the break and saves', () => {
    const { breakables, progress, save, seen } = setup({ dev: false });
    const item = breakables.items.find((i) => i.id === 'wallMonarchBooth');
    expect(item).toBeTruthy();
    expect(breakables.smash(item, { x: 0, y: 0, z: 0 })).toBe(true);
    expect(item.broken).toBe(true);
    expect(item.mesh.visible).toBe(false);
    expect(progress.gadgets.broken).toEqual(['wallMonarchBooth']);
    expect(save).toHaveBeenCalledTimes(1);
    expect(seen).toContainEqual(['wallBroken', 'wallMonarchBooth']);
  });

  it('a dev run (?gadgets=all) still breaks the wall for this session but never saves', () => {
    const { breakables, progress, save, seen, gfx } = setup({ dev: true });
    const item = breakables.items.find((i) => i.id === 'wallMonarchBooth');
    expect(breakables.smash(item, { x: 0, y: 0, z: 0 })).toBe(true);
    // Still happens: collision removed (box cleared), mesh hidden, debris, the event.
    expect(item.broken).toBe(true);
    expect(item.box).toBe(null);
    expect(item.mesh.visible).toBe(false);
    expect(gfx.debris.burst).toHaveBeenCalledTimes(1);
    expect(seen).toContainEqual(['wallBroken', 'wallMonarchBooth']);
    // Never happens: the real save.
    expect(progress.gadgets.broken).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });

  it('smashing twice is a no-op the second time, dev or not', () => {
    const { breakables } = setup({ dev: true });
    const item = breakables.items.find((i) => i.id === 'wallMonarchBooth');
    breakables.smash(item, { x: 0, y: 0, z: 0 });
    expect(breakables.smash(item, { x: 0, y: 0, z: 0 })).toBe(false);
  });

  it('a normal run records a cache found through update()', () => {
    const { breakables, progress, save } = setup({ dev: false });
    const wall = breakables.items.find((i) => i.id === 'wallColdStore');
    breakables.smash(wall, { x: 0, y: 0, z: 0 });
    const before = save.mock.calls.length;
    const cache = breakables.caches.find((c) => c.id === 'cacheColdStore');
    breakables.update(0, cache.pos);
    expect(progress.gadgets.caches).toEqual(['cacheColdStore']);
    expect(save.mock.calls.length).toBe(before + 1);
  });

  it('a dev run finds the cache (it appears, walking up takes it) but never saves it', () => {
    const { breakables, progress, save } = setup({ dev: true });
    const wall = breakables.items.find((i) => i.id === 'wallColdStore');
    breakables.smash(wall, { x: 0, y: 0, z: 0 });
    const cache = breakables.caches.find((c) => c.id === 'cacheColdStore');
    breakables.update(0, cache.pos);
    expect(cache.taken).toBe(true);
    expect(progress.gadgets.caches).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });
});
