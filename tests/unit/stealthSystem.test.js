// tests/unit/stealthSystem.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStealth } from '../../src/stealth/stealthSystem.js';
import { createEvents } from '../../src/core/events.js';
import { createRng } from '../../src/core/rng.js';
import { LINES } from '../../src/stealth/brain.js';

const W = (x, y, z, wait = 0, face = null) => ({ x, y, z, wait, face });
const ROOM = {
  id: 'test', site: 's', entry: 'e', radius: 20,
  bounds: { minX: -50, maxX: 50, minY: -5, maxY: 20, minZ: -50, maxZ: 50 },
  lights: [{ x: 0, z: 10, r: 6 }],
  perches: [], cover: [], columns: [], posts: [], rails: [], doors: [], decks: [],
  vent: { x: 0, y: 0, z: 5, w: 3, d: 3 },
  huddle: { x: 0, y: 0, z: -10 },
  squad: [
    { type: 'rifle', route: { mode: 'pingpong', points: [W(0, 0, 0), W(0, 0, -8)] } },
    { type: 'rifle', route: { mode: 'pingpong', points: [W(10, 0, 0), W(10, 0, -8)] } },
    { type: 'grunt', route: { mode: 'pingpong', points: [W(-10, 0, 0, 3, 0)] } },
  ],
  encore: [],
};

function fakeHero(x, y, z) {
  const h = {
    pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), state: 'ground', grounded: true, control: null, dead: false,
    crouched: false, perched: false, collision: { resolveCylinder: () => ({}), groundBelow: () => 0 },
    bat: { yaw: 0, face(v) { h.bat.yaw = v; }, animator: { play() {} } },
    setState(s) { h.state = s; },
  };
  return h;
}
function fakeGoon(id, type, p, yaw = 0) {
  const e = {
    id, type, def: { ranged: type === 'rifle' }, alive: true, down: false, air: false, stunned: false, aware: false, state: 'idle',
    pos: new THREE.Vector3(p.x, p.y, p.z), yaw, room: null, seesHero: undefined, woke: 0, calls: [],
    nav: { x: p.x, y: p.y, z: p.z, speed: 0, face: null, lookX: 0, lookZ: 0, arrived: false },
    ch: { animator: { play() {} }, headWorld: (v, lift = 0) => v.set(e.pos.x, e.pos.y + 1.7 + lift, e.pos.z) },
    wake() { e.woke += 1; },
    canNav() { return e.alive && !e.down && e.state !== 'chained'; },
    goTo(x, y, z, speed, state = 'patrol', face = null) {
      if (Math.hypot(x - e.nav.x, z - e.nav.z) > 0.3) e.nav.arrived = false;
      Object.assign(e.nav, { x, y, z, speed, face });
      e.state = state;
      e.calls.push([state, x, z]);
    },
    lookAt(x, z, state = 'suspicious') { e.nav.lookX = x; e.nav.lookZ = z; e.state = state; },
    engageNow() { e.aware = true; e.state = 'engage'; },
    calm() { e.aware = false; e.state = 'look'; },
    chainHold() { e.state = 'chained'; }, chainRelease() { e.state = 'idle'; },
  };
  return e;
}
function setup({ room = ROOM, perches = [], hero = [0, 0, 10] } = {}) {
  const events = createEvents();
  const h = fakeHero(...hero);
  const goons = room.squad.map((g, i) => fakeGoon(`g${i}`, g.type, g.route.points[0]));
  const takedowns = [];
  const combat = { enemies: goons, takedown: (e, kind, opts) => { e.alive = false; e.state = 'ko'; takedowns.push([kind, opts?.crit ?? true]); return true; } };
  const world = { blocker: null };
  const collision = { raycast: () => world.blocker };
  const stealth = createStealth({ hero: h, combat, events, collision, perches, rng: createRng(1) });
  const seen = [];
  for (const n of ['stealthAlarm', 'stealthLost', 'stealthLine', 'stealthFear', 'stealthNoise', 'ventHide', 'perched', 'hint', 'stealthStart', 'stealthEnd']) {
    events.on(n, (d) => seen.push([n, d?.text ?? d?.id ?? d?.fear ?? d?.room ?? d?.kind ?? '']));
  }
  stealth.begin({ stealth: 'test', squad: 'main' }, goons, room);
  const step = (secs, dt = 0.05) => { for (let i = 0; i < Math.round(secs / dt); i++) stealth.update(dt); };
  const mind = (i) => stealth.goons[i].mind;
  return { events, hero: h, goons, stealth, seen, takedowns, world, step, mind };
}
const names = (seen, n) => seen.filter(([k]) => k === n);

describe('a predator room at run time', () => {
  it('marks its goons and walks them along their routes', () => {
    const t = setup({ hero: [0, 0, -30] });
    expect(t.seen[0]).toEqual(['stealthStart', 'test']);
    t.step(0.1);
    expect(t.goons.every((e) => e.room === 'test' && !e.aware)).toBe(true);
    expect(t.goons[0].calls.at(-1)).toEqual(['patrol', 0, -8]);
    expect(t.goons[2].calls.at(-1)).toEqual(['patrol', -10, 0]);
    expect(t.goons[2].nav.face).toBe(0);
    expect(t.stealth.armed()).toBe(2);
  });
  it('a goon that sees Batman in the light notices, searches, then shouts, and the squad comes for him', () => {
    const t = setup();
    t.step(0.3);
    expect(t.mind(0).alert).toBe('suspicious');
    t.step(3);
    expect(names(t.seen, 'stealthAlarm')).toHaveLength(1);
    expect(LINES.spot).toContain(names(t.seen, 'stealthLine').at(-1)[1]);
    expect(t.goons.every((e) => e.aware && e.state === 'engage')).toBe(true);
    expect(t.goons[0].seesHero).toBe(true);
    expect(t.stealth.alarm).toBe(true);
  });
  it('in the dark he is seen at 12 m standing, but not crouched', () => {
    const dark = { ...ROOM, lights: [], vent: null };
    const a = setup({ room: dark, hero: [0, 0, 12] });
    a.step(1);
    expect(a.mind(0).meter).toBeGreaterThan(0);
    const b = setup({ room: dark, hero: [0, 0, 12] });
    b.hero.crouched = true;
    b.step(3);
    expect(b.mind(0).meter).toBe(0);
  });
  it('crouched in the vent steam he is invisible even 5 m away', () => {
    const t = setup({ room: { ...ROOM, lights: [] }, hero: [0, 0, 5] });
    t.hero.crouched = true;
    t.step(2);
    expect(t.mind(0).meter).toBe(0);
    expect(names(t.seen, 'ventHide')).toHaveLength(1);
    t.hero.crouched = false;
    t.step(1);
    expect(t.mind(0).meter).toBeGreaterThan(0);
  });
  it('a wall in the way hides him', () => {
    const t = setup();
    t.world.blocker = { t: 2, box: { tag: 'wall' } };
    t.step(2);
    expect(t.mind(0).meter).toBe(0);
  });
  it('perched on a gargoyle he is invisible to goons that are not hostile', () => {
    const t = setup({ perches: [{ x: 0, y: 6, z: 3, perch: true }], hero: [0, 6, 3] });
    t.step(2);
    expect(t.hero.perched).toBe(true);
    expect(names(t.seen, 'perched')).toHaveLength(1);
    expect(t.mind(0).meter).toBe(0);
  });
  it('once nobody has seen him for 8 s, the squad falls back to searching', () => {
    const t = setup();
    t.step(3);
    t.hero.pos.set(0, 0, -40);
    t.step(1.5);
    expect(t.goons[1].state).toBe('hunt');
    expect(t.goons[1].aware).toBe(true);
    t.step(8);
    expect(names(t.seen, 'stealthLost')).toHaveLength(1);
    expect(t.goons.every((e) => !e.aware)).toBe(true);
    expect([0, 1, 2].map((i) => t.mind(i).alert)).toEqual(['search', 'search', 'search']);
  });
  it('footsteps and a batarang clang draw goons that are not hostile', () => {
    const t = setup({ hero: [-10, 0, -4] });
    t.events.emit('footstep', { sprint: false });
    t.step(0.05);
    expect(t.mind(2).alert).toBe('search');
    expect(t.mind(2).target).toMatchObject({ x: -10, z: -4 });
    expect(t.mind(0).alert).toBe('patrol');
    t.events.emit('batarangWall', { pos: { x: 10, y: 0, z: -4 } });
    t.step(0.05);
    expect(t.mind(1).target).toMatchObject({ x: 10, z: -4 });
    expect(t.mind(0).alert).toBe('search');
    expect(names(t.seen, 'stealthNoise').map(([, k]) => k)).toEqual(['step', 'batarang']);
  });
  it('smoke sends every goon back to searching around the cloud', () => {
    const t = setup();
    t.step(3);
    t.events.emit('smoke', { pos: { x: 1, y: 0, z: 1 } });
    expect(t.stealth.alarm).toBe(false);
    for (const i of [0, 1, 2]) { expect(t.mind(i).alert).toBe('search'); expect(t.mind(i).target).toMatchObject({ x: 1, z: 1 }); }
    expect(t.goons.every((e) => !e.aware)).toBe(true);
  });
  it('a stunned goon goes looking; one that parried a punch raises the alarm', () => {
    const t = setup({ hero: [0, 0, -30] });
    t.events.emit('impact', { target: t.goons[0], outcome: 'stun' });
    expect(t.mind(0).alert).toBe('search');
    t.events.emit('impact', { target: t.goons[1], outcome: 'parried' });
    expect(names(t.seen, 'stealthAlarm')).toHaveLength(1);
  });
  it('a woken goon (a chain heard, or getting up) goes to look where Batman is', () => {
    const t = setup({ hero: [0, 0, -5] });
    t.goons[0].wake();
    t.step(0.05);
    expect(t.mind(0).alert).toBe('search');
    expect(t.mind(0).target).toMatchObject({ x: 0, z: -5 });
  });
  it('each takedown raises fear and a survivor says so; with two left they huddle', () => {
    const t = setup({ hero: [0, 0, -30] });
    t.step(0.1);
    t.goons[0].alive = false;
    t.step(0.1);
    expect(names(t.seen, 'stealthFear')).toEqual([['stealthFear', 1]]);
    expect(LINES.fear1).toContain(names(t.seen, 'stealthLine').at(-1)[1]);
    const [, x, z] = t.goons[1].calls.at(-1);
    expect(Math.hypot(x - 0, z + 10)).toBeCloseTo(1.6, 1);
  });
  it('a punch from behind an unaware goon starts the silent takedown; from the front it does not', () => {
    const t = setup({ hero: [0, 0, -1.2] });
    expect(t.stealth.start('punch')).toBe(true);
    expect(t.hero.control.name).toBe('silent');
    const f = setup({ hero: [0, 0, 1.2] });
    expect(f.stealth.start('punch')).toBe(false);
    expect(f.stealth.start('kick')).toBe(false);
  });
  it('with no safe spot round the goon (an edge on every side) the punch is left to combat', () => {
    const t = setup({ hero: [0, 0, -1.2] });
    t.hero.collision.groundBelow = () => -Infinity;
    expect(t.stealth.start('punch')).toBe(false);
    expect(t.hero.control).toBe(null);
    expect(t.goons[0].state).not.toBe('chained');
  });
  it('perched, a kick drops on the goon below; with nobody below it only hints', () => {
    const t = setup({ perches: [{ x: 0, y: 6, z: 2, perch: true }], hero: [0, 6, 2] });
    t.step(0.1);
    expect(t.stealth.prompt).toBe('perch');
    expect(t.stealth.start('kick')).toBe(true);
    expect(t.hero.control.name).toBe('perchDrop');
    const u = setup({ perches: [{ x: 0, y: 6, z: 2, perch: true }], hero: [0, 6, 2] });
    for (const e of u.goons) e.pos.x += 40;
    u.step(0.1);
    expect(u.stealth.start('punch')).toBe(true);
    expect(u.hero.control).toBe(null);
    expect(names(u.seen, 'hint')).toEqual([['hint', 'perch-none']]);
  });
  it('end hands the goons back', () => {
    const t = setup();
    t.stealth.end();
    expect(t.goons.every((e) => e.room === null)).toBe(true);
    t.goons[0].wake();
    expect(t.goons[0].woke).toBe(1);
    expect(t.stealth.active).toBe(false);
    expect(t.seen.at(-1)[0]).toBe('stealthEnd');
  });
});
