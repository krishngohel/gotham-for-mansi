// The two stealth takedowns, as hero controls (like the traversal controls in src/actors/traverse/).
// - silent: Batman steps in behind a goon that hasn't noticed him and chokes it out over 2 s.
//   Goons within 3 m hear it (STEALTH.noise.takedown). If he is hit first he lets go, and the goon wakes up hostile.
// - perchDrop: from a gargoyle, Batman leaps down onto a goon and knocks it out.
// Both hold the goon with 4E's chainHold (no AI, no physics) until it is taken down.
import * as THREE from 'three';
import { STEALTH } from './vision.js';
import { lungePoint } from '../combat/chains.js';
import { CHOKE_OFFSET } from '../actors/stealthAnims.js';

// How far the ground under a spot may sit from the goon's own feet height and still count as
// "the same floor" (a balcony rail or catwalk edge otherwise reads as fine ground a step away).
const EDGE_MARGIN = 0.5;
// Directly behind the goon, then its left and right shoulder (still CHOKE_OFFSET out, just
// rotated round it), tried in that order.
const APPROACH_OFFSETS = [0, Math.PI / 2, -Math.PI / 2];

// Whether a spot CHOKE_OFFSET from the goon at world angle `yaw` is safe to snap Batman to: not
// through a wall, and with ground under it near the goon's own feet height.
function approachOk(h, target, yaw, out) {
  out.set(target.pos.x - Math.sin(yaw) * CHOKE_OFFSET, target.pos.y, target.pos.z - Math.cos(yaw) * CHOKE_OFFSET);
  const trial = new THREE.Vector3(out.x, out.y, out.z);
  const r = h.collision.resolveCylinder(trial, 0.35, 1.8);
  if (r?.hitWall) return false;
  const ground = h.collision.groundBelow(out.x, target.pos.y + EDGE_MARGIN, out.z, 0.3);
  return ground > -Infinity && Math.abs(ground - target.pos.y) <= EDGE_MARGIN;
}

// Where Batman can snap in to choke this goon: directly behind it, or a shoulder side if behind
// is walled off or would leave him hanging past an edge. Null if nowhere round the goon works,
// so the caller can fall back to a normal attack instead of floating him off a roof.
function pickApproach(h, target) {
  const spot = new THREE.Vector3();
  for (const off of APPROACH_OFFSETS) {
    if (approachOk(h, target, target.yaw + off, spot)) return { spot, yaw: target.yaw + off };
  }
  return null;
}

export function createSilentTakedown(h, api, { target, rules = STEALTH }) {
  const dur = rules.silentTime;
  const from = h.pos.clone();
  const approach = pickApproach(h, target);
  if (!approach) return null; // no side of the goon is safe to snap to: let combat try a normal attack instead
  const spot = approach.spot;
  const head = new THREE.Vector3();
  let t = 0, done = false;
  target.chainHold();
  h.vel.set(0, 0, 0);
  h.bat.face(approach.yaw);
  h.bat.animator.play('Takedown_Choke', { once: true, fade: 0.1 });
  target.ch.animator.play('Choked', { once: true, fade: 0.1 });
  api.events.emit('silentStart', { target });
  api.noise(target.pos, rules.noise.takedown, 'takedown');
  return {
    name: 'silent', camera: 'takedown', combat: true, keepCrouch: true, target,
    canChain: () => done && t >= dur + 0.15,
    update(dt) {
      t += dt;
      if (!done) {
        const k = Math.min(1, t / 0.2);
        h.pos.set(from.x + (spot.x - from.x) * k, from.y, from.z + (spot.z - from.z) * k);
        h.collision.resolveCylinder(h.pos, 0.35, 1.8, { prevY: from.y });
        if (!target.alive) { done = true; return true; }
        if (t >= dur) {
          done = true;
          target.chainRelease();
          target.ch.headWorld(head, 0.2);
          api.takedown(target, 'silent', { crit: false });
          api.events.emit('word', { text: 'NIGHTY NIGHT!', pos: head, big: false });
          api.events.emit('silentTakedown', { target });
        }
      }
      return done && t >= dur + 0.3;
    },
    // Hit mid-choke (combatSystem's onAttackLand): let go, and the goon knows Batman is here.
    knockOff() {
      if (done) return;
      done = true;
      target.chainRelease();
      target.wake();
      api.events.emit('silentBroken', { target });
    },
  };
}

// Where Batman lands beside the goon: the side he's facing in from, or (if that's walled off or
// off an edge) the goon's other side, or (last resort) right where the goon stood, in that order.
function landingSpot(h, target, out) {
  const yaw = h.bat.yaw;
  const candidates = [
    [target.pos.x - Math.sin(yaw) * 0.6, target.pos.z - Math.cos(yaw) * 0.6],
    [target.pos.x + Math.sin(yaw) * 0.6, target.pos.z + Math.cos(yaw) * 0.6],
    [target.pos.x, target.pos.z],
  ];
  for (const [x, z] of candidates) {
    const trial = new THREE.Vector3(x, target.pos.y, z);
    const r = h.collision.resolveCylinder(trial, 0.35, 1.8);
    if (r?.hitWall) continue;
    const ground = h.collision.groundBelow(x, target.pos.y + EDGE_MARGIN, z, 0.3);
    if (ground > -Infinity && Math.abs(ground - target.pos.y) <= EDGE_MARGIN) { out.set(x, ground, z); return; }
  }
  // Every candidate failed (shouldn't happen: the goon is standing on the last one): land on it
  // anyway rather than leave Batman stuck mid-air.
  const [x, z] = candidates[candidates.length - 1];
  out.set(x, target.pos.y, z);
}

export function createPerchDrop(h, api, { target, rules = STEALTH }) {
  const from = h.pos.clone();
  const land = { x: target.pos.x, y: target.pos.y + 1.0, z: target.pos.z };
  const drop = from.y - target.pos.y;
  const dur = Math.min(0.75, Math.max(0.4, 0.3 + drop * 0.035));
  const at = { x: 0, y: 0, z: 0 };
  const head = new THREE.Vector3();
  const landPos = new THREE.Vector3();
  let t = 0, hit = false;
  target.chainHold();
  h.vel.set(0, 0, 0);
  h.setState('air');
  h.grounded = false;
  h.bat.face(Math.atan2(target.pos.x - from.x, target.pos.z - from.z));
  h.bat.animator.play('NinjaJump_Start', { once: true, fade: 0.05 });
  api.events.emit('perchDropStart', { target });
  return {
    name: 'perchDrop', camera: 'drop', combat: true, target,
    canChain: () => hit && t > dur + 0.2,
    update(dt) {
      t += dt;
      if (!hit) {
        lungePoint(from, land, t / dur, 1.2, at, 'in');
        h.pos.set(at.x, at.y, at.z);
        if (t >= dur) {
          hit = true;
          target.chainRelease();
          target.ch.headWorld(head, 0);
          api.takedown(target, 'perch', { crit: true });
          landingSpot(h, target, landPos);
          h.pos.copy(landPos);
          h.vel.set(0, 0, 0);
          h.grounded = true;
          h.setState('ground');
          h.bat.animator.play('NinjaJump_Land', { once: true, fade: 0.05 });
          api.noise(target.pos, rules.noise.perch, 'perch');
          api.events.emit('word', { text: 'KRUNCH!', pos: head, big: true });
          api.events.emit('perchDrop', { target });
        }
      }
      return hit && t > dur + 0.35;
    },
    knockOff() { if (!hit) { hit = true; target.chainRelease(); } },
  };
}
