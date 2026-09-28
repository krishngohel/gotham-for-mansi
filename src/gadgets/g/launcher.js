// Line launcher: a level line to the wall ahead (6 to 40 m along the camera's heading), ridden
// like a zipline at 18 m/s or more. It works from the ground, a jump or a glide, so it can cross
// a street mid-glide. Jump lets go; the end of the line pops Batman up toward the ledge.
import * as THREE from 'three';
import { launcherLine } from '../aim.js';
import { createZipControl } from '../../actors/traverse/zipline.js';

export function createLauncherHandler() {
  let riding = null;
  const hand = new THREE.Vector3(), fwd = new THREE.Vector3();
  return {
    id: 'launcher',
    fire(sys) {
      const { hero } = sys;
      if (hero.control || hero.dead) return false;
      sys.follow.forward(fwd);
      const r = launcherLine(sys.collision, hero.pos, Math.atan2(fwd.x, fwd.z));
      if (!r.ok) { sys.hint(r.reason === 'short' ? 'launcher-short' : 'launcher-none'); return false; }
      hero.cape.setWings(false);
      riding = createZipControl(hero, { events: sys.events }, { line: r.line, s: 0.3, minSpeed: 18, onEvent: 'launcherOn', offEvent: 'launcherOff' });
      hero.control = riding;
      const anchor = new THREE.Vector3(r.line.b.x, r.line.b.y, r.line.b.z);
      sys.events.emit('launcherFire', { pos: anchor });
      sys.events.emit('word', { text: 'THUNK!', pos: anchor.clone(), big: false });
      return true;
    },
    update(sys) {
      if (!riding) return;
      if (sys.hero.control !== riding) { riding = null; sys.gfx.lines.hide('launcher'); return; }
      sys.hero.bat.bone('hand_r').getWorldPosition(hand);
      sys.gfx.lines.set('launcher', hand, riding.line.b);
    },
    cancel(sys) {
      if (!riding) return;
      if (sys.hero.control === riding) sys.hero.control = null;
      riding = null;
      sys.gfx.lines.hide('launcher');
    },
  };
}
