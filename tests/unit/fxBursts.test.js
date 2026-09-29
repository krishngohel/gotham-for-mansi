// tests/unit/fxBursts.test.js: hit starbursts age on real time, so a critical's slow motion never
// leaves them hanging over the action camera's shot.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';

beforeAll(() => {
  // fx.js paints its star texture on a canvas: a do-nothing 2D context is enough here.
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}) });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
});

describe('hit starbursts', () => {
  it('are gone after 0.2 s of real time even at quarter-speed slow motion', async () => {
    const { createFx } = await import('../../src/game/fx.js');
    const scene = new THREE.Scene();
    const fx = createFx(scene);
    fx.impact(new THREE.Vector3(0, 1, 0));
    const live = () => scene.children.filter((o) => o.isSprite && o.visible).length;
    expect(live()).toBe(1);
    // Twelve frames at 60 fps with game time slowed to a quarter.
    for (let f = 0; f < 12; f++) fx.update(1 / 60 / 4, 1 / 60);
    expect(live()).toBe(0);
  });
  it('still animate on game time when no real time is passed (old callers)', async () => {
    const { createFx } = await import('../../src/game/fx.js');
    const scene = new THREE.Scene();
    const fx = createFx(scene);
    fx.impact(new THREE.Vector3(0, 1, 0));
    for (let f = 0; f < 12; f++) fx.update(1 / 60);
    expect(scene.children.filter((o) => o.isSprite && o.visible).length).toBe(0);
  });
});
