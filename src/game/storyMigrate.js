// Saves store the story position as an index into STEPS. Part D inserted two stealth steps, so an
// index saved before that points at the wrong step now. Saves now also store the step's id
// (flow.js writes it on every step); a save without one is read against the old list below.
import { STEPS } from './story.js';
import { registerProgressField } from '../core/save.js';

// The story before Part D, in order. Never edit this list: it describes saves already out there.
export const LEGACY_STEP_IDS = Object.freeze([
  'intro', 'signal', 'card', 'toDocks', 'f1', 'toYard', 'f2', 'toShip', 'f3', 'presents', 'rewardPresents',
  'toNeon', 'n1', 'toStreet', 'n2', 'toMonarch', 'n3', 'party', 'rewardParty',
  'toAce', 'a1', 'toFactory', 'a2', 'toVat', 'a3', 'cake', 'rewardCake', 'toTower', 'boss', 'finale', 'credits',
]);

const ID = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;
registerProgressField('stepId', { sanitize: (v) => (typeof v === 'string' && ID.test(v) ? v : null) });

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
  return { ...progress, step, stepId: steps[step]?.id ?? null };
}
