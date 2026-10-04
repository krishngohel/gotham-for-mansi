// Smoke pellet: a cloud 5 m across at Batman's feet. Goons inside are stunned for 3 s and lose
// track of him for 5 s; the rest of the fight within 10 m loses him for 2 s. Batman slips the
// next hit. Cooldown 12 s (7 s with Quick Smoke). Part D's stealth hooks e.search(from).
import * as THREE from 'three';
import { inRadius } from '../aim.js';

const R = 2.5;
const LIFE = 6; // seconds the cloud lasts: the puffs, and (via the smoke event) how long goons can't see through it

export function createSmokeHandler() {
  const c = new THREE.Vector3();
  return {
    id: 'smoke',
    fire(sys) {
      const { hero, api } = sys;
      c.copy(hero.pos);
      sys.gfx.smoke.burst(c, R, LIFE);
      sys.pose('Gadget_Toss', 0.35, 1.5);
      let n = 0;
      for (const e of sys.combat.enemies) {
        if (!e.alive || e.def.boss) continue;
        if (inRadius(c, e.pos, R + 0.3)) {
          if (!e.down && e.state !== 'frozen') api.landHit('smoke', e);
          e.lose(5, c);
          n += 1;
        } else if (e.aware && inRadius(c, e.pos, 10, 4)) e.lose(2, c);
      }
      hero.invulnerable = Math.max(hero.invulnerable, 0.6);
      sys.events.emit('smoke', { pos: c.clone(), radius: R, life: LIFE, count: n });
      sys.events.emit('word', { text: 'FSSSHH!', pos: c.clone().setY(c.y + 1.6), big: false });
      return true;
    },
  };
}
