// Equip, unlocks, charges and cooldowns for the gadgets. Pure.
// `tune` is the live WayneTech effects object: `${id}Cooldown` (smokeCooldown) overrides a cooldown.
import { GADGETS, GADGET_IDS, gadgetById } from './gadgetDefs.js';

export function createGadgetState({ equipped = 'batarang', unlocked = ['batarang'], tune = {} } = {}) {
  const slots = new Map();
  for (const g of GADGETS) slots.set(g.id, { charges: g.max ?? 0, cool: 0, refill: 0 });
  const open = new Set(['batarang', ...unlocked.filter((id) => GADGET_IDS.includes(id))]);
  let eq = open.has(equipped) ? equipped : 'batarang';
  const cooldownOf = (g) => tune[`${g.id}Cooldown`] ?? g.cooldown;

  function ready(id) {
    const g = gadgetById(id), s = slots.get(id);
    if (!g || !open.has(id)) return false;
    if (g.kind === 'free') return true;
    if (g.kind === 'cooldown') return s.cool <= 0;
    return s.charges > 0;
  }

  return {
    get equipped() { return eq; },
    get unlocked() { return open; },
    isUnlocked: (id) => open.has(id),
    equip(id) {
      if (!open.has(id)) return false;
      eq = id;
      return true;
    },
    // Returns the ids that were newly unlocked.
    unlock(ids) {
      const fresh = [];
      for (const id of ids) if (GADGET_IDS.includes(id) && !open.has(id)) { open.add(id); fresh.push(id); }
      return fresh;
    },
    ready,
    use(id) {
      if (!ready(id)) return false;
      const g = gadgetById(id), s = slots.get(id);
      if (g.kind === 'cooldown') s.cool = cooldownOf(g);
      else if (g.kind === 'charges') {
        s.charges -= 1;
        if (s.refill <= 0) s.refill = g.recharge;
      }
      return true;
    },
    tick(dt) {
      for (const g of GADGETS) {
        const s = slots.get(g.id);
        if (s.cool > 0) s.cool = Math.max(0, s.cool - dt);
        if (g.kind === 'charges' && s.charges < g.max) {
          s.refill -= dt;
          while (s.refill <= 0 && s.charges < g.max) {
            s.charges += 1;
            s.refill = s.charges < g.max ? s.refill + g.recharge : 0;
          }
        }
      }
    },
    status(id, out = {}) {
      const g = gadgetById(id), s = slots.get(id);
      out.id = id;
      out.name = g.name;
      out.kind = g.kind;
      out.ready = ready(id);
      out.charges = s.charges;
      out.max = g.max ?? 0;
      out.cool = g.kind === 'charges' ? (s.charges < g.max ? s.refill : 0) : s.cool;
      out.total = g.kind === 'charges' ? g.recharge : g.kind === 'cooldown' ? cooldownOf(g) : 0;
      out.frac = out.total ? out.cool / out.total : 0;
      out.text = g.kind === 'charges' ? `${s.charges} of ${g.max} charges`
        : out.ready ? 'Ready' : `Ready in ${Math.ceil(s.cool)} s`;
      return out;
    },
    // A number that changes only when the HUD would show something different (quarter seconds).
    hudCode(id) {
      const s = slots.get(id);
      const g = gadgetById(id);
      const t = g.kind === 'charges' ? (s.charges < g.max ? s.refill : 0) : s.cool;
      return GADGET_IDS.indexOf(id) * 1e6 + s.charges * 1e4 + Math.ceil(t * 4);
    },
  };
}
