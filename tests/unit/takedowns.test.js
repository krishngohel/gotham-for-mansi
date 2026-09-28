import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSilentTakedown, createPerchDrop } from '../../src/stealth/takedowns.js';
import { createEvents } from '../../src/core/events.js';
import { CHOKE_OFFSET } from '../../src/actors/stealthAnims.js';

function fakeHero(x = 0, y = 0, z = 0) {
  const h = {
    pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), state: 'ground', grounded: true, clips: [],
    collision: { resolveCylinder: () => ({ groundY: 0 }) },
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
    expect(api.log).toEqual(['silentStart', 'HRKK!', 'silentTakedown']);
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
});
