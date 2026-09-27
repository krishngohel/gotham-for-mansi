import { strings, brass, drum, snare, cymbal, bell, organ, mtof } from './synth.js';

// Lookahead music engine. Each mode is a pattern: a step length plus a step(m, i, t)
// function that schedules notes for step i at AudioContext time t. pump(until) is the
// only scheduling entry point, used by the live timer and by the offline self-check.

export const MUSIC_MODES = ['title', 'explore', 'combat', 'boss', 'finale'];
export const STINGERS = ['districtClear', 'death', 'bossPhase', 'objective'];

const VOICE_CAP = 64; // oscillator budget across all music layers
const COST = { strings: 2, brass: 2, drum: 3, snare: 2, cymbal: 2, bell: 2, organ: 3 };
const INSTRUMENTS = { strings, brass, drum, snare, cymbal, bell, organ };

const triad = (root, minor) => [root, root + (minor ? 3 : 4), root + 7];

// ---- title: slow drone and a haunting four-note motif ----
function title() {
  const sd = 60 / 56 / 2; // eighth notes at 56 bpm
  const chords = [[38, true], [34, false], [31, true], [33, false]]; // Dm Bb Gm A
  const motif = [[62, 2], [69, 2], [68, 2], [65, 6]]; // D A Ab F
  const answer = [[50, 2], [53, 2], [52, 2], [45, 6]];
  return {
    stepDur: sd,
    step(m, i, t) {
      const s = i % 64;
      if (s % 16 === 0) {
        const [root, minor] = chords[s / 16];
        [root, root + 7, root + (minor ? 15 : 16)].forEach((n) => m.strings(t, n, 16 * sd, { gain: 0.045, cutoff: 520, a: 1.4, r: 1.6 }));
        if (s === 0) m.drum(t, { freq: mtof(38), d: 1.6, gain: 0.3, skin: 0.05, skinFreq: 300 });
      }
      let x = 0;
      for (const [n, len] of motif) {
        if (s === 4 + x) {
          m.bell(t, n + 12, { gain: 0.05, d: 2.2, ratio: 3.01, index: 1.4 });
          m.strings(t, n, len * sd, { gain: 0.03, cutoff: 1800, a: 0.12, r: 0.8, voices: 2 });
        }
        x += len;
      }
      x = 0;
      for (const [n, len] of answer) {
        if (s === 36 + x) m.brass(t, n, len * sd, { gain: 0.035, a: 0.25, r: 0.8, bright: 0.2 });
        x += len;
      }
      if (s === 48 || s === 56) m.drum(t, { freq: mtof(38), d: 1.2, gain: 0.18, skin: 0.03, skinFreq: 300 });
      if (s === 16) m.strings(t, 74, 14 * sd, { gain: 0.01, cutoff: 3000, a: 2, r: 2, voices: 1, type: 'triangle' });
    },
  };
}

// ---- explore: brooding 80 bpm pulse ----
function explore() {
  const sd = 60 / 80 / 4;
  const chords = [[38, true], [34, false], [43, true], [45, false]];
  const ost = [0, 0, 12, 0, 7, 0, 12, 7];
  return {
    stepDur: sd,
    step(m, i, t) {
      const s = i % 128;
      const [root, minor] = chords[Math.floor(s / 32)];
      if (s % 2 === 0) {
        const k = (s / 2) % 8;
        m.strings(t, root + ost[k], 0.13, { gain: k === 0 ? 0.075 : 0.055, cutoff: k === 0 ? 1100 : 800, a: 0.01, r: 0.1 });
      }
      if (s % 32 === 0) triad(root + 12, minor).forEach((n) => m.strings(t, n, 32 * sd, { gain: 0.022, cutoff: 1000, a: 0.9, r: 1 }));
      if (s % 16 === 0) m.drum(t, { freq: mtof(38), d: 0.9, gain: 0.3, skin: 0.08, skinFreq: 500 });
      if (s % 16 === 10) m.drum(t, { freq: mtof(38), d: 0.6, gain: 0.14, skin: 0.04, skinFreq: 500 });
      if (s === 96) [57, 61, 64].forEach((n) => m.brass(t, n, 1.6, { gain: 0.028, a: 1.2, r: 0.9, bright: 0.3 }));
      if (s === 64 && Math.floor(i / 128) % 2 === 1) [55, 58, 62].forEach((n) => m.brass(t, n, 1.8, { gain: 0.026, a: 1.3, r: 1, bright: 0.3 }));
    },
  };
}

// Layers shared by combat and boss that grow with combat intensity x.
function battleLayers(m, s, t, root, minor, x, sd) {
  const b = s % 16;
  if (b === 0 || b === 6 || b === 11) m.drum(t, { freq: 55, d: 0.45, gain: 0.34, skin: 0.2, skinFreq: 700 });
  if (b === 0) m.strings(t, root, 16 * sd, { gain: 0.05, cutoff: 350, a: 0.02, r: 0.2 });
  if (s % 32 === 0) triad(root + 24, minor).forEach((n) => m.brass(t, n, 0.18, { gain: 0.03, a: 0.02, r: 0.15 }));
  if (x > 0.25 && (b === 4 || b === 12)) m.snare(t, { gain: 0.04 + 0.07 * x });
  if (x > 0.45) {
    if (b === 8) m.drum(t, { freq: mtof(root + 12), d: 0.5, gain: 0.22, skin: 0.1 });
    if (b === 6 || b === 11) triad(root + 24, minor).forEach((n) => m.brass(t, n, 0.12, { gain: 0.022, a: 0.015, r: 0.12 }));
  }
  if (x > 0.65) {
    const tones = triad(root + 36, minor);
    m.strings(t, tones[s % 3], 0.07, { gain: 0.012 + 0.012 * x, cutoff: 3500, a: 0.005, r: 0.05 });
  }
  if (x > 0.85) {
    if (s % 32 === 0) m.cymbal(t, { gain: 0.06, d: 1.4 });
    if (s >= 60) m.drum(t, { freq: 70 + (s - 60) * 6, d: 0.2, gain: 0.2, skin: 0.15 });
    if (b === 0) m.brass(t, root + 24, 15 * sd, { gain: 0.022, a: 0.3, r: 0.3, bright: 0.6 });
  }
}

// ---- combat: driving 130 bpm staccato strings, taiko, brass ----
function combat() {
  const sd = 60 / 130 / 4;
  const chords = [[38, true], [38, true], [34, false], [36, false]]; // Dm Dm Bb C
  const ost = [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 12, 0, 7, 0, 12, 10];
  const accent = new Set([0, 3, 6, 8, 11, 14]);
  return {
    stepDur: sd,
    step(m, i, t) {
      const s = i % 64;
      const [root, minor] = chords[Math.floor(s / 16)];
      const b = s % 16;
      const acc = accent.has(b);
      m.strings(t, root + 12 + ost[b], 0.07, { gain: acc ? 0.07 : 0.045, cutoff: acc ? 2200 : 1300, a: 0.004, r: 0.06 });
      battleLayers(m, s, t, root, minor, m.intensity, sd);
    },
  };
}

// ---- boss: manic 150 bpm, calliope circus organ over the battle layers ----
function boss() {
  const sd = 60 / 150 / 4;
  const chords = [[36, true], [36, true], [32, false], [31, false]]; // Cm Cm Ab G
  const ost = [0, 1, 0, 12, 0, 1, 0, 7, 0, 1, 0, 12, 11, 12, 7, 6];
  const tune = [67, 66, 67, 75, 74, 73, 74, 72, 70, 69, 70, 67, 68, 67, 66, 67,
    68, 67, 68, 72, 75, 74, 72, 71, 74, 72, 71, 69, 67, 66, 67, 71];
  return {
    stepDur: sd,
    step(m, i, t) {
      const s = i % 64;
      const [root, minor] = chords[Math.floor(s / 16)];
      const b = s % 16;
      m.strings(t, root + 12 + ost[b], 0.06, { gain: b % 4 === 0 ? 0.065 : 0.04, cutoff: b % 4 === 0 ? 2400 : 1400, a: 0.004, r: 0.05 });
      if (b === 0 || b === 8) m.organ(t, root + 12, 0.12, { gain: 0.03 });
      if (b === 4 || b === 12) triad(root + 24, minor).slice(1).forEach((n) => m.organ(t, n, 0.1, { gain: 0.018 }));
      if (s % 2 === 0) m.organ(t, tune[s / 2], sd * 1.6, { gain: 0.03, vib: 12 });
      battleLayers(m, s, t, root, minor, m.intensity, sd);
    },
  };
}

// ---- finale: Happy Birthday to You (public domain), then a gentle waltz variation ----
const HB_INTRO = [[67, 3], [67, 1], [69, 4], [67, 4], [72, 4], [71, 8], [67, 3], [67, 1], [69, 4], [67, 4], [74, 4], [72, 8],
  [67, 3], [67, 1], [79, 4], [76, 4], [72, 4], [71, 4], [69, 8], [77, 3], [77, 1], [76, 4], [72, 4], [74, 4], [72, 12]];
const HB_LOOP = HB_INTRO.map(([n, l], k) => [n, k === 18 ? 4 : k === 24 ? 8 : l]); // no fermata, 96 steps
const INTRO_CHORDS = [[0, 'C'], [16, 'G7'], [40, 'C'], [52, 'C7'], [64, 'F'], [80, 'C'], [88, 'G7'], [92, 'C'], [104, null]];
const LOOP_CHORDS = [[0, 'C'], [16, 'G7'], [40, 'C'], [52, 'C7'], [64, 'F'], [76, 'C'], [84, 'G7'], [88, 'C'], [96, null]];
const CHORD = { C: [0, 4, 7], G7: [-5, -1, 2, 5], C7: [0, 4, 7, 10], F: [0, 5, 9] };
const BASS = { C: 0, G7: -5, C7: 0, F: -7 };
const INTRO_LEN = 108;

function timeline(mel, chords) {
  const notes = new Map();
  let x = 0;
  for (const [n, l] of mel) { notes.set(x, [n, l]); x += l; }
  const ch = new Map();
  for (let k = 0; k < chords.length - 1; k++) ch.set(chords[k][0], [chords[k][1], chords[k + 1][0] - chords[k][0]]);
  return { notes, ch };
}

function finale() {
  const sd = 60 / 96 / 4;
  const T = 5; // transpose C major -> F major
  const intro = timeline(HB_INTRO, INTRO_CHORDS);
  const loop = timeline(HB_LOOP, LOOP_CHORDS);
  let current = 'C';
  return {
    stepDur: sd,
    step(m, i, t) {
      const isIntro = i < INTRO_LEN;
      const s = isIntro ? i : (i - INTRO_LEN) % 96;
      const pass = isIntro ? -1 : Math.floor((i - INTRO_LEN) / 96);
      const tl = isIntro ? intro : loop;
      const chord = tl.ch.get(s);
      if (chord) {
        const [name, len] = chord;
        current = name;
        const dur = len * sd;
        CHORD[name].forEach((o) => m.strings(t, 53 + T - 5 + o, dur, { gain: isIntro ? 0.02 : 0.016, cutoff: 1400, a: 0.25, r: 0.5 }));
        if (isIntro) m.brass(t, 41 + T - 5 + BASS[name], dur, { gain: 0.03, a: 0.2, r: 0.4, bright: 0.25 });
      }
      const note = tl.notes.get(s);
      if (note) {
        const [n, len] = note;
        const dur = len * sd;
        if (isIntro) {
          m.bell(t, n + T + 12, { gain: 0.09, d: Math.max(0.9, dur * 1.6), ratio: 3.5, index: 1.6 });
          m.strings(t, n + T, dur * 0.95, { gain: 0.03, cutoff: 2600, a: 0.03, r: 0.25 });
        } else if (pass % 2 === 0) {
          m.strings(t, n + T, dur * 0.95, { gain: 0.03, cutoff: 2400, a: 0.06, r: 0.3 });
        } else {
          m.brass(t, n + T, dur * 0.9, { gain: 0.022, a: 0.05, r: 0.3, bright: 0.4 });
        }
      }
      if (isIntro) {
        if (s === 0) m.cymbal(t, { gain: 0.05, a: 0.6, d: 1.6 });
        if (s === 92) {
          m.drum(t, { freq: mtof(41), d: 1.4, gain: 0.3, skin: 0.05 });
          m.cymbal(t, { gain: 0.05, d: 2.2 });
          [65, 69, 72].forEach((n) => m.brass(t, n, 1.6, { gain: 0.03, a: 0.08, r: 0.6, bright: 0.6 }));
        }
        return;
      }
      // waltz: bass on beat one, soft chord on two and three, bell arpeggio in eighths
      const beat = (s + 8) % 12; // bars begin 4 steps after the loop starts (pickup)
      const tones = CHORD[current].slice(0, 3).map((o) => 60 + T + o);
      if (beat === 0) m.strings(t, 41 + T - 5 + BASS[current], 0.4, { gain: 0.06, cutoff: 600, a: 0.01, r: 0.3 });
      if (beat === 4 || beat === 8) tones.forEach((n) => m.strings(t, n - 12, 0.22, { gain: 0.012, cutoff: 1500, a: 0.02, r: 0.2 }));
      if (beat % 2 === 0) {
        const k = beat / 2;
        m.bell(t, tones[k % 3] + 12 * Math.floor(k / 3), { gain: 0.026, d: 0.8, ratio: 3.5, index: 1.1 });
      }
      if (Math.random() < 0.05) m.bell(t, 84 + T + [0, 4, 7][Math.floor(Math.random() * 3)], { gain: 0.012, d: 0.6, ratio: 2, index: 1 });
    },
  };
}

const PATTERNS = { title, explore, combat, boss, finale };

// Short musical hits, scheduled straight into the output with the layers ducked.
const STING = {
  districtClear(m, t) {
    for (let k = 0; k < 7; k++) m.drum(t + k * 0.07, { freq: mtof(38), d: 0.3, gain: 0.08 + k * 0.03, skin: 0.05 });
    [46, 50, 53].forEach((n) => m.brass(t, n, 0.28, { gain: 0.04, a: 0.03, r: 0.1 }));
    const h = t + 0.5;
    [50, 54, 57, 62].forEach((n) => m.brass(h, n, 1.2, { gain: 0.045, a: 0.04, r: 0.7, bright: 1 }));
    [66, 69, 74].forEach((n) => m.strings(h, n, 1.2, { gain: 0.025, cutoff: 3000, a: 0.08, r: 0.7 }));
    m.drum(h, { freq: mtof(38), d: 1.2, gain: 0.35 });
    m.cymbal(h, { gain: 0.07, d: 2 });
    m.bell(h, 86, { gain: 0.05, d: 1.6 });
    return 2.4;
  },
  death(m, t) {
    [50, 53, 57].forEach((n) => m.brass(t, n, 0.55, { gain: 0.045, a: 0.03, r: 0.3, bright: 0.6 }));
    m.drum(t, { freq: mtof(38), d: 1, gain: 0.35 });
    const h = t + 0.6;
    [44, 49, 52].forEach((n) => m.brass(h, n, 1.4, { gain: 0.04, a: 0.1, r: 1, bright: 0.3 }));
    m.strings(h, 26, 1.6, { gain: 0.06, cutoff: 300, a: 0.05, r: 1 });
    m.drum(h, { freq: mtof(33), d: 1.6, gain: 0.35 });
    return 3;
  },
  bossPhase(m, t) {
    [0, 0.15, 0.3].forEach((d, k) => m.drum(t + d, { freq: 55 + k * 10, d: 0.5, gain: 0.3, skin: 0.2 }));
    [48, 49, 55, 60].forEach((n) => m.brass(t + 0.3, n, 0.8, { gain: 0.035, a: 0.5, r: 0.3, bright: 1 }));
    for (let k = 0; k < 10; k++) m.organ(t + 0.3 + k * 0.045, 72 + k, 0.05, { gain: 0.03 });
    m.cymbal(t + 1.1, { gain: 0.07, d: 1.2 });
    m.drum(t + 1.1, { freq: 50, d: 0.8, gain: 0.35 });
    return 2.2;
  },
  objective(m, t) {
    m.brass(t, 57, 0.13, { gain: 0.045, a: 0.02, r: 0.08 });
    m.brass(t + 0.15, 62, 0.6, { gain: 0.05, a: 0.03, r: 0.4 });
    m.brass(t + 0.15, 57, 0.6, { gain: 0.03, a: 0.03, r: 0.4 });
    m.bell(t + 0.15, 86, { gain: 0.05, d: 1 });
    m.drum(t + 0.15, { freq: mtof(38), d: 0.6, gain: 0.2 });
    return 1.3;
  },
};

export function createMusic(ctx, out) {
  const duck = ctx.createGain();
  duck.connect(out);
  const layers = [];
  let mode = 'none';
  let intensity = 0;
  let ends = [];

  // Instrument wrappers that respect the voice budget and route into a layer.
  function voices(dest) {
    const api = {};
    for (const [name, fn] of Object.entries(INSTRUMENTS)) {
      api[name] = (t, ...args) => {
        ends = ends.filter((e) => e.end > t);
        const used = ends.reduce((a, e) => a + e.cost, 0);
        if (used + COST[name] > VOICE_CAP) return;
        const end = fn(ctx, dest, t, ...args);
        ends.push({ end, cost: COST[name] });
      };
    }
    Object.defineProperty(api, 'intensity', { get: () => intensity });
    return api;
  }

  function setMode(next, fade = 1.5) {
    if (next === mode) return false;
    mode = next;
    const now = ctx.currentTime;
    for (const l of layers) {
      if (l.stopAt) continue;
      l.gain.gain.cancelScheduledValues(now);
      l.gain.gain.setValueAtTime(l.gain.gain.value, now);
      l.gain.gain.linearRampToValueAtTime(0, now + fade);
      l.stopAt = now + fade;
    }
    const make = PATTERNS[next];
    if (make) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + Math.max(0.01, fade));
      gain.connect(duck);
      layers.push({ mode: next, pat: make(), gain, m: voices(gain), next: now + 0.05, i: 0, stopAt: 0 });
    }
    return true;
  }

  function pump(until) {
    const now = ctx.currentTime;
    for (let k = layers.length - 1; k >= 0; k--) {
      const l = layers[k];
      if (l.stopAt && now > l.stopAt + 3) { l.gain.disconnect(); layers.splice(k, 1); continue; }
      if (l.next < now - 0.05) l.next = now + 0.02; // fell behind (tab was asleep): skip, don't burst
      while (l.next < until && !(l.stopAt && l.next >= l.stopAt)) {
        l.pat.step(l.m, l.i, l.next);
        l.next += l.pat.stepDur;
        l.i++;
      }
    }
  }

  const stingVoices = voices(out);
  function stinger(name, t = ctx.currentTime + 0.03) {
    const fn = STING[name];
    if (!fn) return false;
    const len = fn(stingVoices, t);
    const g = duck.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.45, t + 0.08);
    g.setValueAtTime(0.45, t + len * 0.7);
    g.linearRampToValueAtTime(1, t + len);
    return true;
  }

  return {
    get mode() { return mode; },
    setMode,
    pump,
    stinger,
    setIntensity(x) { intensity = Math.min(1, Math.max(0, Number(x) || 0)); },
    dispose() { layers.forEach((l) => l.gain.disconnect()); layers.length = 0; duck.disconnect(); },
  };
}
