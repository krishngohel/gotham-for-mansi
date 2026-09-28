// src/actors/traverse/zipline.js
// Riding a zipline: speed builds downhill; jump lets go with full momentum; the end launches you.
import { zipPoint, zipSpeed } from '../../world/climbables.js';

export function createZipControl(h, { events }, { line, s = 0 }) {
  let pos = s, speed = Math.max(8, Math.hypot(h.vel.x, h.vel.z) * 0.6);
  h.cape.setWings(false);
  h.setState('air');
  h.grounded = false;
  h.bat.animator.play('Zip_Hang', { fade: 0.1 });
  h.bat.face(Math.atan2(line.dir.x, line.dir.z));
  events.emit('zipOn');
  function release(extraUp) {
    h.vel.set(line.dir.x * speed, line.dir.y * speed + extraUp, line.dir.z * speed);
    h.setState('air'); h.airT = 0.3; h.lastClimbT = 0;
    events.emit('zipOff');
  }
  return {
    name: 'zip',
    camera: 'zip',
    get speed() { return speed; },
    update(dt, ctx) {
      speed = zipSpeed(line, speed, dt);
      pos += speed * dt;
      const p = zipPoint(line, pos);
      h.pos.set(p.x, p.y - 2.05, p.z); // hanging below the cable by one arm
      h.vel.set(line.dir.x * speed, line.dir.y * speed, line.dir.z * speed);
      if (ctx.input.pressed('jump')) {
        release(6);
        if (ctx.input.down('jump')) h.startGlide();
        return true;
      }
      if (pos >= line.length - 0.5) { release(8); return true; }
      return false;
    },
  };
}
