// tests/unit/stealthSystem.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStealth } from '../../src/stealth/stealthSystem.js';
import { createEvents } from '../../src/core/events.js';
import { createRng } from '../../src/core/rng.js';
import { LINES } from '../../src/stealth/brain.js';
import { tracker, moveList, BASE_MOVES } from '../../src/game/progressTracker.js';
import { sanitizeProgress, BALLOON_COUNT, DISTRICT_IDS } from '../../src/core/save.js';
import { STEPS } from '../../src/game/story.js';
import { CHALLENGES } from '../../src/game/challenges.js';

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
  it('nobody sees Batman through the smoke cloud until it clears', () => {
    const t = setup();
    t.step(3);
    expect(t.stealth.alarm).toBe(true);
    t.events.emit('smoke', { pos: { x: 0, y: 0, z: 10 }, radius: 2.5 });
    t.step(2);
    expect(t.stealth.alarm).toBe(false);
    expect(t.goons.some((e) => e.seesHero)).toBe(false);
    t.step(5);
    expect(t.stealth.alarm).toBe(true);
  });
  it('the cloud lasts as long as the smoke event says', () => {
    const t = setup();
    t.step(3);
    t.events.emit('smoke', { pos: { x: 0, y: 0, z: 10 }, radius: 2.5, life: 2 });
    t.step(1.5);
    expect(t.stealth.alarm).toBe(false);
    t.step(3);
    expect(t.stealth.alarm).toBe(true);
  });
  it('a room that begins again forgets the last smoke cloud', () => {
    const t = setup();
    t.step(3);
    t.events.emit('smoke', { pos: { x: 0, y: 0, z: 10 }, radius: 2.5 });
    t.stealth.begin({ stealth: 'test', squad: 'main' }, t.goons, ROOM);
    t.step(3);
    expect(t.stealth.alarm).toBe(true);
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
  it('a scared goon on another floor than the huddle keeps to its route instead of freezing at the rail', () => {
    const room = { ...ROOM, squad: [...ROOM.squad.slice(0, 2), { type: 'grunt', route: { mode: 'pingpong', points: [W(-10, 7, 0), W(-10, 7, -8)] } }] };
    const t = setup({ room, hero: [0, 0, -30] });
    t.step(0.1);
    t.goons[0].alive = false;
    t.step(0.1);
    const [, hx, hz] = t.goons[1].calls.at(-1);
    expect(Math.hypot(hx - 0, hz + 10)).toBeCloseTo(1.6, 1);
    const [state, x] = t.goons[2].calls.at(-1);
    expect(state).toBe('patrol');
    expect(x).toBe(-10);
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
  it('a punch just after the takedown prompt went away still takes the goon down, a little farther off', () => {
    const t = setup({ hero: [0, 0, -1.5] });
    t.step(0.1);
    expect(t.stealth.prompt).toBe('silent');
    t.hero.pos.z = -1.85; // the goon walked on: 1.85 m is past the 1.6 m reach, inside 1.2 times it
    t.step(0.1);
    expect(t.stealth.prompt).toBe(null);
    expect(t.stealth.start('punch')).toBe(true);
    expect(t.hero.control.name).toBe('silent');
    // Too late: a quarter second after the prompt went away the grace is over.
    const late = setup({ hero: [0, 0, -1.5] });
    late.step(0.1);
    late.hero.pos.z = -1.85;
    late.step(0.4);
    expect(late.stealth.start('punch')).toBe(false);
    // The grace needs the prompt to have been up: standing at 1.85 m from the start is no takedown.
    const never = setup({ hero: [0, 0, -1.85] });
    never.step(0.1);
    expect(never.stealth.start('punch')).toBe(false);
    // And it adds reach, not much: 2.1 m is out even straight after the prompt.
    const far = setup({ hero: [0, 0, -1.5] });
    far.step(0.1);
    far.hero.pos.z = -2.1;
    far.step(0.05);
    expect(far.stealth.start('punch')).toBe(false);
  });
  it('in a quiet room a punch that would land on an unaware goon is swallowed with a hint', () => {
    const t = setup({ hero: [0, 0, 3] });
    expect(t.stealth.hold('punch', t.goons[0])).toBe(true);
    expect(names(t.seen, 'hint')).toEqual([['hint', 'silent-miss']]);
    // Kicks still go loud; aware, stunned, down or outside goons take a normal punch.
    expect(t.stealth.hold('kick', t.goons[0])).toBe(false);
    t.goons[1].aware = true;
    expect(t.stealth.hold('punch', t.goons[1])).toBe(false);
    t.goons[2].stunned = true;
    expect(t.stealth.hold('punch', t.goons[2])).toBe(false);
    const stranger = { ...t.goons[0], room: null };
    expect(t.stealth.hold('punch', stranger)).toBe(false);
    expect(t.stealth.hold('punch', null)).toBe(false);
  });
  it('after an alarm, or outside a room, punches are normal again', () => {
    const t = setup({ hero: [0, 0, 3] });
    t.events.emit('impact', { target: t.goons[1], outcome: 'parried' });
    expect(t.stealth.alarm).toBe(true);
    expect(t.stealth.hold('punch', t.goons[0])).toBe(false);
    const u = setup({ hero: [0, 0, 3] });
    u.stealth.end();
    expect(u.stealth.hold('punch', u.goons[0])).toBe(false);
    expect(names(t.seen, 'hint').concat(names(u.seen, 'hint'))).toEqual([]);
  });
  it('outside a room a perched kick with nobody below is a normal kick; a drop still works', () => {
    const t = setup({ perches: [{ x: 0, y: 6, z: 2, perch: true }], hero: [0, 6, 2] });
    t.stealth.end();
    for (const e of t.goons) e.pos.x += 40;
    t.step(0.1);
    expect(t.hero.perched).toBe(true);
    expect(t.stealth.start('kick')).toBe(false);
    expect(t.stealth.start('punch')).toBe(false);
    expect(names(t.seen, 'hint')).toEqual([]);
    const u = setup({ perches: [{ x: 0, y: 6, z: 2, perch: true }], hero: [0, 6, 2] });
    u.stealth.end();
    u.step(0.1);
    expect(u.stealth.start('kick')).toBe(true);
    expect(u.hero.control.name).toBe('perchDrop');
  });
  it('registers the stealth moves so a finished old save keeps 100% and an early one counts 10', () => {
    const at = (id) => STEPS.findIndex((x) => x.id === id);
    expect(moveList()).toEqual([...BASE_MOVES, 'silentTakedown', 'perchDrop']);
    const done = sanitizeProgress({
      step: at('credits'), finished: true, balloons: [...Array(BALLOON_COUNT).keys()],
      challenges: Object.fromEntries(CHALLENGES.map((c) => [c.id, { best: 1, medal: 'gold' }])),
      crimes: { stopped: 10 }, moves: BASE_MOVES, districts: DISTRICT_IDS,
    });
    expect(tracker.score(done).percent).toBe(100);
    const early = tracker.score(sanitizeProgress({ step: at('party'), moves: BASE_MOVES })).parts.find((x) => x.id === 'moves');
    expect(early).toMatchObject({ done: 8, total: 10 });
  });
  it('a room that ends mid-takedown (a restart, a story jump) drops the takedown and lets go of the goon', () => {
    const t = setup({ hero: [0, 0, -1.2] });
    expect(t.stealth.start('punch')).toBe(true);
    expect(t.goons[0].state).toBe('chained');
    t.stealth.end();
    expect(t.hero.control).toBe(null);
    expect(t.goons[0].state).not.toBe('chained');
    const u = setup({ perches: [{ x: 0, y: 6, z: 2, perch: true }], hero: [0, 6, 2] });
    u.step(0.1);
    expect(u.stealth.start('kick')).toBe(true);
    u.stealth.end();
    expect(u.hero.control).toBe(null);
    expect(u.goons[0].state).not.toBe('chained');
  });
  it('a takedown that has already landed keeps playing out when the room ends', () => {
    const t = setup({ hero: [0, 0, -1.2] });
    t.stealth.start('punch');
    const ctl = t.hero.control;
    for (let i = 0; i < 130; i++) ctl.update(1 / 60);
    expect(t.goons[0].alive).toBe(false);
    t.stealth.end();
    expect(t.hero.control).toBe(ctl);
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
