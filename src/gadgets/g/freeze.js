// Freeze blast: an ice grenade at the goon you aim at (or steer toward). The goon is frozen for
// 5 s (8 s with Deep Freeze); any hit shatters the ice and knocks it out. Two charges, one back
// every 10 s. Never the Joker.
import * as THREE from 'three';
import { pickAimed } from '../aim.js';
import { selectTarget } from '../../combat/targeting.js';

export function createFreezeHandler() {
  const eye = new THREE.Vector3(), dir = new THREE.Vector3(), hand = new THREE.Vector3();
  const frozen = [];
  const freezable = (e) => e.alive && !e.def.boss && !e.down && !e.air && !['frozen', 'grabbed', 'chained', 'tied'].includes(e.state);

  return {
    id: 'freeze',
    fire(sys, ctx) {
      const { hero, api, effects } = sys;
      const list = sys.combat.enemies;
      eye.set(hero.pos.x, hero.pos.y + 1.4, hero.pos.z);
      sys.follow.lookDir(dir);
      const ok = (e) => freezable(e) && api.canSee(e);
      const target = pickAimed(list, eye, dir, { range: 22, maxAngle: 0.35, filter: ok })
        ?? selectTarget(hero.pos, api.inputDir(ctx, true), list.filter(ok), { range: 22, maxAngle: 1 });
      if (!target) { sys.hint(list.some((e) => e.alive && e.def.boss) ? 'gadget-boss' : 'freeze-none'); return false; }
      api.faceTo(target);
      sys.pose('OverhandThrow', 0.3, 1.9);
      hero.bat.bone('hand_r').getWorldPosition(hand);
      sys.gfx.ice.throw(hand, (out) => target.ch.headWorld(out, -0.3), () => {
        if (!freezable(target)) return;
        if (target.freeze(effects.freezeTime)) api.director.release(target.id);
        const slot = sys.gfx.ice.attach(target);
        if (slot >= 0) frozen.push({ e: target, slot });
        sys.events.emit('freeze', { target });
        sys.events.emit('word', { text: 'KRZZT!', pos: target.pos.clone().setY(target.pos.y + 1.8), big: false });
      });
      return true;
    },
    // Ice goes when the goon leaves the frozen state: shattered into shards, or melted.
    update(sys) {
      for (let i = frozen.length - 1; i >= 0; i--) {
        const f = frozen[i];
        if (f.e.state === 'frozen') continue;
        sys.gfx.ice.release(f.slot, f.e.shattered);
        frozen.splice(i, 1);
      }
    },
  };
}
