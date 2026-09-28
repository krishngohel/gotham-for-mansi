// WayneTech at run time: XP from play (fights, takedowns, chains, balloons, medals, crimes,
// caches, and Part H's crates and side missions), a level and an upgrade point every 1,000 XP,
// buying upgrades, and applying their effects through the one effects object that combat, the
// hero and the gadgets read. Also health recovery out of combat (Field Medic speeds it up).
import { XP, comboXp, chainXp, medalXp, levelOf, pointsFree, toNext, levelsCrossed, createComboRun } from './xp.js';
import { TREES, UPGRADE_IDS, upgradeEffects, canBuy, upgradeStatus, regenStep } from './upgrades.js';

// Events that pay a flat XP amount (the XP table key is the event name).
const FLAT = ['ko', 'takedown', 'special', 'fightDone', 'objectiveDone', 'balloon', 'crimeStopped', 'glassBroken', 'wallBroken', 'crateOpened', 'missionDone'];

export function createWayneTech({ events, progress, save, hero, combat, hud, effects, baseHealth, dev = false }) {
  // A dev run (?gadgets=all) still earns XP, levels and purchases for the session so testing
  // works, but never touches the real save: it works on its own copy, never the passed-in
  // progress.wayne, so nothing else that later calls save() (crimes, balloons, side content's
  // periodic save) can carry the dev session's XP into the real file.
  const w = dev ? { xp: progress.wayne.xp, owned: [...progress.wayne.owned], medals: { ...progress.wayne.medals } } : progress.wayne;
  const persist = dev ? () => {} : save;
  const run = createComboRun();
  const regenState = { calm: false, sinceHurt: 0 };
  let lastCombo = 0, sinceHurt = 99, dirty = false, saveT = 0, shownHealth = -1;

  function award(amount, source) {
    const a = Math.round(amount);
    if (!(a > 0)) return;
    const before = w.xp;
    w.xp += a;
    dirty = true;
    events.emit('xp', { amount: a, source, xp: w.xp });
    const levels = levelsCrossed(before, w.xp);
    levels.forEach((level, i) => events.emit('levelUp', { level, points: pointsFree(w.xp, w.owned.length) - (levels.length - 1 - i) }));
    if (levels.length) { dirty = false; persist(); }
  }

  for (const ev of FLAT) events.on(ev, () => award(XP[ev], ev));
  events.on('counter', ({ count = 1 } = {}) => award(XP.counter * count, 'counter'));
  events.on('chainDone', ({ count, stealth }) => award(chainXp(count, stealth), 'chain'));
  events.on('swarmDone', ({ count }) => award(XP.swarmPerGoon * count, 'swarm'));
  events.on('cacheFound', ({ xp }) => award(xp, 'cache'));
  events.on('challengeDone', ({ id, medal }) => {
    const gain = medalXp(w.medals[id] ?? null, medal);
    if (!gain) return;
    w.medals[id] = medal;
    award(gain, 'medal');
  });
  events.on('impact', ({ move, outcome }) => { if (outcome !== 'parried' && outcome !== 'immune') run.note(move, 0); });
  events.on('heroHurt', () => { sinceHurt = 0; });

  function apply() {
    upgradeEffects(w.owned, effects);
    combat.applyEffects();
    const max = baseHealth() + effects.maxHealthBonus;
    if (hero.maxHealth !== max) {
      hero.health = Math.min(max, hero.health + Math.max(0, max - hero.maxHealth));
      hero.maxHealth = max;
      hud.setHealth(hero.health / max);
    }
  }

  return {
    effects,
    get xp() { return w.xp; },
    get level() { return levelOf(w.xp); },
    get free() { return pointsFree(w.xp, w.owned.length); },
    award,
    apply,
    buy(id) {
      const r = canBuy(w.owned, id, pointsFree(w.xp, w.owned.length));
      if (!r.ok) return r;
      w.owned.push(id);
      apply();
      persist();
      events.emit('upgradeBought', { id });
      return r;
    },
    page() {
      const free = pointsFree(w.xp, w.owned.length);
      const n = toNext(w.xp);
      return {
        level: levelOf(w.xp), xp: w.xp, into: n.into, need: n.need, fraction: n.fraction, free,
        allOwned: w.owned.length === UPGRADE_IDS.length,
        trees: TREES.map((t) => ({
          id: t.id, name: t.name,
          upgrades: t.upgrades.map((u, i) => ({ id: u.id, name: u.name, text: u.text, tier: i + 1, state: upgradeStatus(w.owned, u.id, free) })),
        })),
      };
    },
    update(dt) {
      // A combo run closes when the counter drops back to 0.
      const v = combat.combo.value;
      if (v > 0) run.note(null, v);
      if (lastCombo > 0 && v === 0) { const r = run.close(); award(comboXp(r.peak, r.variety), 'combo'); }
      lastCombo = v;
      sinceHurt += dt;
      if (!hero.dead) {
        regenState.calm = !combat.active;
        regenState.sinceHurt = sinceHurt;
        const h = regenStep(hero.health, hero.maxHealth, regenState, effects, dt);
        if (h !== hero.health) {
          hero.health = h;
          if (Math.abs(h - shownHealth) >= 1 || h >= hero.maxHealth) { shownHealth = h; hud.setHealth(h / hero.maxHealth); }
        }
      }
      saveT -= dt;
      if (dirty && saveT <= 0) { saveT = 2; dirty = false; persist(); }
    },
  };
}
