import {
  tone, noise, metal, env, filter, drive, noiseSource, bell, brass, mtof, rand,
} from './synth.js';

// Each SFX builds into (ctx, out, t, p) where p is a pitch multiplier, and returns its end time.
// `wet` is the reverb send level, `max` caps how many of that sound may overlap.

// Short airy sweep shared by swings, throws and counters.
function swish(ctx, out, t, p, { from = 350, peak = 1900, to = 500, dur = 0.26, gain = 0.5, Q = 1.6 } = {}) {
  const g = env(ctx, out, t, { a: dur * 0.45, d: dur * 0.55, peak: gain });
  const f = filter(ctx, g, 'bandpass', from * p, Q);
  f.frequency.setValueAtTime(from * p, t);
  f.frequency.exponentialRampToValueAtTime(peak * p, t + dur * 0.45);
  f.frequency.exponentialRampToValueAtTime(to * p, t + dur);
  noiseSource(ctx, t, dur).connect(f);
  return t + dur + 0.02;
}

// Rapid amplitude flutter on noise: cloth, capes, crackle.
function flutter(ctx, out, t, p, { dur = 0.3, rate = 38, freq = 2200, to = null, gain = 0.4, Q = 0.9, a = 0.02 } = {}) {
  const g = env(ctx, out, t, { a, d: dur - a, peak: gain });
  const am = ctx.createGain();
  am.gain.value = 0.5;
  am.connect(g);
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.setValueAtTime(rate, t);
  lfo.frequency.linearRampToValueAtTime(rate * 0.6, t + dur);
  const lg = ctx.createGain();
  lg.gain.value = 0.5;
  lfo.connect(lg);
  lg.connect(am.gain);
  const f = filter(ctx, am, 'bandpass', freq * p, Q);
  if (to) f.frequency.exponentialRampToValueAtTime(to * p, t + dur);
  noiseSource(ctx, t, dur).connect(f);
  lfo.start(t);
  lfo.stop(t + dur + 0.05);
  return t + dur + 0.02;
}

// Random clicks on one noise gain: crackle for fireworks, electricity and drips.
function crackle(ctx, out, t, { dur = 0.6, count = 30, freq = 3000, gain = 0.4, type = 'highpass' } = {}) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  const times = [];
  for (let i = 0; i < count; i++) times.push(t + Math.pow(Math.random(), 1.4) * dur);
  times.sort((a, b) => a - b);
  let last = t;
  for (const ct of times) {
    if (ct < last + 0.004) continue;
    const fade = 1 - (ct - t) / (dur * 1.1);
    g.gain.setValueAtTime(gain * fade * rand(0.4, 1), ct);
    g.gain.setValueAtTime(0, ct + rand(0.001, 0.004));
    last = ct + 0.004;
  }
  g.connect(out);
  const f = filter(ctx, g, type, freq, 0.7);
  noiseSource(ctx, t, dur + 0.02).connect(f);
  return t + dur + 0.03;
}

function thump(ctx, out, t, p, { from = 160, to = 50, d = 0.16, gain = 0.7 } = {}) {
  return tone(ctx, out, t, { freq: from * p, to: to * p, glide: d * 0.7, d, gain });
}

export const SFX = {
  punch: { wet: 0.08, max: 4, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 170, to: 55, d: 0.14, gain: 0.75 });
    noise(ctx, out, t, { type: 'bandpass', freq: 1300 * p, Q: 0.9, d: 0.07, gain: 0.7 });
    noise(ctx, out, t, { type: 'highpass', freq: 4000, d: 0.012, gain: 0.35 });
    return t + 0.16;
  } },

  kick: { wet: 0.08, max: 4, fn(ctx, out, t, p) {
    swish(ctx, out, t, p, { from: 250, peak: 1100, to: 400, dur: 0.1, gain: 0.25 });
    const h = t + 0.06;
    thump(ctx, out, h, p, { from: 130, to: 40, d: 0.2, gain: 0.8 });
    noise(ctx, out, h, { type: 'lowpass', freq: 900 * p, d: 0.11, gain: 0.7 });
    noise(ctx, out, h, { type: 'bandpass', freq: 2500 * p, Q: 1.2, d: 0.02, gain: 0.35 });
    return h + 0.22;
  } },

  heavy: { wet: 0.2, max: 2, fn(ctx, out, t, p) {
    const post = ctx.createGain();
    post.gain.value = 0.5;
    post.connect(out);
    const crunch = drive(ctx, post, 5);
    const pre = ctx.createGain();
    pre.gain.value = 0.9;
    pre.connect(crunch);
    thump(ctx, pre, t, p, { from: 140, to: 32, d: 0.55, gain: 0.55 });
    noise(ctx, pre, t, { type: 'lowpass', freq: 700 * p, to: 150, d: 0.45, gain: 0.45 });
    noise(ctx, out, t, { type: 'bandpass', freq: 1800 * p, Q: 0.8, d: 0.09, gain: 0.45 });
    tone(ctx, out, t, { freq: 48 * p, to: 28, d: 0.7, gain: 0.3 });
    return t + 0.72;
  } },

  counter: { wet: 0.15, max: 2, fn(ctx, out, t, p) {
    swish(ctx, out, t, p, { from: 400, peak: 3200, to: 900, dur: 0.16, gain: 0.45, Q: 2 });
    const h = t + 0.14;
    noise(ctx, out, h, { type: 'highpass', freq: 2500 * p, d: 0.035, gain: 0.55 });
    tone(ctx, out, h, { type: 'square', freq: 900 * p, to: 300 * p, d: 0.03, gain: 0.15 });
    thump(ctx, out, h, p, { from: 200, to: 70, d: 0.12, gain: 0.45 });
    return h + 0.14;
  } },

  block: { wet: 0.06, max: 3, fn(ctx, out, t, p) {
    tone(ctx, out, t, { freq: 95 * p, to: 62 * p, d: 0.12, gain: 0.7 });
    tone(ctx, out, t, { type: 'triangle', freq: 210 * p, to: 170 * p, d: 0.07, gain: 0.3 });
    noise(ctx, out, t, { type: 'lowpass', freq: 380 * p, d: 0.09, gain: 0.8 });
    return t + 0.14;
  } },

  whoosh: { wet: 0.1, max: 3, fn(ctx, out, t, p) {
    return swish(ctx, out, t, p, { from: 300, peak: 1700, to: 450, dur: 0.28, gain: 0.55 });
  } },

  cape: { wet: 0.08, max: 2, fn(ctx, out, t, p) {
    flutter(ctx, out, t, p, { dur: 0.2, rate: 45, freq: 1800, to: 3000, gain: 0.5, a: 0.03 });
    noise(ctx, out, t + 0.18, { type: 'bandpass', freq: 2600 * p, Q: 1.4, d: 0.035, gain: 0.55 });
    return t + 0.24;
  } },

  batarangThrow: { wet: 0.12, max: 2, fn(ctx, out, t, p) {
    const dur = 0.6;
    const g = env(ctx, out, t, { a: 0.03, d: dur - 0.03, peak: 0.9 });
    const am = ctx.createGain();
    am.gain.value = 0.55;
    am.connect(g);
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(28, t);
    lfo.frequency.linearRampToValueAtTime(18, t + dur);
    const lg = ctx.createGain();
    lg.gain.value = 0.45;
    lfo.connect(lg);
    lg.connect(am.gain);
    const f = filter(ctx, am, 'bandpass', 2400 * p, 3);
    f.frequency.exponentialRampToValueAtTime(1300 * p, t + dur);
    noiseSource(ctx, t, dur).connect(f);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520 * p, t);
    o.frequency.exponentialRampToValueAtTime(360 * p, t + dur);
    const og = ctx.createGain();
    og.gain.value = 0.12;
    o.connect(og);
    og.connect(am);
    [o, lfo].forEach((n) => { n.start(t); n.stop(t + dur + 0.05); });
    return t + dur + 0.02;
  } },

  batarangHit: { wet: 0.18, max: 3, fn(ctx, out, t, p) {
    metal(ctx, out, t, { base: 2100 * p, ratios: [1, 1.63, 2.47, 3.3], d: 0.35, gain: 0.22 });
    noise(ctx, out, t, { type: 'highpass', freq: 5000, d: 0.015, gain: 0.5 });
    tone(ctx, out, t, { type: 'triangle', freq: 600 * p, to: 400 * p, d: 0.05, gain: 0.25 });
    return t + 0.37;
  } },

  grapple: { wet: 0.12, max: 2, fn(ctx, out, t, p) {
    noise(ctx, out, t, { type: 'bandpass', freq: 1400 * p, Q: 0.7, d: 0.06, gain: 0.7 });
    thump(ctx, out, t, p, { from: 220, to: 70, d: 0.09, gain: 0.55 });
    const z = t + 0.05, dur = 0.42;
    const g = env(ctx, out, z, { a: 0.02, d: dur, peak: 0.16 });
    const bp = filter(ctx, g, 'bandpass', 800 * p, 2);
    bp.frequency.setValueAtTime(700 * p, z);
    bp.frequency.exponentialRampToValueAtTime(4200 * p, z + dur);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180 * p, z);
    o.frequency.exponentialRampToValueAtTime(1700 * p, z + dur);
    o.connect(bp);
    o.start(z);
    o.stop(z + dur + 0.05);
    noise(ctx, out, z, { type: 'bandpass', freq: 3000 * p, to: 7000 * p, Q: 4, a: 0.02, d: dur, gain: 0.4 });
    return z + dur + 0.05;
  } },

  grappleLand: { wet: 0.12, max: 2, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 150, to: 50, d: 0.18, gain: 0.7 });
    metal(ctx, out, t, { base: 1100 * p, ratios: [1, 1.5, 2.3], d: 0.18, gain: 0.18 });
    noise(ctx, out, t, { type: 'bandpass', freq: 2200 * p, Q: 1, d: 0.04, gain: 0.5 });
    return t + 0.22;
  } },

  land: { wet: 0.12, max: 2, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 110, to: 34, d: 0.3, gain: 0.85 });
    noise(ctx, out, t, { type: 'lowpass', freq: 600 * p, d: 0.22, gain: 0.7 });
    crackle(ctx, out, t + 0.01, { dur: 0.14, count: 12, freq: 2500, gain: 0.35 });
    noise(ctx, out, t, { type: 'bandpass', freq: 2000 * p, Q: 0.8, d: 0.12, gain: 0.25 });
    return t + 0.32;
  } },

  roll: { wet: 0.06, max: 2, fn(ctx, out, t, p) {
    const dur = 0.42;
    const g = env(ctx, out, t, { a: 0.05, d: dur - 0.05, peak: 0.8 });
    const am = ctx.createGain();
    am.connect(g);
    am.gain.setValueAtTime(1, t);
    for (let i = 1; i < 5; i++) am.gain.linearRampToValueAtTime(i % 2 ? 0.35 : 1, t + i * dur / 5);
    noiseSource(ctx, t, dur).connect(filter(ctx, am, 'lowpass', 420 * p, 0.8));
    flutter(ctx, out, t + 0.05, p, { dur: 0.3, rate: 22, freq: 1500, gain: 0.2 });
    thump(ctx, out, t, p, { from: 90, to: 50, d: 0.12, gain: 0.4 });
    return t + dur + 0.02;
  } },

  // Called constantly, so kept to one noise source, one filter and one gain.
  footstep: { wet: 0, max: 2, fn(ctx, out, t, p) {
    return noise(ctx, out, t, { type: 'bandpass', freq: rand(1400, 2400) * p, to: rand(500, 700) * p, Q: 0.9, a: 0.003, d: 0.07, gain: 0.35 });
  } },

  glideStart: { wet: 0.15, max: 1, fn(ctx, out, t, p) {
    flutter(ctx, out, t, p, { dur: 0.55, rate: 30, freq: 700, to: 2600, gain: 0.5, a: 0.08 });
    swish(ctx, out, t + 0.05, p, { from: 250, peak: 1200, to: 600, dur: 0.5, gain: 0.35 });
    noise(ctx, out, t + 0.5, { type: 'bandpass', freq: 2000 * p, Q: 1.2, d: 0.05, gain: 0.45 });
    return t + 0.6;
  } },

  hurt: { wet: 0.1, max: 2, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 130, to: 45, d: 0.2, gain: 0.8 });
    noise(ctx, out, t, { type: 'bandpass', freq: 900 * p, Q: 0.8, d: 0.1, gain: 0.5 });
    // a short "oof": buzzy source through two vowel formants, pitch falling
    const g = env(ctx, out, t + 0.02, { a: 0.02, d: 0.22, peak: 0.55 });
    const f1 = filter(ctx, g, 'bandpass', 500 * p, 5);
    const f2 = filter(ctx, g, 'bandpass', 1000 * p, 7);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(170 * p, t + 0.02);
    o.frequency.exponentialRampToValueAtTime(95 * p, t + 0.26);
    o.connect(f1); o.connect(f2);
    o.start(t + 0.02);
    o.stop(t + 0.28);
    return t + 0.28;
  } },

  ko: { wet: 0.25, max: 2, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 150, to: 30, d: 0.5, gain: 0.8 });
    noise(ctx, out, t, { type: 'lowpass', freq: 800 * p, to: 120, d: 0.4, gain: 0.55 });
    tone(ctx, out, t + 0.05, { type: 'triangle', freq: 440 * p, to: 110 * p, d: 0.55, gain: 0.25 });
    noise(ctx, out, t + 0.28, { type: 'lowpass', freq: 500 * p, d: 0.2, gain: 0.35 });
    return t + 0.65;
  } },

  buzzer: { wet: 0.08, max: 2, fn(ctx, out, t, p) {
    const dur = 0.75;
    const g = env(ctx, out, t, { a: 0.01, hold: 0.45, d: 0.29, peak: 0.12 });
    const hp = filter(ctx, g, 'highpass', 90, 0.7);
    const buzz = drive(ctx, hp, 8);
    const am = ctx.createGain();
    am.connect(buzz);
    am.gain.setValueAtTime(1, t);
    for (let x = 0.03; x < dur; x += rand(0.02, 0.06)) am.gain.setValueAtTime(rand(0.3, 1), t + x);
    [[60, 'sawtooth'], [121, 'square'], [183, 'sawtooth']].forEach(([f, type]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * p;
      o.connect(am);
      o.start(t);
      o.stop(t + dur + 0.02);
    });
    crackle(ctx, out, t, { dur, count: 40, freq: 3500, gain: 0.45 });
    return t + dur + 0.03;
  } },

  gas: { wet: 0.1, max: 2, fn(ctx, out, t, p) {
    const dur = 1.2;
    noise(ctx, out, t, { type: 'highpass', freq: 3500 * p, Q: 0.6, a: 0.1, hold: 0.6, d: 0.5, gain: 0.26 });
    noise(ctx, out, t, { type: 'bandpass', freq: 6000 * p, to: 4000 * p, Q: 2, a: 0.15, hold: 0.5, d: 0.5, gain: 0.2 });
    return t + dur + 0.02;
  } },

  throw: { wet: 0.08, max: 2, fn(ctx, out, t, p) {
    return swish(ctx, out, t, p, { from: 500, peak: 2400, to: 1200, dur: 0.18, gain: 0.5, Q: 1.3 });
  } },

  pop: { wet: 0.1, max: 3, fn(ctx, out, t, p) {
    noise(ctx, out, t, { type: 'highpass', freq: 1500 * p, d: 0.045, gain: 0.6 });
    tone(ctx, out, t, { type: 'triangle', freq: 1400 * p, to: 500 * p, d: 0.04, gain: 0.35 });
    thump(ctx, out, t, p, { from: 300, to: 120, d: 0.05, gain: 0.35 });
    return t + 0.07;
  } },

  balloon: { wet: 0.35, max: 2, fn(ctx, out, t, p) {
    const semi = 12 * Math.log2(p);
    [84, 88, 91, 93, 96, 100].forEach((m, i) => bell(ctx, out, t + i * 0.055, m + semi, { gain: 0.2, d: 0.7, ratio: 2.01, index: 1.2 }));
    crackle(ctx, out, t + 0.1, { dur: 0.7, count: 18, freq: 7000, gain: 0.18 });
    return t + 1.05;
  } },

  uiMove: { wet: 0, max: 2, fn(ctx, out, t, p) {
    return tone(ctx, out, t, { type: 'triangle', freq: 1500 * p, d: 0.04, gain: 0.25 });
  } },

  uiSelect: { wet: 0.08, max: 2, fn(ctx, out, t, p) {
    tone(ctx, out, t, { type: 'triangle', freq: 880 * p, d: 0.07, gain: 0.3 });
    return tone(ctx, out, t + 0.06, { type: 'triangle', freq: 1320 * p, d: 0.14, gain: 0.3 });
  } },

  uiBack: { wet: 0.05, max: 2, fn(ctx, out, t, p) {
    tone(ctx, out, t, { type: 'triangle', freq: 990 * p, d: 0.06, gain: 0.28 });
    return tone(ctx, out, t + 0.06, { type: 'triangle', freq: 620 * p, d: 0.12, gain: 0.28 });
  } },

  // Maniacal cackle: a buzzy glottal source through three vowel formants, with
  // breathy "h" onsets. Syllables speed up and climb, then the last one slides down.
  laugh: { wet: 0.3, max: 1, fn(ctx, out, t, p) {
    const syl = [[300, 0.15], [330, 0.13], [360, 0.12], [385, 0.11], [400, 0.11], [370, 0.12], [320, 0.34]];
    const bank = ctx.createGain();
    [[780, 7, 1.6], [1180, 9, 1.0], [2550, 11, 0.45]].forEach(([f, Q, lvl]) => {
      const fg = ctx.createGain();
      fg.gain.value = lvl;
      fg.connect(out);
      bank.connect(filter(ctx, fg, 'bandpass', f * Math.sqrt(p), Q));
    });

    const voice = ctx.createGain();
    voice.gain.setValueAtTime(0, t);
    voice.connect(bank);
    const breath = ctx.createGain();
    breath.gain.setValueAtTime(0, t);
    breath.connect(bank);

    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    const vib = ctx.createOscillator();
    vib.frequency.value = 7;
    const vg = ctx.createGain();
    vg.gain.value = 25;
    vib.connect(vg);
    vg.connect(src.detune);
    src.connect(voice);

    let x = t;
    syl.forEach(([f0, len], i) => {
      const last = i === syl.length - 1;
      const h = 0.035;
      breath.gain.setValueAtTime(0, x);
      breath.gain.linearRampToValueAtTime(0.9, x + 0.01);
      breath.gain.linearRampToValueAtTime(0, x + h);
      src.frequency.setValueAtTime(f0 * p * 1.08, x + h * 0.6);
      src.frequency.exponentialRampToValueAtTime(f0 * p * (last ? 0.6 : 0.88), x + h + len);
      voice.gain.setValueAtTime(0, x + h * 0.5);
      voice.gain.linearRampToValueAtTime(1, x + h + 0.015);
      voice.gain.setValueAtTime(1, x + h + len * 0.55);
      voice.gain.linearRampToValueAtTime(0, x + h + len);
      x += h + len + (last ? 0 : 0.03);
    });
    const end = x + 0.05;
    noiseSource(ctx, t, end - t).connect(filter(ctx, breath, 'highpass', 900, 0.5));
    [src, vib].forEach((n) => { n.start(t); n.stop(end); });
    return end;
  } },

  firework: { wet: 0.3, max: 3, fn(ctx, out, t, p) {
    const up = 0.55;
    const g = env(ctx, out, t, { a: up * 0.8, d: up * 0.2, peak: 0.12 });
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(700 * p, t);
    o.frequency.exponentialRampToValueAtTime(2600 * p, t + up);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 18;
    const lg = ctx.createGain();
    lg.gain.value = 40;
    lfo.connect(lg);
    lg.connect(o.frequency);
    o.connect(g);
    [o, lfo].forEach((n) => { n.start(t); n.stop(t + up + 0.02); });
    noise(ctx, out, t, { type: 'bandpass', freq: 3000 * p, Q: 3, a: up * 0.8, d: up * 0.2, gain: 0.12 });
    const b = t + up + 0.03;
    tone(ctx, out, b, { freq: 90 * p, to: 30, d: 0.5, gain: 0.7 });
    noise(ctx, out, b, { type: 'lowpass', freq: 1500 * p, to: 200, d: 0.4, gain: 0.7 });
    crackle(ctx, out, b + 0.08, { dur: 0.85, count: 60, freq: 2500, gain: 0.45 });
    return b + 0.95;
  } },

  // Longer than most on purpose: a rolling rumble with an irregular swell pattern.
  thunder: { wet: 0.35, max: 1, fn(ctx, out, t, p) {
    const dur = 3.6;
    noise(ctx, out, t, { type: 'highpass', freq: 1200, a: 0.005, d: 0.25, gain: 0.35 });
    const g = env(ctx, out, t, { a: 0.08, d: dur - 0.08, peak: 1 });
    const am = ctx.createGain();
    am.connect(g);
    am.gain.setValueAtTime(1, t);
    for (let x = 0.2; x < dur; x += rand(0.18, 0.45)) am.gain.linearRampToValueAtTime(rand(0.35, 1), t + x);
    const lp = filter(ctx, am, 'lowpass', 260 * p, 0.8);
    lp.frequency.setValueAtTime(700 * p, t);
    lp.frequency.exponentialRampToValueAtTime(140 * p, t + dur);
    const pre = ctx.createGain();
    pre.gain.value = 1.8;
    pre.connect(lp);
    noiseSource(ctx, t, dur).connect(pre);
    tone(ctx, out, t, { freq: 45 * p, to: 30, a: 0.1, d: 2.2, gain: 0.35 });
    return t + dur + 0.02;
  } },

  // Slow-mo finisher: a quick reversed swell sucks in, then a deep boom lands.
  takedown: { wet: 0.4, max: 1, fn(ctx, out, t, p) {
    const s = 0.28;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(1e-4, t);
    sg.gain.exponentialRampToValueAtTime(0.5, t + s);
    sg.gain.setValueAtTime(0, t + s + 0.005);
    sg.connect(out);
    const bp = filter(ctx, sg, 'bandpass', 400 * p, 1.2);
    bp.frequency.setValueAtTime(400 * p, t);
    bp.frequency.exponentialRampToValueAtTime(3000 * p, t + s);
    noiseSource(ctx, t, s).connect(bp);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(80 * p, t);
    o.frequency.exponentialRampToValueAtTime(320 * p, t + s);
    const og = ctx.createGain();
    og.gain.value = 0.25;
    o.connect(og);
    og.connect(bp);
    o.start(t);
    o.stop(t + s + 0.01);
    const h = t + s;
    tone(ctx, out, h, { freq: 110 * p, to: 24, glide: 1.0, d: 1.15, gain: 0.7 });
    noise(ctx, out, h, { type: 'lowpass', freq: 900 * p, to: 80, d: 0.9, gain: 0.45 });
    noise(ctx, out, h, { type: 'bandpass', freq: 1600 * p, Q: 0.8, d: 0.08, gain: 0.35 });
    return h + 1.2;
  } },

  signal: { wet: 0.35, max: 1, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 120, to: 55, d: 0.25, gain: 0.5 });
    metal(ctx, out, t, { base: 310 * p, ratios: [1, 1.52, 2.64, 3.7], d: 0.5, gain: 0.22 });
    noise(ctx, out, t, { type: 'bandpass', freq: 1500 * p, Q: 1, d: 0.05, gain: 0.35 });
    crackle(ctx, out, t + 0.05, { dur: 0.35, count: 20, freq: 4000, gain: 0.25 });
    // mains hum and a rising glow
    const h = t + 0.1, dur = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, h);
    g.gain.linearRampToValueAtTime(0.1, h + 1.0);
    g.gain.setValueAtTime(0.1, h + 1.2);
    g.gain.linearRampToValueAtTime(0, h + dur);
    g.connect(out);
    const lp = filter(ctx, g, 'lowpass', 300, 0.7);
    lp.frequency.linearRampToValueAtTime(1400, h + 1.0);
    [[60, 'sawtooth'], [120, 'sawtooth'], [180.5, 'square']].forEach(([f, type]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * p;
      o.connect(lp);
      o.start(h);
      o.stop(h + dur + 0.02);
    });
    [50, 57, 62].forEach((m) => brass(ctx, out, h + 0.3, m + 12 * Math.log2(p), 0.8, { gain: 0.035, a: 0.7, r: 0.5, bright: 0.4 }));
    return h + dur + 0.05;
  } },

  pickup: { wet: 0.25, max: 2, fn(ctx, out, t, p) {
    const semi = 12 * Math.log2(p);
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, t + i * 0.07, { type: 'square', freq: mtof(m + semi), d: 0.1, gain: 0.12 });
      bell(ctx, out, t + i * 0.07, m + 12 + semi, { gain: 0.12, d: 0.3, ratio: 2, index: 1 });
    });
    const f = t + 0.21;
    brass(ctx, out, f, 84 + semi - 12, 0.25, { gain: 0.15, a: 0.02, r: 0.3, bright: 1 });
    brass(ctx, out, f, 79 + semi - 12, 0.25, { gain: 0.1, a: 0.02, r: 0.3, bright: 1 });
    bell(ctx, out, f, 96 + semi, { gain: 0.15, d: 0.6, ratio: 3.01, index: 1.5 });
    return f + 0.6;
  } },

  // Remote batarang: a fast whirring spin, re-triggered every 1.1 s while it flies.
  remote: { wet: 0.1, max: 2, fn(ctx, out, t, p) {
    flutter(ctx, out, t, p, { dur: 1.1, rate: 46, freq: 2600, to: 2200, gain: 0.2, Q: 2.2, a: 0.04 });
    return t + 1.15;
  } },

  // Gel spray: a wet hiss and a squelch.
  gelSpray: { wet: 0.06, max: 2, fn(ctx, out, t, p) {
    noise(ctx, out, t, { type: 'bandpass', freq: 1800 * p, Q: 1.2, d: 0.2, gain: 0.35 });
    tone(ctx, out, t + 0.05, { type: 'sine', freq: 320 * p, to: 110 * p, d: 0.14, gain: 0.3 });
    return t + 0.24;
  } },

  // Gel blast: a deep boom with a crackle of debris. Gains trimmed from the original 1 / 0.9 (fix
  // round 1): unlike heavy, this has no drive/post-attenuation stage, so it rendered ~3 dB hotter
  // than heavy's peak. Still the loudest of the gadget set, now within ~1 dB of heavy.
  gelBoom: { wet: 0.3, max: 2, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 120, to: 32, d: 0.55, gain: 0.65 });
    noise(ctx, out, t, { type: 'lowpass', freq: 700 * p, d: 0.6, gain: 0.58 });
    crackle(ctx, out, t + 0.05, { dur: 0.5, count: 26, freq: 2500, gain: 0.3 });
    return t + 0.7;
  } },

  // Smoke pellet: a pop, then a long hiss swelling out.
  smoke: { wet: 0.2, max: 1, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 260, to: 90, d: 0.08, gain: 0.5 });
    swish(ctx, out, t + 0.03, p, { from: 300, peak: 1400, to: 500, dur: 0.9, gain: 0.5, Q: 0.8 });
    noise(ctx, out, t + 0.05, { type: 'highpass', freq: 3000, d: 1.1, gain: 0.12 });
    return t + 1.2;
  } },

  // Line launcher: a gas-powered thunk and the line whipping out.
  launcher: { wet: 0.15, max: 2, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 210, to: 90, d: 0.1, gain: 0.6 });
    metal(ctx, out, t, { base: 1200 * p, ratios: [1, 2.3], d: 0.14, gain: 0.14 });
    swish(ctx, out, t + 0.04, p, { from: 800, peak: 3600, to: 1500, dur: 0.3, gain: 0.35, Q: 3 });
    return t + 0.36;
  } },

  // Batclaw: the claw flies out and clamps shut.
  claw: { wet: 0.12, max: 2, fn(ctx, out, t, p) {
    swish(ctx, out, t, p, { from: 600, peak: 2800, to: 900, dur: 0.18, gain: 0.35, Q: 2.5 });
    metal(ctx, out, t + 0.16, { base: 900 * p, ratios: [1, 1.6, 2.7], d: 0.2, gain: 0.2 });
    thump(ctx, out, t + 0.18, p, { from: 180, to: 70, d: 0.12, gain: 0.5 });
    return t + 0.4;
  } },

  // Freeze blast: a crackling freeze under a falling whistle.
  freeze: { wet: 0.3, max: 2, fn(ctx, out, t, p) {
    crackle(ctx, out, t, { dur: 0.5, count: 36, freq: 6000, gain: 0.3 });
    tone(ctx, out, t, { type: 'sine', freq: 2400 * p, to: 900 * p, d: 0.4, gain: 0.18 });
    return t + 0.55;
  } },

  // Ice shatter: a bright crackle over a glassy ring.
  shatter: { wet: 0.35, max: 2, fn(ctx, out, t, p) {
    crackle(ctx, out, t, { dur: 0.35, count: 44, freq: 5000, gain: 0.5 });
    bell(ctx, out, t, 100 + 12 * Math.log2(p), { gain: 0.12, d: 0.5, ratio: 2.7, index: 1.4 });
    return t + 0.6;
  } },

  // A glass sign coming down.
  glass: { wet: 0.3, max: 2, fn(ctx, out, t, p) {
    crackle(ctx, out, t, { dur: 0.45, count: 50, freq: 7000, gain: 0.45 });
    tone(ctx, out, t, { type: 'triangle', freq: 3200 * p, to: 2000 * p, d: 0.1, gain: 0.2 });
    return t + 0.5;
  } },

  // A cracked wall giving way: a heavy crunch and tumbling bricks. Gains trimmed from the
  // original 0.9 / 0.7 (fix round 1): no drive/post-attenuation stage like heavy has, so it
  // rendered louder than heavy's peak. Now within ~1 dB of heavy.
  wallBreak: { wet: 0.3, max: 1, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 90, to: 30, d: 0.45, gain: 0.77 });
    noise(ctx, out, t, { type: 'lowpass', freq: 500 * p, d: 0.5, gain: 0.6 });
    crackle(ctx, out, t + 0.1, { dur: 0.7, count: 22, freq: 900, gain: 0.35, type: 'lowpass' });
    return t + 0.85;
  } },

  // Party popper: three pops, a crackle of confetti and a little fanfare. Pop gains trimmed
  // (fix round 1): each of the three pops rendered near heavy's peak on its own, and the loudest
  // still cleared it by more than 1 dB.
  popper: { wet: 0.3, max: 1, fn(ctx, out, t, p) {
    const semi = 12 * Math.log2(p);
    for (const at of [0, 0.09, 0.2]) {
      noise(ctx, out, t + at, { type: 'highpass', freq: 1500, d: 0.05, gain: 0.5 });
      thump(ctx, out, t + at, p, { from: 320, to: 120, d: 0.06, gain: 0.34 });
    }
    crackle(ctx, out, t + 0.2, { dur: 0.8, count: 30, freq: 6500, gain: 0.2 });
    [72, 76, 79, 84].forEach((m, i) => bell(ctx, out, t + 0.28 + i * 0.07, m + semi, { gain: 0.14, d: 0.5, ratio: 2, index: 1 }));
    return t + 1.1;
  } },

  // Level up: a rising bell arpeggio over brass.
  levelUp: { wet: 0.35, max: 1, fn(ctx, out, t, p) {
    const semi = 12 * Math.log2(p);
    [67, 72, 76, 79, 84].forEach((m, i) => bell(ctx, out, t + i * 0.08, m + semi, { gain: 0.16, d: 0.8, ratio: 2.01, index: 1.2 }));
    brass(ctx, out, t + 0.32, 72 + semi, 0.5, { gain: 0.14, a: 0.03, r: 0.4, bright: 1 });
    brass(ctx, out, t + 0.32, 79 + semi, 0.5, { gain: 0.1, a: 0.03, r: 0.4, bright: 1 });
    return t + 1.3;
  } },

  // Buying an upgrade: a mechanical clunk and a chime.
  upgrade: { wet: 0.2, max: 1, fn(ctx, out, t, p) {
    metal(ctx, out, t, { base: 700 * p, ratios: [1, 1.5, 2.2], d: 0.18, gain: 0.18 });
    bell(ctx, out, t + 0.1, 88 + 12 * Math.log2(p), { gain: 0.16, d: 0.7, ratio: 3.01, index: 1.5 });
    return t + 0.8;
  } },

  // The gadget wheel opening: a soft paper swish.
  wheelOpen: { wet: 0.05, max: 1, fn(ctx, out, t, p) {
    return swish(ctx, out, t, p, { from: 800, peak: 2400, to: 1200, dur: 0.16, gain: 0.2, Q: 1.2 });
  } },

  // Bat Swarm: two layers of wing flutter, swelling and fading.
  swarm: { wet: 0.35, max: 1, fn(ctx, out, t, p) {
    flutter(ctx, out, t, p, { dur: 1.8, rate: 30, freq: 3200, to: 1800, gain: 0.35, Q: 0.9, a: 0.3 });
    flutter(ctx, out, t + 0.15, p, { dur: 1.6, rate: 22, freq: 1500, to: 900, gain: 0.25, Q: 0.9, a: 0.3 });
    return t + 2;
  } },
};

export const SFX_NAMES = Object.keys(SFX);
const TRIM = 0.8; // headroom: noise-based hits vary a little in peak from play to play

// Builds one SFX voice (gain + optional pan + reverb send) into a mixer and schedules it.
export function triggerSfx(mix, name, t, { gain = 1, pitch = 1, pan = 0 } = {}) {
  const def = SFX[name];
  if (!def) return null;
  const { ctx } = mix;
  const v = ctx.createGain();
  v.gain.value = TRIM * Math.max(0, Number(gain) || 0);
  const pn = Math.max(-1, Math.min(1, Number(pan) || 0));
  if (pn && ctx.createStereoPanner) {
    const sp = ctx.createStereoPanner();
    sp.pan.value = pn;
    v.connect(sp);
    sp.connect(mix.sfxIn);
  } else v.connect(mix.sfxIn);
  if (def.wet > 0) {
    const s = ctx.createGain();
    s.gain.value = def.wet;
    v.connect(s);
    s.connect(mix.sfxWet);
  }
  const p = Math.max(0.25, Math.min(4, Number(pitch) || 1));
  const end = def.fn(ctx, v, t, p);
  return { name, gain: v, start: t, end };
}
