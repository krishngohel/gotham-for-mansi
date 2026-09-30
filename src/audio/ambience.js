import { noiseBuffer, filter, tone, rand, drive } from './synth.js';
import { engineParams, ENGINE_KINDS } from './engineCurve.js';

// Rain and glide-wind loops. Sources start the first time a level goes above zero and
// then idle at zero gain; drips are scheduled from tick() using AudioContext time.
// Vehicle engine loops (setEngine) follow the same pattern: nodes for a given kind are built
// once, the first time that kind is used, and only their gain/frequency params move after that.
export function createAmbience(ctx, out) {
  let rain = null;
  let wind = null;
  let rainLevel = 0;
  let glideLevel = 0;
  let nextDrip = 0;
  const engines = { batmobile: null, car: null, wing: null };
  const engineScratch = {}; // reused by setEngine, never reallocated per call

  function loop() {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx);
    s.loop = true;
    s.start(ctx.currentTime, Math.random() * 1.9);
    return s;
  }

  function buildRain() {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(out);
    const hiss = ctx.createGain();
    hiss.gain.value = 0.22;
    hiss.connect(g);
    loop().connect(filter(ctx, filter(ctx, hiss, 'lowpass', 7000, 0.5), 'highpass', 900, 0.5));
    const body = ctx.createGain();
    body.gain.value = 0.5;
    body.connect(g);
    loop().connect(filter(ctx, body, 'lowpass', 650, 0.6));
    return { g };
  }

  function buildWind() {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(out);
    const bp = filter(ctx, g, 'bandpass', 500, 0.9);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    const lg = ctx.createGain();
    lg.gain.value = 180;
    lfo.connect(lg);
    lg.connect(bp.frequency);
    lfo.start();
    const pre = ctx.createGain();
    pre.gain.value = 1.6;
    pre.connect(bp);
    loop().connect(pre);
    const whistle = ctx.createGain();
    whistle.gain.value = 0;
    whistle.connect(g);
    const hp = filter(ctx, whistle, 'bandpass', 2400, 3);
    loop().connect(hp);
    return { g, bp, whistle, hp };
  }

  // A piston engine: two detuned saws through a lowpass for the rumble, a little filtered noise
  // for exhaust hiss. The Batmobile additionally gets a boost layer: a separate, distorted saw
  // that only comes up while boosting (setEngine's `boost` option).
  function buildPistonEngine(withBoost) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(out);
    const lp = filter(ctx, g, 'lowpass', 300, 0.8);
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 60;
    o1.detune.value = -7;
    o1.connect(lp);
    o1.start();
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 60;
    o2.detune.value = 7;
    o2.connect(lp);
    o2.start();
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noiseGain.connect(g);
    const nf = filter(ctx, noiseGain, 'lowpass', 900, 0.6);
    loop().connect(nf);
    let boostOut = null, bo = null;
    if (withBoost) {
      boostOut = ctx.createGain();
      boostOut.gain.value = 0;
      boostOut.connect(g);
      const crunch = drive(ctx, boostOut, 6);
      bo = ctx.createOscillator();
      bo.type = 'sawtooth';
      bo.frequency.value = 130;
      bo.connect(crunch);
      bo.start();
    }
    return { g, lp, o1, o2, noiseGain, nf, boostOut, bo };
  }

  // The Batwing's jet whine: filtered noise (turbine rush) plus a thin sawtooth riding on top
  // that sweeps much further with speed than either piston engine.
  function buildJetEngine() {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(out);
    const bp = filter(ctx, g, 'bandpass', 500, 1.1);
    loop().connect(bp);
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0;
    whineGain.connect(g);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 300;
    o.connect(whineGain);
    o.start();
    return { g, bp, whineGain, o };
  }

  function drip(t) {
    const f = rand(1200, 2600);
    const g = ctx.createGain();
    g.gain.value = rand(0.15, 0.35) * rainLevel;
    let dest = out;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = rand(-0.8, 0.8);
      p.connect(out);
      dest = p;
    }
    g.connect(dest);
    tone(ctx, g, t, { freq: f, to: f * 0.45, glide: 0.035, d: 0.05, gain: 1 });
  }

  return {
    setRain(x, time = 0.6) {
      rainLevel = Math.min(1, Math.max(0, Number(x) || 0));
      if (!rain && rainLevel > 0) rain = buildRain();
      if (rain) rain.g.gain.setTargetAtTime(rainLevel * 0.55, ctx.currentTime, time / 3);
    },
    setGlide(x, time = 0.3) {
      glideLevel = Math.min(1, Math.max(0, Number(x) || 0));
      if (!wind && glideLevel > 0) wind = buildWind();
      if (!wind) return;
      const now = ctx.currentTime;
      const k = time / 3;
      wind.g.gain.setTargetAtTime(glideLevel * 0.35, now, k);
      wind.bp.frequency.setTargetAtTime(350 + 1300 * glideLevel, now, k);
      wind.whistle.gain.setTargetAtTime(glideLevel * glideLevel * 0.25, now, k);
      wind.hp.frequency.setTargetAtTime(1800 + 1600 * glideLevel, now, k);
    },
    // One engine at a time: whichever vehicle Mansi is driving/flying. `kind` is 'batmobile',
    // 'car', 'wing' or null/falsy to fade out; `level` (0..1) is an overall presence/fade
    // multiplier (0 on enter before the fade-in finishes, 0 again after exit); `speedFrac` is
    // 0..1 of the vehicle's own top speed, for pitch and loudness; `opts.boost` layers the
    // Batmobile's boost roar on top. No new nodes are created after the first call for a given
    // kind: only gain/frequency params move, via setTargetAtTime (same pattern as setRain/
    // setGlide above), so this is safe to call every frame from the vehicle code.
    setEngine(kind, level = 1, speedFrac = 0, opts = {}) {
      const now = ctx.currentTime;
      const lvl = Math.min(1, Math.max(0, Number(level) || 0));
      const k = kind && ENGINE_KINDS.includes(kind) && lvl > 0 ? kind : null;
      if (k) {
        if (!engines[k]) engines[k] = k === 'wing' ? buildJetEngine() : buildPistonEngine(k === 'batmobile');
        const e = engines[k];
        const p = engineParams(k, speedFrac, !!opts.boost, engineScratch);
        const tc = 0.15; // responsive to the pedal, but slow enough not to zipper
        e.g.gain.setTargetAtTime(p.vol * lvl, now, tc);
        if (e.lp) e.lp.frequency.setTargetAtTime(Math.min(4000, p.freq * 7), now, tc);
        if (e.o1) e.o1.frequency.setTargetAtTime(p.freq, now, tc);
        if (e.o2) e.o2.frequency.setTargetAtTime(p.freq, now, tc);
        if (e.nf) e.nf.frequency.setTargetAtTime(Math.min(4000, p.freq * 10), now, tc);
        if (e.noiseGain) e.noiseGain.gain.setTargetAtTime(p.noise * lvl, now, tc);
        if (e.boostOut) e.boostOut.gain.setTargetAtTime(p.boostVol * lvl, now, tc);
        if (e.bp) e.bp.frequency.setTargetAtTime(p.freq * 1.5, now, tc);
        if (e.whineGain) e.whineGain.gain.setTargetAtTime(p.noise * lvl, now, tc);
        if (e.o) e.o.frequency.setTargetAtTime(p.freq, now, tc);
      }
      // Fade every other built engine (including the one just switched away from) toward
      // silence instead of stopping or disconnecting anything.
      for (const name of ENGINE_KINDS) {
        if (name === k) continue;
        const e = engines[name];
        if (e) e.g.gain.setTargetAtTime(0, now, 0.3);
      }
    },
    // Schedules drips up to `until` (AudioContext time).
    tick(until) {
      if (rainLevel <= 0.02) { nextDrip = 0; return; }
      if (nextDrip < ctx.currentTime) nextDrip = ctx.currentTime + rand(0.05, 0.4);
      while (nextDrip < until) {
        drip(nextDrip);
        nextDrip += rand(0.08, 0.9) / (0.3 + rainLevel);
      }
    },
  };
}
