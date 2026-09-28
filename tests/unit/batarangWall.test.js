import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createBatarangHandler } from '../../src/gadgets/g/batarang.js';
import { createEvents } from '../../src/core/events.js';

function goonAt(id, x, z) {
  return { id, alive: true, down: false, state: 'patrol', pos: new THREE.Vector3(x, 0, z), get x() { return this.pos.x; }, get z() { return this.pos.z; } };
}
function sysWith({ goons = [], wallAt = 10, stealth = true } = {}) {
  const events = createEvents(), seen = [];
  events.on('batarangWall', (d) => seen.push(['wall', +d.pos.x.toFixed(2), +d.pos.z.toFixed(2)]));
  events.on('batarangThrow', () => seen.push(['throw']));
  events.on('word', (d) => seen.push(['word', d.text]));
  const fx = { batarang: vi.fn((from, getTarget, onHit) => { getTarget(new THREE.Vector3()); onHit(); }) };
  const hero = {
    pos: new THREE.Vector3(0, 0, 0), control: null,
    bat: { face() {}, animator: { play() {} }, bone: () => ({ getWorldPosition: (v) => v.set(0, 1.4, 0) }) },
  };
  const api = { alive: () => goons, canSee: () => true, inputDir: () => new THREE.Vector3(0, 0, 1), batarang: vi.fn(() => ({ name: 'batarang' })) };
  const sys = {
    hero, events, fx, api, effects: { batarangCount: 1 }, stealth: { active: stealth },
    follow: { lookDir: (v) => v.set(0, 0, 1) },
    collision: { raycast: (o, d, max) => (wallAt !== null && wallAt <= max ? { t: wallAt, box: { tag: 'wall' } } : null) },
  };
  return { sys, seen, fx, hero, api };
}
const run = (ctl, secs) => { for (let t = 0; t < secs; t += 1 / 60) if (ctl.update(1 / 60)) break; };

describe('the batarang in a predator room', () => {
  it('with no goon under the crosshair it flies to the wall, and the clang goes out', () => {
    const t = sysWith();
    expect(createBatarangHandler().fire(t.sys, {})).toBe(true);
    expect(t.hero.control.name).toBe('batarang');
    run(t.hero.control, 0.5);
    expect(t.fx.batarang).toHaveBeenCalledTimes(1);
    expect(t.seen).toEqual([['throw'], ['wall', 0, 9.85], ['word', 'TINK!']]);
  });
  it('only locks onto a goon right under the crosshair', () => {
    const off = sysWith({ goons: [goonAt('side', 6, 6)] });
    createBatarangHandler().fire(off.sys, {});
    expect(off.api.batarang).not.toHaveBeenCalled();
    expect(off.hero.control.name).toBe('batarang');
    const on = sysWith({ goons: [goonAt('ahead', 0.5, 8)] });
    createBatarangHandler().fire(on.sys, {});
    expect(on.api.batarang).toHaveBeenCalledTimes(1);
  });
  it('needs a wall between 2 and 30 m', () => {
    expect(createBatarangHandler().fire(sysWith({ wallAt: null }).sys, {})).toBe(false);
    expect(createBatarangHandler().fire(sysWith({ wallAt: 1 }).sys, {})).toBe(false);
  });
  it('outside a predator room nothing changes: no goon, no throw', () => {
    const t = sysWith({ stealth: false });
    expect(createBatarangHandler().fire(t.sys, {})).toBe(false);
    expect(t.hero.control).toBe(null);
  });
});
