import { createMixer } from './mixer.js';
import { SFX, SFX_NAMES, triggerSfx } from './sfx.js';
import { createMusic, MUSIC_MODES, STINGERS } from './music.js';
import { createAmbience } from './ambience.js';

export { SFX_NAMES, MUSIC_MODES, STINGERS };

const SFX_CAP = 20;          // simultaneous one-shot voices
const TICK_MS = 30;          // scheduler timer
const LOOKAHEAD = 0.15;      // seconds scheduled ahead while visible
const HIDDEN_LOOKAHEAD = 1.5; // background tabs throttle timers to ~1 s
const MODES = new Set([...MUSIC_MODES, 'none']);
const clamp01 = (x) => Math.min(1, Math.max(0, Number(x) || 0));

// The game's sound system. Nothing touches Web Audio until unlock() is called from a
// user gesture; every method before that just records state and never throws.
export function createAudio() {
  let ctx = null;
  let mix = null;
  let music = null;
  let amb = null;
  let timer = 0;
  let disposed = false;
  const state = {
    volumes: { master: 0.9, music: 0.7, sfx: 0.9 }, mode: 'none', rain: 0, glide: 0, intensity: 0,
    engine: { kind: null, level: 0, speed: 0, boost: false },
  };
  const warned = new Set();
  let voices = [];
  let spent = [];

  const warnOnce = (key, msg) => {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`[audio] ${msg}`);
  };
  const guard = (fn) => (...args) => {
    try { return fn(...args); } catch (err) { warnOnce(`err:${err && err.message}`, `ignored error: ${err && err.message}`); }
    return undefined;
  };
  const running = () => !disposed && ctx && ctx.state === 'running';

  function tick() {
    if (!running()) return;
    const hidden = typeof document !== 'undefined' && document.hidden;
    const until = ctx.currentTime + (hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD);
    music.pump(until);
    amb.tick(until);
    // release finished one-shot voices so their nodes can be collected
    const now = ctx.currentTime;
    if (spent.length) spent = spent.filter((v) => (v.end < now - 0.2 ? (v.gain.disconnect(), false) : true));
  }

  function steal(v, now) {
    const g = v.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.03);
    voices = voices.filter((x) => x !== v);
  }

  const api = {
    unlock: guard(() => {
      if (disposed) return;
      if (!ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) { warnOnce('noac', 'Web Audio is not available'); return; }
        ctx = new AC({ latencyHint: 'interactive' });
        mix = createMixer(ctx, { volumes: state.volumes });
        music = createMusic(ctx, mix.musicIn);
        amb = createAmbience(ctx, mix.sfxIn);
        music.setIntensity(state.intensity);
        if (state.rain > 0) amb.setRain(state.rain);
        if (state.glide > 0) amb.setGlide(state.glide);
        if (state.engine.kind) amb.setEngine(state.engine.kind, state.engine.level, state.engine.speed, { boost: state.engine.boost });
        if (state.mode !== 'none') music.setMode(state.mode);
        timer = setInterval(guard(tick), TICK_MS);
      }
      if (ctx.state !== 'running' && ctx.state !== 'closed') {
        const p = ctx.resume();
        if (p && p.then) p.then(guard(tick), () => {});
      }
    }),

    setVolumes: guard((v = {}) => {
      const next = {};
      for (const k of ['master', 'music', 'sfx']) if (v[k] !== undefined) next[k] = clamp01(v[k]);
      Object.assign(state.volumes, next);
      if (mix) mix.setVolumes(next);
    }),

    play: guard((name, opts = {}) => {
      const def = SFX[name];
      if (!def) { warnOnce(`sfx:${name}`, `unknown sfx "${name}"`); return; }
      if (!running()) return;
      const now = ctx.currentTime;
      voices = voices.filter((v) => v.end > now);
      const same = voices.filter((v) => v.name === name);
      if (same.length >= def.max) steal(same[0], now);
      else if (voices.length >= SFX_CAP) steal(voices[0], now);
      const v = triggerSfx(mix, name, now + 0.003, opts || {});
      if (v) { voices.push(v); spent.push(v); }
    }),

    music: guard((mode) => {
      if (!MODES.has(mode)) { warnOnce(`mode:${mode}`, `unknown music mode "${mode}"`); return; }
      if (mode === state.mode) return;
      state.mode = mode;
      if (music) music.setMode(mode, 1.5);
      tick();
    }),

    stinger: guard((name) => {
      if (!STINGERS.includes(name)) { warnOnce(`sting:${name}`, `unknown stinger "${name}"`); return; }
      if (running()) music.stinger(name);
    }),

    setRain: guard((x) => { state.rain = clamp01(x); if (amb) amb.setRain(state.rain); }),
    setGlide: guard((x) => { state.glide = clamp01(x); if (amb) amb.setGlide(state.glide); }),
    // kind: 'batmobile' | 'car' | 'wing' | null (falsy fades out whichever engine is playing).
    // level: 0..1 overall presence. speed: 0..1 fraction of that vehicle's own top speed.
    setEngine: guard((kind, level = 1, speed = 0, opts = {}) => {
      const e = state.engine; // mutated in place: this is called every frame while driving
      e.kind = kind || null; e.level = clamp01(level); e.speed = clamp01(speed); e.boost = !!opts.boost;
      if (amb) amb.setEngine(state.engine.kind, state.engine.level, state.engine.speed, { boost: state.engine.boost });
    }),
    setCombatIntensity: guard((x) => { state.intensity = clamp01(x); if (music) music.setIntensity(state.intensity); }),

    // Scheduling runs on its own timer, so there is nothing to do per frame.
    update() {},

    dispose: guard(() => {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
      if (music) music.dispose();
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
      mix = music = amb = null; // later calls only record state
      voices = [];
      spent = [];
    }),

    get context() { return ctx; },
  };
  return api;
}
