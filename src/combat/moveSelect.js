// How Batman moves picks the strike (docs/superpowers/specs/2026-10-08-movement-combos-design.md).
// Pure: combatSystem passes the held direction (relative to the goon), sprint, airborne and
// sprint-jump state; null means "use the normal punch / kick rotation".
const TOWARD = (50 * Math.PI) / 180, AWAY = (130 * Math.PI) / 180;

export function classifyDir(move, toTarget) {
  const ml = Math.hypot(move.x, move.z), tl = Math.hypot(toTarget.x, toTarget.z);
  if (ml < 0.2 || tl < 1e-6) return 'none';
  const dot = (move.x * toTarget.x + move.z * toTarget.z) / (ml * tl);
  const a = Math.acos(Math.max(-1, Math.min(1, dot)));
  if (a <= TOWARD) return 'toward';
  if (a >= AWAY) return 'away';
  // Facing +z, right is -x: a move to the right gives a negative side value.
  const side = toTarget.z * move.x - toTarget.x * move.z;
  return side < 0 ? 'right' : 'left';
}

const M = (o) => ({ power: 1.4, launch: 2, crit: false, react: null, word: null, stop: 'kick', air: false, ...o });
export const MOVE_TABLE = [
  M({ id: 'stomp', name: 'Stomp', input: 'Kick a goon on the floor', action: 'kick', clip: 'Stomp', kind: 'kick', power: 1.8, launch: 0.3, word: 'STOMP!', stop: 'heavy' }),
  M({ id: 'hurricane', name: 'Hurricane Kick', input: 'Sprint, jump, kick', action: 'kick', clip: 'Kick_Hurricane', kind: 'spinKick', power: 2.4, launch: 7, crit: true, word: 'HURRICANE!', stop: 'finisher', air: true }),
  M({ id: 'leapSmash', name: 'Leaping Smash', input: 'Sprint, jump, punch', action: 'punch', clip: 'Smash_Leap', kind: 'heavy', power: 2.2, launch: 0.5, crit: true, word: 'SMASH!', stop: 'finisher', air: true }),
  M({ id: 'backflipKick', name: 'Backflip Kick', input: 'Jump, hold back, kick', action: 'kick', clip: 'Kick_BackFlip', kind: 'spinKick', power: 2.4, launch: 8, crit: true, word: 'WHAM!', stop: 'finisher', air: true }),
  M({ id: 'airAxe', name: 'Axe Kick', input: 'Jump, kick', action: 'kick', clip: 'Kick_AirAxe', kind: 'spinKick', power: 2.2, launch: 0.5, crit: true, word: 'KRUNCH!', stop: 'finisher', air: true }),
  M({ id: 'flyingKnee', name: 'Flying Knee', input: 'Sprint, kick', action: 'kick', clip: 'Knee_Flying', kind: 'spinKick', power: 2.2, launch: 6, crit: true, word: 'KNEE!', stop: 'finisher' }),
  M({ id: 'runUppercut', name: 'Running Uppercut', input: 'Sprint, punch', action: 'punch', clip: 'Punch_RunUppercut', kind: 'heavy', power: 1.8, launch: 3.4, word: 'UPPERCUT!', stop: 'heavy', react: 'head' }),
  M({ id: 'spinBackKick', name: 'Spinning Back Kick', input: 'Hold back from a goon, kick', action: 'kick', clip: 'Kick_SpinBack', kind: 'spinKick', power: 2.2, launch: 5, crit: true, word: 'THWACK!', stop: 'finisher' }),
  M({ id: 'spinBackfist', name: 'Spinning Backfist', input: 'Hold back from a goon, punch', action: 'punch', clip: 'Punch_Backfist', kind: 'heavy', power: 1.8, launch: 4.5, stop: 'heavy', react: 'spin' }),
  M({ id: 'sideRound', name: 'Roundhouse', input: 'Hold left or right of a goon, kick', action: 'kick', clip: 'Kick_SideRound', kind: 'kick', power: 1.6, launch: 2.5, react: 'spin' }),
  M({ id: 'sideHook', name: 'Hook', input: 'Hold left or right of a goon, punch', action: 'punch', clip: 'Punch_SideHook', kind: 'punch', power: 1.3, launch: 0, stop: 'punch', react: 'spin' }),
];
const byId = Object.fromEntries(MOVE_TABLE.map((m) => [m.id, m]));

export function selectMove({ action, dir = 'none', sprint = false, air = false, airFromSprint = false, targetDown = false, has = () => true }) {
  const pick = (id, clip) => {
    const m = byId[id];
    const c = clip ?? m.clip;
    return has(c) ? { ...m, clip: c } : null;
  };
  const kick = action === 'kick';
  if (targetDown) return kick ? pick('stomp') : null;
  if (air) {
    if (airFromSprint) return pick(kick ? 'hurricane' : 'leapSmash');
    if (!kick) return null;
    return dir === 'away' ? pick('backflipKick') : pick('airAxe');
  }
  if (sprint) return pick(kick ? 'flyingKnee' : 'runUppercut');
  if (dir === 'away') return pick(kick ? 'spinBackKick' : 'spinBackfist');
  if (dir === 'left' || dir === 'right') {
    const id = kick ? 'sideRound' : 'sideHook';
    return pick(id, byId[id].clip + (dir === 'left' ? '_M' : ''));
  }
  return null;
}
