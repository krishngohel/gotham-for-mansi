// tests/unit/streetCarMerge.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStreetCar, createJokerVan } from '../../src/vehicles/vehicleModels.js';
import { LAYER_FX } from '../../src/render/layers.js';

function meshes(group) {
  const out = [];
  group.traverse((o) => { if (o.isMesh) out.push(o); });
  return out;
}

describe('createStreetCar merges its static parts', () => {
  for (const kind of ['sedan', 'van']) {
    it(`draws a ${kind} in a dozen meshes or fewer, one per material`, () => {
      const { group } = createStreetCar(0x2f3f5a, kind);
      const ms = meshes(group);
      expect(ms.length).toBeLessThanOrEqual(12);
      const fills = ms.filter((m) => !m.material.userData.outline);
      expect(new Set(fills.map((m) => m.material)).size).toBe(fills.length);
    });
    it(`keeps the ${kind}'s ink outlines on the FX layer, culled like everything else`, () => {
      const { group } = createStreetCar(0x2f3f5a, kind);
      const hulls = meshes(group).filter((m) => m.material.userData.outline);
      expect(hulls.length).toBeGreaterThan(0);
      for (const h of hulls) {
        expect(h.layers.isEnabled(LAYER_FX)).toBe(true);
        expect(h.frustumCulled).toBe(true);
        expect(h.geometry.boundingSphere).not.toBeNull();
      }
    });
    it(`keeps the ${kind} the same size and shape`, () => {
      const { group } = createStreetCar(0x2f3f5a, kind);
      const box = new THREE.Box3().setFromObject(group);
      expect(box.max.z - box.min.z).toBeGreaterThan(4);
      expect(box.max.y).toBeGreaterThan(1.2);
      expect(box.min.y).toBeLessThan(0.1);
    });
  }
  it('still lets the Joker van add its own stripe and beacon on top', () => {
    const van = createJokerVan();
    expect(meshes(van.group).length).toBeGreaterThan(meshes(createStreetCar(0x6b2f8f, 'van').group).length);
  });
});
