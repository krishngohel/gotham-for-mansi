import { describe, it, expect } from 'vitest';
import {
  FILTERS, FRAMES, DEFAULT_CAPTION, PHOTO_LIMITS, cycle, createPhotoCam, setPhotoMode, stepPhotoCam, photoView,
  frameLayout, sanitizeCaption, photoFileName,
} from '../../src/game/photoMath.js';

const anchor = { x: 0, y: 0, z: 0 };
const pivot = { x: 0, y: PHOTO_LIMITS.pivotY, z: 0 };
const cam0 = () => createPhotoCam({ position: { x: 0, y: 1.2, z: 0 }, target: { x: 0, y: 1.2, z: 5 }, fov: 60 });
const dist = (c) => Math.hypot(c.x - pivot.x, c.y - pivot.y, c.z - pivot.z);

describe('photo camera', () => {
  it('starts from the live camera direction', () => {
    const c = cam0();
    expect(c.yaw).toBeCloseTo(0);
    expect(c.pitch).toBeCloseTo(0);
    expect(createPhotoCam({ position: { x: 0, y: 0, z: 0 }, target: { x: 3, y: 0, z: 0 }, fov: 60 }).yaw).toBeCloseTo(Math.PI / 2);
    expect(DEFAULT_CAPTION).toBe('HAPPY BIRTHDAY MANSI');
  });
  it('flies but stays within 20 m of Batman', () => {
    const c = stepPhotoCam(cam0(), { moveY: 1 }, 10, anchor);
    expect(dist(c)).toBeCloseTo(20, 6);
    expect(c.z).toBeCloseTo(20, 6);
  });
  it('never goes below the street', () => {
    const c = stepPhotoCam({ ...cam0(), z: 5 }, { up: -1 }, 10, anchor);
    expect(c.y).toBe(0.3);
  });
  it('clamps FOV and roll', () => {
    expect(stepPhotoCam(cam0(), { zoom: 1 }, 10, anchor).fov).toBe(100);
    expect(stepPhotoCam(cam0(), { zoom: -1 }, 10, anchor).fov).toBe(20);
    expect(stepPhotoCam(cam0(), { fovDelta: -100 }, 0.016, anchor).fov).toBe(20);
    expect(stepPhotoCam(cam0(), { roll: 1 }, 10, anchor).roll).toBeCloseTo(Math.PI / 4);
    expect(stepPhotoCam(cam0(), { roll: -1 }, 10, anchor).roll).toBeCloseTo(-Math.PI / 4);
  });
  it('switches to orbit without jumping, and orbits within limits', () => {
    const free = createPhotoCam({ position: { x: 0, y: 1.2, z: -4 }, target: { x: 0, y: 1.2, z: 0 }, fov: 60 });
    const orbit = stepPhotoCam(setPhotoMode(free, 'orbit', anchor), {}, 0.016, anchor);
    expect(orbit.x).toBeCloseTo(0, 6);
    expect(orbit.y).toBeCloseTo(1.2, 6);
    expect(orbit.z).toBeCloseTo(-4, 6);
    expect(stepPhotoCam(orbit, { moveY: 1 }, 100, anchor).orbitDist).toBe(PHOTO_LIMITS.minOrbit);
    expect(stepPhotoCam(orbit, { moveY: -1 }, 100, anchor).orbitDist).toBe(PHOTO_LIMITS.maxDist - 0.5);
  });
  it('points the orbit camera at Batman', () => {
    const o = stepPhotoCam(setPhotoMode(cam0(), 'orbit', anchor), { lookX: 300, lookY: 60 }, 0.016, anchor);
    const v = photoView(o);
    const f = [v.target.x - v.position.x, v.target.y - v.position.y, v.target.z - v.position.z];
    const p = [pivot.x - v.position.x, pivot.y - v.position.y, pivot.z - v.position.z];
    const n = (a) => { const l = Math.hypot(...a); return a.map((q) => q / l); };
    n(f).forEach((q, i) => expect(q).toBeCloseTo(n(p)[i], 5));
  });
});

describe('filters, frames and captions', () => {
  it('cycles both ways and recovers from unknown values', () => {
    expect(cycle(FILTERS, 'ink')).toBe('noir');
    expect(cycle(FILTERS, 'sepia')).toBe('ink');
    expect(cycle(FILTERS, 'ink', -1)).toBe('sepia');
    expect(cycle(FRAMES, 'mystery')).toBe('none');
  });
  it('lays out frames inside the picture at any size', () => {
    for (const [w, h] of [[1280, 720], [720, 1280], [3840, 2160]]) {
      const none = frameLayout('none', w, h);
      expect(none.inset).toBe(0);
      expect(none.border).toBe(0);
      expect(none.masthead).toBe(null);
      const panel = frameLayout('panel', w, h);
      expect(panel.inset).toBeGreaterThan(0);
      expect(panel.border).toBeGreaterThan(0);
      const cover = frameLayout('cover', w, h);
      expect(cover.masthead.h).toBeGreaterThan(0);
      expect(cover.masthead.x + cover.masthead.w).toBeLessThanOrEqual(w);
      expect(cover.issue.x).toBeGreaterThan(cover.masthead.x);
      expect(cover.issue.x + cover.issue.w).toBeLessThanOrEqual(cover.masthead.x + cover.masthead.w);
      for (const L of [none, panel, cover]) {
        expect(L.caption.x).toBeGreaterThanOrEqual(0);
        expect(L.caption.y).toBeGreaterThanOrEqual(0);
        expect(L.caption.x + L.caption.maxW).toBeLessThanOrEqual(w);
        expect(L.caption.y + L.caption.h).toBeLessThanOrEqual(h);
      }
    }
  });
  it('cleans captions', () => {
    expect(sanitizeCaption('  happy   birthday \u2014 mansi  ')).toBe('HAPPY BIRTHDAY - MANSI');
    expect(sanitizeCaption('x'.repeat(60))).toHaveLength(48);
    expect(sanitizeCaption(null)).toBe('');
  });
  it('names the file with the date and time', () => {
    expect(photoFileName(new Date(2026, 8, 28, 21, 5, 9))).toBe('gotham-for-mansi-20260928-210509.png');
  });
});
