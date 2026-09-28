// src/actors/traverse/wallrun.js
// Running along a wall for up to 1.2 s (1.8 s with Wall Grip Boots) on a gentle arc; jump kicks
// off with a boost.
const DUR = 1.2;

// Vertical speed along a wall run of `dur` seconds: up then down, peaking about 1.4 m above the
// start and ending level, whatever the length (Wall Grip Boots makes it 1.8 s).
export function wallRunVy(t, dur = DUR) {
  return ((4.6 * 1.2) / dur) * (1 - (2 * t) / dur);
}

export function createWallRunControl(h, { collision, events }, { wall, speed }) {
  let t = 0;
  const dur = h.tuning?.wallRunTime ?? DUR;
  const sp = Math.max(9, Math.min(14, speed));
  const ax = wall.alongX, az = wall.alongZ;
  h.airRuns += 1;
  h.setState('air'); h.grounded = false;
  h.bat.face(Math.atan2(ax, az));
  h.bat.animator.play('WallRun_Loop', { fade: 0.08 });
  events.emit('wallRun');
  return {
    name: 'wallrun',
    camera: 'wallrun',
    update(dt, ctx) {
      t += dt;
      // Up then down: a 1.2 s arc that peaks 1.4 m above the start.
      const vy = wallRunVy(t, dur);
      h.vel.set(ax * sp - wall.nx * 1.5, vy, az * sp - wall.nz * 1.5);
      const r = h.integrate(dt);
      h.bat.tilt.rotation.z = wall.side * 0.45;
      if (ctx.input.pressed('jump')) {
        h.bat.tilt.rotation.set(0, 0, 0);
        h.vel.set(ax * sp * 0.8 + wall.nx * 7.5, 9, az * sp * 0.8 + wall.nz * 7.5);
        h.setState('air'); h.airT = 0.3; h.lastClimbT = 0;
        h.bat.face(Math.atan2(h.vel.x, h.vel.z));
        h.bat.animator.play('NinjaJump_Start', { once: true, fade: 0.05 });
        events.emit('wallKick');
        return true;
      }
      // Cheap distance check against the wall box's footprint instead of a per-frame query
      // allocation; the run ends anyway once the hero drifts off the wall or lands.
      // XZ-only: safe because findRunWall only offers walls taller than minHeight (4 m), well
      // above this control's own arc (peaks 1.4 m up), so the hero can't run above the wall's top.
      const dx = Math.max(wall.box.minX - h.pos.x, 0, h.pos.x - wall.box.maxX);
      const dz = Math.max(wall.box.minZ - h.pos.z, 0, h.pos.z - wall.box.maxZ);
      const still = Math.hypot(dx, dz) < 1.2;
      if (t > dur || r.grounded || !still) {
        h.bat.tilt.rotation.set(0, 0, 0);
        h.setState(r.grounded ? 'ground' : 'air');
        h.lastClimbT = 0;
        return true;
      }
      return false;
    },
    // Anything that hits the hero knocks them off the wall.
    knockOff() {
      h.bat.tilt.rotation.set(0, 0, 0);
      h.lastClimbT = 0;
      h.setState('air');
    },
  };
}
