// Climbing a ladder: forward/back climb, sprint slides down, jump kicks off, the top pulls up.
import { ladderExit } from '../../world/climbables.js';

const CLIMB = 2.4, SLIDE = 9;

export function createLadderControl(h, { collision, events }, { ladder, y, fromTop = false }) {
  const l = ladder;
  const sx = l.x + l.nx * 0.45, sz = l.z + l.nz * 0.45;
  let phase = fromTop ? 'mountTop' : 'climb', t = 0;
  let cy = fromTop ? l.top - 1 : y;
  const yaw = Math.atan2(-l.nx, -l.nz);
  h.vel.set(0, 0, 0);
  h.cape.setWings(false);
  h.bat.tilt.rotation.set(0, 0, 0);
  h.bat.face(yaw);
  h.setState('air');
  h.grounded = false;
  events.emit('ladderOn');
  const exit = ladderExit(l);

  function leave() { h.lastClimbT = 0; events.emit('ladderOff'); }

  return {
    name: 'ladder',
    camera: 'climb',
    update(dt, ctx) {
      t += dt;
      const { input } = ctx;
      if (phase === 'mountTop') {
        // Step over the edge and turn around onto the rungs.
        const k = Math.min(1, t / 0.45);
        h.pos.set(exit.x + (sx - exit.x) * k, l.top - k * 1, exit.z + (sz - exit.z) * k);
        if (k >= 1) { phase = 'climb'; t = 0; }
        return false;
      }
      if (phase === 'top') {
        const k = Math.min(1, t / 0.6);
        const gy = collision.groundBelow(exit.x, l.top + 1.5, exit.z, 0.2);
        const topY = gy > -Infinity ? gy : l.top;
        h.pos.set(sx + (exit.x - sx) * k, cy + (topY - cy) * Math.min(1, k * 1.6), sz + (exit.z - sz) * k);
        if (k >= 1) { h.pos.y = topY; h.setState('ground'); h.grounded = true; leave(); events.emit('climbTop'); return true; }
        return false;
      }
      // Jump: kick off backward, away from the wall.
      if (input.pressed('jump')) {
        h.vel.set(l.nx * 6, 7, l.nz * 6);
        h.setState('air'); h.airT = 0.25;
        h.bat.face(Math.atan2(l.nx, l.nz));
        h.bat.animator.play('Jump_Start', { once: true, fade: 0.08 });
        leave();
        return true;
      }
      const slide = input.down('sprint');
      const v = slide ? -SLIDE : input.move.y * CLIMB;
      cy += v * dt;
      if (cy >= l.top - 1) { cy = l.top - 1; if (v > 0) { phase = 'top'; t = 0; h.bat.animator.play('ClimbUp_1m', { once: true, timeScale: 1.5, fade: 0.08 }); return false; } }
      if (cy <= l.bottom) {
        cy = l.bottom;
        if (v < 0) {
          h.pos.set(sx, l.bottom, sz);
          h.setState(l.bottom <= 0.05 || collision.groundBelow(sx, l.bottom + 0.1, sz, 0.2) >= l.bottom - 0.05 ? 'ground' : 'air');
          h.grounded = h.state === 'ground';
          leave();
          return true;
        }
      }
      h.pos.set(sx, cy, sz);
      h.bat.face(yaw);
      if (Math.abs(v) > 0.1) {
        h.bat.animator.play('Ladder_Climb', { fade: 0.12, timeScale: slide ? 0 : Math.sign(v) * Math.abs(v) / CLIMB });
      } else h.bat.animator.play('Ladder_Idle', { fade: 0.15 });
      return false;
    },
    // Anything that hits the hero knocks them off.
    knockOff() { h.vel.set(l.nx * 3, 0, l.nz * 3); h.setState('air'); leave(); },
  };
}
