// src/game/party.js
// The finale rooftop party (GCPD roof, SITES.start / signal, y 42): every rescued guest joins
// in, then celebrate() brings the whole thing to life. Reuses what already exists rather than
// duplicating it: src/world/storyProps.js's cake and party kit (speakers, crates, disco ball),
// src/gadgets/gadgetFx.js's confetti and sky-lettering pools (the same ones the party popper
// gadget uses), and src/game/finale.js's own fireworks loop.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createGoon } from '../actors/characters.js';
import { createPartyKit } from '../world/storyProps.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { PALETTE } from '../config/palette.js';
import { createRng } from '../core/rng.js';
import { letterPoints, birthdayLine } from '../gadgets/skyLetters.js';
import MANSI from '../mansi.config.js';
import { PARTY_Y as Y, guestSlots, guestsInView } from './partySlots.js';

const mat = (color, extra = {}) => toonMaterial({ color, ...extra });
const prop = (geo, color, extra = {}) => { const m = new THREE.Mesh(geo, mat(color, extra)); addHullOutline(m, 0.012); return m; };

// A canvas banner: code-drawn text, no external assets. Hung on a rope between two poles.
function buildBanner(text, width = 7.5, height = 1.3) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 176;
  const x = c.getContext('2d');
  x.fillStyle = '#efe6cf'; x.fillRect(0, 0, 1024, 176);
  x.strokeStyle = '#0b0b12'; x.lineWidth = 10; x.strokeRect(5, 5, 1014, 166);
  x.font = '90px Bangers, Impact, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#c8323c';
  x.fillText(text, 512, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), toonMaterial({ map: tex, side: THREE.DoubleSide }));
  addHullOutline(panel, 0.015);
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, height + 1.2, 8);
  const poleMat = mat(0x3a3f4a);
  const poleL = new THREE.Mesh(poleGeo, poleMat), poleR = new THREE.Mesh(poleGeo, poleMat);
  poleL.position.x = -width / 2 - 0.06;
  poleR.position.x = width / 2 + 0.06;
  g.add(panel, poleL, poleR);
  return g;
}

// String lights: small warm bulbs sagging between anchor points, merged into one draw call.
function buildStringLights(anchors, sag = 1.3, perSpan = 10) {
  const bulbGeo = new THREE.SphereGeometry(0.09, 6, 5);
  const parts = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    for (let k = 1; k <= perSpan; k++) {
      const t = k / (perSpan + 1);
      const bx = a.x + (b.x - a.x) * t, bz = a.z + (b.z - a.z) * t;
      const by = a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag;
      parts.push(bulbGeo.clone().translate(bx, by, bz));
    }
  }
  const merged = mergeGeometries(parts, false);
  const bulbs = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ color: PALETTE.signal }));
  return bulbs;
}

function partyHat(color) {
  const h = prop(new THREE.ConeGeometry(0.14, 0.4, 14), color);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: PALETTE.paper }));
  ball.position.y = 0.22;
  h.add(ball);
  return h;
}

function glasses() {
  const g = new THREE.Group();
  const rim = new THREE.TorusGeometry(0.028, 0.006, 6, 12);
  const m = mat(0x0b0b12);
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(rim, m);
    lens.position.set(side * 0.032, 0, 0.01);
    g.add(lens);
  }
  return g;
}

function buildGuestBody(assets, rng, small = false) {
  const ch = createGoon(assets, { type: 'civilian', rng });
  if (small) ch.root.scale.setScalar(0.66);
  return ch;
}

export function createParty({ scene, assets, events, gfx, finale }) {
  const rng = createRng(220990);
  const group = new THREE.Group();
  group.name = 'party';
  scene.add(group);

  const guests = []; // { id, ch, dance() }
  const dancers = []; // every ch added, for celebrate()
  const pulsers = []; // { mesh, base } emissive lights to pulse
  let djKit = null, decorated = false, near = true;

  // Set dressing shared by every guest (string lights + the banner), built once, the first time
  // any guest is added, so an empty roof never pays for it.
  function decorate() {
    if (decorated) return;
    decorated = true;
    const bulbs = buildStringLights([
      { x: -18, y: Y + 8, z: -18 }, { x: 0, y: Y + 9.5, z: -18 }, { x: 18, y: Y + 8, z: -18 },
      { x: 18, y: Y + 8, z: 18 }, { x: -18, y: Y + 8, z: 18 }, { x: -18, y: Y + 8, z: -18 },
    ]);
    bulbs.userData.keepFar = true;
    group.add(bulbs);
    const banner = buildBanner(MANSI.finaleSignal);
    banner.position.set(0, Y + 10.5, -17.9);
    banner.userData.keepFar = true;
    group.add(banner);
    const banner2 = buildBanner(MANSI.finaleSignal, 6, 1.1);
    banner2.position.set(-17.9, Y + 9, 0);
    banner2.rotation.y = Math.PI / 2;
    banner2.userData.keepFar = true;
    group.add(banner2);
  }

  function addNpc(ch, slot) {
    ch.root.position.set(slot.x, Y, slot.z);
    ch.root.rotation.y = slot.yaw ?? 0;
    ch.animator.play('Idle_Talking_Loop', { fade: 0.2 });
    group.add(ch.root);
    dancers.push(ch);
    return ch;
  }

  const BUILDERS = {
    dj(slot) {
      const ch = addNpc(buildGuestBody(assets, rng), slot);
      djKit = createPartyKit();
      djKit.position.set(slot.x + 1.4, Y, slot.z - 0.6);
      djKit.rotation.y = slot.yaw ?? 0;
      group.add(djKit);
      // Two small pulsing lights beside the booth, on top of the kit's own speakers.
      for (const s of [-1, 1]) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x4fe3ff }));
        bulb.position.set(slot.x + 1.4 + s * 1.1, Y + 1.9, slot.z - 0.6);
        group.add(bulb);
        pulsers.push({ mesh: bulb, base: new THREE.Color(0x4fe3ff), k: 3 + s });
      }
      return [ch];
    },
    // Stands beside the existing cake prop (src/game/finale.js's own, at its table near (3, 4))
    // instead of bringing a second one: freeRoam() (called from celebrate() below) reveals it.
    baker(slot) {
      const ch = addNpc(buildGuestBody(assets, rng), slot);
      const apron = prop(new THREE.BoxGeometry(0.34, 0.5, 0.1), PALETTE.paper);
      apron.position.set(0, -0.05, 0.09);
      ch.bone('spine_02')?.add(apron);
      const toqueBase = prop(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14), PALETTE.paper);
      const toqueTop = prop(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), PALETTE.paper);
      toqueTop.position.y = 0.08;
      const toque = new THREE.Group();
      toque.add(toqueBase, toqueTop);
      toque.position.y = 0.16;
      ch.bone('Head')?.add(toque);
      return [ch];
    },
    band(slots) {
      const made = [];
      slots.forEach((slot, i) => {
        const ch = addNpc(buildGuestBody(assets, rng), slot);
        if (i === 0) {
          // Guitar: a slim body and a neck, held in front.
          const body = prop(new THREE.BoxGeometry(0.05, 0.55, 0.32), PALETTE.balloon);
          const neck = prop(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), 0x5a3a24);
          neck.rotation.z = Math.PI / 2;
          neck.position.set(0, 0.35, -0.03);
          const guitar = new THREE.Group();
          guitar.add(body, neck);
          guitar.rotation.z = 0.5;
          guitar.position.set(0.18, -0.15, 0.28);
          ch.bone('spine_02')?.add(guitar);
        } else if (i === 1) {
          // A small snare drum on a stand in front of the player.
          const drum = new THREE.Group();
          const shell = prop(new THREE.CylinderGeometry(0.28, 0.28, 0.24, 16), 0xd8dde6);
          const standPole = prop(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), 0x2a2c32);
          shell.position.y = 0.55;
          drum.add(shell, standPole);
          drum.position.set(0.55, 0, 0.35);
          ch.root.add(drum);
        } else {
          // A microphone on a stand.
          const stand = new THREE.Group();
          const pole = prop(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), 0x2a2c32);
          const mic = prop(new THREE.SphereGeometry(0.06, 8, 6), 0x1a1b1f);
          mic.position.y = 0.58;
          pole.position.y = 0.55;
          stand.add(pole, mic);
          stand.position.set(0, 0, 0.4);
          ch.root.add(stand);
        }
        made.push(ch);
      });
      return made;
    },
    gordon(slot) {
      const ch = addNpc(buildGuestBody(assets, rng), slot);
      const coat = prop(new THREE.CylinderGeometry(0.22, 0.28, 0.85, 10), 0x4b586e);
      coat.position.set(0, -0.15, 0);
      ch.bone('spine_02')?.add(coat);
      const specs = glasses();
      specs.position.set(0, 0.02, 0.14);
      ch.bone('Head')?.add(specs);
      return [ch];
    },
    alfred(slot) {
      const ch = addNpc(buildGuestBody(assets, rng), slot);
      const vest = prop(new THREE.BoxGeometry(0.3, 0.42, 0.16), 0x14151b);
      vest.position.set(0, -0.03, 0);
      ch.bone('spine_02')?.add(vest);
      const tray = new THREE.Group();
      const disc = prop(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20), 0xd8dde6);
      const cup = prop(new THREE.CylinderGeometry(0.035, 0.03, 0.05, 10), PALETTE.paper);
      cup.position.set(0.06, 0.03, 0);
      tray.add(disc, cup);
      const hand = ch.bone('hand_l');
      if (hand) { tray.rotation.x = -0.3; hand.add(tray); }
      return [ch];
    },
    nightwing(slot) {
      // Prefer the real Nightwing system when it's merged in (src/allies/nightwing.js's own
      // contract: spawn(p, mode), actor); a simple look-alike otherwise so this branch's own
      // party still works end to end. His own combat AI (updateAlly, run every frame from
      // game.js) keeps steering his animation, so Dance_Loop may not stick on the real actor.
      const nw = window.__game?.nightwing;
      if (nw?.spawn) {
        nw.spawn({ x: slot.x, y: Y, z: slot.z }, 'ally');
        const actor = nw.actor;
        if (actor) dancers.push(actor);
        return actor ? [actor] : [];
      }
      const ch = addNpc(buildGuestBody(assets, rng), slot);
      const suit = prop(new THREE.CylinderGeometry(0.2, 0.24, 0.9, 10), 0x14151b);
      suit.position.set(0, -0.12, 0);
      ch.bone('spine_02')?.add(suit);
      const chevron = prop(new THREE.CircleGeometry(0.1, 3), PALETTE.detective);
      chevron.position.set(0, 0.15, 0.13);
      chevron.rotation.z = Math.PI;
      ch.bone('spine_02')?.add(chevron);
      const mask = prop(new THREE.BoxGeometry(0.22, 0.05, 0.02), 0x0b0b12);
      mask.position.set(0, 0.02, 0.13);
      ch.bone('Head')?.add(mask);
      return [ch];
    },
    kids(slots) {
      const colors = [PALETTE.signal, PALETTE.neonCyan, PALETTE.neonPink];
      return slots.map((slot, i) => {
        const ch = addNpc(buildGuestBody(assets, rng, true), slot);
        const hat = partyHat(colors[i % colors.length]);
        ch.bone('Head')?.add(hat);
        return ch;
      });
    },
  };

  const api = {
    get guests() { return guests.map((g) => g.id); },
    addGuest(id) {
      if (guests.some((g) => g.id === id)) return false;
      const build = BUILDERS[id];
      if (!build) return false;
      decorate();
      const slots = guestSlots(id);
      const made = build(slots.length > 1 ? slots : slots[0]);
      // The guests' ink outline shells come off: a dozen skinned characters, each drawn twice,
      // made the finale the slowest scene in the game (about 7 ms of GPU time on an RTX 4060;
      // draw-bound, so fewer triangles did not help). The ink pass still draws their edges, and
      // side by side they look the same. Only skinned shells: the props keep theirs.
      group.traverse((o) => { if (o.isSkinnedMesh && o.material?.userData?.outline) o.visible = false; });
      guests.push({ id, made });
      events?.emit?.('partyGuest', { id });
      return true;
    },
    celebrate() {
      for (const ch of dancers) ch?.animator?.play?.('Dance_Loop', { fade: 0.2 });
      if (gfx?.confetti) {
        const at = new THREE.Vector3(0, Y + 2, 0);
        gfx.confetti.burst(at, 500);
        gfx.confetti.burst(new THREE.Vector3(-8, Y + 2, -6), 300);
        gfx.confetti.burst(new THREE.Vector3(8, Y + 2, 6), 300);
        const letters = letterPoints(birthdayLine(MANSI.name), { cell: 0.7 }).points;
        gfx.confetti.letters(at, new THREE.Vector3(0, Y + 16, -30), new THREE.Vector3(1, 0, 0), letters, 0.7);
      }
      finale?.freeRoam?.();
      events?.emit?.('partyCelebrate');
    },
    reset() {
      // The real Nightwing (if used) is externally owned: despawn him properly instead of
      // ripping his root out from under src/allies/nightwing.js's own state.
      if (guests.some((g) => g.id === 'nightwing')) window.__game?.nightwing?.despawn?.();
      for (const g of guests) {
        if (g.id === 'nightwing') continue;
        for (const m of g.made) { const root = m?.root ?? m?.ch?.root; if (root?.parent) root.parent.remove(root); }
      }
      guests.length = 0;
      dancers.length = 0;
      pulsers.length = 0;
      while (group.children.length) group.remove(group.children[0]);
      djKit = null; decorated = false;
    },
    update(dt, camPos) {
      // Every frame, not only on a change: a guest can join while the camera is across the city.
      if (camPos) {
        near = guestsInView(camPos);
        for (const c of group.children) if (!c.userData.keepFar) c.visible = near;
      }
      if (!near) return;
      // Nobody else advances these guests' animations (they are not fighters): without this they
      // stand in the rig's bind pose, arms out, through the whole finale.
      for (const ch of dancers) ch?.animator?.update?.(dt);
      const now = performance.now() / 1000;
      for (const p of pulsers) p.mesh.material.color.copy(p.base).multiplyScalar(0.6 + Math.sin(now * p.k) * 0.4);
      if (djKit) djKit.userData.ball.rotation.y += dt * 1.2;
    },
  };
  return api;
}
