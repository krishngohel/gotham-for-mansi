// enemy.wake() (Plan 4E final review, Important 1): waking a goon that is tied, down, getting up,
// chained or grabbed used to stomp straight to 'alert' regardless, which left it stuck (down
// forever, or the rope gone from an unaware goon it never let go of). It should only flag the
// goon aware and let its current state finish on its own; enemy.js's own getup/tie-expiry/
// chainRelease logic already sends an aware goon on to 'engage' once that state is done.
import { describe, it, expect, vi } from 'vitest';
import { createEnemy } from '../../src/actors/enemy.js';
import { createRng } from '../../src/core/rng.js';

// createEnemy builds a full skinned character via characters.js, which needs real GLTF assets.
// Stub it so this test exercises enemy.js's own state machine without loading any of that.
vi.mock('../../src/actors/characters.js', () => ({
  createGoon: () => ({
    animator: { prime() {}, play() {}, update() {} },
    root: { position: { x: 0, y: 0, z: 0 } },
    yaw: 0,
    face() {},
    headWorld(out) { return out; },
  }),
  footGround: () => () => 0,
  enemyPlantsFeet: () => false,
}));

function makeEnemy(state) {
  const e = createEnemy({ id: 'g1', type: 'grunt', assets: {}, scene: { add() {} }, collision: {}, rng: createRng(1) });
  e.state = state;
  e.aware = false;
  return e;
}

describe('enemy.wake', () => {
  it('alerts an unaware goon that is just standing around', () => {
    const e = makeEnemy('idle');
    e.wake();
    expect(e.aware).toBe(true);
    expect(e.state).toBe('alert');
  });

  for (const state of ['tied', 'down', 'getup', 'chained', 'grabbed']) {
    it(`flags a goon aware without moving it out of '${state}'`, () => {
      const e = makeEnemy(state);
      e.wake();
      expect(e.aware).toBe(true);
      expect(e.state).toBe(state);
    });
  }

  it('does nothing once already aware', () => {
    const e = makeEnemy('engage');
    e.aware = true;
    e.wake();
    expect(e.state).toBe('engage');
  });

  it('does nothing to a dead goon', () => {
    const e = makeEnemy('ko');
    e.alive = false;
    e.wake();
    expect(e.aware).toBe(false);
  });
});
