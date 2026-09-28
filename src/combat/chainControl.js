// A chain takedown in progress, as hero.control (name 'chain'). It plays a timeline from
// chainTimeline.js: Batman lunges between the chained goons (collision-resolved, and a ground
// lunge never carries him off an edge), each clip starts so its contact frame lands on the
// step's contact, and each effect lands through `api` (built by combatSystem.js) so chains share
// the normal hit bookkeeping. The finisher gets the slow-motion action shot.
import * as THREE from 'three';
import { strikeSpot, midSpot, backSpot, lungePoint, chainHearers } from './chains.js';

const HERO_R = 0.35, HERO_H = 1.8;
const LEDGE_DROP = 0.5; // same guard as a strike lunge: never step down more than this
const GRIP_OPEN = 0.62, GRIP_SHUT = 0.24, SNAP_TIME = 0.08, PULL_TIME = 0.18;
// The action camera per chain: wide over the tangled heap, tight on the heads, high over the crater.
export const CHAIN_SHOTS = {
  rope: { dist: 4.6, lift: 0.9, back: 1.6 },
  head: { dist: 2.4, lift: -0.25, back: 0.5 },
  domino: { dist: 3.8, lift: 2.6, back: 1.0 },
};
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const live = (e) => !!e && e.alive;

export function createChainControl(hero, api, { chain, targets, stealth, timeline }) {
  const { events, collision } = api;
  const steps = timeline.steps;
  const n = targets.length;
  const floorY = hero.pos.y;
  // Scratch, allocated once per chain: nothing below allocates per frame.
  const from = new THREE.Vector3(), to = new THREE.Vector3(), center = new THREE.Vector3(), at = new THREE.Vector3();
  const planned = new THREE.Vector3(), prev = new THREE.Vector3();
  const lp = { x: 0, y: 0, z: 0 };
  const gripStarts = [new THREE.Vector3(), new THREE.Vector3()];
  const pullStarts = targets.map(() => new THREE.Vector3()), pullEnds = targets.map(() => new THREE.Vector3());
  let i = 0, t = 0, entered = false, clipOn = false, landed = false, ground = false, done = false;
  // Headbanger: Batman holds the first two goons by the head from the grab to the smash.
  let gripOn = false, gripT = 0, gripUx = 0, gripUz = 1;
  // Rope-a-Dope yank: the goons accelerate into each other.
  let pullOn = false, pullT = 0;

  for (const e of targets) api.hold(e);
  hero.invulnerable = Math.max(hero.invulnerable, timeline.duration + 0.4);
  hero.vel.set(0, 0, 0);
  hero.cape.setWings(false);
  hero.bat.tilt.rotation.set(0, 0, 0);

  const targetOf = (s) => (s.target === 'pile' ? null : targets[s.target]);
  const faceTo = (x, z) => hero.bat.face(Math.atan2(x - hero.pos.x, z - hero.pos.z));
  const hand = (out) => hero.bat.bone('hand_r').getWorldPosition(out);
  function updateCenter() {
    let x = 0, z = 0;
    for (let j = 0; j < n; j++) { x += targets[j].pos.x; z += targets[j].pos.z; }
    center.set(x / n, floorY, z / n);
  }
  const drops = (x, z) => collision.groundBelow(x, floorY + 0.45, z, HERO_R * 0.6) < floorY - LEDGE_DROP;

  function enter(s) {
    entered = true; clipOn = false; landed = false;
    from.copy(hero.pos);
    planned.copy(hero.pos);
    updateCenter();
    const e = targetOf(s);
    switch (s.at) {
      case 'strike': to.copy(live(e) ? strikeSpot(hero.pos, e.pos, s.stop * e.scale) : hero.pos); to.y = floorY; break;
      case 'between': to.copy(midSpot(targets[0].pos, targets[1].pos)); to.y = floorY; break;
      // A goon something else already knocked out has no head to stand on: land where he lies.
      case 'head': to.set(e.pos.x, live(e) ? e.pos.y + 1.85 * e.scale : floorY, e.pos.z); break;
      case 'back': to.copy(backSpot(center, hero.pos, s.stop)); to.y = floorY; break;
      case 'apex': to.set(center.x, floorY + s.stop, center.z); break;
      case 'pile': to.copy(center); break;
      default: to.copy(hero.pos);
    }
    // A lunge that ends on the floor ends on this floor: pull a spot past an edge back along
    // the lunge until there is ground under it (where he started always has).
    const floorSpot = s.at === 'strike' || s.at === 'between' || s.at === 'back';
    if (floorSpot && drops(to.x, to.z)) {
      const tx = to.x, tz = to.z;
      to.copy(from);
      for (let k = 7; k >= 1; k--) {
        const x = from.x + ((tx - from.x) * k) / 8, z = from.z + ((tz - from.z) * k) / 8;
        if (!drops(x, z)) { to.set(x, floorY, z); break; }
      }
    }
    ground = floorSpot && s.arc === 0;
    if (s.at === 'between') {
      // Arms span the two goons: face across the line between them, whichever way is nearer.
      const a = targets[0].pos, b = targets[1].pos;
      const yaw = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
      hero.bat.face(Math.abs(angleDiff(yaw, hero.bat.yaw)) < Math.PI / 2 ? yaw : yaw + Math.PI);
    } else if (s.at !== 'stay') {
      // A step that stays put (the Headbanger smash) keeps the facing it has.
      if (e) faceTo(e.pos.x, e.pos.z); else faceTo(center.x, center.z);
    }
  }

  // The plan is applied as per-frame deltas on top of the resolved position (as strike lunges
  // do), so a wall push-out is kept rather than recomputed through the wall.
  function move(s) {
    lungePoint(from, to, t / s.lunge, s.arc, lp, s.ease);
    prev.copy(hero.pos);
    hero.pos.x += lp.x - planned.x;
    hero.pos.z += lp.z - planned.z;
    hero.pos.y = lp.y;
    planned.set(lp.x, lp.y, lp.z);
    const r = collision.resolveCylinder(hero.pos, HERO_R, HERO_H, { prevY: prev.y });
    // A ground lunge never carries Batman off an edge: where the floor drops away, he stops.
    if (ground && r && r.groundY < floorY - LEDGE_DROP) hero.pos.copy(prev);
  }

  function startGrip() {
    const a = targets[0], b = targets[1];
    const ux = b.pos.x - a.pos.x, uz = b.pos.z - a.pos.z, d = Math.hypot(ux, uz) || 1;
    gripOn = true; gripT = 0; gripUx = ux / d; gripUz = uz / d;
    gripStarts[0].copy(a.pos);
    gripStarts[1].copy(b.pos);
    if (live(a)) a.ch.animator.play('Hit_Head', { once: true, timeScale: 0.45, fade: 0.05 });
    if (live(b)) b.ch.animator.play('Hit_Head', { once: true, timeScale: 0.45, fade: 0.05 });
  }
  // Both goons snap to Batman's hands, then squeeze in as the smash reaches its contact frame.
  function holdGrip(dt, s) {
    if (!gripOn) return;
    gripT += dt;
    const squeeze = s.effect === 'headSmash' ? Math.min(1, t / Math.max(1e-6, s.contact)) : 0;
    const gap = GRIP_OPEN + (GRIP_SHUT - GRIP_OPEN) * squeeze * squeeze;
    const snap = Math.min(1, gripT / SNAP_TIME);
    for (let j = 0; j < 2; j++) {
      const e = targets[j];
      if (!live(e)) continue;
      const side = j === 0 ? -1 : 1;
      const x = hero.pos.x + gripUx * gap * side, z = hero.pos.z + gripUz * gap * side;
      e.pos.x = gripStarts[j].x + (x - gripStarts[j].x) * snap;
      e.pos.z = gripStarts[j].z + (z - gripStarts[j].z) * snap;
      e.ch.face(Math.atan2(-side * gripUx, -side * gripUz));
    }
  }

  function startPull() {
    updateCenter();
    pullOn = true; pullT = 0;
    for (let j = 0; j < n; j++) {
      const e = targets[j], a = (j / n) * Math.PI * 2;
      pullStarts[j].copy(e.pos);
      pullEnds[j].set(center.x + Math.sin(a) * 0.35, e.pos.y, center.z + Math.cos(a) * 0.35);
      if (live(e)) e.ch.animator.play('Hit_Chest', { once: true, timeScale: 1.6, fade: 0.05 });
    }
  }
  function stepPull(dt) {
    if (!pullOn) return;
    pullT += dt;
    const k = Math.min(1, pullT / PULL_TIME);
    for (let j = 0; j < n; j++) if (live(targets[j])) targets[j].pos.lerpVectors(pullStarts[j], pullEnds[j], k * k);
    if (k >= 1) pullOn = false;
  }

  function land(s) {
    const e = targetOf(s);
    // A step aimed at a goon that something else already knocked out lands nothing (no word).
    const hit = !e || live(e);
    if (s.hitStop && hit) api.time.hitStop(s.hitStop);
    if (e) e.ch.headWorld(at, 0.3); else at.set(center.x, center.y + 1.6, center.z);
    switch (s.effect) {
      case 'stagger': if (live(e)) api.stagger(e); break;
      case 'tether': api.fx?.fire(hand, targets, 0.22); events.emit('chainTether'); break;
      case 'yank': startPull(); events.emit('chainYank'); break;
      case 'tie': {
        // Finish the yank exactly (frame timing can leave it a hair short), then tie them.
        if (pullOn) { pullT = PULL_TIME; stepPull(0); }
        const list = targets.filter(live);
        api.tie(list);
        api.fx?.bind(list);
        break;
      }
      case 'grab': startGrip(); events.emit('chainGrab'); break;
      case 'headSmash':
        gripOn = false;
        for (let j = 0; j < 2; j++) if (live(targets[j])) api.finish(targets[j], { power: 0.5 });
        events.emit('chainSmash', { pos: at.clone() });
        break;
      case 'heel': if (live(e)) api.finish(e, { power: 1.8, launch: 4 }); break;
      case 'stomp': if (live(e)) { api.finish(e, { power: 0.3 }); events.emit('chainStomp'); } break;
      case 'diveBomb': api.shockwave(center, 4.5, { crit: false, word: null }); break;
      default: break;
    }
    if (s.thenClip) hero.bat.animator.play(s.thenClip, { once: true, timeScale: 0.9, fade: 0.04 });
    if (s.word && hit) api.word(s.word, at, s.finisher);
    const focus = e ?? targets.find(live) ?? targets[0];
    if (s.finisher) api.critical(focus, { slow: 0.9, scale: 0.25, shot: CHAIN_SHOTS[chain.id], variant: chain.id });
    else if (s.effect === 'heel') api.critical(focus, { slow: 0.35, scale: 0.4, variant: chain.id });
    events.emit('chainContact', { chain: chain.id, effect: s.effect, index: i });
  }

  function finish() {
    done = true;
    gripOn = false;
    pullOn = false;
    const g = collision.groundBelow(hero.pos.x, hero.pos.y + 0.5, hero.pos.z, 0.3);
    const airborne = g === -Infinity || hero.pos.y - g > 0.3;
    if (!airborne) hero.pos.y = g;
    hero.vel.set(0, 0, 0);
    hero.grounded = !airborne;
    hero.setState(airborne ? 'air' : 'ground');
    hero.invulnerable = Math.min(hero.invulnerable, 0.3);
    for (const e of targets) api.release(e);
    // Silent from stealth: only unaware goons close to where it ended hear it.
    if (stealth) for (const e of chainHearers(hero.pos, api.enemies(), targets)) e.wake();
    events.emit('chainDone', { chain: chain.id, count: targets.length, stealth });
  }

  return {
    name: 'chain', camera: 'chain', combat: true, chain: chain.id, targets,
    // A chain isn't cut short by another move; it hands control back when it's over.
    canChain: () => false,
    update(dt) {
      if (done) return true;
      t += dt;
      const s = steps[i];
      if (!entered) enter(s);
      // Frames rarely fall exactly on clipStart: start the clip as far in as the frame is late,
      // so its contact frame still lands exactly on the step's contact. hero.js advances the
      // mixer by dt right after this update, so the clip starts one frame's worth earlier (up to
      // dt * speed before its first frame). The floor keeps it positive after that same-frame
      // mixer step: a LoopOnce action still below 0 then would finish on its first frame.
      if (s.clip && !clipOn && t >= s.clipStart) {
        clipOn = true;
        const startAt = Math.max((t - dt - s.clipStart) * s.speed, 1e-6 - dt * s.speed);
        hero.bat.animator.play(s.clip, { once: true, timeScale: s.speed, fade: 0.05, startAt });
      }
      if (s.lunge > 0 && s.at !== 'stay') move(s);
      holdGrip(dt, s);
      stepPull(dt);
      if (!landed && t >= s.contact) { landed = true; land(s); }
      if (t >= s.dur) {
        t -= s.dur;
        i += 1;
        entered = false;
        if (i >= steps.length) { finish(); return true; }
      }
      return false;
    },
  };
}
