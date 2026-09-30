// Predator visuals, built once per run and only moved afterwards:
// - vision cones: a flat fan on the floor in front of each room goon, the size of its current
//   sight range, drawn only in detective vision (LAYER_XRAY): white patrolling, yellow searching,
//   red hostile. The goon's x-ray silhouette gets the same colour;
// - laser sights: a red line from the muzzle to Batman while a rifle goon aims (one LineSegments).
//   A second, dark ink LineSegments is drawn a hair above and below the same path: against a bright
//   backdrop (the Ace Chemicals vats' green glow) a lone 1px red line reads as a thin dark scratch,
//   the same "thin lines lose their colour" issue noted on the batarang trail (gadgetFx.js). The
//   ink outline keeps the red core legible everywhere without needing a full ribbon rewrite;
// - shots: a pale tracer and a muzzle flash for a moment when a rifle fires. A hit tracer reads
//   warm and bright; a miss reads cooler and dimmer (vertex colours on the one shared material, so
//   the warm-cast material count doesn't grow per outcome).
// createStealthWarm() puts one of each material in the boot warm cast (warmCast.js).
import * as THREE from 'three';
import { LAYER_FX, LAYER_XRAY } from '../render/layers.js';
import { PALETTE } from '../config/palette.js';
import { STEALTH } from './vision.js';
import { stateColor } from './brain.js';
import { xrayMaterial } from '../render/toon.js';

export const STEALTH_FX_MAX = 8;
export const STATE_COLORS = [0xe8f0ff, 0xffd23a, 0xff3b3b]; // patrolling, searching, hostile
const SHOTS = 4, SHOT_LIFE = 0.12;
const HIT_COLOR = new THREE.Color(0xfff1b8);
const MISS_COLOR = new THREE.Color(0x8a93a8);
const LASER_OUTLINE_DY = 0.05; // metres the ink outline sits above/below the laser's own path

// A unit-radius fan in the XZ plane, apex at the origin, opening toward +z (a goon's yaw 0).
function coneGeometry(fov = STEALTH.fov, seg = 16) {
  const pos = [0, 0, 0];
  for (let i = 0; i <= seg; i++) {
    const a = -fov / 2 + (fov * i) / seg;
    pos.push(Math.sin(a), 0, Math.cos(a));
  }
  const idx = [];
  for (let i = 1; i <= seg; i++) idx.push(0, i + 1, i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
const segments = (n) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  return g;
};
// Same layout as segments(), plus a per-vertex colour so a shared LineBasicMaterial can still
// tell a hit tracer from a miss without a second material.
const coloredSegments = (n) => {
  const g = segments(n);
  const col = new THREE.BufferAttribute(new Float32Array(n * 6), 3);
  col.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('color', col);
  return g;
};

let shared = null;
export function stealthMaterials() {
  if (shared) return shared;
  shared = {
    cones: STATE_COLORS.map((color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthTest: false, depthWrite: false, side: THREE.DoubleSide })),
    laser: new THREE.LineBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.95 }),
    // A dark ink twin of the laser, offset a hair above/below it (see the module comment).
    laserOutline: new THREE.LineBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.85 }),
    tracer: new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 1 }),
    flash: new THREE.MeshBasicMaterial({ color: 0xffd86a }),
  };
  return shared;
}

// A throwaway one-bone SkinnedMesh so a shared xrayMaterial(color) (toon.js/addXray) gets its
// program compiled here, under the loading screen, as the same kind of object (SkinnedMesh, on
// LAYER_XRAY) drawEverything() (render/prewarm.js) will later draw a goon's x-ray silhouette as -
// isSkinnedMesh is part of a material's program cache key, so warming with a plain Mesh wouldn't
// cover it.
function xraySkinWarm(color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0], 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const bone = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(geo, xrayMaterial(color));
  mesh.add(bone);
  mesh.bind(new THREE.Skeleton([bone]));
  mesh.layers.set(LAYER_XRAY);
  return mesh;
}

// One of each, below the city, drawn once under the loading screen.
export function createStealthWarm() {
  const m = stealthMaterials();
  const group = new THREE.Group();
  group.name = 'stealthWarm';
  const geo = coneGeometry();
  m.cones.forEach((mat, i) => { const c = new THREE.Mesh(geo, mat); c.position.set(20 + i * 2, -50, 0); group.add(c); });
  const line = segments(1);
  line.attributes.position.array.set([30, -50, 0, 31, -49, 0]);
  const tline = coloredSegments(1);
  tline.attributes.position.array.set([30, -50, 0, 31, -49, 0]);
  tline.attributes.color.array.set([1, 1, 1, 1, 1, 1]);
  group.add(new THREE.LineSegments(line, m.laser), new THREE.LineSegments(line, m.laserOutline), new THREE.LineSegments(tline, m.tracer));
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), m.flash);
  flash.position.set(32, -50, 0);
  group.add(flash);
  // Every shared x-ray silhouette colour a goon or the Joker can wear (toon.js's xrayMaterial
  // cache): PALETTE.sodium at rest, the three STEALTH_FX state colours, and the Joker's green.
  let wx = 34;
  for (const color of [PALETTE.sodium, ...STATE_COLORS, PALETTE.jokerGreen]) {
    const x = xraySkinWarm(color);
    x.position.set(wx, -50, 0);
    wx += 1;
    group.add(x);
  }
  return group;
}

export function createStealthFx(scene) {
  const m = stealthMaterials();
  const geo = coneGeometry();
  const cones = [];
  for (let i = 0; i < STEALTH_FX_MAX; i++) {
    const c = new THREE.Mesh(geo, m.cones[0]);
    c.layers.set(LAYER_XRAY);
    c.visible = false;
    c.frustumCulled = false;
    c.renderOrder = 2;
    scene.add(c);
    cones.push(c);
  }
  const laserGeo = segments(STEALTH_FX_MAX);
  const laserPos = laserGeo.attributes.position.array;
  laserGeo.setDrawRange(0, 0);
  const lasers = new THREE.LineSegments(laserGeo, m.laser);
  // The dark outline twin: two offset copies (above and below) per laser, so it frames the red
  // core from most camera angles. Written alongside the laser in the same update() pass below,
  // no extra per-frame allocation, just a few more floats into a preallocated buffer.
  const outlineGeo = segments(STEALTH_FX_MAX * 2);
  const outlinePos = outlineGeo.attributes.position.array;
  outlineGeo.setDrawRange(0, 0);
  const laserOutline = new THREE.LineSegments(outlineGeo, m.laserOutline);
  laserOutline.renderOrder = 1;
  lasers.renderOrder = 2;
  const tracerGeo = coloredSegments(SHOTS);
  const tracerPos = tracerGeo.attributes.position.array;
  const tracerCol = tracerGeo.attributes.color.array;
  const tracers = new THREE.LineSegments(tracerGeo, m.tracer);
  for (const o of [laserOutline, lasers, tracers]) { o.layers.set(LAYER_FX); o.frustumCulled = false; o.visible = false; scene.add(o); }
  const flashGeo = new THREE.OctahedronGeometry(0.18);
  const flashes = [];
  for (let i = 0; i < SHOTS; i++) {
    const f = new THREE.Mesh(flashGeo, m.flash);
    f.layers.set(LAYER_FX);
    f.visible = false;
    f.frustumCulled = false;
    scene.add(f);
    flashes.push(f);
  }
  const life = new Float32Array(SHOTS);
  const tmp = new THREE.Vector3();
  let next = 0;
  // Swaps each mesh onto the shared material for that colour (addXray/xrayMaterial in toon.js):
  // never mutates a material's own .color, which would recolor every other character currently
  // sharing that same instance.
  const tint = (e, hex) => { for (const x of e.ch.xrays ?? []) x.material = xrayMaterial(hex); };
  // Which goon (its enemy record `e`) each cone slot last tinted, so clear() can restore x-ray
  // colours even when it's called with no goons (the real wiring: stealthSystem.end() empties its
  // own goons array and emits `stealthEnd` with no payload before game.js's
  // `events.on('stealthEnd', () => stealthFx.clear())` ever runs). Preallocated, one slot per cone.
  const tracked = new Array(STEALTH_FX_MAX).fill(null);

  return {
    parts: { cones, lasers, laserOutline, tracers, flashes },
    update(dt, goons, { detective = false, hero = null } = {}) {
      let n = 0;
      for (let i = 0; i < cones.length; i++) {
        const g = goons[i], c = cones[i];
        if (g) tracked[i] = g.e;
        if (!g || !g.e.alive) { c.visible = false; continue; }
        const s = stateColor(g.mind);
        if (s !== g.color) { g.color = s; c.material = m.cones[s]; tint(g.e, STATE_COLORS[s]); }
        c.visible = detective && !g.e.down;
        if (c.visible) {
          c.position.set(g.e.pos.x, g.e.pos.y + 0.06, g.e.pos.z);
          c.rotation.y = g.e.yaw;
          c.scale.setScalar(g.range);
        }
        if (hero && g.e.aiming && g.e.ch.muzzle) {
          g.e.ch.muzzle.getWorldPosition(tmp);
          const hy = hero.pos.y + (hero.crouched ? 0.7 : 1.1);
          const o = n * 6;
          laserPos[o] = tmp.x; laserPos[o + 1] = tmp.y; laserPos[o + 2] = tmp.z;
          laserPos[o + 3] = hero.pos.x; laserPos[o + 4] = hy; laserPos[o + 5] = hero.pos.z;
          const oo = n * 12;
          outlinePos[oo] = tmp.x; outlinePos[oo + 1] = tmp.y + LASER_OUTLINE_DY; outlinePos[oo + 2] = tmp.z;
          outlinePos[oo + 3] = hero.pos.x; outlinePos[oo + 4] = hy + LASER_OUTLINE_DY; outlinePos[oo + 5] = hero.pos.z;
          outlinePos[oo + 6] = tmp.x; outlinePos[oo + 7] = tmp.y - LASER_OUTLINE_DY; outlinePos[oo + 8] = tmp.z;
          outlinePos[oo + 9] = hero.pos.x; outlinePos[oo + 10] = hy - LASER_OUTLINE_DY; outlinePos[oo + 11] = hero.pos.z;
          n += 1;
        }
      }
      laserGeo.setDrawRange(0, n * 2);
      if (n) laserGeo.attributes.position.needsUpdate = true;
      lasers.visible = n > 0;
      outlineGeo.setDrawRange(0, n * 4);
      if (n) outlineGeo.attributes.position.needsUpdate = true;
      laserOutline.visible = n > 0;
      let live = 0;
      for (let i = 0; i < SHOTS; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] > 0) { live += 1; continue; }
        flashes[i].visible = false;
        tracerPos.fill(0, i * 6, i * 6 + 6);
        tracerGeo.attributes.position.needsUpdate = true;
      }
      tracers.visible = live > 0;
    },
    // A rifle fired: from the muzzle to where it aimed (copied; the caller reuses its vectors).
    // `hit` (combatSystem's onRifleFire `lands`) tints the tracer warm on a hit, cool on a miss.
    shot(from, to, hit = true) {
      const i = next;
      next = (next + 1) % SHOTS;
      const o = i * 6;
      tracerPos[o] = from.x; tracerPos[o + 1] = from.y; tracerPos[o + 2] = from.z;
      tracerPos[o + 3] = to.x; tracerPos[o + 4] = to.y; tracerPos[o + 5] = to.z;
      tracerGeo.attributes.position.needsUpdate = true;
      const c = hit ? HIT_COLOR : MISS_COLOR;
      tracerCol[o] = c.r; tracerCol[o + 1] = c.g; tracerCol[o + 2] = c.b;
      tracerCol[o + 3] = c.r; tracerCol[o + 4] = c.g; tracerCol[o + 5] = c.b;
      tracerGeo.attributes.color.needsUpdate = true;
      flashes[i].position.copy(from);
      flashes[i].visible = true;
      life[i] = SHOT_LIFE;
      tracers.visible = true;
    },
    // The room ended: hide everything and hand back the goons' usual x-ray colour. Called with no
    // goons in real play (stealthSystem.end() has already emptied its own list by the time
    // `stealthEnd` fires), so it falls back to whatever it last tinted (`tracked`) and forgets them.
    clear(goons = []) {
      for (const c of cones) c.visible = false;
      lasers.visible = false;
      laserGeo.setDrawRange(0, 0);
      laserOutline.visible = false;
      outlineGeo.setDrawRange(0, 0);
      life.fill(0);
      for (const f of flashes) f.visible = false;
      tracerPos.fill(0);
      tracerGeo.attributes.position.needsUpdate = true;
      tracers.visible = false;
      if (goons.length) {
        for (const g of goons) { tint(g.e, PALETTE.sodium); g.color = -1; }
      } else {
        for (const e of tracked) if (e) tint(e, PALETTE.sodium);
      }
      tracked.fill(null);
    },
  };
}
