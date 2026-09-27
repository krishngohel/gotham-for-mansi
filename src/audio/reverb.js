// Shared hall reverb: a ConvolverNode fed by a generated stereo noise impulse whose
// tail decays exponentially and darkens over time (a one-pole lowpass that closes).
export function createReverb(ctx, { seconds = 2.4, decay = 3, predelay = 0.018 } = {}) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const ir = ctx.createBuffer(2, len, rate);
  const pre = Math.floor(rate * predelay);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const x = (i - pre) / (len - pre);
      const k = 0.85 - 0.8 * x; // filter coefficient: bright early, dark late
      lp += k * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.pow(1 - x, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  return conv;
}
