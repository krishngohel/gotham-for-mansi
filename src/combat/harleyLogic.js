// Harley Quinn's pure decision helpers (the mini-boss goon, src/actors/enemy.js type 'harley').
// No THREE, no rng object: a caller-supplied [0,1) float, so this is unit-testable in isolation.
// Each move's glyph (what the HUD shows during her windup: 'red' means dodge, not block or
// counter, matching how a brute's telegraphs already read) and windup/recover timing in seconds.
export const HARLEY_MOVES = {
  slam: { glyph: 'red', windup: 1.1, recover: 0.6, range: 3.2 },
  sweep: { glyph: 'red', windup: 0.75, recover: 0.5, range: 3.6 },
  throw: { glyph: null, windup: 0.45, recover: 0.4, range: 14 },
};

export const harleyGlyph = (move) => HARLEY_MOVES[move]?.glyph ?? null;
export const harleyWindup = (move, fallback = 0.6) => HARLEY_MOVES[move]?.windup ?? fallback;
export const harleyRecover = (move, fallback = 0.5) => HARLEY_MOVES[move]?.recover ?? fallback;

// Seconds before each move is off cooldown again, so she doesn't spam the same one back to back.
export const HARLEY_COOLDOWN = { slam: 3.4, sweep: 2.6, throw: 4 };

// No dashes: player-visible text.
export const HARLEY_TAUNTS = [
  'Aw, is it your birthday, Bats? Mistah J got you a PRESENT!',
  'Hold still, birthday girl!',
];

// Which move Harley throws out next: the mallet slam and sweep only at melee range, the
// pie/confetti throw only at a distance, each gated by its own cooldown (seconds remaining;
// <= 0 is ready). `rng01` is a single already-rolled float in [0, 1) so this stays pure; picks
// uniformly among whatever is currently both in range and off cooldown. Returns null when
// nothing is ready (the caller should just keep closing or holding distance).
export function chooseHarleyMove(dist, cooldowns, rng01) {
  const options = [];
  if ((cooldowns.slam ?? 0) <= 0 && dist < HARLEY_MOVES.slam.range) options.push('slam');
  if ((cooldowns.sweep ?? 0) <= 0 && dist < HARLEY_MOVES.sweep.range) options.push('sweep');
  if ((cooldowns.throw ?? 0) <= 0 && dist >= HARLEY_MOVES.slam.range && dist < HARLEY_MOVES.throw.range) options.push('throw');
  if (!options.length) return null;
  return options[Math.min(options.length - 1, Math.floor(rng01 * options.length))];
}

// Whether she cartwheels away right now: only while she isn't already committed to a move, on
// her own cooldown so she doesn't hop every frame, and a dice roll so it reads as a personality
// tic rather than a metronome. `engaged` is just "she is in the fight and standing".
export function shouldCartwheel(engaged, cooldown, rng01, chance = 0.35) {
  return !!engaged && (cooldown ?? 0) <= 0 && rng01 < chance;
}
