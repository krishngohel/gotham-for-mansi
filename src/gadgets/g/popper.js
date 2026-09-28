// Party popper (unlocked after the credits): a confetti bomb thrown 5 m ahead. Every goon within
// 6 m dances, stunned, for 3 s, and the confetti flies up to spell HAPPY BIRTHDAY <NAME>! across
// the sky 30 m ahead, holds for five seconds, then flutters down. The letters are baked once.
import * as THREE from 'three';
import MANSI from '../../mansi.config.js';
import { letterPoints, birthdayLine } from '../skyLetters.js';

const R = 6, DELAY = 0.35;
// Big, bold sky lettering: a wide glyph cell so the banner fills the middle of the screen, placed
// far enough ahead that the perspective across its width stays calm.
const LETTER_CELL = 0.8, LETTER_FWD = 34, LETTER_UP = 15, LETTER_PITCH = -0.13;

export function createPopperHandler() {
  const letters = letterPoints(birthdayLine(MANSI.name), { cell: LETTER_CELL }).points;
  const at = new THREE.Vector3(), anchor = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
  let pending = -1;

  function pop(sys) {
    const { api, hero } = sys;
    sys.gfx.confetti.burst(at, 320);
    anchor.copy(hero.pos).addScaledVector(fwd, LETTER_FWD);
    anchor.y = hero.pos.y + LETTER_UP;
    sys.gfx.confetti.letters(at, anchor, right, letters, LETTER_CELL);
    let n = 0;
    for (const e of sys.combat.enemies) {
      if (!e.alive || e.def.boss || e.down || Math.hypot(e.pos.x - at.x, e.pos.z - at.z) > R || Math.abs(e.pos.y - at.y) > 3) continue;
      api.landHit('popper', e);
      if (e.dance(3)) api.director.release(e.id);
      n += 1;
    }
    // Tilt the view up so the lettering clears rooftops and the objective card without running
    // off the top of the frame.
    sys.follow.state.pitch = Math.min(sys.follow.state.pitch, LETTER_PITCH);
    sys.fx.impact(at, 1.4);
    sys.events.emit('popper', { pos: at.clone(), count: n });
    sys.events.emit('word', { text: 'POP! POP! POP!', pos: at.clone().setY(at.y + 1.5), big: true });
  }

  return {
    id: 'popper',
    fire(sys) {
      const { hero } = sys;
      if (hero.state !== 'ground' || hero.control) { sys.hint('popper-ground'); return false; }
      sys.follow.forward(fwd);
      sys.follow.right(right);
      at.copy(hero.pos).addScaledVector(fwd, 5);
      const g = sys.collision.groundBelow(at.x, hero.pos.y + 2, at.z, 0.3);
      at.y = g > -Infinity ? g : hero.pos.y;
      sys.pose('OverhandThrow', 0.4, 1.6);
      pending = DELAY;
      return true;
    },
    update(sys, real, dt) {
      if (pending < 0) return;
      pending -= dt;
      if (pending < 0) pop(sys);
    },
    cancel() { pending = -1; },
  };
}
