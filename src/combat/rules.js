// Combat numbers and hit resolution. Pure.

export const DIFFICULTY = {
  story: { damage: 0.5, windup: 0.9, gap: [3.2, 5], maxWindups: 1, heroHealth: 150 },
  normal: { damage: 1, windup: 0.6, gap: [2.2, 4], maxWindups: 2, heroHealth: 100 },
  hard: { damage: 1.5, windup: 0.45, gap: [1.6, 3], maxWindups: 2, heroHealth: 100 },
};

export const ENEMY = {
  grunt: { health: 4, damage: 10, counterable: true, parry: false, armored: false, speed: 3.3, scale: 1 },
  knife: { health: 4, damage: 15, counterable: true, parry: true, armored: false, speed: 3.5, scale: 1 },
  brute: { health: 10, damage: 20, counterable: false, parry: false, armored: true, speed: 2.4, scale: 1.25 },
  rifle: { health: 4, damage: 15, counterable: false, parry: true, armored: false, speed: 3.2, scale: 1, ranged: true },
  joker: { health: 30, damage: 12, counterable: true, parry: false, armored: false, speed: 3.6, scale: 1, boss: true },
  // Harley Quinn, a mini-boss goon (src/actors/enemy.js, src/actors/harleyChar.js): about 6
  // grunts' worth of health, armored like a brute (immune to a plain punch/kick until stunned,
  // and so excluded from being a chain takedown's first target the same way brutes are, in
  // chains.js's `leaders`), but not a `boss`: chains, the swarm and dive-bomb shockwaves can all
  // still knock her down, they just never outright KO her (chainOutcome already reads that off
  // `def.armored`).
  harley: { health: 24, damage: 22, counterable: false, parry: false, armored: true, speed: 3.0, scale: 1.05 },
};

// damage, and whether the move knocks down / stuns / breaks a knife guard.
export const MOVES = {
  punch: { damage: 1 },
  beatdown: { damage: 1 },
  kick: { damage: 2, breaksGuard: true },
  jumpKick: { damage: 2, knockdown: true, breaksGuard: true },
  diveBomb: { damage: 2, knockdown: true, breaksGuard: true },
  counter: { damage: 1, knockdown: true, breaksGuard: true },
  cape: { damage: 0, stun: 1.5, stunOnly: true },
  batarang: { damage: 0, stun: 1.2, stunOnly: true },
  special: { ko: true },
  // Finishers and new attacks.
  heavy: { damage: 2, knockdown: true },
  spinKick: { damage: 3, knockdown: true, breaksGuard: true },
  slam: { damage: 2, knockdown: true, breaksGuard: true },
  throw: { damage: 1, knockdown: true, breaksGuard: true, noHeavy: true },
  thrownInto: { damage: 1, knockdown: true, breaksGuard: true },
  // Gadgets.
  gel: { damage: 1, knockdown: true, breaksGuard: true },
  remote: { damage: 0, stun: 1.5, stunOnly: true },
  claw: { damage: 0, stun: 1.2, stunOnly: true },
  smoke: { damage: 0, stun: 3, stunOnly: true },
  popper: { damage: 0, stun: 3, stunOnly: true },
  shatter: { ko: true },
};

// How much of each attack a raised guard absorbs.
export const BLOCK_REDUCTION = { grunt: 0.8, knife: 0.5, brute: 0.4, charge: 0, joker: 0.6, gas: 0, buzzer: 0, rifle: 0, harleySlam: 0.3, harleySweep: 0.5, harleyThrow: 0.2 };
const ATTACK_DAMAGE = { grunt: 10, knife: 15, brute: 20, charge: 25, joker: 12, gas: 4, buzzer: 12, rifle: 15, harleySlam: 22, harleySweep: 14, harleyThrow: 6 };
// A rifle shot hurts a set amount per difficulty rather than Normal's figure times the difficulty
// multiplier: two Normal shots used to take half of Batman's health in under two seconds. Hard
// keeps what it had (25 x 1.5).
export const RIFLE_DAMAGE = { story: 10, normal: 15, hard: 37.5 };

// Mutates enemy.health / enemy.stunned. Returns { outcome, damage, stun }.
// outcome: 'hit' | 'knockdown' | 'ko' | 'stun' | 'parried' | 'immune'
export function resolveHit(move, enemy) {
  const m = MOVES[move];
  const def = enemy.def ?? ENEMY[enemy.type];
  if (!m || !def) throw new Error(`Unknown move/enemy ${move}/${enemy.type}`);

  if (m.ko) {
    if (def.boss) return applyDamage(enemy, 3, false);
    enemy.health = 0;
    return { outcome: 'ko', damage: enemy.health, stun: 0 };
  }
  if (enemy.down && (move === 'punch' || move === 'kick' || move === 'beatdown') && !def.boss) {
    enemy.health = 0;
    return { outcome: 'ko', damage: 0, stun: 0 };
  }
  if (m.stunOnly) return { outcome: 'stun', damage: 0, stun: m.stun };
  // Nobody picks up a brute, or the Joker.
  if (m.noHeavy && (def.armored || def.boss)) return { outcome: 'immune', damage: 0, stun: 0 };
  if (def.armored && !enemy.stunned) return { outcome: 'immune', damage: 0, stun: 0 };
  if (def.parry && !enemy.stunned) {
    if (!m.breaksGuard) return { outcome: 'parried', damage: 0, stun: 0 };
    const r = applyDamage(enemy, m.damage, m.knockdown);
    return { ...r, stun: r.outcome === 'hit' ? 1.2 : 0 };
  }
  return applyDamage(enemy, m.damage, m.knockdown);
}

// A dive-bomb shockwave reaches out to `radius` on the ground and 2.5 m up/down.
export function inShockwave(c, p, radius = 4) {
  return Math.hypot(p.x - c.x, p.z - c.z) <= radius && Math.abs(p.y - c.y) <= 2.5;
}

// Whether a glide-state kick should start the dive-bomb attack (instead of the old
// target-seeking air kick, which still runs below this height).
export function shouldDiveBomb(state, heightAboveGround, threshold = 6) {
  return state === 'glide' && heightAboveGround > threshold;
}

function applyDamage(enemy, damage, knockdown) {
  enemy.health = Math.max(0, enemy.health - damage);
  if (enemy.health <= 0) return { outcome: 'ko', damage, stun: 0 };
  return { outcome: knockdown ? 'knockdown' : 'hit', damage, stun: 0 };
}

// Whether a hanging ledge takedown can target this enemy: alive, standing, unaware, not the
// boss or a grabbed goon, and within reach of the ledge's hang point.
export function canLedgeTakedown(enemy, ledge) {
  if (!enemy || !ledge || !enemy.alive || enemy.down || enemy.aware) return false;
  if (enemy.def?.boss || enemy.state === 'grabbed') return false;
  return Math.abs(enemy.pos.y - ledge.y) < 0.4 &&
    Math.hypot(enemy.pos.x - ledge.x, enemy.pos.z - ledge.z) < 1.5;
}

// Whether a hard landing can drop-takedown this enemy: alive, standing, not the boss or a
// grabbed goon (the boss can never be one-shot), and right under the hero.
export function canDropTakedown(enemy, heroPos) {
  if (!enemy || !heroPos || !enemy.alive || enemy.down) return false;
  if (enemy.def?.boss || enemy.state === 'grabbed') return false;
  return Math.hypot(enemy.pos.x - heroPos.x, enemy.pos.z - heroPos.z) < 1.2 &&
    Math.abs(enemy.pos.y - heroPos.y) < 1;
}

export function damageToHero(attack, { difficulty = 'normal', blocking = false, invulnerable = false } = {}) {
  if (invulnerable) return 0;
  const base = ATTACK_DAMAGE[attack] ?? 10;
  const reduction = blocking ? BLOCK_REDUCTION[attack] ?? 0 : 0;
  if (attack === 'rifle') return Math.round((RIFLE_DAMAGE[difficulty] ?? RIFLE_DAMAGE.normal) * (1 - reduction) * 100) / 100;
  return Math.round(base * (1 - reduction) * DIFFICULTY[difficulty].damage * 100) / 100;
}
