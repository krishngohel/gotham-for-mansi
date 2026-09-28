// src/actors/traverse/zipline.js
// Riding a zipline: speed builds downhill; jump lets go with full momentum; the end launches you.
import { zipPoint, zipSag, zipSpeed } from '../../world/climbables.js';

export function createZipControl(h, { events }, { line, s = 0, minSpeed = 0, onEvent = 'zipOn', offEvent = 'zipOff' }) {
  let pos = s, speed = Math.max(8, Math.hypot(h.vel.x, h.vel.z) * 0.6);
  const p = { x: 0, y: 0, z: 0 };
  h.cape.setWings(false);
  h.bat.tilt.rotation.set(0, 0, 0);
  h.setState('air');
  h.grounded = false;
  h.bat.animator.play('Zip_Hang', { fade: 0.1 });
  h.bat.face(Math.atan2(line.dir.x, line.dir.z));
  events.emit(onEvent);
  function release(extraUp) {
    h.vel.set(line.dir.x * speed, line.dir.y * speed + extraUp, line.dir.z * speed);
    h.setState('air'); h.airT = 0.3; h.lastClimbT = 0;
    events.emit(offEvent);
  }
  return {
    name: 'zip',
    camera: 'zip',
    line,
    get speed() { return speed; },
    update(dt, ctx) {
      speed = Math.max(minSpeed, zipSpeed(line, speed, dt));
      pos += speed * dt;
      zipPoint(line, pos, p);
      p.y -= zipSag(line, pos); // hang from the sagging point, not the straight chord
      h.pos.set(p.x, p.y - 2.05, p.z); // hanging below the cable by one arm
      h.vel.set(line.dir.x * speed, line.dir.y * speed, line.dir.z * speed);
      if (ctx.input.pressed('jump')) {
        // Let go with full momentum. `release` sets airT above the air-state glide threshold, so
        // if the player keeps holding jump, hero.js's normal air-state rule starts the glide a
        // frame later (inheriting this velocity); a tap just falls.
        release(6);
        return true;
      }
      if (pos >= line.length - 0.5) { release(8); return true; }
      return false;
    },
    // Anything that hits the hero knocks them off, same as ladder/ledge: let go with no
    // extra upward boost.
    knockOff() { release(0); },
  };
}
