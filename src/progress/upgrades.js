// WayneTech: four trees of five upgrades, one point each, each needing the one above it. Every
// effect is a number in one shared effects object that combat, the hero and the gadgets read. Pure.
import { damageToHero } from '../combat/rules.js';
export const TREES = [
  { id: 'armor', name: 'Armor', upgrades: [
    { id: 'plating1', name: 'Reinforced Plating', text: 'Max health +25.' },
    { id: 'kevlar', name: 'Kevlar Weave', text: "Knife slashes and the Joker's thrown gags hurt 30% less." },
    { id: 'plating2', name: 'Titanium Plating', text: 'Max health +25 more.' },
    { id: 'medic', name: 'Field Medic', text: 'Out of a fight, health comes back after 2.5 s instead of 6 s, three times as fast.' },
    { id: 'dampers', name: 'Impact Dampers', text: 'Every hit hurts 15% less.' },
  ] },
  { id: 'combat', name: 'Combat', upgrades: [
    { id: 'reflexes', name: 'Quick Reflexes', text: 'Blue bolts stay up 0.15 s longer: more time to counter.' },
    { id: 'flow', name: 'Steady Flow', text: 'The first hit you take in a combo does not break it.' },
    { id: 'efficient', name: 'Efficient Chains', text: 'Chain takedowns cost 2 less combo.' },
    { id: 'fastFinish', name: 'Fast Finish', text: 'Special takedowns unlock at combo 6 instead of 8.' },
    { id: 'swarm', name: 'Bat Swarm', text: 'A fourth chain takedown for a big combo: a swarm of bats takes down up to six goons.' },
  ] },
  { id: 'gadgets', name: 'Gadgets', upgrades: [
    { id: 'triple', name: 'Triple Batarang', text: 'The batarang throws up to three at once, one per goon.' },
    { id: 'bigBang', name: 'Bigger Bang', text: 'Explosive gel blast grows from 4 m to 5.5 m.' },
    { id: 'quickSmoke', name: 'Quick Smoke', text: 'Smoke pellet cooldown drops from 12 s to 7 s.' },
    { id: 'doubleClaw', name: 'Double Claw', text: 'The batclaw pulls two goons at once.' },
    { id: 'deepFreeze', name: 'Deep Freeze', text: 'Freeze blast ice lasts 8 s instead of 5 s.' },
  ] },
  { id: 'traversal', name: 'Traversal', upgrades: [
    { id: 'accelerator', name: 'Grapple Accelerator', text: 'Grapple boost launches you about 25% higher and farther.' },
    { id: 'aero', name: 'Aerodynamic Cape', text: 'Glide dives build speed 30% faster, top speed 56 m/s instead of 48.' },
    { id: 'grip', name: 'Wall Grip Boots', text: 'Wall runs last 1.8 s instead of 1.2 s.' },
    { id: 'rails', name: 'Slide Rails', text: 'Slide down ladders at 14 m/s instead of 9.' },
    { id: 'seismic', name: 'Seismic Landing', text: 'Dive bomb shockwave reaches 6 m instead of 4 m.' },
  ] },
];

export const UPGRADES = TREES.flatMap((t) => t.upgrades.map((u, tier) => ({
  ...u, tree: t.id, tier, cost: 1, requires: tier ? t.upgrades[tier - 1].id : null,
})));
export const UPGRADE_IDS = UPGRADES.map((u) => u.id);
const byId = new Map(UPGRADES.map((u) => [u.id, u]));

export const BASE_EFFECTS = Object.freeze({
  // Armor
  maxHealthBonus: 0, knifeMult: 1, rangedMult: 1, damageMult: 1, regenDelay: 6, regenRate: 4,
  // Combat
  counterWindow: 0, comboShield: 0, chainDiscount: 0, specialAt: 8, batSwarm: false,
  // Gadgets
  batarangCount: 1, gelRadius: 4, smokeCooldown: 12, clawTargets: 1, freezeTime: 5,
  // Traversal (hero.tuning reads these names)
  boostUp: 15, boostOut: 9, diveGain: 1, glideMax: 48, wallRunTime: 1.2, ladderSlide: 9, diveRadius: 4,
});

const APPLY = {
  plating1: (e) => { e.maxHealthBonus += 25; },
  kevlar: (e) => { e.knifeMult = 0.7; e.rangedMult = 0.7; },
  plating2: (e) => { e.maxHealthBonus += 25; },
  medic: (e) => { e.regenDelay = 2.5; e.regenRate = 12; },
  dampers: (e) => { e.damageMult = 0.85; },
  reflexes: (e) => { e.counterWindow = 0.15; },
  flow: (e) => { e.comboShield = 1; },
  efficient: (e) => { e.chainDiscount = 2; },
  fastFinish: (e) => { e.specialAt = 6; },
  swarm: (e) => { e.batSwarm = true; },
  triple: (e) => { e.batarangCount = 3; },
  bigBang: (e) => { e.gelRadius = 5.5; },
  quickSmoke: (e) => { e.smokeCooldown = 7; },
  doubleClaw: (e) => { e.clawTargets = 2; },
  deepFreeze: (e) => { e.freezeTime = 8; },
  accelerator: (e) => { e.boostUp = 19; e.boostOut = 11; },
  aero: (e) => { e.diveGain = 1.3; e.glideMax = 56; },
  grip: (e) => { e.wallRunTime = 1.8; },
  rails: (e) => { e.ladderSlide = 14; },
  seismic: (e) => { e.diveRadius = 6; },
};

// Rebuilds `out` (the live effects object) from the owned upgrades.
export function upgradeEffects(owned, out = {}) {
  Object.assign(out, BASE_EFFECTS);
  for (const u of UPGRADES) if (owned.includes(u.id)) APPLY[u.id](out);
  return out;
}

export function canBuy(owned, id, free) {
  const u = byId.get(id);
  if (!u) return { ok: false, reason: 'unknown' };
  if (owned.includes(id)) return { ok: false, reason: 'owned' };
  if (u.requires && !owned.includes(u.requires)) return { ok: false, reason: 'locked' };
  if (free < u.cost) return { ok: false, reason: 'points' };
  return { ok: true, reason: null };
}

export function upgradeStatus(owned, id, free) {
  const r = canBuy(owned, id, free);
  if (r.ok) return 'buyable';
  return r.reason === 'owned' ? 'owned' : r.reason === 'points' ? 'poor' : 'locked';
}

// How much of an attack's damage lands. The Joker's gags are `gas` (the laughing-gas grenades he
// throws) and `buzzer` (the joy-buzzer floor tiles): Kevlar Weave covers both, as it does knives.
const RANGED = new Set(['gas', 'buzzer']);
export function damageFactor(kind, e) {
  const k = kind === 'knife' ? e.knifeMult : RANGED.has(kind) ? e.rangedMult : 1;
  return k * e.damageMult;
}

// Damage that reaches Batman after armor, rounded to hundredths: goon attacks (combat) and the
// Joker fight's hazards (boss.js) both go through here, so every upgrade applies to both.
export function hurtDamage(kind, opts, e) {
  return Math.round(damageToHero(kind, opts) * damageFactor(kind, e) * 100) / 100;
}

// Health recovery out of combat: after `regenDelay` seconds calm and unhurt, `regenRate` per second.
export function regenStep(health, max, { calm, sinceHurt }, e, dt) {
  if (!calm || sinceHurt < e.regenDelay || health >= max) return health;
  return Math.min(max, health + e.regenRate * dt);
}
