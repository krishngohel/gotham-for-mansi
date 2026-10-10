// A knocked-out goon starts going over the moment he is hit. The KO clips (Death01, Hit_Knockback)
// open on their feet (Death01 sags for most of a second), and a critical KO runs in slow motion,
// so playing them from frame 0 left goons standing for over a second after the blow.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createRng } from '../../src/core/rng.js';

const plays = [];
vi.mock('../../src/actors/characters.js', () => ({
  createGoon: () => ({
    root: new THREE.Group(),
    yaw: 0,
    face: () => {},
    headWorld: () => {},
    animator: {
      prime: () => {},
      play: (name, opts) => { plays.push({ name, ...opts }); return { time: 0, getClip: () => ({ duration: 1 }) }; },
      update: () => {},
      has: () => true,
      mixer: { timeScale: 1 },
    },
    groundAt: null,
  }),
  footGround: () => () => 0,
  enemyPlantsFeet: () => false,
}));

const { createEnemy, KO_FALL } = await import('../../src/actors/enemy.js');

describe('KO clips', () => {
  it('start at the fall, not standing up', () => {
    const seen = new Set();
    for (let seed = 1; seed < 12; seed++) {
      const e = createEnemy({ id: 'x', type: 'grunt', assets: {}, scene: { add: () => {} }, collision: {}, rng: createRng(seed) });
      plays.length = 0;
      e.applyHit({ outcome: 'ko', damage: 9, stun: 0 }, new THREE.Vector3(0, 0, -2));
      const ko = plays.at(-1);
      seen.add(ko.name);
      expect(KO_FALL[ko.name]).toBeDefined();
      expect(ko.startAt).toBe(KO_FALL[ko.name].startAt);
      expect(ko.timeScale).toBeGreaterThanOrEqual(1.2);
    }
    expect(seen.size).toBe(2); // both clips still in rotation
  });
});
