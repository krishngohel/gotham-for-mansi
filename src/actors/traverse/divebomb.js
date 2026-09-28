// src/actors/traverse/divebomb.js
// From a glide: dive straight down wherever the camera points, then a shockwave on impact.
import * as THREE from 'three';
import { resolveHit } from '../../combat/rules.js';

export function createDiveControl(h, { events, combat }) {
  h.cape.setWings(false);
  h.bat.animator.play('Dive', { fade: 0.06 });
  h.setState('air');
  events.emit('diveStart');
  let t = 0;
  const hit = new Set(); // goons already struck on the way down; the shockwave handles the rest on impact
  const fwd = new THREE.Vector3();
  return {
    name: 'dive',
    camera: 'dive',
    update(dt, ctx) {
      t += dt;
      ctx.cam.forward(fwd);
      h.vel.x += (fwd.x * 8 - h.vel.x) * Math.min(1, dt * 3);
      h.vel.z += (fwd.z * 8 - h.vel.z) * Math.min(1, dt * 3);
      h.vel.y = Math.max(-42, h.vel.y - 60 * dt);
      h.bat.tilt.rotation.x = 1.2 * h.bat.lm.fwd;
      // A direct hit on a goon caught on the way down. Bosses and grabbed goons are
      // excluded, same as the shockwave and the rest of combat.
      for (const e of combat.enemies) {
        if (e.alive && !e.down && !e.def?.boss && e.state !== 'grabbed' && !hit.has(e.id) && e.pos.distanceTo(h.pos) < 1.1) {
          hit.add(e.id);
          const result = resolveHit('diveBomb', e);
          const wasAttacking = e.applyHit(result, h.pos, { power: 1.6, launch: 5 });
          if (wasAttacking) combat.director.release(e.id);
        }
      }
      const r = h.integrate(dt);
      if (r.grounded || t > 4) {
        h.bat.tilt.rotation.set(0, 0, 0);
        combat.shockwave(h.pos, 4);
        h.land(-20);
        return true;
      }
      return false;
    },
    // A hit mid-dive interrupts it: no shockwave, just stop diving.
    knockOff() {
      h.bat.tilt.rotation.set(0, 0, 0);
      h.setState('air');
    },
  };
}
