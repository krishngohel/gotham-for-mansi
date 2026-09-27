// Freeflow combo counter. Pure.
export function createCombo({ timeout = 1.5, ready = 8 } = {}) {
  let value = 0, clock = 0, best = 0;
  const reset = () => { value = 0; clock = 0; };
  return {
    hit() { value += 1; clock = timeout; best = Math.max(best, value); },
    miss: reset,
    damaged: reset,
    spend: reset,
    tick(dt) {
      if (value === 0) return;
      clock -= dt;
      if (clock <= 0) reset();
    },
    get value() { return value; },
    get ready() { return value >= ready; },
    get best() { return best; },
  };
}
