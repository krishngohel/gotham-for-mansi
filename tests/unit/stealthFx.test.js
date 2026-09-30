import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStealthFx, createStealthWarm, STEALTH_FX_MAX, STATE_COLORS } from '../../src/stealth/stealthFx.js';
import { createMind } from '../../src/stealth/brain.js';
import { LAYER_XRAY, LAYER_FX } from '../../src/render/layers.js';
import { PALETTE } from '../../src/config/palette.js';

function goon(x, z, alert = 'patrol', aiming = false) {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(x, 1.4, z + 0.7);
  const e = { alive: true, down: false, pos: new THREE.Vector3(x, 0, z), yaw: 0.5, aiming, ch: { muzzle, xrays: [{ material: { color: new THREE.Color(PALETTE.sodium) } }] } };
  const mind = createMind();
  mind.alert = alert;
  return { e, mind, range: 15, color: -1 };
}
const hero = { pos: new THREE.Vector3(0, 0, 10), crouched: false };
function setup() {
  const scene = new THREE.Scene();
  const fx = createStealthFx(scene);
  const goons = [goon(0, 0, 'patrol', true), goon(5, 0, 'search'), goon(9, 0, 'hunt')];
  return { scene, fx, goons, cones: fx.parts.cones };
}

describe('stealth visuals', () => {
  it('are built up front: nothing is added to the scene afterwards', () => {
    const { scene, fx, goons } = setup();
    const n = scene.children.length;
    for (let i = 0; i < 100; i++) fx.update(0.016, goons, { detective: true, hero });
    fx.shot(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 1.1, 10));
    fx.update(0.016, goons, { detective: true, hero });
    fx.clear(goons);
    expect(scene.children.length).toBe(n);
    expect(fx.parts.cones).toHaveLength(STEALTH_FX_MAX);
  });
  it('in detective vision each goon has a cone in its state colour, sized to its sight range', () => {
    const { fx, goons, cones } = setup();
    fx.update(0.016, goons, { detective: true, hero });
    expect(cones.slice(0, 4).map((c) => c.visible)).toEqual([true, true, true, false]);
    expect(cones.map((c) => c.material.color.getHex()).slice(0, 3)).toEqual(STATE_COLORS);
    expect(cones.every((c) => c.layers.mask === 1 << LAYER_XRAY)).toBe(true);
    expect(cones[1].position.toArray()).toEqual([5, 0.06, 0]);
    expect(cones[1].rotation.y).toBeCloseTo(0.5);
    expect(cones[1].scale.x).toBe(15);
  });
  it('cones hide outside detective vision; x-ray tints follow the state and clear() restores them', () => {
    const { fx, goons, cones } = setup();
    fx.update(0.016, goons, { detective: false, hero });
    expect(cones.some((c) => c.visible)).toBe(false);
    expect(goons[1].e.ch.xrays[0].material.color.getHex()).toBe(STATE_COLORS[1]);
    expect(goons[2].e.ch.xrays[0].material.color.getHex()).toBe(STATE_COLORS[2]);
    fx.clear(goons);
    expect(goons[2].e.ch.xrays[0].material.color.getHex()).toBe(PALETTE.sodium);
  });
  // Mirrors the real wiring (game.js): events.on('stealthEnd', () => stealthFx.clear()) is called
  // with NO goons, because stealthSystem.end() has already emptied its own goons array by the time
  // it emits `stealthEnd`. stealthFx must remember who it tinted itself.
  it('clear() with no arguments still restores every x-ray it tinted', () => {
    const { fx, goons } = setup();
    fx.update(0.016, goons, { detective: false, hero });
    expect(goons[1].e.ch.xrays[0].material.color.getHex()).toBe(STATE_COLORS[1]);
    expect(goons[2].e.ch.xrays[0].material.color.getHex()).toBe(STATE_COLORS[2]);
    fx.clear();
    for (const g of goons) expect(g.e.ch.xrays[0].material.color.getHex()).toBe(PALETTE.sodium);
  });
  it('draws a laser from each aiming muzzle to Batman chest', () => {
    const { fx, goons } = setup();
    fx.update(0.016, goons, { detective: false, hero });
    const { lasers } = fx.parts;
    expect(lasers.visible).toBe(true);
    expect(lasers.layers.mask).toBe(1 << LAYER_FX);
    expect(lasers.geometry.drawRange.count).toBe(2);
    const p = lasers.geometry.attributes.position.array;
    expect(Array.from(p.slice(0, 6)).map((v) => +v.toFixed(2))).toEqual([0, 1.4, 0.7, 0, 1.1, 10]);
    goons[0].e.aiming = false;
    fx.update(0.016, goons, { detective: false, hero });
    expect(lasers.visible).toBe(false);
  });
  it('a shot flashes for a moment', () => {
    const { fx, goons } = setup();
    fx.shot(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 1.1, 10));
    fx.update(0.016, goons, { detective: false, hero });
    expect(fx.parts.tracers.visible).toBe(true);
    expect(fx.parts.flashes.some((f) => f.visible)).toBe(true);
    for (let i = 0; i < 20; i++) fx.update(0.016, goons, { detective: false, hero });
    expect(fx.parts.tracers.visible).toBe(false);
    expect(fx.parts.flashes.some((f) => f.visible)).toBe(false);
  });
  it('the warm-up copy holds one of every material', () => {
    const g = createStealthWarm();
    const mats = new Set();
    g.traverse((o) => { if (o.material) mats.add(o.material); });
    // cones (3) + laser + laserOutline + tracer + flash + every shared x-ray silhouette colour
    // (PALETTE.sodium, the 3 state colours, PALETTE.jokerGreen - see toon.js's xrayMaterial cache).
    expect(mats.size).toBe(STATE_COLORS.length + 4 + (STATE_COLORS.length + 2));
  });
  // Fix round 1: a lone red laser washed out against a bright backdrop (Ace Chemicals' green vat
  // glow). A dark ink twin, offset a hair above and below the laser's own path, keeps it legible
  // without touching `lasers`' own geometry (so the test above stays exact).
  it('draws a dark ink outline framing the laser, and hides with it', () => {
    const { fx, goons } = setup();
    fx.update(0.016, goons, { detective: false, hero });
    const { laserOutline } = fx.parts;
    expect(laserOutline.visible).toBe(true);
    expect(laserOutline.layers.mask).toBe(1 << LAYER_FX);
    expect(laserOutline.material.color.getHex()).toBe(PALETTE.ink);
    expect(laserOutline.geometry.drawRange.count).toBe(4);
    const p = laserOutline.geometry.attributes.position.array;
    expect(+p[1].toFixed(2)).toBeCloseTo(1.45); // muzzle y (1.4) + the outline's offset
    expect(+p[7].toFixed(2)).toBeCloseTo(1.35); // muzzle y (1.4) - the outline's offset
    goons[0].e.aiming = false;
    fx.update(0.016, goons, { detective: false, hero });
    expect(laserOutline.visible).toBe(false);
  });
  // combatSystem's onRifleFire passes `lands` (whether the shot will actually damage Batman) as a
  // third argument; the tracer tints warm on a hit and cool on a miss via one shared vertex-coloured
  // material, so this doesn't add to the material count above.
  it('a hit tracer reads warm and a miss reads cool, sharing one material', () => {
    const { fx, goons } = setup();
    fx.shot(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 1.1, 10), true);
    fx.update(0.016, goons, { detective: false, hero });
    const hitCol = Array.from(fx.parts.tracers.geometry.attributes.color.array.slice(0, 3));
    for (let i = 0; i < 20; i++) fx.update(0.016, goons, { detective: false, hero });
    fx.shot(new THREE.Vector3(5, 1.4, 0), new THREE.Vector3(0, 1.1, 10), false);
    fx.update(0.016, goons, { detective: false, hero });
    const missCol = Array.from(fx.parts.tracers.geometry.attributes.color.array.slice(6, 9));
    expect(hitCol).not.toEqual(missCol);
    // Warmer (more red than blue) on a hit, cooler (more blue than red) on a miss.
    expect(hitCol[0]).toBeGreaterThan(hitCol[2]);
    expect(missCol[2]).toBeGreaterThan(missCol[0]);
    expect(fx.parts.tracers.material.vertexColors).toBe(true);
  });
  it('shot(from, to) with no third argument reads as a hit', () => {
    const { fx, goons } = setup();
    fx.shot(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 1.1, 10));
    fx.update(0.016, goons, { detective: false, hero });
    const col = Array.from(fx.parts.tracers.geometry.attributes.color.array.slice(0, 3));
    expect(col[0]).toBeGreaterThan(col[2]);
  });
});
