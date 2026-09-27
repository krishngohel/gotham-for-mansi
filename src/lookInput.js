// Keyboard and mouse state, polled once per frame. Mouse deltas count only while pointer-locked.
export function createInput(target = window) {
  const held = new Set();
  const pressed = new Set();
  const clicked = new Set();
  const mouse = { dx: 0, dy: 0 };
  target.addEventListener('keydown', (e) => { if (!held.has(e.code)) pressed.add(e.code); held.add(e.code); });
  target.addEventListener('keyup', (e) => held.delete(e.code));
  target.addEventListener('mousedown', (e) => clicked.add(e.button));
  target.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  });
  target.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => held.clear());
  return {
    held: (code) => held.has(code),
    pressed: (code) => pressed.has(code),
    clicked: (button) => clicked.has(button),
    mouse,
    endFrame() { pressed.clear(); clicked.clear(); mouse.dx = 0; mouse.dy = 0; },
  };
}
