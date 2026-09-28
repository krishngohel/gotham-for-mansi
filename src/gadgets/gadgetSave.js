// The saved gadget state (progress.gadgets): what's equipped, every gadget ever unlocked (a new
// game keeps them), broken breakables and found caches. Registers itself at load, so game.js
// must import this module before loadProgress runs. Pure.
import { registerProgressField } from '../core/save.js';
import { tracker } from '../game/progressTracker.js';
import { GADGET_IDS } from './gadgetDefs.js';
import { BREAKABLE_IDS, CACHE_IDS } from '../world/breakableSpots.js';

const ids = (v, allowed) => (Array.isArray(v) ? [...new Set(v.filter((s) => allowed.includes(s)))] : []);

export function sanitizeGadgetSave(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    equipped: GADGET_IDS.includes(r.equipped) ? r.equipped : 'batarang',
    unlocked: ids(r.unlocked, GADGET_IDS),
    broken: ids(r.broken, BREAKABLE_IDS),
    caches: ids(r.caches, CACHE_IDS),
  };
}

registerProgressField('gadgets', { sanitize: sanitizeGadgetSave });

tracker.register({
  id: 'caches', label: 'WayneTech caches', weight: 3,
  count: (p) => ({ done: p.gadgets.caches.length, total: CACHE_IDS.length }),
  detail: (p) => `${p.gadgets.caches.length} of ${CACHE_IDS.length} found behind cracked walls and vents`,
});
