import { describe, it, expect } from 'vitest';
import { arcDash } from '../../src/ui/hud.js';

describe('arcDash', () => {
  const C = 2 * Math.PI * 50;
  it('draws three quarters of the ring at full health', () => {
    expect(arcDash(1)).toBe(`${(0.75 * C).toFixed(2)} ${C.toFixed(2)}`);
  });
  it('scales and clamps', () => {
    expect(arcDash(0.5)).toBe(`${(0.375 * C).toFixed(2)} ${C.toFixed(2)}`);
    expect(arcDash(-1)).toBe(`0.00 ${C.toFixed(2)}`);
    expect(arcDash(2)).toBe(arcDash(1));
  });
});
