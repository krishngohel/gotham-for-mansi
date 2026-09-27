import { ACTIONS, DEFAULT_BINDINGS } from './bindings.js';

const KEY = 'gotham-mansi-settings-v1';

export const DEFAULT_SETTINGS = {
  bindings: DEFAULT_BINDINGS,
  sensitivity: 1,
  invertY: false,
  fov: 60,
  cameraShake: true,
  quality: 'high',
  renderScale: 1,
  halftone: 1,
  showFps: false,
  volume: { master: 0.8, music: 0.6, sfx: 0.9 },
  difficulty: 'normal',
  hints: true,
};

const num = (v, min, max, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

function sanitizeBindings(raw) {
  const out = {};
  for (const { id } of ACTIONS) {
    const codes = raw?.[id];
    out[id] = Array.isArray(codes) && codes.length && codes.every((c) => typeof c === 'string') ? [...codes] : [...DEFAULT_BINDINGS[id]];
  }
  return out;
}

export function sanitizeSettings(raw = {}) {
  const d = DEFAULT_SETTINGS;
  const r = raw && typeof raw === 'object' ? raw : {};
  const v = r.volume && typeof r.volume === 'object' ? r.volume : {};
  return {
    bindings: sanitizeBindings(r.bindings),
    sensitivity: num(r.sensitivity, 0.2, 3, d.sensitivity),
    invertY: bool(r.invertY, d.invertY),
    fov: num(r.fov, 50, 90, d.fov),
    cameraShake: bool(r.cameraShake, d.cameraShake),
    quality: oneOf(r.quality, ['high', 'low'], d.quality),
    renderScale: num(r.renderScale, 0.5, 1, d.renderScale),
    halftone: num(r.halftone, 0, 1.5, d.halftone),
    showFps: bool(r.showFps, d.showFps),
    volume: {
      master: num(v.master, 0, 1, d.volume.master),
      music: num(v.music, 0, 1, d.volume.music),
      sfx: num(v.sfx, 0, 1, d.volume.sfx),
    },
    difficulty: oneOf(r.difficulty, ['story', 'normal', 'hard'], d.difficulty),
    hints: bool(r.hints, d.hints),
  };
}

export function loadSettings(storage) {
  try {
    const raw = storage?.getItem(KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeSettings({});
  }
}

export function saveSettings(storage, settings) {
  try { storage?.setItem(KEY, JSON.stringify(settings)); } catch { /* private window or blocked storage */ }
}
