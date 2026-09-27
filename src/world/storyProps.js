// The things the Joker stole: presents, the party, the cake. Built from primitives in the toon style.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import MANSI from '../mansi.config.js';

const mat = (color, extra = {}) => toonMaterial({ color, ...extra });

function gift(size, color, ribbon = PALETTE.paper) {
  const g = new THREE.Group();
  const [w, h, d] = size;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  box.position.y = h / 2;
  addHullOutline(box, 0.02);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, d * 0.16), mat(ribbon));
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.16, h + 0.02, d + 0.02), mat(ribbon));
  r1.position.y = r2.position.y = h / 2;
  const bowGeo = new THREE.TorusGeometry(Math.min(w, d) * 0.16, 0.04, 8, 16);
  for (const s of [-1, 1]) {
    const bow = new THREE.Mesh(bowGeo, mat(ribbon));
    bow.position.set(s * Math.min(w, d) * 0.14, h + 0.08, 0);
    bow.rotation.set(0, Math.PI / 2, s * 0.6);
    g.add(bow);
  }
  g.add(box, r1, r2);
  return g;
}

export function createPresents() {
  const g = new THREE.Group();
  const specs = [
    [[0.9, 0.7, 0.9], PALETTE.balloon, PALETTE.signal, 0, 0, 0],
    [[0.6, 0.5, 0.6], PALETTE.containerBlue, PALETTE.paper, 0.85, 0, 0.3],
    [[0.7, 0.9, 0.5], PALETTE.jokerPurple, PALETTE.jokerGreen, -0.8, 0, -0.1],
    [[0.5, 0.4, 0.5], PALETTE.signal, PALETTE.balloon, 0.1, 0.7, 0.05],
    [[0.45, 0.35, 0.45], PALETTE.containerGreen, PALETTE.paper, -0.3, 0, 0.8],
  ];
  for (const [size, color, ribbon, x, y, z] of specs) {
    const p = gift(size, color, ribbon);
    p.position.set(x, y, z);
    p.rotation.y = x * 0.7;
    g.add(p);
  }
  return g;
}

function discoBall() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), toonMaterial({ color: 0xc9d4e6, emissive: 0x33445a, flatShading: true }));
  ball.material.flatShading = true;
  addHullOutline(ball, 0.02);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2), mat(PALETTE.ink));
  cord.position.y = 1.15;
  g.add(ball, cord);
  return g;
}

export function createPartyKit() {
  const g = new THREE.Group();
  // Crates stenciled PARTY, speakers, a disco ball, bunting.
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#6a5438'; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = '#3a2c1c'; x.lineWidth = 6; x.strokeRect(6, 6, 244, 116);
  x.font = '64px Bangers, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#0b0b12'; x.fillText('PARTY', 128, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const crateMat = toonMaterial({ map: t });
  for (const [cx, cz, s] of [[0, 0, 1], [1.2, 0.2, 0.8], [-1.1, -0.3, 0.9], [0.1, 1.1, 0.7]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), crateMat);
    crate.position.set(cx, s * 0.4, cz);
    crate.rotation.y = cx * 0.4;
    addHullOutline(crate, 0.02);
    g.add(crate);
  }
  for (const s of [-1, 1]) {
    const spk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.6), mat(0x1e2026));
    spk.position.set(s * 2.3, 0.7, -0.6);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), mat(0x3a3f4a));
    cone.position.set(s * 2.3, 0.9, -0.29);
    addHullOutline(spk, 0.02);
    g.add(spk, cone);
  }
  const ball = discoBall();
  ball.position.set(0, 2.4, 0.2);
  g.add(ball);
  g.userData.ball = ball;
  return g;
}

export function createCake() {
  const g = new THREE.Group();
  const tiers = [[1.2, 0.7], [0.9, 0.6], [0.6, 0.5]];
  let y = 0;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.08, 40), mat(0xd8dde6));
  plate.position.y = 0.04;
  addHullOutline(plate, 0.02);
  g.add(plate);
  y = 0.08;
  // Name band on the bottom tier.
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#f1d9c0'; x.fillRect(0, 0, 1024, 128);
  x.font = '84px "Patrick Hand SC", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#c8323c';
  for (let k = 0; k < 2; k++) x.fillText(MANSI.name.toUpperCase(), 256 + k * 512, 70);
  const nameTex = new THREE.CanvasTexture(c); nameTex.colorSpace = THREE.SRGBColorSpace;
  tiers.forEach(([r, h], i) => {
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), i === 0 ? toonMaterial({ map: nameTex }) : mat(PALETTE.cake));
    tier.position.y = y + h / 2;
    addHullOutline(tier, 0.02);
    const frost = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 40), mat(PALETTE.frosting));
    frost.rotation.x = Math.PI / 2;
    frost.position.y = y + h;
    g.add(tier, frost);
    y += h;
  });
  const flames = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const cx = Math.cos(a) * 0.38, cz = Math.sin(a) * 0.38;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), mat(i % 2 ? PALETTE.neonCyan : PALETTE.signal));
    candle.position.set(cx, y + 0.15, cz);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8), new THREE.MeshBasicMaterial({ color: 0xffc36a }));
    flame.position.set(cx, y + 0.37, cz);
    flames.push(flame);
    g.add(candle, flame);
  }
  g.userData.flames = flames;
  g.userData.top = y + 0.4;
  return g;
}

// Pickup wrapper: a stolen item waiting at a site, with a slow bob and a glow halo.
export function createPickups(scene, halos, sites) {
  const items = {
    presents: { group: createPresents(), site: sites.presents, taken: false },
    party: { group: createPartyKit(), site: sites.party, taken: false },
    cake: { group: createCake(), site: sites.cake, taken: false },
  };
  for (const [id, it] of Object.entries(items)) {
    it.group.position.set(it.site.x, it.site.y, it.site.z);
    it.halo = halos.add(it.site.x, it.site.y + 1.2, it.site.z, id === 'party' ? PALETTE.neonPink : PALETTE.signal, 6);
    scene.add(it.group);
  }
  return {
    items,
    // Marks an item recovered. It stays in place for its reward comic, then hide() clears it.
    take(id) {
      const it = items[id];
      if (!it || it.taken) return;
      it.taken = true;
      halos.setSize(it.halo, 0.01);
    },
    hide(id) { if (items[id]) items[id].group.visible = false; },
    restore(taken) { for (const id of taken) { this.take(id); this.hide(id); } },
    update(t) {
      const ball = items.party.group.userData.ball;
      if (ball) ball.rotation.y = t * 0.8;
      for (const f of items.cake.group.userData.flames) f.scale.y = 0.8 + Math.sin(t * 20 + f.position.x * 9) * 0.25;
    },
  };
}

// Once the party is recovered, Neon Row gets bunting and coloured lights over the street.
export function createNeonParty(scene, halos) {
  const g = new THREE.Group();
  g.visible = false;
  const colors = [PALETTE.balloon, PALETTE.signal, PALETTE.neonCyan, PALETTE.jokerPurple, PALETTE.neonPink];
  const mats = colors.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.4, 0, 0), new THREE.Vector3(0.4, 0, 0), new THREE.Vector3(0, -0.8, 0)]);
  const lights = [];
  for (let z = -80; z <= 120; z += 14) {
    for (let k = 1; k < 12; k++) {
      const t = k / 12;
      const f = new THREE.Mesh(tri, mats[(k + z) % mats.length]);
      f.position.set(141 + 18 * t, 12 - Math.sin(t * Math.PI) * 1.8, z + 7);
      g.add(f);
    }
    lights.push([150, 11.5, z + 7]);
  }
  scene.add(g);
  const ids = [];
  return {
    show() {
      if (g.visible) return;
      g.visible = true;
      for (const [x, y, z] of lights) ids.push(halos.add(x, y, z, colors[ids.length % colors.length], 7));
    },
  };
}
