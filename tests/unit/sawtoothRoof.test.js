// tests/unit/sawtoothRoof.test.js: on a sawtooth roof, what you stand on is what you see.
import { describe, it, expect } from 'vitest';
import { sawtoothRoof, SAWTOOTH } from '../../src/world/cityBuilder.js';
import { createCollision } from '../../src/world/collision.js';

// The Ace Chemicals factory: 64 x 44, roof line at 24.
const B = { id: 'factory', x: 140, z: -172, w: 64, d: 44, h: 24, district: 'ace' };

function build() {
  const collision = createCollision();
  const ctx = { collision, buckets: { add() {} }, rng: { chance: () => false } };
  sawtoothRoof(ctx, B);
  return collision;
}

// The drawn surface: the deck, plus the tooth ramp in the side bands. (Sampled with a zero
// footprint: a character's 0.3 m radius stands on a step's edge next to a tooth's glass face.)
function drawn(x, z) {
  const { DECK, TOOTH, DEPTH, BAND } = SAWTOOTH;
  const top = B.h + DECK, band = Math.max(4, B.w * BAND);
  const dx = Math.abs(x - B.x);
  if (dx < B.w / 2 - 0.5 - band || dx > B.w / 2 - 0.5) return top;
  for (let t = -B.d / 2 + DEPTH / 2; t < B.d / 2 - 2; t += DEPTH) {
    const zt = B.z + t;
    if (z >= zt - DEPTH / 2 && z <= zt + DEPTH / 2) return top + TOOTH * ((zt + DEPTH / 2 - z) / DEPTH);
  }
  return top;
}

describe('sawtooth roofs', () => {
  it('the middle half is flat footing at the deck, where the factory fight happens', () => {
    const col = build();
    for (const [dx, dz] of [[0, 0], [10, 8], [-14, -18], [15, 19]]) {
      expect(col.groundBelow(B.x + dx, 40, B.z + dz, 0)).toBeCloseTo(B.h + SAWTOOTH.DECK, 5);
    }
  });
  it('on the teeth, the ground is never more than TOOTH / 6 off the drawn ramp', () => {
    const col = build();
    let worst = 0;
    for (let dx = -31; dx <= 31; dx += 1.7) {
      for (let dz = -21; dz <= 21; dz += 0.37) {
        const x = B.x + dx, z = B.z + dz;
        worst = Math.max(worst, Math.abs(col.groundBelow(x, 40, z, 0) - drawn(x, z)));
      }
    }
    expect(worst).toBeLessThanOrEqual(SAWTOOTH.TOOTH / 6 + 1e-6);
  });
});
