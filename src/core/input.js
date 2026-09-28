// Action-based input over keyboard, mouse (pointer lock) and the Gamepad API.
// Keyboard and mouse follow the rebindable settings; the gamepad uses a fixed Xbox layout.

const PAD_BUTTONS = {
  jump: [0], kick: [1], punch: [2], block: [3], grapple: [4], cape: [5], dodge: [6], batarang: [7],
  detective: [8], pause: [9], sprint: [10], special: [11], photo: [12], help: [13], throw: [15],
};
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

  function pollPad() {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((p) => p && p.connected);
    const now = new Set();
    if (pad) {
      for (const [action, idx] of Object.entries(PAD_BUTTONS)) if (idx.some((i) => pad.buttons[i]?.pressed)) now.add(action);
      pad.buttons.forEach((b, i) => { if (b?.pressed) { if (!rawHeld.has(i)) rawPressed.add(i); rawHeld.add(i); } else rawHeld.delete(i); });
      stick.mx = dz(pad.axes[0] ?? 0); stick.my = dz(pad.axes[1] ?? 0);
      stick.lx = dz(pad.axes[2] ?? 0); stick.ly = dz(pad.axes[3] ?? 0);
      if (now.size || stick.mx || stick.my || stick.lx || stick.ly) device = 'pad';
    } else {
      stick.mx = stick.my = stick.lx = stick.ly = 0;
    }
    for (const a of now) if (!padHeld.has(a)) padPressed.add(a);
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
    setBindings,
    captureNext(cb) { capture = cb; },
    cancelCapture() { capture = null; },
    // Drops a code's buffered press without touching `held`, so a click that only re-acquired
    // pointer lock (Safari needs a real user gesture) doesn't also fire the action bound to it.
    swallowCode(code) { pressedCodes.delete(code); },
    get capturing() { return capture !== null; },
    // While a menu is open, the game ignores keys so buttons get Space and Enter.
    setEnabled(v) { enabled = v; if (!v) onBlur(); },
    // Call once per frame before reading actions.
    update(dt) {
      pollPad();
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
