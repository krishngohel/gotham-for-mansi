// Climbing a ladder: forward/back climb, sprint slides down, jump kicks off, the top pulls up.
// The limbs are posed by IK every frame (pose(), after the animator): each hand and foot grips a
// real rung, in the two-beat gait of ./ladderGait.js, driven by the body's height.
import * as THREE from 'three';
import { ladderExit, ladderBottomExit } from '../../world/climbables.js';
import { ladderGrips, GAIT } from './ladderGait.js';
import { solveTwoBone } from '../limbIK.js';

const CLIMB = 1.9, SLIDE = 9;
const STAND = 0.36; // the body's distance out from the rungs
const IK_IN = 0.18, IK_OUT = 0.2, SLIDE_BLEND = 0.12; // seconds
const RAIL = 0.25; // the side rails' offset from the ladder's centre line
const TOP_DUR = 0.75; // pulling up over the top and stepping onto the landing

const tgt = new THREE.Vector3(), pole = new THREE.Vector3(), probe = new THREE.Vector3();
const grips = { handR: {}, handL: {}, footR: {}, footL: {} };

export function createLadderControl(h, { collision, events }, { ladder, y, fromTop = false }) {
  const l = ladder;
  const sx = l.x + l.nx * STAND, sz = l.z + l.nz * STAND;
  let phase = fromTop ? 'mountTop' : 'climb', t = 0;
  let cy = fromTop ? l.top - 1 : y;
  const yaw = Math.atan2(-l.nx, -l.nz);
  h.vel.set(0, 0, 0);
  h.cape.setWings(false);
  h.bat.tilt.rotation.set(0, 0, 0);
  h.bat.face(yaw);
  h.setState('air');
  h.grounded = false;
  events.emit('ladderOn');
  const exit = ladderExit(l);

  // Which way along the wall is the character's right: measured off the rig once it faces the
  // rungs, so it holds whichever way the model was built.
  const alongX = -l.nz, alongZ = l.nx;
  const bat = h.bat;
  bat.root.updateMatrixWorld(true);
  bat.bone('upperarm_r').getWorldPosition(probe);
  const right = Math.sign((probe.x - bat.root.position.x) * alongX + (probe.z - bat.root.position.z) * alongZ) || 1;
  const limbs = [
    { key: 'handR', side: right, hand: true, bones: ['upperarm_r', 'lowerarm_r', 'hand_r'].map(bat.bone) },
    { key: 'handL', side: -right, hand: true, bones: ['upperarm_l', 'lowerarm_l', 'hand_l'].map(bat.bone) },
    { key: 'footR', side: right, hand: false, bones: ['thigh_r', 'calf_r', 'foot_r'].map(bat.bone) },
    { key: 'footL', side: -right, hand: false, bones: ['thigh_l', 'calf_l', 'foot_l'].map(bat.bone) },
  ];
  let ik = 0, slideK = 0, sliding = false;

  function leave() { h.lastClimbT = 0; bat.tilt.rotation.z = 0; events.emit('ladderOff'); }

  // Puts every hand and foot on its rung. `w` blends the whole pass in and out.
  function pose(dt) {
    ik = phase === 'top' ? Math.max(0, ik - dt / IK_OUT) : Math.min(1, ik + dt / IK_IN);
    slideK = sliding ? Math.min(1, slideK + dt / SLIDE_BLEND) : Math.max(0, slideK - dt / SLIDE_BLEND);
    if (ik <= 0) { bat.tilt.rotation.z = 0; return; }
    const by = h.pos.y;
    ladderGrips(by, l, grips);
    // A gentle roll toward the hand that is pulling, in time with the gait.
    const v = (by + GAIT.HAND_R - l.bottom) / GAIT.D;
    bat.tilt.rotation.z = Math.sin(v * Math.PI * 2) * 0.035 * ik * (1 - slideK) * right;
    bat.root.updateMatrixWorld(true);
    for (const limb of limbs) {
      const g = grips[limb.key];
      const out = limb.hand ? 0.06 + 0.12 * g.swing : 0.13 + 0.15 * g.swing;
      const side = limb.side * (limb.hand ? 0.17 : 0.12);
      let gy = limb.hand ? g.y - 0.06 : g.y + 0.09;
      let gs = side;
      if (slideK > 0) {
        // Sliding: hands and feet on the rails instead of the rungs.
        gy += ((limb.hand ? by + 1.55 : by + 0.3) - gy) * slideK;
        gs += (limb.side * RAIL * (limb.hand ? 1 : 0.8) - gs) * slideK;
      }
      tgt.set(l.x + alongX * gs + l.nx * out, gy, l.z + alongZ * gs + l.nz * out);
      if (limb.hand) pole.set(alongX * limb.side * 0.7 + l.nx * 0.6, -1, alongZ * limb.side * 0.7 + l.nz * 0.6);
      else pole.set(alongX * limb.side * 0.3 - l.nx * 0.6, 0.6, alongZ * limb.side * 0.3 - l.nz * 0.6); // knees up, toward the rungs
      const [a, b, c] = limb.bones;
      solveTwoBone(a, b, c, tgt, pole, ik);
    }
  }

  return {
    name: 'ladder',
    camera: 'climb',
    pose,
    update(dt, ctx) {
      t += dt;
      const { input } = ctx;
      if (phase === 'mountTop') {
        // Step over the edge and turn around onto the rungs.
        const k = Math.min(1, t / 0.45);
        h.pos.set(exit.x + (sx - exit.x) * k, l.top - k * 1, exit.z + (sz - exit.z) * k);
        if (k >= 1) { phase = 'climb'; t = 0; }
        return false;
      }
      if (phase === 'top') {
        const k = Math.min(1, t / TOP_DUR);
        const gy = collision.groundBelow(exit.x, l.top + 1.5, exit.z, 0.2);
        const topY = gy > -Infinity ? gy : l.top;
        h.pos.set(sx + (exit.x - sx) * k, cy + (topY - cy) * Math.min(1, k * 1.6), sz + (exit.z - sz) * k);
        if (k >= 1) { h.pos.y = topY; h.setState('ground'); h.grounded = true; leave(); events.emit('climbTop'); return true; }
        return false;
      }
      // Jump: kick off backward, away from the wall.
      if (input.pressed('jump')) {
        h.vel.set(l.nx * 6, 7, l.nz * 6);
        h.setState('air'); h.airT = 0.25;
        h.bat.face(Math.atan2(l.nx, l.nz));
        h.bat.animator.play('Jump_Start', { once: true, fade: 0.08 });
        leave();
        return true;
      }
      const slide = input.down('sprint');
      sliding = slide;
      const v = slide ? -(h.tuning?.ladderSlide ?? SLIDE) : input.move.y * CLIMB;
      cy += v * dt;
      if (cy >= l.top - 1) { cy = l.top - 1; if (v > 0) { phase = 'top'; t = 0; h.bat.animator.play('ClimbUp_1m', { once: true, timeScale: 1.2, fade: 0.2 }); return false; } }
      if (cy <= l.bottom) {
        cy = l.bottom;
        if (v < 0) {
          // Step off onto solid ground: the stand point itself for a street-level ladder, or
          // the nearest landing surface found stepping in from an outer-rail mount.
          const bx = ladderBottomExit(l, collision.groundBelow);
          h.pos.set(bx.x, l.bottom, bx.z);
          h.bat.face(Math.atan2(l.nx, l.nz));
          h.setState(l.bottom <= 0.05 || collision.groundBelow(bx.x, l.bottom + 0.1, bx.z, 0.2) >= l.bottom - 0.05 ? 'ground' : 'air');
          h.grounded = h.state === 'ground';
          leave();
          return true;
        }
      }
      h.pos.set(sx, cy, sz);
      h.bat.face(yaw);
      // The IK (pose) does the climbing motion; the clip is only the base it bends from.
      h.bat.animator.play('Ladder_Hold', { fade: 0.12 });
      return false;
    },
    // Anything that hits the hero knocks them off.
    knockOff() { h.vel.set(l.nx * 3, 0, l.nz * 3); h.setState('air'); leave(); },
  };
}
