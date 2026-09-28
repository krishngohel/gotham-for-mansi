import { describe, it, expect } from 'vitest';
import { slotFromDir, slotFromCode, slotCenter, createWheelCursor, createWheelLogic, WHEEL_DIGITS } from '../../src/gadgets/wheelMath.js';

describe('slotFromDir', () => {
  it('slot 0 is up, then clockwise (screen y points down)', () => {
    expect(slotFromDir(0, -1)).toBe(0);
    expect(slotFromDir(0.7, -0.7)).toBe(1);
    expect(slotFromDir(1, 0)).toBe(2);
    expect(slotFromDir(0, 1)).toBe(4);
    expect(slotFromDir(-1, 0)).toBe(6);
    expect(slotFromDir(-0.7, -0.7)).toBe(7);
  });
  it('rounds to the nearest slot and ignores the dead zone', () => {
    expect(slotFromDir(0.2, -1)).toBe(0);
    expect(slotFromDir(0.1, 0.1)).toBe(null);
    expect(slotFromDir(0.3, 0, { dead: 0.2 })).toBe(2);
  });
});

describe('keys and layout', () => {
  it('Digit1 to Digit8 pick slots 0 to 7, nothing else does', () => {
    expect(WHEEL_DIGITS).toHaveLength(8);
    expect(slotFromCode('Digit1')).toBe(0);
    expect(slotFromCode('Digit8')).toBe(7);
    expect(slotFromCode('Digit9')).toBe(null);
    expect(slotFromCode('KeyR')).toBe(null);
  });
  it('slot centers sit on the ring', () => {
    const c = slotCenter(2, 100);
    expect(c.x).toBeCloseTo(100);
    expect(c.y).toBeCloseTo(0);
    expect(slotCenter(0, 100).y).toBeCloseTo(-100);
  });
});

describe('wheel cursor', () => {
  it('follows the mouse and stays inside the unit circle', () => {
    const c = createWheelCursor({ pxPerUnit: 100 });
    c.move(0, -50);
    expect(c.slot()).toBe(0);
    c.move(400, 50);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(1);
    expect(c.slot()).toBe(2);
    c.reset();
    expect(c.slot()).toBe(null);
  });
});

describe('wheel hold logic', () => {
  it('opens on the current gadget, picks while open, equips on release', () => {
    const w = createWheelLogic();
    w.press(0);
    expect(w.open).toBe(true);
    expect(w.pick).toBe(0);
    w.choose(3);
    w.choose(null);
    expect(w.pick).toBe(3);
    expect(w.release(() => true)).toBe(3);
    expect(w.open).toBe(false);
  });
  it('a locked pick equips nothing', () => {
    const w = createWheelLogic();
    w.press(0);
    w.choose(7);
    expect(w.release((i) => i !== 7)).toBe(null);
  });
  it('choosing while closed and releasing twice do nothing', () => {
    const w = createWheelLogic();
    w.choose(4);
    expect(w.pick).toBe(null);
    expect(w.release(() => true)).toBe(null);
    w.press(1);
    w.cancel();
    expect(w.open).toBe(false);
    expect(w.release(() => true)).toBe(null);
  });
});
