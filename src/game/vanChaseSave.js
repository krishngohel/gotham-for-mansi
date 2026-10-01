// The saved count of free-roam Joker van chases stopped (progress.vanChases), the same small,
// lifetime-counter shape as progress.crimes (src/core/save.js) and following the same
// registerProgressField extension point src/gadgets/gadgetSave.js and src/progress/wayneSave.js
// use. Registers itself at import, so game.js imports this before loadProgress runs.
import { registerProgressField } from '../core/save.js';
import { tracker } from './progressTracker.js';

const amount = (v, max = 1e6) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(Math.min(v, max)) : 0);

export function sanitizeVanChaseSave(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { stopped: amount(r.stopped) };
}

registerProgressField('vanChases', { sanitize: sanitizeVanChaseSave });

// Small side content, same weight class as the WayneTech caches (gadgetSave.js): enough to reward
// playing with it, not enough to rebalance the main spec categories in progressTracker.js.
export const VAN_CHASE_TARGET = 5;

tracker.register({
  id: 'vanChases', label: 'Van chases', weight: 3,
  count: (p) => ({ done: Math.min(p.vanChases.stopped, VAN_CHASE_TARGET), total: VAN_CHASE_TARGET }),
  detail: (p) => `Stopped ${p.vanChases.stopped} Joker van${p.vanChases.stopped === 1 ? '' : 's'} on the street`,
});
