// Gadget 1, the batarang, as it always was: it stuns and interrupts the goon you steer toward, up
// to 26 m away. With WayneTech's Triple Batarang it throws one at each of up to three goons.
// In a predator room (Part D) it only locks onto a goon right under the crosshair; otherwise it
// flies to the wall you are looking at, and the clang pulls goons within 12 m over to look.
import * as THREE from 'three';
import { selectTarget } from '../../combat/targeting.js';

const WALL_RANGE = 30, WALL_MIN = 2;

export function createBatarangHandler() {
  const eye = new THREE.Vector3(), dir = new THREE.Vector3(), hand = new THREE.Vector3();

  function throwAtWall(sys) {
    const { hero, follow, collision, events, fx } = sys;
    follow.lookDir(dir);
    eye.set(hero.pos.x, hero.pos.y + 1.5, hero.pos.z);
    const hit = collision.raycast(eye, dir, WALL_RANGE);
    if (!hit || hit.t < WALL_MIN) return false;
    const at = eye.clone().addScaledVector(dir, hit.t - 0.15);
    hero.bat.face(Math.atan2(dir.x, dir.z));
    hero.bat.animator.play('OverhandThrow', { once: true, timeScale: 1.9, fade: 0.05 });
    events.emit('batarangThrow', { count: 1 });
    let t = 0, thrown = false;
    hero.control = {
      name: 'batarang', combat: true,
      canChain: () => t > 0.25,
      update(dt) {
        t += dt;
        if (!thrown && t > 0.14) {
          thrown = true;
          hero.bat.bone('hand_r').getWorldPosition(hand);
          fx.batarang(hand.clone(), (out) => out.copy(at), () => {
            events.emit('batarangWall', { pos: at });
            events.emit('word', { text: 'TINK!', pos: at, big: false });
          });
        }
        return t > 0.35;
      },
    };
    return true;
  }

  return {
    id: 'batarang',
    // No goon in range yet: the buffered press tries again for a moment, as before.
    retry: true,
    fire(sys, ctx) {
      const { api, hero, effects } = sys;
      const quiet = !!sys.stealth?.active;
      const list = api.alive().filter((e) => e.state !== 'grabbed' && api.canSee(e));
      const first = selectTarget(hero.pos, api.inputDir(ctx, true), list, { range: 26, maxAngle: quiet ? 0.3 : 1.2 });
      if (!first) return quiet ? throwAtWall(sys) : false;
      const targets = [first];
      if (effects.batarangCount > 1) {
        const rest = list.filter((e) => e !== first && !e.down && e.pos.distanceTo(hero.pos) < 26)
          .sort((a, b) => a.pos.distanceTo(first.pos) - b.pos.distanceTo(first.pos));
        targets.push(...rest.slice(0, effects.batarangCount - 1));
      }
      hero.control = api.batarang(targets, sys.fx);
      return true;
    },
  };
}
