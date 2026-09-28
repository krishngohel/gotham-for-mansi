// src/actors/traverse/ledge.js
// Hanging from a ledge: shimmy left/right (wrapping outside corners), pull up, drop, or backflip.
import * as THREE from 'three';
import { hangPos, wrapCorner } from './probes.js';
import { canLedgeTakedown } from '../../combat/rules.js';

const SHIMMY = 1.6;
const DROP_HOLD = 0.25; // seconds `back` must be held before it drops instead of backflipping

export function createLedgeControl(h, { collision, events }, { ledge }) {
  let l = ledge, phase = 'catch', t = 0, backT = 0;
  const start = h.pos.clone();
  const rightOut = new THREE.Vector3();
  const hangOut = { x: 0, y: 0, z: 0 };
  h.vel.set(0, 0, 0);
  h.cape.setWings(false);
  h.bat.tilt.rotation.set(0, 0, 0);
  h.setState('air');
  h.grounded = false;
  h.bat.animator.play('Hang_Idle', { fade: 0.08 });
  events.emit('ledgeGrab');
  const alongOf = () => (l.axis === 'x' ? l.x : l.z);
  const setAlong = (v) => { if (l.axis === 'x') l.x = v; else l.z = v; };
  const face = () => h.bat.face(Math.atan2(-l.nx, -l.nz));

  function leave() { h.lastClimbT = 0; }

  return {
    name: 'ledge',
    camera: 'hang',
    get ledge() { return l; },
    update(dt, ctx) {
      t += dt;
      const { input, cam } = ctx;
      const hp = hangPos(l, hangOut);
      if (phase === 'catch') {
        const k = Math.min(1, t / 0.12);
        h.pos.lerpVectors(start, hp, k);
        face();
        if (k >= 1) { phase = 'hang'; t = 0; }
        return false;
      }
      if (phase === 'up') {
        const k = Math.min(1, t / 0.6);
        const tx = l.x - l.nx * 0.6, tz = l.z - l.nz * 0.6;
        h.pos.set(hp.x + (tx - hp.x) * k, hp.y + (l.y - hp.y) * Math.min(1, k * 1.6), hp.z + (tz - hp.z) * k);
        if (k >= 1) { h.pos.y = l.y; h.setState('ground'); h.grounded = true; leave(); events.emit('ledgeUp'); return true; }
        return false;
      }
      // Hanging.
      if (input.pressed('punch') && h.combat) {
        const e = h.combat.enemies.find((g) => canLedgeTakedown(g, l));
        if (e) {
          h.bat.animator.play('Ledge_Yank', { once: true, fade: 0.05 });
          e.launch(l.nx * 3, 2, l.nz * 3);
          h.combat.takedown(e, 'ledge');
          h.combat.consumeInput('punch');
        }
      }
      const backHeld = input.move.y < -0.5;
      backT = backHeld ? backT + dt : 0;
      if (input.pressed('jump') && backHeld && backT < DROP_HOLD) {
        // Backflip away from the wall: back tapped-and-held (under the drop threshold) plus jump.
        h.vel.set(l.nx * 7, 9, l.nz * 7);
        h.setState('air'); h.airT = 0.25;
        h.bat.face(Math.atan2(l.nx, l.nz));
        h.bat.animator.play('NinjaJump_Start', { once: true, fade: 0.05 });
        leave(); events.emit('jump');
        return true;
      }
      if (input.pressed('jump') || input.move.y > 0.5) {
        phase = 'up'; t = 0;
        h.bat.animator.play('ClimbUp_1m', { once: true, timeScale: 1.5, fade: 0.08 });
        return false;
      }
      if (input.pressed('sprint') || backT >= DROP_HOLD) {
        h.pos.set(hp.x + l.nx * 0.25, hp.y, hp.z + l.nz * 0.25);
        h.vel.set(0, -1, 0);
        h.setState('air'); h.airT = 0.4;
        leave(); events.emit('ledgeDrop');
        return true;
      }
      // Shimmy: screen-left/right mapped onto the edge axis using the camera's right vector.
      const right = cam.right(rightOut);
      const ax = l.axis === 'x' ? right.x : right.z;
      const dir = Math.sign(ax * input.move.x);
      if (Math.abs(input.move.x) > 0.3 && dir !== 0) {
        let v = alongOf() + dir * SHIMMY * dt;
        if (v > l.max || v < l.min) {
          const w = wrapCorner(collision, l, v > l.max ? 1 : -1);
          if (w) { l = w; phase = 'catch'; t = 0; start.copy(h.pos); return false; }
          v = Math.min(Math.max(v, l.min), l.max);
        }
        setAlong(v);
        h.bat.animator.play('Shimmy', { fade: 0.1, timeScale: dir });
      } else h.bat.animator.play('Hang_Idle', { fade: 0.15 });
      hangPos(l, hangOut);
      h.pos.set(hangOut.x, hangOut.y, hangOut.z);
      face();
      return false;
    },
    knockOff() { h.vel.set(l.nx * 2, -2, l.nz * 2); h.setState('air'); leave(); },
  };
}
