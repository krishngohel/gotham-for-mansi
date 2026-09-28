import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSilentTakedown, createPerchDrop } from '../../src/stealth/takedowns.js';
import { createEvents } from '../../src/core/events.js';
import { CHOKE_OFFSET } from '../../src/actors/stealthAnims.js';

// `collision` lets a test override resolveCylinder (walls) and/or groundBelow (edges) to probe
// the approach/landing fallbacks; by default there's a wall nowhere and ground everywhere at y=0.
function fakeHero(x = 0, y = 0, z = 0, collision = {}) {
  const h = {
    pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), state: 'ground', grounded: true, clips: [],
    collision: {
      resolveCylinder: () => ({ groundY: 0 }),
      groundBelow: () => 0,
      ...collision,
    },
    bat: { yaw: 0, face(y2) { h.bat.yaw = y2; }, animator: { play: (n) => h.clips.push(n) } },
    setState(s) { h.state = s; },
  };
  return h;
}
function fakeGoon(x, y, z, yaw = 0) {
  const e = {
    id: 'g', pos: new THREE.Vector3(x, y, z), yaw, alive: true, state: 'patrol', woke: 0, clips: [],
    ch: { animator: { play: (n) => e.clips.push(n) }, headWorld: (v, lift = 0) => v.set(e.pos.x, e.pos.y + 1.7 + lift, e.pos.z) },
    chainHold() { e.state = 'chained'; }, chainRelease() { if (e.state === 'chained') e.state = 'patrol'; },
    wake() { e.woke += 1; },
  };
  return e;
}
function fakeApi() {
  const events = createEvents(), log = [];
  for (const n of ['silentStart', 'silentTakedown', 'silentBroken', 'perchDropStart', 'perchDrop']) events.on(n, () => log.push(n));
  events.on('word', (d) => log.push(d.text));
  const api = {
    events, log, noises: [], takedowns: [],
    noise: (pos, radius, kind) => api.noises.push([kind, radius]),
    takedown: (e, kind, opts) => { api.takedowns.push([kind, opts?.crit ?? true]); e.alive = false; e.state = 'ko'; return true; },
  };
  return api;
}
const run = (ctl, secs, dt = 1 / 60) => { let done = false; for (let t = 0; t < secs && !done; t += dt) done = ctl.update(dt); return done; };

describe('the silent takedown', () => {
  it('snaps behind the goon, chokes for 2 s, then knocks it out quietly', () => {
    const h = fakeHero(0, 0, -1.2), e = fakeGoon(0, 0, 0), api = fakeApi();
    const ctl = createSilentTakedown(h, api, { target: e });
    expect(ctl).toMatchObject({ name: 'silent', camera: 'takedown', combat: true, keepCrouch: true });
    expect(e.state).toBe('chained');
    expect(h.clips).toEqual(['Takedown_Choke']);
    expect(e.clips).toEqual(['Choked']);
    expect(api.noises).toEqual([['takedown', 6]]);
    run(ctl, 0.3);
    expect(h.pos.z).toBeCloseTo(-CHOKE_OFFSET, 2);
    expect(e.alive).toBe(true);
    expect(run(ctl, 2.2)).toBe(true);
    expect(api.takedowns).toEqual([['silent', false]]);
    expect(api.log).toEqual(['silentStart', 'NIGHTY NIGHT!', 'silentTakedown']);
  });
  it('lets go if Batman is hit, and the goon wakes up', () => {
    const h = fakeHero(0, 0, -1.2), e = fakeGoon(0, 0, 0), api = fakeApi();
    const ctl = createSilentTakedown(h, api, { target: e });
    run(ctl, 1);
    ctl.knockOff();
    expect(e.state).toBe('patrol');
    expect(e.woke).toBe(1);
    expect(api.takedowns).toEqual([]);
    expect(api.log).toContain('silentBroken');
  });

  // Fix round 1: a goon at a balcony rail or catwalk edge must never float Batman off it.
  it('aborts instead of snapping Batman off an edge, when no side of the goon has ground', () => {
    const h = fakeHero(0, 0, -1.2, { groundBelow: () => -Infinity }), e = fakeGoon(0, 0, 0), api = fakeApi();
    const ctl = createSilentTakedown(h, api, { target: e });
    expect(ctl).toBe(null);
    expect(e.state).toBe('patrol');
    expect(api.noises).toEqual([]);
    expect(api.log).toEqual([]);
  });
  it('steps to a shoulder side when the ground drops away directly behind the goon', () => {
    // Ground is missing only right behind the goon (x near 0); either shoulder side (x = +-CHOKE_OFFSET) is fine.
    const h = fakeHero(0, 0, -1.2, { groundBelow: (x) => (Math.abs(x) < 0.1 ? -Infinity : 0) });
    const e = fakeGoon(0, 0, 0), api = fakeApi();
    const ctl = createSilentTakedown(h, api, { target: e });
    expect(ctl).not.toBe(null);
    expect(e.state).toBe('chained');
    run(ctl, 0.3);
    expect(Math.abs(h.pos.x)).toBeCloseTo(CHOKE_OFFSET, 2);
    expect(h.pos.z).toBeCloseTo(0, 2);
  });
  it('steps to a side when directly behind the goon is blocked by a wall', () => {
    const h = fakeHero(0, 0, -1.2, { resolveCylinder: (p) => ({ groundY: 0, hitWall: Math.abs(p.x) < 0.1 }) });
    const e = fakeGoon(0, 0, 0), api = fakeApi();
    const ctl = createSilentTakedown(h, api, { target: e });
    expect(ctl).not.toBe(null);
    expect(e.state).toBe('chained');
    run(ctl, 0.3);
    expect(Math.abs(h.pos.x)).toBeCloseTo(CHOKE_OFFSET, 2);
  });
});

describe('the perch drop', () => {
  it('arcs onto the goon, knocks it out with an action shot and lands beside it', () => {
    const h = fakeHero(0, 10, 0), e = fakeGoon(2, 0, 1), api = fakeApi();
    const ctl = createPerchDrop(h, api, { target: e });
    expect(ctl).toMatchObject({ name: 'perchDrop', camera: 'dive', combat: true });
    expect(e.state).toBe('chained');
    expect(h.state).toBe('air');
    let peak = 0;
    for (let i = 0; i < 20; i++) { ctl.update(1 / 60); peak = Math.max(peak, h.pos.y); }
    expect(peak).toBeGreaterThan(10);
    expect(run(ctl, 1.5)).toBe(true);
    expect(api.takedowns).toEqual([['perch', true]]);
    expect(api.noises).toEqual([['perch', 8]]);
    expect(api.log).toEqual(['perchDropStart', 'KRUNCH!', 'perchDrop']);
    expect(h.state).toBe('ground');
    expect(h.pos.y).toBeCloseTo(0);
    expect(Math.hypot(h.pos.x - 2, h.pos.z - 1)).toBeLessThan(1);
  });

  // Fix round 1: the landing spot is now collision- and ground-resolved, with a fallback to the
  // goon's other side (and finally right on top of where it stood).
  it('lands on the goon\'s other side when the first landing spot has no ground under it', () => {
    const yaw = Math.atan2(2, 1); // matches h.bat.face(atan2(target.x - from.x, target.z - from.z)) below
    const h = fakeHero(0, 10, 0, { groundBelow: (x, y, z) => (z < 1 ? -Infinity : 0) });
    const e = fakeGoon(2, 0, 1), api = fakeApi();
    const ctl = createPerchDrop(h, api, { target: e });
    run(ctl, 1.5);
    expect(h.pos.x).toBeCloseTo(e.pos.x + Math.sin(yaw) * 0.6, 3);
    expect(h.pos.z).toBeCloseTo(e.pos.z + Math.cos(yaw) * 0.6, 3);
    expect(h.pos.y).toBeCloseTo(0);
  });
});
