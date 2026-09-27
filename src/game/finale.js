// The birthday finale on the GCPD roof: the signal spells it out, fireworks, the recovered
// presents, party and cake, the Joker tied to a chair in a party hat, then the credits.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { createPresents, createPartyKit, createCake } from '../world/storyProps.js';
import { createFireworks } from './fireworks.js';
import MANSI from '../mansi.config.js';

function signalText(text) {
  const words = text.split(' ');
  const last = words.pop();
  const lines = words.length ? [words.join(' '), last] : [last];
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 1024, 400);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    const size = Math.min(150, 1700 / Math.max(5, l.length));
    g.font = `${size}px Bangers, Impact, sans-serif`;
    g.fillText(l, 512, lines.length === 1 ? 200 : 125 + i * 165);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function createFinale({ scene, world, hero, boss, camera, events, rng, halos }) {
  const set = new THREE.Group();
  set.visible = false;
  scene.add(set);
  const Y = 42;
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.6), toonMaterial({ color: 0x5a4636 }));
  table.position.set(3, Y + 0.45, 4);
  addHullOutline(table, 0.02);
  const cake = createCake();
  cake.position.set(3, Y + 0.9, 4);
  const presents = createPresents();
  presents.position.set(-1, Y, 6.5);
  const party = createPartyKit();
  party.position.set(8, Y, 1);
  set.add(table, cake, presents, party);
  // Bunting strung across the roof.
  const flagMat = [PALETTE.balloon, PALETTE.signal, PALETTE.neonCyan, PALETTE.jokerPurple].map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  for (const [ax, az, bx, bz] of [[-18, -18, 18, 18], [-18, 18, 18, -18]]) {
    for (let k = 1; k < 20; k++) {
      const t = k / 20;
      const flag = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.35, 0, 0), new THREE.Vector3(0.35, 0, 0), new THREE.Vector3(0, -0.7, 0)]), flagMat[k % 4]);
      flag.geometry.computeVertexNormals();
      flag.position.set(ax + (bx - ax) * t, Y + 7 - Math.sin(t * Math.PI) * 2.5, az + (bz - az) * t);
      flag.rotation.y = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
      set.add(flag);
    }
  }
  // Rope and a party hat for our guest.
  const rope = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 20), toonMaterial({ color: 0xb08a50 }));
    r.rotation.x = Math.PI / 2;
    r.position.y = 0.75 + k * 0.22;
    rope.add(r);
  }
  const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), toonMaterial({ color: 0x3a2a24 }));
  chair.position.y = 0.25;
  rope.add(chair);
  rope.position.set(-7, Y, 9);
  set.add(rope);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 16), toonMaterial({ color: PALETTE.neonPink }));
  addHullOutline(hat, 0.01);

  // Each burst lights the sky for a moment.
  const flash = new THREE.PointLight(0xfff0d0, 0, 400, 1.2);
  scene.add(flash);
  let flashT = 0;
  const fireworks = createFireworks(scene, rng, (at) => { events.emit('firework'); flash.position.copy(at); flashT = 0.35; });
  const focus = new THREE.Vector3(1, Y + 1.5, 6);
  let playing = false;
  let t = 0;
  let launchT = 0;
  let resolve = null;
  let freeRoam = false;

  function launchOne() {
    const a = rng.range(-Math.PI, Math.PI);
    const d = rng.range(55, 130);
    const to = new THREE.Vector3(Math.cos(a) * d, rng.range(70, 120), -Math.abs(Math.sin(a)) * d - 20);
    fireworks.launch(new THREE.Vector3(to.x * 0.8, 10, to.z * 0.8), to);
  }

  return {
    get active() { return playing; },
    // The cinematic. Resolves when it is done; the credits come next.
    play() {
      set.visible = true;
      playing = true;
      t = 0;
      hero.teleport({ x: 0, y: Y, z: 9 }, Math.PI);
      hero.bat.animator.play('Dance_Loop', { fade: 0.2 });
      boss.pose([-7, Y + 0.5, 9], 1.2, 'Sitting_Idle_Loop', 1);
      boss.joker.ch.bone('Head').add(hat);
      hat.position.set(0, 0.28, 0.02);
      world.sky.setSignalTexture(signalText(MANSI.finaleSignal), 2.6);
      world.sky.setSignalPoint(new THREE.Vector3(-60, 190, -220), 58);
      events.emit('signal');
      events.emit('finaleStart');
      return new Promise((r) => { resolve = r; });
    },
    freeRoam() { freeRoam = true; playing = false; },
    resize(h, fov) { fireworks.resize(h, fov); },
    update(dt, cameraOverride) {
      if (!set.visible) return false;
      fireworks.update(dt);
      flashT = Math.max(0, flashT - dt);
      flash.intensity = flashT * 9000;
      launchT -= dt;
      if (launchT <= 0 && (playing || freeRoam)) { launchT = playing ? rng.range(0.35, 0.9) : rng.range(2, 5); launchOne(); }
      for (const f of cake.userData.flames) f.scale.y = 0.8 + Math.sin(performance.now() / 50 + f.position.x * 9) * 0.25;
      party.userData.ball.rotation.y += dt;
      if (!playing) return false;
      t += dt;
      hero.bat.animator.update(dt);
      hero.updateCape(dt);
      boss.update(dt);
      // Three camera moves: up at the signal, around the party, out over the city.
      if (t < 7) {
        const k = t / 7;
        camera.position.set(2 - k * 3, Y + 1 + k * 2, 16 - k * 3);
        camera.lookAt(-20 + k * 14, Y + 25 - k * 12, -40 + k * 20);
      } else if (t < 14) {
        const a = (t - 7) * 0.35 + 0.4;
        camera.position.set(focus.x + Math.sin(a) * 8, Y + 3, focus.z + Math.cos(a) * 8);
        camera.lookAt(focus);
      } else {
        const k = Math.min(1, (t - 14) / 7);
        camera.position.set(14 + k * 20, Y + 6 + k * 18, 22 + k * 20);
        camera.lookAt(-20, Y + 30, -60);
      }
      if (t > 21 && resolve) { const r = resolve; resolve = null; playing = false; r(); }
      return true;
    },
    get fireworks() { return fireworks; },
  };
}
