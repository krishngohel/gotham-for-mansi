import { createAudio, SFX_NAMES, MUSIC_MODES, STINGERS } from './audio.js';
import { createMixer } from './mixer.js';
import { triggerSfx } from './sfx.js';
import { createMusic } from './music.js';
import { createAmbience } from './ambience.js';

// Dev page for auditioning every sound, plus window.__audioCheck(): renders each sound
// offline through the same mixer and synth code and reports peak / rms / length.

const audio = createAudio();
window.__audio = audio;
const app = document.getElementById('app');

function section(title) {
  const s = document.createElement('section');
  s.innerHTML = `<h2>${title}</h2><div class="row"></div>`;
  app.appendChild(s);
  return s.querySelector('.row');
}

function button(row, label, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => { audio.unlock(); onClick(b); });
  row.appendChild(b);
  return b;
}

function slider(row, label, value, onInput) {
  const wrap = document.createElement('label');
  wrap.innerHTML = `<span>${label}</span><input type="range" min="0" max="1" step="0.01" value="${value}"><output>${value}</output>`;
  const input = wrap.querySelector('input');
  const out = wrap.querySelector('output');
  input.addEventListener('input', () => { audio.unlock(); out.textContent = input.value; onInput(Number(input.value)); });
  row.appendChild(wrap);
}

const opts = { gain: 1, pitch: 1, pan: 0 };
const sfxRow = section('Sound effects');
SFX_NAMES.forEach((n) => button(sfxRow, n, () => audio.play(n, { ...opts, pitch: opts.pitch * (opts.jitter ? 0.92 + Math.random() * 0.16 : 1) })));
const optRow = section('One-shot options');
slider(optRow, 'gain', 1, (v) => { opts.gain = v; });
slider(optRow, 'pitch (0.5 to 1.5)', 0.5, (v) => { opts.pitch = 0.5 + v; });
slider(optRow, 'pan (left to right)', 0.5, (v) => { opts.pan = v * 2 - 1; });
button(optRow, 'random pitch: off', (b) => { opts.jitter = !opts.jitter; b.textContent = `random pitch: ${opts.jitter ? 'on' : 'off'}`; });

const musicRow = section('Music');
[...MUSIC_MODES, 'none'].forEach((m) => button(musicRow, m, () => audio.music(m)));
const stingRow = section('Stingers');
STINGERS.forEach((s) => button(stingRow, s, () => audio.stinger(s)));

const mixRow = section('Mix and loops');
const vols = { master: 0.9, music: 0.7, sfx: 0.9 };
Object.keys(vols).forEach((k) => slider(mixRow, `${k} volume`, vols[k], (v) => audio.setVolumes({ [k]: v })));
slider(mixRow, 'rain', 0, (v) => audio.setRain(v));
slider(mixRow, 'glide wind', 0, (v) => audio.setGlide(v));
slider(mixRow, 'combat intensity', 0, (v) => audio.setCombatIntensity(v));

const checkRow = section('Self-check');
const table = document.createElement('pre');
button(checkRow, 'run offline check', async (b) => {
  b.disabled = true;
  table.textContent = 'rendering...';
  const r = await window.__audioCheck();
  table.textContent = r.results.map((x) => `${x.flag ? '!!' : 'ok'}  ${x.name.padEnd(24)} peak ${x.peak.toFixed(3)}  rms ${x.rms.toFixed(4)}  ${x.durationSec.toFixed(2)} s`).join('\n');
  b.disabled = false;
});
checkRow.parentElement.appendChild(table);

// ---- offline self-check ----

const RATE = 44100;
const REVERB_TAIL = 2.6;

function measure(buf) {
  let peak = 0;
  let last = 0;
  const chans = [];
  for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
  for (const d of chans) {
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      if (a > 1e-3 && i > last) last = i;
    }
  }
  let sum = 0;
  const n = Math.max(1, last + 1);
  for (const d of chans) for (let i = 0; i < n; i++) sum += d[i] * d[i];
  return { peak, rms: Math.sqrt(sum / (n * chans.length)), durationSec: (last + 1) / buf.sampleRate };
}

async function render(name, seconds, build) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const mix = createMixer(ctx, { limiter: false, volumes: { master: 1, music: 1, sfx: 1 } });
  build(ctx, mix);
  const m = measure(await ctx.startRendering());
  const silent = m.rms < 1e-4;
  const clipping = m.peak > 1.0;
  return { name, ...m, silent, clipping, flag: silent || clipping };
}

// Probe a sound's scheduled length in a throwaway context so the render covers its tail.
function sfxLength(name) {
  const ctx = new OfflineAudioContext(2, RATE, RATE);
  const v = triggerSfx(createMixer(ctx, { limiter: false }), name, 0);
  return v ? v.end : 1;
}

window.__audioCheck = async function audioCheck({ musicSeconds = 4 } = {}) {
  const results = [];
  for (const name of SFX_NAMES) {
    const len = sfxLength(name);
    results.push({ ...(await render(name, len + REVERB_TAIL, (ctx, mix) => triggerSfx(mix, name, 0))), scheduledSec: len });
  }
  const musicCases = [
    ...MUSIC_MODES.map((mode) => [mode, mode, 0]),
    ['combat x=1', 'combat', 1],
    ['boss x=1', 'boss', 1],
  ];
  for (const [label, mode, x] of musicCases) {
    results.push(await render(`music:${label}`, musicSeconds, (ctx, mix) => {
      const music = createMusic(ctx, mix.musicIn);
      music.setIntensity(x);
      music.setMode(mode, 0);
      music.pump(musicSeconds);
    }));
  }
  for (const s of STINGERS) {
    results.push(await render(`stinger:${s}`, 5, (ctx, mix) => createMusic(ctx, mix.musicIn).stinger(s, 0.02)));
  }
  results.push(await render('loop:rain', 3, (ctx, mix) => {
    const amb = createAmbience(ctx, mix.sfxIn);
    amb.setRain(1, 0.01);
    amb.tick(3);
  }));
  results.push(await render('loop:glide', 3, (ctx, mix) => createAmbience(ctx, mix.sfxIn).setGlide(1, 0.01)));
  const failures = results.filter((r) => r.flag).map((r) => r.name);
  return { ok: failures.length === 0, failures, results };
};

// Long render of one mode, e.g. a full loop, the whole finale, or combat at full intensity.
window.__audioCheckMusic = (mode, seconds = 24, intensity = 0) => render(`music:${mode} x=${intensity} ${seconds}s`, seconds, (ctx, mix) => {
  const music = createMusic(ctx, mix.musicIn);
  music.setIntensity(intensity);
  music.setMode(mode, 0);
  music.pump(seconds);
});

// RMS envelope of one SFX in fixed windows (dry, no reverb), for inspecting shapes like the laugh.
window.__audioEnvelope = async (name, winMs = 20) => {
  const len = sfxLength(name);
  const ctx = new OfflineAudioContext(1, Math.ceil((len + 0.05) * RATE), RATE);
  triggerSfx({ ctx, sfxIn: ctx.destination, sfxWet: ctx.createGain() }, name, 0);
  const d = (await ctx.startRendering()).getChannelData(0);
  const w = Math.floor((RATE * winMs) / 1000);
  const env = [];
  for (let i = 0; i + w <= d.length; i += w) {
    let sum = 0;
    for (let j = i; j < i + w; j++) sum += d[j] * d[j];
    env.push(Math.sqrt(sum / w));
  }
  return env;
};
