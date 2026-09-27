import { noiseBuffer, filter, tone, rand } from './synth.js';

// Rain and glide-wind loops. Sources start the first time a level goes above zero and
// then idle at zero gain; drips are scheduled from tick() using AudioContext time.
export function createAmbience(ctx, out) {
  let rain = null;
  let wind = null;
  let rainLevel = 0;
  let glideLevel = 0;
  let nextDrip = 0;

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
