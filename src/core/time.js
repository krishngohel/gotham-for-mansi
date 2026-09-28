// Converts real frame time into game time, applying hit-stop freezes, slow motion and holds.
// A hold is a sustained slow-down that lasts until released (the gadget wheel, remote batarang
// steering). Several holds at once: the slowest wins. Holds stack with slow motion.
export function createTimeControl() {
  let stop = 0;
  let slow = 0;
  let slowScale = 1;
  const holds = new Map();
  let holdScale = 1;
  const refresh = () => {
    holdScale = 1;
    for (const s of holds.values()) holdScale = Math.min(holdScale, s);
  };
  return {
    hitStop(sec) { stop = Math.max(stop, sec); },
    slowMo(sec, scale) { slow = Math.max(slow, sec); slowScale = scale; },
    hold(id, scale) { holds.set(id, Math.min(1, Math.max(0.01, scale))); refresh(); },
    release(id) { if (holds.delete(id)) refresh(); },
    scale(dt) {
      if (stop > 0) {
        const used = Math.min(stop, dt);
        stop -= used;
        dt -= used;
        if (dt <= 1e-9) return 0;
      }
      let out = dt;
      if (slow > 0) { slow -= dt; out = dt * slowScale; }
      return out * holdScale;
    },
    get held() { return holdScale; },
    get stopped() { return stop > 0; },
    get debug() { return { stop, slow, slowScale, holdScale }; },
  };
}
