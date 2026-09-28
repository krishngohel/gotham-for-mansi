// The two stealth takedowns, as hero controls (like the traversal controls in src/actors/traverse/).
// - silent: Batman steps in behind a goon that hasn't noticed him and chokes it out over 2 s.
//   Goons within 6 m hear it. If he is hit first he lets go, and the goon wakes up hostile.
// - perchDrop: from a gargoyle, Batman leaps down onto a goon and knocks it out.
// Both hold the goon with 4E's chainHold (no AI, no physics) until it is taken down.
import * as THREE from 'three';
import { STEALTH } from './vision.js';
import { lungePoint } from '../combat/chains.js';
import { CHOKE_OFFSET } from '../actors/stealthAnims.js';

export function createSilentTakedown(h, api, { target, rules = STEALTH }) {
  const dur = rules.silentTime;
  const from = h.pos.clone();
  const spot = new THREE.Vector3(target.pos.x - Math.sin(target.yaw) * CHOKE_OFFSET, from.y, target.pos.z - Math.cos(target.yaw) * CHOKE_OFFSET);
  const head = new THREE.Vector3();
  let t = 0, done = false;
  target.chainHold();
  h.vel.set(0, 0, 0);
  h.bat.face(target.yaw);
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
          api.events.emit('word', { text: 'HRKK!', pos: head, big: false });
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

export function createPerchDrop(h, api, { target, rules = STEALTH }) {
  const from = h.pos.clone();
  const land = { x: target.pos.x, y: target.pos.y + 1.0, z: target.pos.z };
  const drop = from.y - target.pos.y;
  const dur = Math.min(0.75, Math.max(0.4, 0.3 + drop * 0.035));
  const at = { x: 0, y: 0, z: 0 };
  const head = new THREE.Vector3();
  let t = 0, hit = false;
  target.chainHold();
  h.vel.set(0, 0, 0);
  h.setState('air');
  h.grounded = false;
  h.bat.face(Math.atan2(target.pos.x - from.x, target.pos.z - from.z));
  h.bat.animator.play('NinjaJump_Start', { once: true, fade: 0.05 });
  api.events.emit('perchDropStart', { target });
  return {
    name: 'perchDrop', camera: 'dive', combat: true, target,
    canChain: () => hit && t > dur + 0.2,
    update(dt) {
      t += dt;
      if (!hit) {
        lungePoint(from, land, t / dur, 1.2, at, 'in');
        h.pos.set(at.x, at.y, at.z);
        if (t >= dur) {
          hit = true;
          const gx = target.pos.x, gy = target.pos.y, gz = target.pos.z;
          target.chainRelease();
          target.ch.headWorld(head, 0);
          api.takedown(target, 'perch', { crit: true });
          h.pos.set(gx - Math.sin(h.bat.yaw) * 0.6, gy, gz - Math.cos(h.bat.yaw) * 0.6);
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
