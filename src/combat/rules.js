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
  joker: { health: 30, damage: 12, counterable: true, parry: false, armored: false, speed: 3.6, scale: 1, boss: true },
};

// damage, and whether the move knocks down / stuns / breaks a knife guard.
export const MOVES = {
  punch: { damage: 1 },
  beatdown: { damage: 1 },
  kick: { damage: 2, breaksGuard: true },
  jumpKick: { damage: 2, knockdown: true, breaksGuard: true },
  diveBomb: { damage: 2, knockdown: true, breaksGuard: true },
  counter: { damage: 1, knockdown: true },
  cape: { damage: 0, stun: 1.5, stunOnly: true },
  batarang: { damage: 0, stun: 1.2, stunOnly: true },
  special: { ko: true },
};

// How much of each attack a raised guard absorbs.
export const BLOCK_REDUCTION = { grunt: 0.8, knife: 0.5, brute: 0.4, charge: 0, joker: 0.6, gas: 0, buzzer: 0 };
const ATTACK_DAMAGE = { grunt: 10, knife: 15, brute: 20, charge: 25, joker: 12, gas: 4, buzzer: 12 };

// Mutates enemy.health / enemy.stunned. Returns { outcome, damage, stun }.
// outcome: 'hit' | 'knockdown' | 'ko' | 'stun' | 'parried' | 'immune'
export function resolveHit(move, enemy) {
  const m = MOVES[move];
  const def = ENEMY[enemy.type];
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
  if (def.armored && !enemy.stunned) return { outcome: 'immune', damage: 0, stun: 0 };
  if (def.parry && !enemy.stunned) {
    if (!m.breaksGuard) return { outcome: 'parried', damage: 0, stun: 0 };
    const r = applyDamage(enemy, m.damage, m.knockdown);
    return { ...r, stun: r.outcome === 'hit' ? 1.2 : 0 };
  }
  return applyDamage(enemy, m.damage, m.knockdown);
}

function applyDamage(enemy, damage, knockdown) {
  enemy.health = Math.max(0, enemy.health - damage);
  if (enemy.health <= 0) return { outcome: 'ko', damage, stun: 0 };
  return { outcome: knockdown ? 'knockdown' : 'hit', damage, stun: 0 };
}

export function damageToHero(attack, { difficulty = 'normal', blocking = false, invulnerable = false } = {}) {
  if (invulnerable) return 0;
  const base = ATTACK_DAMAGE[attack] ?? 10;
  const reduction = blocking ? BLOCK_REDUCTION[attack] ?? 0 : 0;
  return Math.round(base * (1 - reduction) * DIFFICULTY[difficulty].damage * 100) / 100;
}
