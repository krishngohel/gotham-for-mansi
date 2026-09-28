// Buffers the latest pressed combat action for a short window so freeflow chains feel
// responsive even when the player's input lands a frame or two before the current move can
// accept it. Pure state machine, no THREE/hero coupling.
export function createInputBuffer(window = 0.3) {
  let action = null, t = 0;
  return {
    // Record a fresh press; overwrites whatever was buffered before.
    press(a) { action = a; t = window; },
    // Age the buffer out after `window` seconds with nothing consuming it.
    tick(dt) {
      if (!action) return;
      t -= dt;
      if (t <= 0) { action = null; t = 0; }
    },
    // Clear the buffer early, but only if it still holds this exact action. Used when
    // something other than freeflow combat (a traversal control) already acted on the press,
    // so it can't also fire a real move later once that control lets go.
    consume(a) { if (action === a) { action = null; t = 0; } },
    get value() { return action; },
  };
}
