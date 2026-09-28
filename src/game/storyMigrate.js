// Saves store the story position as an index into STEPS. Part D inserted two stealth steps, so an
// index saved before that points at the wrong step now. Saves now also store the step's id
// (flow.js writes it on every step); a save without one is read against the old list below.
import { STEPS } from './story.js';
import { registerProgressField } from '../core/save.js';

// NEVER remove or rename a step id in story.js (see the note on STEPS). A stepId that no longer
// exists falls back to reading the saved index against LEGACY_STEP_IDS below, which is only right
// for saves written before Part D. If a step must go, keep its id alive on a stand-in step, or add a
// save version here and migrate on it.

// The story before Part D, in order. Never edit this list: it describes saves already out there.
export const LEGACY_STEP_IDS = Object.freeze([
  'intro', 'signal', 'card', 'toDocks', 'f1', 'toYard', 'f2', 'toShip', 'f3', 'presents', 'rewardPresents',
  'toNeon', 'n1', 'toStreet', 'n2', 'toMonarch', 'n3', 'party', 'rewardParty',
  'toAce', 'a1', 'toFactory', 'a2', 'toVat', 'a3', 'cake', 'rewardCake', 'toTower', 'boss', 'finale', 'credits',
]);

const ID = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;
// A new game starts at the intro, never at the old save's step.
registerProgressField('stepId', { sanitize: (v) => (typeof v === 'string' && ID.test(v) ? v : null), fresh: null });
// The one-time "goons have learned new tricks" caption for a save from before Part D that already
// went past Monarch Balcony but not yet the catwalks: 'due' until game.js shows it, then 'shown'.
registerProgressField('predatorNotice', { sanitize: (v) => (v === 'due' || v === 'shown' ? v : null), fresh: null });

export function resolveStep(progress, steps = STEPS, legacy = LEGACY_STEP_IDS) {
  const byId = (id) => steps.findIndex((s) => s.id === id);
  if (progress.stepId) {
    const i = byId(progress.stepId);
    if (i >= 0) return i;
  }
  const old = Number.isInteger(progress.step) && progress.step > 0 ? progress.step : 0;
  if (old >= legacy.length) return steps.length;
  const i = byId(legacy[old]);
  return i >= 0 ? i : Math.min(old, steps.length);
}

// Places a loaded save on the current story and stamps the id right away, so the save is never
// written back with a new index and no id (which the next load would read against the old list).
export function migrateProgress(progress, steps = STEPS) {
  const step = resolveStep(progress, steps);
  const out = { ...progress, step, stepId: steps[step]?.id ?? null };
  if (!progress.stepId && !progress.predatorNotice && betweenRooms(step, steps)) out.predatorNotice = 'due';
  return out;
}

// Past the first predator room (Monarch Balcony) and before the second (Ace Chemicals Catwalks).
export function betweenRooms(index, steps = STEPS) {
  const first = steps.findIndex((s) => s.id === 'monarchBalcony');
  const last = steps.findIndex((s) => s.id === 'aceCatwalks');
  return first >= 0 && last >= 0 && index > first && index < last;
}
