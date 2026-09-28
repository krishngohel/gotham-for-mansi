// Converts real frame time into game time, applying hit-stop freezes and slow motion.
export function createTimeControl() {
  let stop = 0;
  let slow = 0;
  let slowScale = 1;
  return {
    hitStop(sec) { stop = Math.max(stop, sec); },
    slowMo(sec, scale) { slow = Math.max(slow, sec); slowScale = scale; },
    scale(dt) {
      if (stop > 0) {
        const used = Math.min(stop, dt);
        stop -= used;
        dt -= used;
        if (dt <= 1e-9) return 0;
      }
      if (slow > 0) { slow -= dt; return dt * slowScale; }
      return dt;
    },
    get stopped() { return stop > 0; },
    get debug() { return { stop, slow, slowScale }; },
  };
}
