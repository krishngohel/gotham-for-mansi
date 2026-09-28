// Gadget wheel picking. Pure. Slot 0 is at the top of the wheel, then clockwise; directions are
// in screen space (x right, y down), like mouse deltas and the gamepad's right stick.
export const WHEEL_SLOTS = 8;
export const WHEEL_DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];

export function slotFromDir(x, y, { slots = WHEEL_SLOTS, dead = 0.35 } = {}) {
  if (Math.hypot(x, y) < dead) return null;
  const a = Math.atan2(x, -y);
  const step = (Math.PI * 2) / slots;
  return ((Math.round(a / step) % slots) + slots) % slots;
}

export function slotFromCode(code) {
  const i = WHEEL_DIGITS.indexOf(code);
  return i >= 0 ? i : null;
}

export function slotCenter(i, radius, slots = WHEEL_SLOTS) {
  const a = (i / slots) * Math.PI * 2;
  return { x: Math.sin(a) * radius, y: -Math.cos(a) * radius };
}

// A virtual cursor moved by mouse deltas (pointer lock), kept inside the unit circle.
export function createWheelCursor({ pxPerUnit = 110 } = {}) {
  let x = 0, y = 0;
  return {
    get x() { return x; },
    get y() { return y; },
    reset() { x = 0; y = 0; },
    move(dx, dy) {
      x += dx / pxPerUnit;
      y += dy / pxPerUnit;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
    },
    slot(opts) { return slotFromDir(x, y, opts); },
  };
}

// Hold to open on the equipped slot, pick while open, equip the pick on release if unlocked.
export function createWheelLogic() {
  let open = false, pick = null;
  return {
    get open() { return open; },
    get pick() { return pick; },
    press(current) { open = true; pick = current; },
    choose(i) { if (open && i !== null && i !== undefined) pick = i; },
    release(isUnlocked) {
      if (!open) return null;
      open = false;
      const p = pick;
      pick = null;
      return p !== null && isUnlocked(p) ? p : null;
    },
    cancel() { open = false; pick = null; },
  };
}
