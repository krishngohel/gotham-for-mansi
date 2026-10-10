// The idle nudge: on a travel step, `wait` seconds without getting `gain` metres closer to the
// marker means she has probably lost the thread, so the radio says the goal again. At most `max`
// times a step; time only counts while `running` (no radio line, comic or cinematic up).
export function createNudge({ wait = 45, gain = 5, max = 3 } = {}) {
  let best = null, t = 0, fired = 0;
  return {
    reset() { best = null; t = 0; fired = 0; },
    update(dt, dist, running) {
      if (!running || fired >= max) return false;
      if (best == null || dist <= best - gain) { best = dist; t = 0; return false; }
      t += dt;
      if (t < wait) return false;
      fired += 1;
      t = 0;
      best = dist;
      return true;
    },
  };
}
