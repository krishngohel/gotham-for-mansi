// tests/unit/batmobileModel.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBatmobile } from '../../src/vehicles/vehicleModels.js';
import { LAYER_FX } from '../../src/render/layers.js';

function meshes(group) {
  const out = [];
  group.traverse((o) => { if (o.isMesh) out.push(o); });
  return out;
}

describe('createBatmobile', () => {
  it('keeps the frozen interface vehicles.js relies on', () => {
    const bm = createBatmobile();
    expect(bm.group.isObject3D).toBe(true);
    expect(bm.wheels).toHaveLength(4);
    // Two front (steering) wheels, two rear.
    expect(bm.wheels.filter((w) => w.front)).toHaveLength(2);
    expect(bm.wheels.filter((w) => !w.front)).toHaveLength(2);
    for (const w of bm.wheels) { expect(w.pivot.isObject3D).toBe(true); expect(w.spin.isObject3D).toBe(true); }
    expect(bm.jetGlow.isMesh).toBe(true);
    expect(bm.jetHalo.isMesh).toBe(true);
    expect(typeof bm.radius).toBe('number');
    expect(typeof bm.setBoost).toBe('function');
    expect(() => bm.setBoost(true)).not.toThrow();
    expect(() => bm.setBoost(false)).not.toThrow();
  });

  it('reads as a wide, low body: wider than a street car and lower than it is wide', () => {
    const bm = createBatmobile();
    const box = new THREE.Box3().setFromObject(bm.group);
    const width = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;
    const length = box.max.z - box.min.z;
    expect(width).toBeGreaterThan(2.8); // street cars top out under 2m (createStreetCar)
    expect(length).toBeGreaterThan(width); // still a car, not a box
    expect(height).toBeLessThan(width); // wide and low, not tall
    expect(box.min.y).toBeLessThan(0.1); // belly sits close to the ground
  });

  it('keeps the wheels well out toward the corners, past the hull half-width', () => {
    const bm = createBatmobile();
    for (const w of bm.wheels) expect(Math.abs(w.pivot.position.x)).toBeGreaterThan(bm.halfWidth - 0.1);
    // Front and rear pairs sit at opposite ends of the wheelbase.
    const frontZ = bm.wheels.filter((w) => w.front).map((w) => w.pivot.position.z);
    const rearZ = bm.wheels.filter((w) => !w.front).map((w) => w.pivot.position.z);
    expect(Math.min(...frontZ)).toBeGreaterThan(Math.max(...rearZ));
  });

  it('keeps its footprint compatible with its own collision radius', () => {
    const bm = createBatmobile();
    expect(bm.halfWidth).toBeLessThan(bm.radius);
    expect(bm.halfLength).toBeGreaterThan(bm.radius);
  });

  it('merges its static body into a small, fixed number of draw calls, wheels and jet left separate', () => {
    const bm = createBatmobile();
    const ms = meshes(bm.group);
    // 4 wheels x (tire, hub, cap, tire outline, hub outline) + jetGlow + jetHalo, the rest merged.
    const wheelMeshCount = 4 * 5;
    expect(ms.length - wheelMeshCount - 2).toBeLessThanOrEqual(16);
    const underWheel = (o) => { for (let p = o; p; p = p.parent) if (bm.wheels.some((w) => w.pivot === p)) return true; return false; };
    const fills = ms.filter((m) => !m.material.userData.outline && m !== bm.jetGlow && m !== bm.jetHalo && !underWheel(m));
    expect(new Set(fills.map((m) => m.material)).size).toBe(fills.length);
  });

  it('keeps every ink outline on the FX layer, with a real bounding sphere', () => {
    const bm = createBatmobile();
    const hulls = meshes(bm.group).filter((m) => m.material.userData.outline);
    expect(hulls.length).toBeGreaterThan(0);
    for (const h of hulls) expect(h.layers.isEnabled(LAYER_FX)).toBe(true);
    // The merged body's outlines (everything but the wheels, which stay unmerged so they can keep
    // spinning and steering) get a real bounding sphere out of the merge, so they're safe to cull.
    const underWheel = (o) => { for (let p = o; p; p = p.parent) if (bm.wheels.some((w) => w.pivot === p)) return true; return false; };
    const bodyHulls = hulls.filter((h) => !underWheel(h));
    expect(bodyHulls.length).toBeGreaterThan(0);
    for (const h of bodyHulls) { expect(h.frustumCulled).toBe(true); expect(h.geometry.boundingSphere).not.toBeNull(); }
  });

  it('boost brightens and grows the jet glow and halo', () => {
    const bm = createBatmobile();
    const baseGlow = bm.jetGlow.scale.x, baseHalo = bm.jetHalo.scale.x;
    bm.setBoost(true);
    expect(bm.jetGlow.scale.x).toBeGreaterThan(baseGlow);
    expect(bm.jetHalo.scale.x).toBeGreaterThan(baseHalo);
    bm.setBoost(false);
    expect(bm.jetGlow.scale.x).toBe(baseGlow);
    expect(bm.jetHalo.scale.x).toBe(baseHalo);
  });
});
