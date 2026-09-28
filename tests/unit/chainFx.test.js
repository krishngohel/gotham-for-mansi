import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createChainFx, CHAIN_FX_MAX, ROPE_WIDTH } from '../../src/game/chainFx.js';

const goon = (x, o = {}) => {
  const pos = new THREE.Vector3(x, 0, 0);
  return { pos, alive: true, state: 'chained', down: false, ch: { root: { parent: {} }, headWorld: (out, l = 0) => out.set(pos.x, 1.7 + l, pos.z) }, ...o };
};
const setup = () => { const scene = new THREE.Scene(); const fx = createChainFx(scene); return { fx, lines: scene.getObjectByName('chainTether') }; };
const hand = (o) => o.set(0, 1.4, 0);

describe('chainFx', () => {
  it('draws nothing until fired, then the line reaches every goon in turn', () => {
    const { fx, lines } = setup();
    fx.update(0.016);
    expect(lines.visible).toBe(false);
    fx.fire(hand, [goon(1), goon(3), goon(5)], 0.2);
    fx.update(0.05);
    const early = lines.geometry.drawRange.count;
    fx.update(0.3);
    const full = lines.geometry.drawRange.count;
    expect(lines.visible).toBe(true);
    expect(early).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(early);
  });
  it('keeps a tied bundle wrapped until its goons are knocked out', () => {
    const { fx, lines } = setup();
    const gs = [goon(1, { state: 'tied' }), goon(2, { state: 'tied' })];
    fx.bind(gs);
    fx.update(0.016);
    expect(lines.visible).toBe(true);
    for (const g of gs) { g.alive = false; g.state = 'ko'; }
    fx.update(0.016);
    expect(lines.visible).toBe(false);
    expect(fx.active).toBe(false);
  });
  it('drops goons that were despawned', () => {
    const { fx, lines } = setup();
    const gs = [goon(1, { state: 'tied' }), goon(2, { state: 'tied' })];
    fx.bind(gs);
    for (const g of gs) g.ch.root.parent = null;
    fx.update(0.016);
    expect(lines.visible).toBe(false);
  });
  it('lets a fired line fade when nothing gets tied', () => {
    const { fx, lines } = setup();
    fx.fire(hand, [goon(1), goon(2)], 0.2);
    fx.update(0.1);
    fx.update(2);
    expect(lines.visible).toBe(false);
  });
  it('clear() drops a flying line and any bound bundles and fully hides the mesh', () => {
    const { fx, lines } = setup();
    fx.fire(hand, [goon(1), goon(3)], 0.2);
    fx.update(0.05);
    expect(lines.visible).toBe(true);
    fx.clear();
    expect(lines.visible).toBe(false);
    expect(fx.active).toBe(false);
    fx.update(0.016);
    expect(lines.visible).toBe(false);
  });
  it('never writes past its buffer', () => {
    const { fx, lines } = setup();
    // bind keeps at most 3 bundles, so only the last 3 of these 5 survive: three bound 3-goon
    // bundles, the worst coexisting case. Assert the exact count, not just the overflow cap: a
    // silently truncated worst case would still pass a bare toBeLessThanOrEqual check.
    for (let b = 0; b < 5; b++) fx.bind([goon(b, { state: 'tied' }), goon(b + 0.5, { state: 'tied' }), goon(b + 1, { state: 'tied' })]);
    fx.update(0.5);
    // 3 goons x 2 rings x 10 segments, plus 2 spans per goon after the first: 64 segments a
    // bundle, times 3 bundles, times 18 indices a segment. That pins the capacity math above.
    expect(lines.geometry.drawRange.count).toBe(3 * 64 * 18);
    expect(lines.geometry.drawRange.count).toBeLessThanOrEqual(CHAIN_FX_MAX * 18);
  });
  it('draws rope with real width, turned to face the camera, with an ink edge each side', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.4, 7);
    const fx = createChainFx(scene, camera);
    const mesh = scene.getObjectByName('chainTether');
    fx.fire(hand, [goon(1), goon(3)], 0.2);
    fx.update(0.05); // first leg in flight: one segment from the hand toward x = 1
    const p = mesh.geometry.attributes.position, c = mesh.geometry.attributes.color;
    const at = (k) => new THREE.Vector3().fromBufferAttribute(p, k);
    // Across one end: ink, rope, rope, ink, spanning ROPE_WIDTH, square to the line and to the view.
    const across = at(3).sub(at(0));
    expect(across.length()).toBeCloseTo(ROPE_WIDTH, 5);
    const along = at(4).sub(at(0)).normalize();
    expect(Math.abs(across.clone().normalize().dot(along))).toBeLessThan(1e-3);
    expect(Math.abs(across.clone().normalize().dot(new THREE.Vector3(0, 0, 1)))).toBeLessThan(0.2);
    const lum = (k) => c.getX(k) + c.getY(k) + c.getZ(k);
    expect(lum(0)).toBeLessThan(0.3);
    expect(lum(1)).toBeGreaterThan(1.2);
    expect(lum(3)).toBeLessThan(0.3);
  });
  it('wraps each tied goon round the torso, lying down too', () => {
    const scene = new THREE.Scene();
    const fx = createChainFx(scene);
    const mesh = scene.getObjectByName('chainTether');
    // A goon lying along +x: head at (1.7, 0.3, 0), feet at the origin.
    const lying = goon(0, { state: 'tied' });
    lying.ch.headWorld = (out, l = 0) => out.set(1.7, 0.3 + l, 0);
    fx.bind([lying]);
    fx.update(0.016);
    const p = mesh.geometry.attributes.position;
    const n = mesh.geometry.drawRange.count / 18;
    expect(n).toBeGreaterThan(10);
    // Every rope point sits in a ring square to the body axis: its x stays near the torso's.
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let k = 0; k < n * 8; k++) { minX = Math.min(minX, p.getX(k)); maxX = Math.max(maxX, p.getX(k)); maxY = Math.max(maxY, p.getY(k)); }
    expect(minX).toBeGreaterThan(0.5);
    expect(maxX).toBeLessThan(1.3);
    // Flattened: it hugs the body instead of arching high over it.
    expect(maxY).toBeGreaterThan(0.3);
    expect(maxY).toBeLessThan(0.45);
  });
});
