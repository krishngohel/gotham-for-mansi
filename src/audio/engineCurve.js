// Pure speed/throttle -> engine loop parameters. Kept separate from ambience.js's Web Audio
// nodes so the mapping itself is unit-testable without an AudioContext.
export const ENGINE_KINDS = ['batmobile', 'car', 'wing'];

// Levels tuned to sit under loop:glide (peak ~0.43, rms ~-19 dB) and loop:rain (peak ~0.38, rms
// ~-24 dB) at full speed, measured with scripts/audiocheck-ref.mjs against the real mixer. A
// sustained tone through a lowpass reads far louder at a given gain than filtered noise does at
// the same gain (much more energy concentrated at a few harmonics instead of spread across the
// band), so these numbers are well below the one-shot SFX gains they might look similar to.
const CURVES = {
  // Deep and powerful: the rumble frequency only climbs modestly (it's a V8, not a kazoo), but
  // level climbs more so idling-vs-flooring-it reads clearly. Still the loudest engine loop, but
  // kept under loop:rain/loop:glide even with the boost layer added on top.
  batmobile: { freqMin: 32, freqMax: 78, volMin: 0.045, volMax: 0.12, noiseMin: 0.02, noiseMax: 0.065 },
  // Lighter civilian engine: higher and thinner, less low end, quieter overall than the Batmobile.
  car: { freqMin: 70, freqMax: 190, volMin: 0.02, volMax: 0.055, noiseMin: 0.01, noiseMax: 0.032 },
  // Jet whine: a turbine, not a piston engine, so pitch sweeps much further.
  wing: { freqMin: 220, freqMax: 820, volMin: 0.05, volMax: 0.14, noiseMin: 0.04, noiseMax: 0.13 },
};

const clamp01 = (x) => Math.min(1, Math.max(0, Number(x) || 0));

// speedFrac: 0..1 fraction of the vehicle's own top speed (the caller normalizes by its own
// tuning/WING_TUNING). boost: Batmobile only, layers a bright overdriven roar on top of the base
// rumble. Writes into `out` (default a fresh object) instead of always allocating, so a caller
// with a scratch object can reuse it every frame.
export function engineParams(kind, speedFrac, boost = false, out = {}) {
  const c = CURVES[kind] ?? CURVES.car;
  const s = clamp01(speedFrac);
  const eased = Math.sqrt(s); // most of the climb happens low in the throttle, like a real engine
  out.freq = c.freqMin + (c.freqMax - c.freqMin) * eased;
  out.vol = c.volMin + (c.volMax - c.volMin) * eased;
  out.noise = c.noiseMin + (c.noiseMax - c.noiseMin) * eased;
  out.boostVol = kind === 'batmobile' && boost ? 0.04 + 0.05 * eased : 0;
  return out;
}
