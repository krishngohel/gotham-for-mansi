// Remote batarang: Batman holds still and steers it by moving the camera, for up to 3 s, while the
// world runs at 30%. It stuns every goon it passes (not the Joker), smashes glass signs and flies
// on, and stops at anything else solid. The fire key again drops it early.
import * as THREE from 'three';
import { steerDir } from '../aim.js';

const SPEED = 24, LIFE = 3, HIT_R = 1.3, WHIRR = 1.1;

export function createRemoteHandler() {
  const pos = new THREE.Vector3(), dir = new THREE.Vector3(), want = new THREE.Vector3();
  const hit = new Set();
  let active = false, t = 0, whirr = 0, S = null;
  const smashGlass = (b) => S.breakables.smash(b, pos);

  function end(sys, why) {
    active = false;
    sys.time.release('remote');
    sys.gfx.trail.stop();
    sys.fx.impact(pos, 0.6);
    sys.cameraFocus = null;
    sys.cameraMode = null;
    sys.events.emit('remoteEnd', { why });
  }

  return {
    id: 'remote',
    get active() { return active; },
    get position() { return pos; },
    fire(sys) {
      const { hero } = sys;
      if (active) return false;
      if (hero.state !== 'ground' || !hero.grounded || hero.control) { sys.hint('remote-ground'); return false; }
      S = sys;
      active = true;
      t = 0;
      whirr = 0;
      hit.clear();
      hero.bat.bone('hand_r').getWorldPosition(pos);
      sys.follow.lookDir(dir);
      dir.normalize();
      hero.bat.face(Math.atan2(dir.x, dir.z));
      hero.bat.animator.play('OverhandThrow', { once: true, timeScale: 1.9, fade: 0.05 });
      // Batman stands still until it lands.
      hero.control = { name: 'remoteSteer', combat: false, canChain: () => false, update: () => !active };
      sys.time.hold('remote', 0.3);
      sys.gfx.trail.start(pos);
      sys.cameraFocus = pos;
      sys.cameraMode = 'remote';
      sys.events.emit('remoteStart');
      sys.events.emit('word', { text: 'WHIRRR!', pos: pos.clone(), big: false });
      return true;
    },
    update(sys, real, dt, ctx) {
      if (!active) return;
      // A pause drops every time hold each frame (gadgetSystem.halt -> time.releaseAll); this
      // reasserts it the moment play resumes and gadget updates run again.
      sys.time.hold('remote', 0.3);
      t += real;
      whirr -= real;
      if (whirr <= 0) { whirr = WHIRR; sys.events.emit('remoteWhirr'); }
      if (sys.hero.dead || sys.hero.control?.name !== 'remoteSteer') { end(sys, 'interrupted'); return; }
      if (t > 0.15 && ctx.input.pressed('batarang')) { sys.combat.consumeInput('batarang'); end(sys, 'drop'); return; }
      sys.follow.lookDir(want);
      steerDir(dir, want, real, 5, dir);
      const step = SPEED * real;
      const wall = sys.collision.raycast(pos, dir, step + 0.2);
      if (wall) {
        const glass = sys.breakables.aimed(pos, dir, step + 0.2, ['glass']);
        if (glass) sys.breakables.smash(glass, pos);
        else {
          pos.addScaledVector(dir, Math.max(0, wall.t - 0.1));
          sys.gfx.trail.push(pos);
          end(sys, 'wall');
          return;
        }
      }
      pos.addScaledVector(dir, step);
      sys.gfx.trail.push(pos);
      for (const e of sys.combat.enemies) {
        if (!e.alive || e.def.boss || hit.has(e.id)) continue;
        if (Math.hypot(e.pos.x - pos.x, e.pos.y + 1.2 - pos.y, e.pos.z - pos.z) > HIT_R) continue;
        hit.add(e.id);
        sys.api.landHit('remote', e);
        sys.events.emit('remoteHit', { target: e });
      }
      sys.breakables.forNear(pos, 0.9, 'glass', smashGlass);
      if (t >= LIFE) end(sys, 'time');
    },
    // Called every frame while play is stopped or paused (gadgetSystem.interrupt): must stay
    // cheap and safe to call repeatedly, so it only does real work once, the frame it fires.
    cancel(sys) { if (active) end(sys, 'cancel'); },
  };
}
