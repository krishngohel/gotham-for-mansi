const KEY = 'gotham-mansi-progress-v1';
export const BALLOON_COUNT = 12;
export const DISTRICT_IDS = ['gcpd', 'docks', 'neon', 'ace', 'clock'];
export const MEDALS = ['bronze', 'silver', 'gold'];
export const MILESTONE_STEPS = [0, 25, 50, 75, 100];
export const STAT_KEYS = ['playTime', 'kos', 'longestCombo', 'topGlideSpeed', 'distanceGlided', 'photos'];
const WHOLE_STATS = new Set(['kos', 'longestCombo', 'photos']);
const ID = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;

export const DEFAULT_PROGRESS = {
  step: 0,
  balloons: [],
  suit: null,
  goldUnlocked: false,
  seenIntro: false,
  finished: false,
  challenges: {},
  stats: { playTime: 0, kos: 0, longestCombo: 0, topGlideSpeed: 0, distanceGlided: 0, photos: 0 },
  crimes: { stopped: 0 },
  moves: [],
  districts: [],
  milestone: 0,
  unlocks: [],
};

// Later parts (the post-game in Part H) add saved fields here instead of editing
// sanitizeProgress. `fresh` (optional) is the value a new game resets the field to; leave it out
// to keep the field across a new game. Returns an undo, mainly for tests.
const extraFields = new Map();
const freshValues = new Map();
export function registerProgressField(key, { sanitize, ...opts }) {
  if (key in DEFAULT_PROGRESS || extraFields.has(key)) throw new Error(`progress field "${key}" already exists`);
  extraFields.set(key, sanitize);
  if ('fresh' in opts) freshValues.set(key, opts.fresh);
  return () => { extraFields.delete(key); freshValues.delete(key); };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const amount = (v, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, v) : 0);
function idList(v, allowed = null, max = 32) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((s) => typeof s === 'string' && ID.test(s) && (!allowed || allowed.includes(s))))].slice(0, max);
}
function sanitizeChallenges(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [id, r] of Object.entries(raw).slice(0, 32)) {
    if (!ID.test(id) || !isObj(r)) continue;
    if (typeof r.best !== 'number' || !Number.isFinite(r.best) || r.best < 0) continue;
    out[id] = { best: r.best, medal: MEDALS.includes(r.medal) ? r.medal : null };
  }
  return out;
}
function sanitizeStats(raw) {
  const r = isObj(raw) ? raw : {};
  const out = {};
  for (const k of STAT_KEYS) out[k] = WHOLE_STATS.has(k) ? Math.floor(amount(r[k])) : amount(r[k]);
  return out;
}

export function sanitizeProgress(raw = {}) {
  const r = isObj(raw) ? raw : {};
  const balloons = Array.isArray(r.balloons)
    ? [...new Set(r.balloons.filter((b) => Number.isInteger(b) && b >= 0 && b < BALLOON_COUNT))]
    : [];
  const out = {
    step: Number.isInteger(r.step) && r.step >= 0 ? r.step : 0,
    balloons,
    suit: ['m', 'f', 'gold'].includes(r.suit) ? r.suit : null,
    goldUnlocked: r.goldUnlocked === true,
    seenIntro: r.seenIntro === true,
    finished: r.finished === true,
    challenges: sanitizeChallenges(r.challenges),
    stats: sanitizeStats(r.stats),
    crimes: { stopped: Math.floor(amount(isObj(r.crimes) ? r.crimes.stopped : 0, 1e6)) },
    moves: idList(r.moves),
    districts: idList(r.districts, DISTRICT_IDS),
    milestone: MILESTONE_STEPS.includes(r.milestone) ? r.milestone : 0,
    unlocks: idList(r.unlocks),
  };
  for (const [key, sanitize] of extraFields) out[key] = sanitize(r[key]);
  return out;
}

// A new game restarts the story. Balloons, medals, stats and everything else found stay.
export function newGameProgress(old) {
  const out = { ...sanitizeProgress(old), step: 0, suit: null, seenIntro: false, finished: false };
  for (const [key, fresh] of freshValues) out[key] = sanitizeProgress({ [key]: fresh })[key];
  return out;
}

export function loadProgress(storage) {
  try {
    const raw = storage?.getItem(KEY);
    return sanitizeProgress(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeProgress({});
  }
}

export function saveProgress(storage, progress) {
  try { storage?.setItem(KEY, JSON.stringify(progress)); } catch { /* storage unavailable */ }
}

export function clearProgress(storage) {
  try { storage?.setItem(KEY, JSON.stringify(DEFAULT_PROGRESS)); } catch { /* storage unavailable */ }
}
