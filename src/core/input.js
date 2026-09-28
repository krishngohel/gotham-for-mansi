// Action-based input over keyboard, mouse (pointer lock) and the Gamepad API.
// Keyboard and mouse follow the rebindable settings; the gamepad uses a fixed Xbox layout.

export const PAD_BUTTONS = {
  jump: [0], kick: [1], punch: [2], block: [3], grapple: [4],
  // RB (5) is not here: a tap is the cape stun and a hold opens the gadget wheel (createHoldTap).
  dodge: [6], batarang: [7],
  detective: [8], pause: [9], sprint: [10], special: [11], photo: [12], help: [13], throw: [15],
};

// Chain takedowns: D-pad left, up and right while block (Y) is held. With block held, D-pad
// right belongs to chain 3, not grab and throw. Y plus LB is the Bat Swarm (chain 4).
export const PAD_CHORD_HOLD = 3;
export const PAD_CHORDS = { chain1: 14, chain2: 12, chain3: 15, chain4: 4 };

// Hoisted once at module load: padActions runs every frame and must not allocate.
const PAD_BUTTON_ENTRIES = Object.entries(PAD_BUTTONS);
const PAD_CHORD_ENTRIES = Object.entries(PAD_CHORDS);
const CHORD_BUTTONS = PAD_CHORD_ENTRIES.map(([, i]) => i);
// D-pad chord buttons (12 to 15) stay latched: once a chord fires, the D-pad button stays
// suppressed for its plain action (e.g. throw) until it is physically released, even if block
// lets go first (players release the two buttons in either order). Chord buttons outside the
// D-pad, like LB (4) for chain4, are not latched: LB doubles as the grapple button and is held
// far longer than a quick D-pad tap, so grapple resumes the instant block lets go even if LB is
// still held; those buttons are only suppressed while block is actually down this frame.
const STICKY_CHORD_BUTTONS = CHORD_BUTTONS.filter((i) => i >= 12);
const IMMEDIATE_CHORD_BUTTONS = new Set(CHORD_BUTTONS.filter((i) => i < 12));

// Buttons a D-pad chord has consumed this "hold" (see STICKY_CHORD_BUTTONS above). Module-scoped
// so it survives across pollPad's per-frame calls; pass a private Set (or call
// resetPadChordLatch) to isolate tests.
const defaultChordLatch = new Set();
export function resetPadChordLatch(latch = defaultChordLatch) { latch.clear(); }

// Actions held on the pad this frame, from a button-state lookup. Allocates nothing beyond the
// returned Set (reuse `out` to avoid even that).
export function padActions(isDown, out = new Set(), latch = defaultChordLatch) {
  out.clear();
  const chord = isDown(PAD_CHORD_HOLD);
  for (let n = 0; n < STICKY_CHORD_BUTTONS.length; n++) {
    const i = STICKY_CHORD_BUTTONS[n];
    if (!isDown(i)) latch.delete(i);
    else if (chord) latch.add(i);
  }
  for (let n = 0; n < PAD_BUTTON_ENTRIES.length; n++) {
    const action = PAD_BUTTON_ENTRIES[n][0];
    const idx = PAD_BUTTON_ENTRIES[n][1];
    let down = false;
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j];
      if (isDown(i) && !latch.has(i) && !(chord && IMMEDIATE_CHORD_BUTTONS.has(i))) { down = true; break; }
    }
    if (down) out.add(action);
  }
  for (let n = 0; n < PAD_CHORD_ENTRIES.length; n++) {
    const action = PAD_CHORD_ENTRIES[n][0];
    const i = PAD_CHORD_ENTRIES[n][1];
    if (chord && isDown(i)) out.add(action);
  }
  return out;
}

// The right bumper: a tap is the cape stun (it fires on release), holding it past PAD_TAP
// opens the gadget wheel until it is let go. Pure.
export const PAD_WHEEL = 5;
export const PAD_TAP = 0.22;
export function createHoldTap(holdTime = PAD_TAP) {
  let down = false, t = 0, holding = false;
  return {
    get holding() { return holding; },
    update(isDown, dt) {
      if (isDown) {
        if (!down) { down = true; t = 0; holding = false; return null; }
        t += dt;
        if (!holding && t >= holdTime) { holding = true; return 'hold'; }
        return null;
      }
      if (!down) return null;
      down = false;
      const was = holding;
      holding = false;
      return was ? 'release' : 'tap';
    },
  };
}

const DEADZONE = 0.18;

export function createInput({ target = window, bindings }) {
  const held = new Set();
  const pressedCodes = new Set();
  const releasedCodes = new Set();
  const padHeld = new Set();
  const padPressed = new Set();
  const padReleased = new Set();
  const rawHeld = new Set();
  const rawPressed = new Set();
  let codeToActions = new Map();
  let capture = null;
  let device = 'kbm';
  let enabled = true;
  const move = { x: 0, y: 0 };
  const look = { dx: 0, dy: 0 };
  const stick = { mx: 0, my: 0, lx: 0, ly: 0 };
  const rbHold = createHoldTap(PAD_TAP);
  let capeTap = false;

  function setBindings(b) {
    codeToActions = new Map();
    for (const [action, codes] of Object.entries(b)) {
      for (const c of codes) {
        if (!codeToActions.has(c)) codeToActions.set(c, []);
        codeToActions.get(c).push(action);
      }
    }
  }
  setBindings(bindings);

  function codeDown(code, e) {
    device = 'kbm';
    if (!enabled && !capture) return;
    if (capture) {
      // The key belongs to the rebind screen: nothing else (like Esc closing the pause menu) sees it.
      e?.preventDefault();
      e?.stopImmediatePropagation();
      const cb = capture;
      capture = null;
      cb(code === 'Escape' ? null : code);
      return;
    }
    if (codeToActions.has(code) && e && code !== 'Escape' && !e.ctrlKey && !e.metaKey) e.preventDefault();
    if (!held.has(code)) pressedCodes.add(code);
    held.add(code);
  }
  function codeUp(code) {
    if (held.delete(code)) releasedCodes.add(code);
  }

  // Typing in a text field (the photo caption) never drives the game.
  const typing = (e) => !!e.target?.closest?.('input[type="text"], textarea');
  const onKeyDown = (e) => { if (typing(e)) return; if (!e.repeat) codeDown(e.code, e); else if (codeToActions.has(e.code)) e.preventDefault(); };
  const onKeyUp = (e) => codeUp(e.code);
  const onMouseDown = (e) => {
    if (e.target?.closest?.('.menu, .rebind')) { if (capture) codeDown('Mouse' + e.button, e); return; }
    codeDown('Mouse' + e.button, e);
  };
  const onMouseUp = (e) => codeUp('Mouse' + e.button);
  const onMouseMove = (e) => {
    if (document.pointerLockElement) { look.dx += e.movementX; look.dy += e.movementY; device = 'kbm'; }
  };
  const onBlur = () => { for (const c of held) releasedCodes.add(c); held.clear(); };
  const onContext = (e) => e.preventDefault();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('mousedown', onMouseDown);
  target.addEventListener('mouseup', onMouseUp);
  target.addEventListener('mousemove', onMouseMove);
  target.addEventListener('contextmenu', onContext);
  window.addEventListener('blur', onBlur);

  const anyCode = (set, action) => {
    for (const [code, actions] of codeToActions) if (actions.includes(action) && set.has(code)) return true;
    return false;
  };

  const dz = (v) => (Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE));

  function pollPad(dt = 0) {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((p) => p && p.connected);
    const now = new Set();
    if (pad) {
      padActions((i) => !!pad.buttons[i]?.pressed, now);
      if (rbHold.update(!!pad.buttons[PAD_WHEEL]?.pressed, dt) === 'tap') capeTap = true;
      if (rbHold.holding) now.add('gadgetWheel');
      pad.buttons.forEach((b, i) => { if (b?.pressed) { if (!rawHeld.has(i)) rawPressed.add(i); rawHeld.add(i); } else rawHeld.delete(i); });
      stick.mx = dz(pad.axes[0] ?? 0); stick.my = dz(pad.axes[1] ?? 0);
      stick.lx = dz(pad.axes[2] ?? 0); stick.ly = dz(pad.axes[3] ?? 0);
      if (now.size || stick.mx || stick.my || stick.lx || stick.ly) device = 'pad';
    } else {
      stick.mx = stick.my = stick.lx = stick.ly = 0;
      rbHold.update(false, dt);
    }
    for (const a of now) if (!padHeld.has(a)) padPressed.add(a);
    if (capeTap) { padPressed.add('cape'); capeTap = false; device = 'pad'; }
    for (const a of padHeld) if (!now.has(a)) padReleased.add(a);
    padHeld.clear();
    for (const a of now) padHeld.add(a);
  }

  return {
    get device() { return device; },
    move,
    look,
    down: (a) => anyCode(held, a) || padHeld.has(a),
    // Gamepad-only queries (menus and comics listen to the pad directly).
    padPressed: (a) => padPressed.has(a),
    padButton: (i) => rawPressed.has(i),
    // Raw pad state for screens with their own controls (photo mode). Works while disabled.
    padButtonHeld: (i) => rawHeld.has(i),
    get stick() { return stick; },
    pressed: (a) => anyCode(pressedCodes, a) || padPressed.has(a),
    released: (a) => anyCode(releasedCodes, a) || padReleased.has(a),
    // Raw key presses this frame, for the gadget wheel's 1 to 8 (whatever they are bound to).
    codePressed: (code) => pressedCodes.has(code),
    // Hides a key press from every action for the rest of this frame (the open wheel eats 1 to 8,
    // so chain takedowns on 1 to 3 never fire from a wheel pick).
    swallow(code) { pressedCodes.delete(code); },
    setBindings,
    captureNext(cb) { capture = cb; },
    cancelCapture() { capture = null; },
    get capturing() { return capture !== null; },
    // While a menu is open, the game ignores keys so buttons get Space and Enter.
    setEnabled(v) { enabled = v; if (!v) onBlur(); },
    // Call once per frame before reading actions.
    update(dt) {
      pollPad(dt);
      const kx = (anyCode(held, 'right') ? 1 : 0) - (anyCode(held, 'left') ? 1 : 0);
      const ky = (anyCode(held, 'forward') ? 1 : 0) - (anyCode(held, 'back') ? 1 : 0);
      move.x = kx + stick.mx;
      move.y = ky - stick.my;
      const len = Math.hypot(move.x, move.y);
      if (len > 1) { move.x /= len; move.y /= len; }
      // Right stick feels like ~900 px/s of mouse at full tilt.
      look.dx += stick.lx * 900 * dt;
      look.dy += stick.ly * 700 * dt;
    },
    endFrame() {
      pressedCodes.clear(); releasedCodes.clear(); padPressed.clear(); padReleased.clear(); rawPressed.clear();
      look.dx = 0; look.dy = 0;
    },
    releaseAll() { onBlur(); padHeld.clear(); },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('mousedown', onMouseDown);
      target.removeEventListener('mouseup', onMouseUp);
      target.removeEventListener('mousemove', onMouseMove);
      target.removeEventListener('contextmenu', onContext);
      window.removeEventListener('blur', onBlur);
    },
  };
}
