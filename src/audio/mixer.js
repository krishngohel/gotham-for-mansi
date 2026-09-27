import { createReverb } from './reverb.js';

// Bus layout shared by the live game and the offline self-check:
//   music layers -> musicIn -> musicVol -> master      (musicVol also sends to reverb)
//   sfx voices   -> sfxIn   -> sfxVol   -> master
//   sfx sends    -> sfxWet  -> sfxWetVol -> reverb -> master
//   master -> [limiter] -> destination
export function createMixer(ctx, { limiter = true, volumes = {} } = {}) {
  const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const vol = { master: 0.9, music: 0.7, sfx: 0.9, ...volumes };

  let tail = ctx.destination;
  if (limiter) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 4;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    tail = comp;
  }
  const master = gain(vol.master, tail);
  const reverb = createReverb(ctx);
  reverb.connect(gain(0.8, master));

  const musicVol = gain(vol.music, master);
  const musicSend = gain(0.32, reverb);
  musicVol.connect(musicSend);
  const musicIn = gain(1, musicVol);

  const sfxVol = gain(vol.sfx, master);
  const sfxIn = gain(1, sfxVol);
  const sfxWetVol = gain(vol.sfx, reverb);
  const sfxWet = gain(1, sfxWetVol);

  function ramp(param, v, now, time) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(v, now + time);
  }

  return {
    ctx, master, musicIn, sfxIn, sfxWet,
    setVolumes({ master: m, music, sfx } = {}, time = 0.25) {
      const now = ctx.currentTime;
      const c = (x) => Math.min(1, Math.max(0, Number(x) || 0));
      if (m !== undefined) ramp(master.gain, c(m), now, time);
      if (music !== undefined) ramp(musicVol.gain, c(music), now, time);
      if (sfx !== undefined) { ramp(sfxVol.gain, c(sfx), now, time); ramp(sfxWetVol.gain, c(sfx), now, time); }
    },
  };
}
