// Batclaw: yanks the goon you aim at (two with Double Claw) right to Batman, down for a free
// punch. A brute loses its armor instead (stunned for 4 s). With no goon in the sights it tears
// down the vent cover or weak railing you aim at; goons standing at a torn railing go over the edge.
import * as THREE from 'three';
import { pickAimedMany } from '../aim.js';
import { boxDistance } from '../../world/breakableSpots.js';
import { freeForGadget } from '../gadgetDefs.js';

const RANGE = 20, LINE_TIME = 0.35;
const HELD = ['grabbed', 'chained', 'tied', 'frozen'];

export function createClawHandler() {
  const eye = new THREE.Vector3(), dir = new THREE.Vector3(), to = new THREE.Vector3(), hand = new THREE.Vector3(), tip = new THREE.Vector3();
  let lineT = 0, lineTarget = null, lineLift = 0;
  const clawable = (e) => e.alive && !e.def.boss && !e.down && !e.air && !HELD.includes(e.state);

  return {
    id: 'claw',
    fire(sys) {
      const { hero, api, effects } = sys;
      // Mid-combo counts as free: a strike in its chain window is replaced by the claw's pose.
      if (hero.state !== 'ground' || !freeForGadget(hero)) { sys.hint('claw-ground'); return false; }
      eye.set(hero.pos.x, hero.pos.y + 1.4, hero.pos.z);
      sys.follow.lookDir(dir);
      const goons = pickAimedMany(sys.combat.enemies, eye, dir, effects.clawTargets, {
        range: RANGE, maxAngle: 0.3, filter: (e) => clawable(e) && api.canSee(e),
      });
      if (goons.length) {
        sys.pose('Spell_Simple_Shoot', 0.3, 2.2);
        // A goon in the batch can be a brute (stripped, not pulled), so the "you yanked someone"
        // word/event below only fires when at least one of them actually got pulled in.
        let yankedAny = false;
        for (const e of goons) {
          if (e.def.armored && !e.stunned) {
            api.landHit('claw', e);
            e.stunned = true;
            e.stunT = Math.max(e.stunT, 4);
            sys.events.emit('clawRip', { target: e });
            sys.events.emit('word', { text: 'RIIIP!', pos: e.pos.clone().setY(e.pos.y + 1.6), big: true });
            continue;
          }
          const dx = e.pos.x - hero.pos.x, dz = e.pos.z - hero.pos.z, d = Math.hypot(dx, dz) || 1;
          to.set(hero.pos.x + (dx / d) * 1.3, hero.pos.y, hero.pos.z + (dz / d) * 1.3);
          // e.yank() always performs the yank; its return value only says whether the goon was
          // mid-attack (so its director slot needs releasing), not whether the yank landed. Using
          // it to gate yankedAny meant clawYank (the sound, the "YOINK!" word) never fired unless
          // the goon happened to be windup/attack at the moment, silent for the common case.
          const wasAttacking = e.yank(to);
          if (wasAttacking) api.director.release(e.id);
          yankedAny = true;
        }
        hero.bat.face(Math.atan2(goons[0].pos.x - hero.pos.x, goons[0].pos.z - hero.pos.z));
        lineTarget = goons[0].pos;
        lineLift = 1.1;
        lineT = LINE_TIME;
        if (yankedAny) {
          sys.events.emit('clawYank', { count: goons.length });
          sys.events.emit('word', { text: 'YOINK!', pos: goons[0].pos.clone().setY(goons[0].pos.y + 1.8), big: false });
        }
        return true;
      }
      const b = sys.breakables.aimed(eye, dir, RANGE, ['vent', 'railing']);
      if (b) {
        sys.pose('Spell_Simple_Shoot', 0.3, 2.2);
        if (b.kind === 'railing') {
          for (const e of sys.combat.enemies) {
            // Frozen, tied, chained or held goons stay put: they aren't standing at the rail.
            if (!e.alive || e.def.boss || HELD.includes(e.state) || boxDistance(b.bounds, e.pos) > 2.5) continue;
            e.launch(b.normal.nx * 5, 3, b.normal.nz * 5);
            api.director.release(e.id);
          }
        }
        sys.breakables.smash(b, hero.pos);
        lineTarget = b.center;
        lineLift = 0;
        lineT = LINE_TIME;
        return true;
      }
      sys.hint(sys.combat.enemies.some((e) => e.alive && e.def.boss) ? 'gadget-boss' : 'claw-none');
      return false;
    },
    update(sys, real) {
      if (lineT <= 0) return;
      lineT -= real;
      if (lineT <= 0) { sys.gfx.lines.hide('claw'); return; }
      sys.hero.bat.bone('hand_r').getWorldPosition(hand);
      tip.copy(lineTarget);
      tip.y += lineLift;
      sys.gfx.lines.set('claw', hand, tip);
    },
  };
}
