// tests/unit/targeting.test.js
import { describe, it, expect } from 'vitest';
import { selectAttackTarget } from '../../src/combat/targeting.js';

const g = (x, z, o = {}) => ({ x, z, alive: true, down: false, ...o });

describe('selectAttackTarget', () => {
  it('auto-attaches to the nearest goon up to the range when nothing is in the held direction', () => {
    const far = g(0, -12);
    expect(selectAttackTarget({ x: 0, z: 0 }, { x: 0, z: 1 }, [far], { range: 14 })).toBe(far);
    expect(selectAttackTarget({ x: 0, z: 0 }, { x: 0, z: 1 }, [g(0, -15)], { range: 14 })).toBeNull();
  });
  it('a held direction pointing at another goon retargets', () => {
    const a = g(0, 3), b = g(4, 0);
    expect(selectAttackTarget({ x: 0, z: 0 }, { x: 1, z: 0 }, [a, b], { range: 14, focus: a })).toBe(b);
  });
  it('holding away from the focus keeps the focus', () => {
    const a = g(0, 3);
    expect(selectAttackTarget({ x: 0, z: 0 }, { x: 0, z: -1 }, [a], { range: 14, focus: a })).toBe(a);
  });
  it('a dead or distant focus is dropped for the nearest', () => {
    const a = g(0, 9), b = g(2, 0);
    expect(selectAttackTarget({ x: 0, z: 0 }, null, [a, b], { range: 14, focus: a })).toBe(b);
    const c = g(0, 2, { alive: false });
    expect(selectAttackTarget({ x: 0, z: 0 }, null, [c, b], { range: 14, focus: c })).toBe(b);
  });
  it('downed goons only when allowed', () => {
    const d = g(1, 0, { down: true }), b = g(5, 0);
    expect(selectAttackTarget({ x: 0, z: 0 }, null, [d, b], { range: 14 })).toBe(b);
    expect(selectAttackTarget({ x: 0, z: 0 }, null, [d, b], { range: 14, allowDown: true })).toBe(d);
  });
});
