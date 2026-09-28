// Experience points: what play pays, levels and upgrade points. Pure.
export const XP_PER_LEVEL = 1000;

// Flat amounts per event. Part H events (crateOpened, missionDone) are listed now so its modules
// only emit them.
export const XP = {
  ko: 10, takedown: 40, special: 25, counter: 5, fightDone: 100, objectiveDone: 25,
  balloon: 150, crimeStopped: 200, glassBroken: 50, wallBroken: 50,
  chainPerGoon: 50, swarmPerGoon: 60, crateOpened: 200, missionDone: 500,
};
// A medal's worth; a better medal pays the difference.
export const MEDAL_XP = { bronze: 150, silver: 300, gold: 500 };

export const pointsEarned = (xp) => Math.floor(Math.max(0, xp) / XP_PER_LEVEL);
export const levelOf = (xp) => pointsEarned(xp) + 1;
export const pointsFree = (xp, spent) => Math.max(0, pointsEarned(xp) - spent);

export function toNext(xp) {
  const into = Math.max(0, xp) % XP_PER_LEVEL;
  return { into, need: XP_PER_LEVEL - into, fraction: into / XP_PER_LEVEL };
}

// A finished combo: 4 per hit from 5 hits up, plus 20 per different move beyond two.
export function comboXp(peak, variety) {
  if (peak < 5) return 0;
  return 4 * peak + 20 * Math.max(0, variety - 2);
}

export function chainXp(count, stealth) {
  return Math.round(XP.chainPerGoon * count * (stealth ? 1.5 : 1));
}

export function medalXp(prev, next) {
  return Math.max(0, (MEDAL_XP[next] ?? 0) - (MEDAL_XP[prev] ?? 0));
}

export function levelsCrossed(before, after) {
  const a = levelOf(before), b = levelOf(after);
  const out = [];
  for (let l = a + 1; l <= b; l++) out.push(l);
  return out;
}

// One combo run: the highest count and the set of moves used, closed when the combo ends.
export function createComboRun() {
  let peak = 0;
  const moves = new Set();
  return {
    get peak() { return peak; },
    note(move, value) { if (value > peak) peak = value; if (move) moves.add(move); },
    close() {
      const r = { peak, variety: moves.size };
      peak = 0;
      moves.clear();
      return r;
    },
  };
}
