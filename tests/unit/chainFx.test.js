import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createChainFx, CHAIN_FX_MAX } from '../../src/game/chainFx.js';

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
  it('never writes past its buffer', () => {
    const { fx, lines } = setup();
    for (let b = 0; b < 5; b++) fx.bind([goon(b, { state: 'tied' }), goon(b + 0.5, { state: 'tied' }), goon(b + 1, { state: 'tied' })]);
    fx.fire(hand, [goon(1), goon(2), goon(3)], 0.1);
    fx.update(0.5);
    expect(lines.geometry.drawRange.count).toBeLessThanOrEqual(CHAIN_FX_MAX);
  });
});
