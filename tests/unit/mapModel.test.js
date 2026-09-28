import { describe, it, expect } from 'vitest';
import { sanitizeProgress } from '../../src/core/save.js';
import { BALLOONS } from '../../src/config/balloonSpots.js';
import { MAP_BOUNDS, toMap, mapModel } from '../../src/game/mapModel.js';

describe('map model', () => {
  it('maps the city into a square, north up', () => {
    expect(toMap(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, 360)).toEqual({ u: 0, v: 0 });
    expect(toMap(MAP_BOUNDS.minX + 258, MAP_BOUNDS.minZ + 258, 360)).toEqual({ u: 180, v: 180 });
  });
  it('draws blocks, shows found balloons and unfound ones only in visited districts', () => {
    const progress = sanitizeProgress({ balloons: [5], districts: ['gcpd'], challenges: { a: { best: 1, medal: 'silver' } } });
    const m = mapModel({
      buildings: [{ x: 0, z: 0, w: 40, d: 40, district: 'gcpd', landmark: true }],
      balloons: BALLOONS, challenges: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 10, z: 10 }], progress, size: 360,
    });
    expect(m.blocks).toHaveLength(1);
    expect(m.blocks[0].u).toBeCloseTo(((-20 + 236) / 516) * 360, 6);
    expect(m.blocks[0].w).toBeCloseTo((40 / 516) * 360, 6);
    expect(m.balloons.map((b) => b.found)).toEqual([false, true]);
    expect(m.challenges.map((c) => c.medal)).toEqual(['silver', null]);
    expect(m.water).toBeCloseTo(((205 + 236) / 516) * 360, 6);
  });
});
