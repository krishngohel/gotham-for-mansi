// tests/unit/chainControl.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createChainControl } from '../../src/combat/chainControl.js';
import { buildChainTimeline, STOCK_BEATS, CHAIN_BEATS } from '../../src/combat/chainTimeline.js';
import { CHAINS } from '../../src/combat/chains.js';

function fakeGoon(id, x, z, o = {}) {
  const pos = new THREE.Vector3(x, 0, z);
  const g = {
    id, type: 'grunt', def: {}, alive: true, down: false, aware: true, state: 'engage', scale: 1, radius: 0.42, pos,
    ch: { face() {}, headWorld: (out, lift = 0) => out.set(pos.x, pos.y + 1.7 + lift, pos.z), animator: { play() {} } },
    wake() { g.aware = true; },
    ...o,
  };
  return g;
}
function fakeHero() {
  const bat = {
    yaw: 0, face(y) { bat.yaw = y; }, tilt: { rotation: { set() {} } },
    bone: () => ({ getWorldPosition: (o) => o.set(0, 1.4, 0) }),
    animator: { played: [], play(n) { bat.animator.played.push(n); } },
  };
  return { pos: new THREE.Vector3(), vel: new THREE.Vector3(), invulnerable: 0, grounded: true, state: 'ground', cape: { setWings() {} }, bat, setState(s) { this.state = s; } };
}
function fakeApi(log, enemies) {
  const emitted = [];
  return {
    emitted,
    events: { emit: (n, d) => emitted.push([n, d]) },
    collision: { resolveCylinder: () => ({ groundY: 0, hitWall: false }), groundBelow: () => 0 },
    time: { hitStop: (s) => log.push(['hitStop', s]) },
    fx: null,
    enemies: () => enemies,
    hold: (e) => { e.state = 'chained'; log.push(['hold', e.id]); },
    release: (e) => { if (e.state === 'chained') e.state = 'engage'; },
    stagger: (e) => log.push(['stagger', e.id]),
    finish: (e) => { log.push(['finish', e.id, e.pos.clone()]); e.alive = false; e.state = 'ko'; return 'ko'; },
    tie: (list) => { for (const e of list) { e.state = 'tied'; e.down = true; } log.push(['tie', list.map((e) => e.id)]); },
    critical: (e, o) => log.push(['critical', e.id, o.variant, !!o.shot]),
    shockwave: (c, r, o) => { log.push(['shockwave', r, o]); return 0; },
    word: (text) => log.push(['word', text]),
  };
}
function run(id, targets, { stealth = false, others = [] } = {}) {
  const log = [];
  const hero = fakeHero();
  const api = fakeApi(log, [...targets, ...others]);
  const chain = CHAINS.find((c) => c.id === id);
  const ctl = createChainControl(hero, api, { chain, targets, stealth, timeline: buildChainTimeline(id, targets.length) });
  let frames = 0, maxY = 0, maxDist = 0, done = false;
  while (!done && frames++ < 600) {
    done = ctl.update(1 / 60);
    maxY = Math.max(maxY, hero.pos.y);
    maxDist = Math.max(maxDist, Math.hypot(hero.pos.x, hero.pos.z));
  }
  return { log, hero, api, ctl, done, maxY, maxDist };
}
const squad = () => [fakeGoon('g0', 0, 2), fakeGoon('g1', 1.5, 3.5), fakeGoon('g2', -1, 4.5)];
const of = (log, kind) => log.filter((l) => l[0] === kind);

describe('chain control', () => {
  it('is the hero control named chain with the chain camera', () => {
    const ctl = createChainControl(fakeHero(), fakeApi([], []), { chain: CHAINS[0], targets: squad(), stealth: false, timeline: buildChainTimeline('rope', 3) });
    expect(ctl).toMatchObject({ name: 'chain', camera: 'chain', combat: true, chain: 'rope' });
    expect(ctl.canChain()).toBe(false);
  });

  it('Rope-a-Dope holds, strikes each goon in order, then ties them all', () => {
    const { log, done, hero, api } = run('rope', squad());
    expect(done).toBe(true);
    expect(of(log, 'hold').map((l) => l[1])).toEqual(['g0', 'g1', 'g2']);
    expect(of(log, 'stagger').map((l) => l[1])).toEqual(['g0', 'g1', 'g2']);
    expect(of(log, 'tie')[0][1]).toEqual(['g0', 'g1', 'g2']);
    expect(of(log, 'critical')).toEqual([['critical', 'g0', 'rope', true]]);
    expect(of(log, 'word').map((l) => l[1])).toEqual(['THWIP!', 'TANGLED!']);
    expect(api.emitted.filter(([n]) => n === 'chainContact').map(([, d]) => d.effect)).toEqual(['stagger', 'stagger', 'stagger', 'tether', 'yank', 'tie']);
    expect(api.emitted.at(-1)[0]).toBe('chainDone');
    expect(hero.state).toBe('ground');
    expect(hero.invulnerable).toBeLessThanOrEqual(0.3);
  });

  it('Rope-a-Dope pulls the goons together before tying them', () => {
    const targets = squad();
    run('rope', targets);
    const spread = Math.max(...targets.map((a) => Math.max(...targets.map((b) => a.pos.distanceTo(b.pos)))));
    expect(spread).toBeLessThan(1);
  });

  it('Headbanger smashes the first two heads together, then heels the third', () => {
    const { log } = run('head', squad());
    const fin = of(log, 'finish');
    expect(fin.map((l) => l[1])).toEqual(['g0', 'g1', 'g2']);
    expect(fin[0][2].distanceTo(fin[1][2])).toBeLessThan(0.6);
    expect(of(log, 'critical').map((l) => l[2])).toEqual(['head', 'head']);
    expect(of(log, 'word').map((l) => l[1])).toEqual(['KONK!', 'THWACK!']);
  });

  it('Headbanger keeps facing across the two goons from the grab through the smash', () => {
    // The smash step stays put: it must not turn Batman to face goon 2, which would swing the two
    // held goons from his hands to in front of and behind him.
    const log = [];
    const hero = fakeHero();
    const targets = squad();
    const api = fakeApi(log, targets);
    const finish = api.finish;
    api.finish = (e) => { log.push(['at', e.id, e.pos.x - hero.pos.x, e.pos.z - hero.pos.z, hero.bat.yaw]); return finish(e); };
    const ctl = createChainControl(hero, api, { chain: CHAINS[1], targets, stealth: false, timeline: buildChainTimeline('head', 3) });
    for (let f = 0; f < 600 && !ctl.update(1 / 60); f++);
    const smash = of(log, 'at').slice(0, 2);
    expect(smash.map((l) => l[1])).toEqual(['g0', 'g1']);
    const side = smash.map(([, , dx, dz, yaw]) => {
      const fwd = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      expect(Math.abs(fwd)).toBeLessThan(0.05);
      return dx * Math.cos(yaw) - dz * Math.sin(yaw);
    });
    expect(Math.abs(side[0])).toBeGreaterThan(0.2);
    expect(Math.sign(side[0])).toBe(-Math.sign(side[1]));
  });

  it('Domino Drop stomps each head, bounces high and dive-bombs the pile', () => {
    const { log, maxY, hero } = run('domino', squad());
    expect(of(log, 'finish').map((l) => l[1])).toEqual(['g0', 'g1', 'g2']);
    const sw = of(log, 'shockwave')[0];
    expect(sw[1]).toBe(4.5);
    expect(sw[2]).toMatchObject({ crit: false, word: null });
    expect(maxY).toBeGreaterThan(5);
    expect(hero.pos.y).toBeCloseTo(0);
    expect(hero.bat.animator.played).toContain('NinjaJump_Land');
  });

  it('keeps Batman near the fight', () => {
    for (const id of ['rope', 'head', 'domino']) expect(run(id, squad()).maxDist).toBeLessThan(9);
  });

  it('skips a goon knocked out by something else mid-chain and still finishes', () => {
    const targets = squad();
    targets[1].alive = false;
    const { log, done, api } = run('domino', targets);
    expect(done).toBe(true);
    expect(of(log, 'finish').map((l) => l[1])).toEqual(['g0', 'g2']);
    // No stomp sound on a goon who is already down.
    expect(api.emitted.filter(([n]) => n === 'chainStomp')).toHaveLength(2);
  });

  it('a stealth chain wakes only unaware goons within 8 m of where it ends', () => {
    const near = fakeGoon('near', 0, 9, { aware: false, state: 'idle' });
    const far = fakeGoon('far', 0, 40, { aware: false, state: 'idle' });
    run('domino', squad(), { stealth: true, others: [near, far] });
    expect(near.aware).toBe(true);
    expect(far.aware).toBe(false);
  });
  it('starts each clip so its contact frame lands on the step contact, whatever the frame rate', () => {
    // Same order as hero.js: the control updates, then the mixer advances every playing clip by
    // dt * speed in the same frame (including a clip the control started this frame). Hit-stop
    // frames (dt = 0) freeze both alike.
    const schedules = [[1 / 60], [1 / 37], [1 / 60, 0, 1 / 45, 0, 0, 1 / 30]];
    for (const id of ['rope', 'head', 'domino']) {
      for (const schedule of schedules) {
        const hero = fakeHero();
        const plays = [];
        let now = 0, cur = null;
        hero.bat.animator.play = (name, o) => { cur = { name, time: o.startAt ?? 0, speed: o.timeScale, at: null, time0: null }; plays.push(cur); };
        const timeline = buildChainTimeline(id, 3);
        const ctl = createChainControl(hero, fakeApi([], squad()), { chain: CHAINS.find((c) => c.id === id), targets: squad(), stealth: false, timeline });
        for (let f = 0; f < 2000; f++) {
          const dt = schedule[f % schedule.length];
          now += dt;
          const done = ctl.update(dt);
          if (cur) {
            cur.time += dt * cur.speed;
            // A LoopOnce action whose time is still negative after a real step finishes at frame 0.
            if (dt > 0) expect(cur.time).toBeGreaterThanOrEqual(0);
            if (cur.at === null) { cur.at = now; cur.time0 = cur.time; }
          }
          if (done) break;
        }
        const beats = { ...STOCK_BEATS, ...CHAIN_BEATS };
        let checked = 0;
        for (const s of timeline.steps) {
          const b = s.clip && beats[s.clip];
          if (!b) continue;
          const p = plays.find((q) => q.name === s.clip && q.at >= s.start - 1e-9);
          const clipContact = s.beat ? b[s.beat] : b.contact;
          // The clip's contact frame, in chain time, from the clip time the mixer showed.
          expect(p.at + (clipContact - p.time0) / p.speed).toBeCloseTo(s.start + s.contact, 5);
          checked += 1;
        }
        expect(checked).toBeGreaterThan(0);
      }
    }
  });

  it('a ground lunge never carries Batman off a ledge', () => {
    // The floor ends at z = 0.5; beyond it is a 10 m drop. The goons stand across the gap.
    const edge = 0.5;
    const log = [];
    const hero = fakeHero();
    const targets = squad();
    const api = fakeApi(log, targets);
    api.collision = {
      groundBelow: (x, y, z) => (z > edge ? -10 : 0),
      resolveCylinder: (p) => { const g = p.z > edge ? -10 : 0; if (p.y <= g) p.y = g; return { groundY: g, hitWall: false }; },
    };
    const ctl = createChainControl(hero, api, { chain: CHAINS[0], targets, stealth: false, timeline: buildChainTimeline('rope', 3) });
    let maxZ = -Infinity, done = false;
    for (let f = 0; f < 600 && !done; f++) { done = ctl.update(1 / 60); maxZ = Math.max(maxZ, hero.pos.z); }
    expect(done).toBe(true);
    expect(maxZ).toBeLessThanOrEqual(edge);
    expect(hero.pos.y).toBe(0);
    expect(hero.state).toBe('ground');
  });
});
