import { describe, it, expect } from 'vitest';
import { pickGrapplePoint } from '../../src/world/grapple.js';

const cam = { x: 0, y: 2, z: 0 };
const fwd = { x: 0, y: 0, z: -1 };
const hero = { x: 0, y: 0, z: 0 };

describe('pickGrapplePoint', () => {
  it('picks the point closest to the center of view', () => {
    const pts = [
      { x: 10, y: 12, z: -30 },
      { x: 1, y: 10, z: -30 },
      { x: -8, y: 14, z: -30 },
    ];
    expect(pickGrapplePoint(pts, cam, fwd, hero)).toBe(pts[1]);
  });

  it('ignores points behind, too far, or not above the hero', () => {
    const pts = [
      { x: 0, y: 10, z: 20 },     // behind
      { x: 0, y: 10, z: -90 },    // too far
      { x: 0, y: 0.5, z: -20 },   // not above
    ];
    expect(pickGrapplePoint(pts, cam, fwd, hero)).toBe(null);
  });

  it('accepts perches at the same height when marked', () => {
    const p = { x: 0, y: 0.5, z: -20, perch: true };
    expect(pickGrapplePoint([p], cam, fwd, hero)).toBe(null);
    const q = { x: 0, y: 3, z: -20, perch: true };
    expect(pickGrapplePoint([q], cam, fwd, hero)).toBe(q);
  });

  it('respects a line-of-sight check', () => {
    const pts = [{ x: 0, y: 10, z: -30 }, { x: 3, y: 10, z: -30 }];
    const blocked = (p) => p.x === 0;
    expect(pickGrapplePoint(pts, cam, fwd, hero, { visible: (p) => !blocked(p) })).toBe(pts[1]);
  });

  it('prefers the looked-at point over a nearer one off to the side', () => {
    const near = { x: 9, y: 6, z: -12 };
    const center = { x: 0, y: 14, z: -40 };
    expect(pickGrapplePoint([near, center], cam, fwd, hero)).toBe(center);
  });
});
