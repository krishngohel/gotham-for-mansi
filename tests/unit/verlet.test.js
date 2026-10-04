import { describe, it, expect } from 'vitest';
import { createCloth, hangFrom, stepCloth } from '../../src/actors/verlet.js';

const make = () => createCloth({ cols: 5, rows: 6, topWidth: 0.3, bottomWidth: 0.9, length: 1.0, pointDrop: 0.08 });
const pinsAt = (cloth, y = 1.5) => {
  const pins = new Float32Array(cloth.cols * 3);
  for (let c = 0; c < cloth.cols; c++) pins.set([(c / (cloth.cols - 1) - 0.5) * 0.3, y, 0], c * 3);
  return pins;
};

describe('cloth', () => {
  it('pins the top row and links neighbors plus shear diagonals', () => {
    const cloth = createCloth({ cols: 3, rows: 4, topWidth: 1, bottomWidth: 1, length: 1 });
    expect(Array.from(cloth.pinned).filter(Boolean)).toHaveLength(3);
    expect(cloth.rest.length).toBe(8 + 9 + 12);
  });

  it('lets no free particle drop below the floor', () => {
    const cloth = make();
    const pins = pinsAt(cloth, 0.5); // a 1 m cloth pinned 0.5 m up: the hem would hang through y = 0
    hangFrom(cloth, pins);
    for (let i = 0; i < 300; i++) stepCloth(cloth, 1 / 120, { pins, floor: 0.02 });
    for (let i = cloth.cols; i < cloth.n; i++) expect(cloth.pos[i * 3 + 1]).toBeGreaterThanOrEqual(0.02 - 1e-6);
    // Without a floor the same cloth hangs through it.
    const free = make();
    hangFrom(free, pins);
    for (let i = 0; i < 300; i++) stepCloth(free, 1 / 120, { pins });
    expect(Math.min(...Array.from({ length: free.n }, (_, i) => free.pos[i * 3 + 1]))).toBeLessThan(0);
  });

  it('floors each point on its own ground so a hem hangs past an edge', () => {
    const cloth = make();
    const pins = pinsAt(cloth, 0.5);
    hangFrom(cloth, pins);
    // Ground at 0.1 under the left half of the cloth, nothing under the right half.
    const floors = new Float32Array(cloth.n);
    for (let i = 0; i < cloth.n; i++) floors[i] = (i % cloth.cols) < 2 ? 0.1 : -Infinity;
    for (let i = 0; i < 300; i++) stepCloth(cloth, 1 / 120, { pins, floor: floors });
    const bottom = (c) => cloth.pos[((cloth.rows - 1) * cloth.cols + c) * 3 + 1];
    expect(bottom(0)).toBeGreaterThanOrEqual(0.1 - 1e-6);
    expect(bottom(1)).toBeGreaterThanOrEqual(0.1 - 1e-6);
    expect(bottom(4)).toBeLessThan(0);
  });

  it('keeps pinned particles on their pins and stays near rest length', () => {
    const cloth = make();
    const pins = pinsAt(cloth);
    hangFrom(cloth, pins);
    for (let i = 0; i < 600; i++) stepCloth(cloth, 1 / 120, { pins });
    for (let c = 0; c < cloth.cols; c++) {
      expect(cloth.pos[c * 3]).toBeCloseTo(pins[c * 3], 5);
      expect(cloth.pos[c * 3 + 1]).toBeCloseTo(pins[c * 3 + 1], 5);
    }
    let worst = 0;
    for (let k = 0; k < cloth.rest.length; k++) {
      const a = cloth.cons[2 * k] * 3, b = cloth.cons[2 * k + 1] * 3;
      const d = Math.hypot(cloth.pos[b] - cloth.pos[a], cloth.pos[b + 1] - cloth.pos[a + 1], cloth.pos[b + 2] - cloth.pos[a + 2]);
      worst = Math.max(worst, d / cloth.rest[k]);
    }
    expect(worst).toBeLessThan(1.1);
  });

  it('keeps every free particle behind the back plane and under its top, even in a wind blowing it forward and up', () => {
    const cloth = make();
    const pins = pinsAt(cloth);
    hangFrom(cloth, pins);
    // The wearer faces +z from the pin line; a hard wind from behind tries to throw the cloth
    // forward over the shoulders (the flip that left the cape hanging in front after a hop).
    const back = { x: 0, z: 0, nx: 0, nz: 1, d: 0.02, top: 1.55 };
    for (let i = 0; i < 300; i++) stepCloth(cloth, 1 / 120, { pins, wind: [0, 30, 40], back });
    for (let i = cloth.cols; i < cloth.n; i++) {
      expect(cloth.pos[i * 3 + 2]).toBeLessThanOrEqual(0.02 + 1e-6);
      expect(cloth.pos[i * 3 + 1]).toBeLessThanOrEqual(1.55 + 1e-6); // and never over the pins' line
    }
    // Without the plane the same wind does carry it forward.
    const free = make();
    hangFrom(free, pins);
    for (let i = 0; i < 300; i++) stepCloth(free, 1 / 120, { pins, wind: [0, 30, 40] });
    expect(Math.max(...Array.from({ length: free.n }, (_, i) => free.pos[i * 3 + 2]))).toBeGreaterThan(0.3);
  });

  it('pushes particles out of sphere colliders', () => {
    const cloth = make();
    const pins = pinsAt(cloth);
    hangFrom(cloth, pins);
    const sphere = { x: 0, y: 1.0, z: 0.05, r: 0.2 };
    for (let i = 0; i < 300; i++) stepCloth(cloth, 1 / 120, { pins, colliders: [sphere] });
    for (let i = cloth.cols; i < cloth.n; i++) {
      const d = Math.hypot(cloth.pos[i * 3] - sphere.x, cloth.pos[i * 3 + 1] - sphere.y, cloth.pos[i * 3 + 2] - sphere.z);
      expect(d).toBeGreaterThanOrEqual(sphere.r - 1e-3);
    }
  });
});
