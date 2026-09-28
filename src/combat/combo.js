// Freeflow combo counter. Pure.
// ready: combo needed for a special takedown (8; WayneTech "Fast Finish" makes it 6).
// shield: hits taken that a combo run survives (WayneTech "Steady Flow" gives 1).
export function createCombo({ timeout = 1.5, ready = 8, shield = 0 } = {}) {
  let value = 0, clock = 0, best = 0, shieldLeft = 0;
  const reset = () => { value = 0; clock = 0; };
  return {
    hit() {
      if (value === 0) shieldLeft = shield;
      value += 1;
      clock = timeout;
      best = Math.max(best, value);
    },
    miss: reset,
    // Batman took a hit. Returns true when that broke the combo.
    damaged() {
      if (value > 0 && shieldLeft > 0) { shieldLeft -= 1; clock = timeout; return false; }
      reset();
      return true;
    },
    spend: reset,
    // Chain takedowns (Plan 4E): spend part of the combo and keep the rest.
    take(n) { value = Math.max(0, value - n); clock = timeout; },
    tick(dt) {
      if (value === 0) return;
      clock -= dt;
      if (clock <= 0) reset();
    },
    setReady(n) { ready = n; },
    setShield(n) { shield = n; },
    get value() { return value; },
    get ready() { return value >= ready; },
    get readyAt() { return ready; },
    get best() { return best; },
  };
}
