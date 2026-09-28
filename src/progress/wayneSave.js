// The saved WayneTech state (progress.wayne): XP, owned upgrades, and the best medal already paid
// for per challenge. Registers itself at load (import before loadProgress). Pure.
import { registerProgressField, MEDALS } from '../core/save.js';
import { tracker } from '../game/progressTracker.js';
import { UPGRADES, UPGRADE_IDS } from './upgrades.js';
import { pointsEarned, levelOf } from './xp.js';

const ID = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;

export function sanitizeWayneSave(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const xp = typeof r.xp === 'number' && Number.isFinite(r.xp) && r.xp > 0 ? Math.floor(Math.min(r.xp, 1e7)) : 0;
  const want = Array.isArray(r.owned) ? r.owned : [];
  // In tree order, so a prerequisite is always seen before what needs it.
  const owned = [];
  for (const u of UPGRADES) {
    if (!want.includes(u.id) || (u.requires && !owned.includes(u.requires))) continue;
    owned.push(u.id);
  }
  // Never more than the XP paid for: drop from the end of the purchase order.
  const keep = want.filter((id, i) => UPGRADE_IDS.includes(id) && want.indexOf(id) === i && owned.includes(id));
  while (keep.length > pointsEarned(xp)) keep.pop();
  const final = UPGRADES.filter((u) => keep.includes(u.id) && (!u.requires || keep.includes(u.requires))).map((u) => u.id);
  const medals = {};
  if (r.medals && typeof r.medals === 'object' && !Array.isArray(r.medals)) {
    for (const [id, m] of Object.entries(r.medals).slice(0, 32)) if (ID.test(id) && MEDALS.includes(m)) medals[id] = m;
  }
  return { xp, owned: final, medals };
}

registerProgressField('wayne', { sanitize: sanitizeWayneSave });

tracker.register({
  id: 'wayneTech', label: 'WayneTech upgrades', weight: 5,
  count: (p) => ({ done: p.wayne.owned.length, total: UPGRADE_IDS.length }),
  detail: (p) => `Level ${levelOf(p.wayne.xp)}, ${p.wayne.owned.length} of ${UPGRADE_IDS.length} upgrades`,
});
