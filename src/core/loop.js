// Fixed-step accumulator: simulation runs at `step` regardless of frame rate.
export function createFixedStep({ step = 1 / 60, maxSteps = 5 } = {}) {
  let acc = 0;
  return {
    step,
    advance(dt) {
      acc += Math.min(dt, step * maxSteps);
      let steps = 0;
      while (acc >= step - 1e-9 && steps < maxSteps) { acc -= step; steps++; }
      return { steps, alpha: Math.max(0, acc / step) };
    },
    reset() { acc = 0; },
  };
}
