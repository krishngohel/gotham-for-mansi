const KEY = 'gotham-mansi-progress-v1';
export const BALLOON_COUNT = 12;

export const DEFAULT_PROGRESS = {
  step: 0,
  balloons: [],
  suit: null,
  goldUnlocked: false,
  seenIntro: false,
  finished: false,
};

export function sanitizeProgress(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const balloons = Array.isArray(r.balloons)
    ? [...new Set(r.balloons.filter((b) => Number.isInteger(b) && b >= 0 && b < BALLOON_COUNT))]
    : [];
  return {
    step: Number.isInteger(r.step) && r.step >= 0 ? r.step : 0,
    balloons,
    suit: ['m', 'f', 'gold'].includes(r.suit) ? r.suit : null,
    goldUnlocked: r.goldUnlocked === true,
    seenIntro: r.seenIntro === true,
    finished: r.finished === true,
  };
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
