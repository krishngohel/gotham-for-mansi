// Explosive gel: tap the fire key to spray a blob where you aim (a floor or a wall, up to 14 m), up
// to three at once; hold it for 0.35 s to set them all off. Each blast knocks down goons within
// 4 m (5.5 m with Bigger Bang) and breaks cracked walls within 1.6 m. Three charges, one back
// every 5 s. The key is read here directly, so a tap and a hold can differ.
import * as THREE from 'three';
import { gelSpot } from '../aim.js';
import { gadgetsLocked } from '../gadgetDefs.js';

const HOLD = 0.35, RANGE = 14, WALL_REACH = 1.6;

export function createGelHandler() {
  const blobs = [];
  const eye = new THREE.Vector3(), dir = new THREE.Vector3(), c = new THREE.Vector3();
  let holdT = -1, S = null;
  const smashWall = (w) => S.breakables.smash(w, c);

  function spray(sys) {
    const { hero } = sys;
    if (blobs.length >= 3) { sys.hint('gel-full'); return; }
    if (!sys.state.ready('gel')) { sys.hint('gadget-empty', 'Explosive Gel'); return; }
    eye.copy(sys.camera.position);
    sys.follow.lookDir(dir);
    const spot = gelSpot(sys.collision, eye, dir, { range: RANGE + eye.distanceTo(hero.pos) });
    if (!spot || Math.hypot(spot.x - hero.pos.x, spot.y - hero.pos.y, spot.z - hero.pos.z) > RANGE) { sys.hint('gel-aim'); return; }
    const slot = sys.gfx.gel.place(spot);
    if (slot < 0) return;
    blobs.push({ x: spot.x, y: spot.y, z: spot.z, slot });
    sys.state.use('gel');
    sys.pose('Spell_Simple_Shoot', 0.25, 2.2);
    c.set(spot.x, spot.y, spot.z);
    sys.events.emit('gelSpray', { pos: c.clone() });
    sys.events.emit('word', { text: 'SPLUT!', pos: c.clone(), big: false });
    sys.events.emit('gadgetUse', { id: 'gel' });
  }

  function detonate(sys) {
    if (!blobs.length) { sys.hint('gel-none'); return; }
    S = sys;
    let n = 0;
    for (const b of blobs) {
      c.set(b.x, b.y, b.z);
      n += sys.api.areaBlast(c, sys.effects.gelRadius, 'gel');
      sys.breakables.forNear(c, WALL_REACH, 'weakWall', smashWall);
      sys.gfx.gel.clear(b.slot);
      sys.fx.impact(c, 1.6);
      sys.gfx.debris.burst(c, 0x9fe3ff, 8, 6, b.y);
      sys.events.emit('gelBlast', { pos: c.clone(), count: n });
    }
    sys.follow.addShake(0.35);
    sys.events.emit('word', { text: 'KA-BLOOEY!', pos: c.clone(), big: true });
    blobs.length = 0;
  }

  return {
    id: 'gel',
    manualSpend: true,
    get placed() { return blobs.length; },
    // The buffered press only needs using up; update() reads the key.
    fire() { return true; },
    update(sys, real, dt, ctx) {
      // Inert under the wheel, a death, remote steering and the controls the wheel can't open
      // over (a chain takedown, the Bat Swarm, a challenge countdown). A press or hold that one of
      // those cuts into is dropped, not sprayed.
      const armed = sys.state.equipped === 'gel' && !sys.wheelOpen && !sys.hero.dead && sys.hero.control?.name !== 'remoteSteer' && !gadgetsLocked(sys.hero);
      if (!armed) { holdT = -1; return; }
      if (ctx.input.pressed('batarang') && holdT < 0) holdT = 0;
      if (holdT < 0) return;
      if (ctx.input.down('batarang')) {
        const before = holdT;
        holdT += real;
        if (before < HOLD && holdT >= HOLD) detonate(sys);
      } else {
        if (holdT < HOLD) spray(sys);
        holdT = -1;
      }
    },
    cancel(sys) {
      if (!blobs.length && holdT < 0) return;
      for (const b of blobs) sys.gfx.gel.clear(b.slot);
      blobs.length = 0;
      holdT = -1;
    },
  };
}
