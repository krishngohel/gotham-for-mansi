// Predator stealth at run time. Inside a predator room it drives the room's goons on top of the
// normal enemy AI: their patrols, what each one sees (vision.js) and how it reacts (brain.js),
// noises, the alarm and its fall-back, fear, and the lines they call out. Anywhere in the city it
// hands combat the silent takedown and the perch drop (combatSystem's stealthStart hook) and keeps
// hero.perched up to date. Allocation-free per frame: every goon record, sense and goal is built
// in begin(), and line-of-sight rays run at 10 Hz per goon.
import { STEALTH, spotCheck, sightRange, inShadow, inRect, canLook, hears, perchedOn, pickSilentTarget, pickPerchDrop } from './vision.js';
import { HOSTILE, createSquad, createMind, thinkGoon, thinkSquad, alarmAll, smokeReset, struck, noteTakedown, fearSpeed, huddles, pickLine } from './brain.js';
import { createPatrol, stepPatrol, huddleSpot, pickSpot } from './patrol.js';
import { ROOMS, roomSquad, roomSpots } from './stealthRooms.js';
import { createSilentTakedown, createPerchDrop } from './takedowns.js';
import { registerMoves } from '../game/progressTracker.js';

// Plan 3C's progress tracker: the two stealth moves count toward "Moves learned".
registerMoves(['silentTakedown', 'perchDrop']);

const WALK = 1.6, SEARCH = 2.2, HUNT = 3.6;   // m/s before fear
const LOOK_SEARCH = 2.5, LOOK_HUNT = 1.5;     // seconds spent looking round at each spot
const LINE_GAP = 2.2;                         // seconds between two lines called out
const HELD_BY_CHAIN = new Set(['chained', 'tied']);

export function createStealth({ hero, combat, events, collision, perches = [], rng, rules = STEALTH }) {
  let room = null, spots = [];
  let squad = createSquad();
  const goons = [], minds = [];
  const eye = { x: 0, y: 0, z: 0 }, ray = { x: 0, y: 0, z: 0 };
  const view = { pos: hero.pos, crouched: false, perched: false, hidden: false, flying: false };
  const sense = { seesAt: -1, range: rules.range, hero: hero.pos, noise: null };
  let perchT = 0, lineT = 0, lineN = 0, alive = 0, lastAlive = -1;
  let prompt = null, wasPerched = false, wasHidden = false;
  const api = { events, noise, takedown: (e, kind, opts) => combat.takedown(e, kind, opts) };

  function hearAt(g, at) {
    g.noiseAt.x = at.x; g.noiseAt.y = at.y; g.noiseAt.z = at.z;
    g.noise = g.noiseAt;
  }

  function begin(fight, made, def = ROOMS[fight.stealth]) {
    end();
    room = def;
    spots = roomSpots(def);
    squad = createSquad();
    const list = roomSquad(def, fight.squad);
    made.forEach((e, i) => {
      const spec = list[i] ?? list[list.length - 1];
      const g = {
        e, spec, route: spec.route, mind: createMind(), patrol: createPatrol(0),
        goal: { x: e.pos.x, y: e.pos.y, z: e.pos.z, face: null }, look: { x: 0, z: 0 },
        view: { pos: e.pos, yaw: 0, hostile: false },
        seesAt: -1, range: rules.range, losT: (i * 0.1) / Math.max(1, made.length), lookT: 0, rev: -1, slot: i, k: i,
        noise: null, noiseAt: { x: 0, y: 0, z: 0 }, out: false, color: -1, baseWake: e.wake,
      };
      e.room = def.id;
      e.aware = false;
      e.seesHero = false;
      // 4E's chain hearers and a goon getting up call wake(): here that means "go and look".
      e.wake = () => hearAt(g, hero.pos);
      // 5FG's smoke calls e.lose(), which calls e.search(from).
      e.search = (from) => hearAt(g, from);
      goons.push(g);
      minds.push(g.mind);
    });
    lastAlive = -1;
    events.emit('stealthStart', { room: def.id });
  }

  function end() {
    if (!room) return;
    for (const g of goons) { g.e.room = null; g.e.wake = g.baseWake; g.e.search = undefined; g.e.seesHero = undefined; }
    goons.length = 0;
    minds.length = 0;
    room = null;
    spots = [];
    events.emit('stealthEnd');
  }

  function noise(pos, radius, kind = 'noise') {
    if (!room || !radius) return 0;
    let n = 0;
    for (const g of goons) {
      if (!canLook(g.e) || HOSTILE.has(g.mind.alert) || !hears(g.e.pos, pos, radius, rules)) continue;
      hearAt(g, pos);
      n += 1;
    }
    if (n) events.emit('stealthNoise', { pos, radius, kind, count: n });
    return n;
  }

  // How far away this goon sees Batman right now, or -1: the pure checks, then one ray.
  function look(g) {
    const e = g.e;
    g.view.yaw = e.yaw;
    g.view.hostile = HOSTILE.has(g.mind.alert);
    g.range = sightRange({ crouched: view.crouched, shadow: inShadow(hero.pos, room.lights) }, rules);
    const d = spotCheck(g.view, view, room.lights, rules);
    if (d < 0) return -1;
    eye.x = e.pos.x; eye.y = e.pos.y + rules.eye; eye.z = e.pos.z;
    ray.x = hero.pos.x - eye.x;
    ray.y = hero.pos.y + (view.crouched ? rules.crouchChest : rules.chest) - eye.y;
    ray.z = hero.pos.z - eye.z;
    const len = Math.hypot(ray.x, ray.y, ray.z);
    if (len < 0.5) return d;
    ray.x /= len; ray.y /= len; ray.z /= len;
    const hit = collision.raycast(eye, ray, len);
    return hit && hit.t < len - 0.3 ? -1 : d;
  }

  function say(g, kind, force = false) {
    if (!kind || (!force && lineT > 0)) return;
    lineT = LINE_GAP;
    events.emit('stealthLine', { target: g.e, text: pickLine(kind, lineN++) });
  }

  function shout(g) {
    const n = alarmAll(minds, squad);
    for (const o of goons) if (o.e.alive && HOSTILE.has(o.mind.alert)) o.e.aware = true;
    say(g, 'spot', true);
    events.emit('stealthAlarm', { target: g.e, count: n + 1 });
  }

  function lost() {
    let first = null;
    for (const g of goons) {
      if (!g.e.alive || g.mind.alert !== 'search') continue;
      g.e.calm();
      if (!first) first = g;
    }
    if (first) say(first, 'lost', true);
    events.emit('stealthLost');
  }

  function knockedOut(g) {
    g.out = true;
    const fear = noteTakedown(squad);
    let left = 0, speaker = null;
    for (const o of goons) {
      if (!o.e.alive) continue;
      left += 1;
      if (!speaker && canLook(o.e)) speaker = o;
    }
    if (speaker) say(speaker, `fear${fear}`, true);
    events.emit('stealthFear', { fear, left });
  }

  // Steer one goon from its mind: fight, stare, patrol (or huddle), or search and hunt.
  function drive(g, dt) {
    const e = g.e, m = g.mind;
    if (m.alert === 'engage') { e.engageNow(); return; }
    if (!e.canNav()) return;
    const k = fearSpeed(squad.fear);
    if (m.alert === 'suspicious') {
      if (e.aware) e.calm();
      e.lookAt(m.target.x, m.target.z, 'suspicious');
      return;
    }
    if (m.alert === 'patrol') {
      if (e.aware) e.calm();
      if (room.huddle && huddles(squad.fear, alive)) huddleSpot(room.huddle, g.slot, alive, g.goal);
      else stepPatrol(g.patrol, g.route, e.pos, dt, g.goal);
      e.goTo(g.goal.x, g.goal.y, g.goal.z, WALK * k, 'patrol', g.goal.face);
      return;
    }
    const hunt = m.alert === 'hunt';
    if (hunt) e.aware = true;
    else if (e.aware) e.calm();
    if (g.rev !== m.rev) {
      g.rev = m.rev;
      g.goal.x = m.target.x; g.goal.y = m.target.y; g.goal.z = m.target.z;
      g.lookT = 0;
    }
    if (g.lookT > 0) {
      g.lookT -= dt;
      e.lookAt(g.look.x, g.look.z, 'look');
      if (g.lookT <= 0) { g.k += 1; pickSpot(spots, hunt ? squad.lastKnown : m.target, e.pos.y, g.k, g.goal); }
      return;
    }
    const state = hunt ? 'hunt' : 'search';
    if (e.state === state && e.nav.arrived) {
      g.lookT = hunt ? LOOK_HUNT : LOOK_SEARCH;
      const a = rng.next() * Math.PI * 2;
      g.look.x = e.pos.x + Math.sin(a) * 5;
      g.look.z = e.pos.z + Math.cos(a) * 5;
      e.lookAt(g.look.x, g.look.z, 'look');
      return;
    }
    e.goTo(g.goal.x, g.goal.y, g.goal.z, (hunt ? HUNT : SEARCH) * k, state);
  }

  function promptFor() {
    if (hero.dead || hero.control || hero.state !== 'ground' || !hero.grounded) return null;
    if (hero.perched) return pickPerchDrop(hero.pos, combat.enemies, rules) ? 'perch' : null;
    return pickSilentTarget(hero.pos, combat.enemies, rules) ? 'silent' : null;
  }

  function update(dt) {
    if (!dt) return;
    perchT -= dt;
    if (perchT <= 0) {
      perchT = 0.1;
      const on = !hero.dead && hero.grounded && hero.state === 'ground' && !hero.control ? perchedOn(hero.pos, perches, rules) : null;
      hero.perched = !!on;
      if (hero.perched && !wasPerched) events.emit('perched');
      wasPerched = hero.perched;
      prompt = promptFor();
    }
    if (!room) return;
    view.crouched = !!hero.crouched;
    view.perched = hero.perched;
    view.hidden = !!room.vent && !!hero.crouched && inRect(hero.pos, room.vent);
    view.flying = hero.dead || hero.control?.name === 'grapple';
    if (view.hidden && !wasHidden) events.emit('ventHide');
    wasHidden = view.hidden;

    let anySees = false;
    alive = 0;
    for (const g of goons) {
      const e = g.e;
      if (!e.alive) { if (!g.out) knockedOut(g); continue; }
      alive += 1;
      if (!canLook(e)) { g.seesAt = -1; e.seesHero = false; continue; }
      g.losT -= dt;
      if (g.losT <= 0) { g.losT = 0.1; g.seesAt = look(g); e.seesHero = g.seesAt >= 0; }
      if (g.seesAt >= 0) anySees = true;
    }
    if (alive !== lastAlive) {
      let k = 0;
      for (const g of goons) if (g.e.alive) g.slot = k++;
      lastAlive = alive;
    }
    for (const g of goons) {
      const e = g.e;
      if (!e.alive || !canLook(e)) continue;
      sense.seesAt = g.seesAt;
      sense.range = g.range;
      sense.noise = g.noise;
      g.noise = null;
      const ev = thinkGoon(g.mind, squad, sense, dt, rules);
      if (ev === 'shout') shout(g);
      else if (ev) say(g, ev === 'giveUp' ? 'calm' : ev === 'search' ? 'suspect' : ev);
      drive(g, dt);
    }
    if (thinkSquad(squad, minds, anySees, dt, rules) === 'lost') lost();
    lineT = Math.max(0, lineT - dt);
  }

  // combatSystem's stealthStart hook: true when the press was used.
  function start(action) {
    if (hero.dead || hero.state !== 'ground' || !hero.grounded) return false;
    if (action !== 'punch' && action !== 'kick') return false;
    if (hero.perched) {
      const t = pickPerchDrop(hero.pos, combat.enemies, rules);
      if (!t) { events.emit('hint', { id: 'perch-none' }); return true; }
      hero.control = createPerchDrop(hero, api, { target: t, rules });
      return true;
    }
    if (action !== 'punch') return false;
    const t = pickSilentTarget(hero.pos, combat.enemies, rules);
    if (!t) return false;
    // Null when no side of the goon is safe to snap to (a wall, or an edge): a normal punch then.
    const choke = createSilentTakedown(hero, api, { target: t, rules });
    if (!choke) return false;
    hero.control = choke;
    return true;
  }

  events.on('footstep', (d) => { if (room) noise(hero.pos, d?.sprint ? rules.noise.sprint : rules.noise.step, 'step'); });
  events.on('land', (d) => { if (room && d?.hard && d.who === 'hero') noise(hero.pos, rules.noise.land, 'land'); });
  events.on('batarangWall', (d) => { if (room) noise(d.pos, rules.noise.batarang, 'batarang'); });
  events.on('smoke', (d) => {
    if (!room) return;
    smokeReset(minds, squad, d.pos, rules);
    for (const g of goons) if (g.e.alive) g.e.calm();
    events.emit('stealthLost');
  });
  events.on('impact', (d) => {
    const target = d?.target;
    if (!room || !target?.alive || target.room !== room.id || HELD_BY_CHAIN.has(target.state)) return;
    const g = goons.find((x) => x.e === target);
    if (g && struck(g.mind, squad, hero.pos, d.outcome, rules) === 'shout') shout(g);
  });

  return {
    get active() { return !!room; },
    get room() { return room; },
    get alarm() { return squad.alarm; },
    get squad() { return squad; },
    get prompt() { return prompt; },
    goons, rules,
    begin, end, update, noise, start,
    armed() { let n = 0; for (const g of goons) if (g.e.alive && g.e.def?.ranged) n += 1; return n; },
  };
}
