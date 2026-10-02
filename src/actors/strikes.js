// More strikes for freeflow, authored in code on the shared skeleton with poseAuthor (same
// conventions as kicks.js: f = forward swing, s = sideways, tw = twist, positive twist turns the
// torso left). The idle stance has the left foot forward; the left ball is planted so turns and
// weight shifts come from the hips, not from the feet sliding.
//
// Beats: wind-up (weight loads, the striking side cocks), the strike snapping into contact, a
// short hold on contact (it lines up with the game's hit-stop), the return to guard.
import { sampleRest, discoverFrames, compileClip } from './poseAuthor.js';

// Clip length, contact frame (clip seconds) and the striking limb, read by combat/reach.js to
// measure where the fist, elbow or foot is on contact.
export const STRIKE_BEATS = {
  Punch_Uppercut: { duration: 0.6, contact: 0.26, limb: 'hand_r' },
  Punch_Hook_L: { duration: 0.55, contact: 0.22, limb: 'hand_l' },
  Elbow_Strike: { duration: 0.5, contact: 0.2, limb: 'lowerarm_r' },
  Punch_Backfist: { duration: 0.85, contact: 0.46, limb: 'hand_r' },
  Punch_Hammer: { duration: 0.75, contact: 0.34, limb: 'hand_r' },
  Kick_Side: { duration: 0.7, contact: 0.33, limb: 'foot_r' },
  Kick_Axe: { duration: 0.8, contact: 0.44, limb: 'foot_r' },
  Kick_Low: { duration: 0.62, contact: 0.28, limb: 'foot_r' },
};

const GUARD_L = { upperarm_l: { f: 0.9, s: -0.1 }, lowerarm_l: { f: 1.3 } };
const GUARD_R = { upperarm_r: { f: 0.9, s: -0.1 }, lowerarm_r: { f: 1.3 } };
const GUARD = { ...GUARD_L, ...GUARD_R };

export function buildStrikeClips(model, clips, fwd = 1) {
  const rest = sampleRest(model, clips.get('Idle_Loop'), 0);
  const frames = discoverFrames(model, fwd);
  const make = (name, keys, plant = 'ball_l') => compileClip(name, STRIKE_BEATS[name].duration, keys, { model, frames, rest, plant });
  const TURN = -Math.PI * 2;

  // Uppercut: knees dip and the right fist drops by the hip, then the legs drive up, the hips
  // turn over and the fist rises on a bent arm right up the middle, rising onto the toes.
  const uppercut = make('Punch_Uppercut', [
    { t: 0.1, ease: 'in',
      pelvis: { f: 0.2, tw: -0.4 }, spine_02: { f: 0.3, tw: -0.35 }, neck_01: { f: -0.1 }, hips: [0, -0.12, 0],
      thigh_l: { f: 0.6, s: -0.15 }, calf_l: { f: 1.15 }, thigh_r: { f: 0.55 }, calf_r: { f: 1.1 },
      upperarm_r: { f: 0.05, s: 0.15 }, lowerarm_r: { f: 1.8 }, ...GUARD_L },
    { t: 0.26, ease: 'snap',
      pelvis: { f: -0.1, tw: 0.65 }, spine_01: { f: -0.25, tw: 0.25 }, spine_02: { f: -0.35, tw: 0.3 }, neck_01: { f: 0.25 }, Head: { f: 0.1 }, hips: [0, 0.06, 0],
      thigh_l: { f: 0.05, s: -0.15 }, calf_l: { f: 0.1 }, foot_l: { f: 0.25 }, thigh_r: { f: 0.05 }, calf_r: { f: 0.2 }, foot_r: { f: 0.45 },
      upperarm_r: { f: 2.55, s: -0.35 }, lowerarm_r: { f: 1.25 }, hand_r: { f: -0.3 },
      upperarm_l: { f: 1.0, s: 0.05 }, lowerarm_l: { f: 1.5 } },
    { t: 0.32, hold: true, ease: 'lin' },
    { t: 0.45, ease: 'io',
      pelvis: { f: 0.05, tw: 0.15 }, spine_01: { f: 0 }, spine_02: { f: 0.05, tw: 0.05 }, neck_01: { f: 0.05 }, Head: { f: 0 },
      thigh_l: { f: 0.15, s: -0.15 }, calf_l: { f: 0.3 }, foot_l: { f: 0 }, thigh_r: { f: 0.1 }, calf_r: { f: 0.25 }, foot_r: { f: 0 }, ...GUARD },
    { t: 0.6, ease: 'io' },
  ]);

  // Left hook: the hips wind left, then whip right; the lead arm swings round flat at shoulder
  // height, bent at ninety degrees, the shoulder rolling in behind it.
  const hook = make('Punch_Hook_L', [
    { t: 0.09, ease: 'in',
      pelvis: { f: 0.1, tw: 0.45 }, spine_02: { f: 0.08, tw: 0.4 },
      thigh_l: { f: 0.3, s: -0.15 }, calf_l: { f: 0.6 }, thigh_r: { f: 0.2 }, calf_r: { f: 0.45 },
      upperarm_l: { f: 0.7, s: 0.9 }, lowerarm_l: { f: 1.7 }, ...GUARD_R },
    { t: 0.22, ease: 'snap',
      pelvis: { f: 0.02, tw: -0.8 }, spine_01: { tw: -0.35 }, spine_02: { f: 0.08, tw: -0.55 }, neck_01: { tw: 0.15 }, Head: { tw: 0.15 },
      thigh_l: { f: 0.15, s: -0.15, tw: -0.35 }, calf_l: { f: 0.35 }, foot_l: { f: 0.15 }, thigh_r: { f: 0.1 }, calf_r: { f: 0.25 },
      upperarm_l: { f: 1.55, s: 1.35, tw: 0.4 }, lowerarm_l: { f: 1.55 },
      upperarm_r: { f: 1.0, s: -0.05 }, lowerarm_r: { f: 1.5 } },
    { t: 0.27, hold: true, ease: 'lin' },
    { t: 0.4, ease: 'io',
      pelvis: { f: 0.05, tw: -0.1 }, spine_01: { tw: 0 }, spine_02: { f: 0, tw: -0.05 }, neck_01: { tw: 0 }, Head: { tw: 0 },
      thigh_l: { f: 0.15, s: -0.15, tw: 0 }, calf_l: { f: 0.3 }, foot_l: { f: 0 }, ...GUARD },
    { t: 0.55, ease: 'io' },
  ]);

  // Elbow: up close, the right elbow comes round flat at head height, the forearm folded tight,
  // the whole torso turning through it.
  const elbow = make('Elbow_Strike', [
    { t: 0.08, ease: 'in',
      pelvis: { f: 0.08, tw: -0.3 }, spine_02: { tw: -0.25 },
      thigh_l: { f: 0.25, s: -0.15 }, calf_l: { f: 0.5 }, thigh_r: { f: 0.2 }, calf_r: { f: 0.45 },
      upperarm_r: { f: 0.6, s: 0.65 }, lowerarm_r: { f: 2.2 }, ...GUARD_L },
    { t: 0.2, ease: 'snap',
      pelvis: { f: 0.02, tw: 0.85 }, spine_01: { tw: 0.4 }, spine_02: { f: 0.1, tw: 0.55 }, neck_01: { tw: -0.15 }, Head: { tw: -0.2 },
      thigh_l: { f: 0.2, s: -0.15, tw: 0.25 }, calf_l: { f: 0.4 }, thigh_r: { f: 0.1 }, calf_r: { f: 0.3 }, foot_r: { f: 0.4 },
      upperarm_r: { f: 1.6, s: 1.1, tw: 0.5 }, lowerarm_r: { f: 2.6 },
      upperarm_l: { f: 1.0, s: 0.1 }, lowerarm_l: { f: 1.6 } },
    { t: 0.25, hold: true, ease: 'lin' },
    { t: 0.36, ease: 'io',
      pelvis: { f: 0.05, tw: 0.1 }, spine_01: { tw: 0 }, spine_02: { f: 0, tw: 0.05 }, neck_01: { tw: 0 }, Head: { tw: 0 },
      thigh_l: { f: 0.15, s: -0.15, tw: 0 }, calf_l: { f: 0.3 }, foot_r: { f: 0 }, ...GUARD },
    { t: 0.5, ease: 'io' },
  ]);

  // Spinning backfist (a finisher): the head leads a full turn over the right shoulder on the
  // left ball, and the right arm whips out straight at three quarters of the turn, the back of
  // the fist through the target.
  const backfist = make('Punch_Backfist', [
    { t: 0.1, ease: 'in',
      pelvis: { f: 0.1, tw: 0.2 }, spine_02: { tw: 0.15 }, thigh_l: { f: 0.25, s: -0.1 }, calf_l: { f: 0.5 }, thigh_r: { f: 0.2 }, calf_r: { f: 0.5 }, ...GUARD },
    { t: 0.24, ease: 'in',
      pelvis: { f: 0.05, tw: TURN * 0.3 }, spine_01: { tw: -0.25 }, spine_02: { tw: -0.35 }, neck_01: { tw: -0.4 }, Head: { tw: -0.6 },
      thigh_l: { f: -0.2, s: -0.2 }, calf_l: { f: 0.5 }, foot_l: { f: 0.2 }, thigh_r: { f: 0.3, s: 0.3 }, calf_r: { f: 0.9 },
      upperarm_r: { f: 0.9, s: 0.3 }, lowerarm_r: { f: 1.7 }, upperarm_l: { f: 0.6, s: 0.8 }, lowerarm_l: { f: 1.0 } },
    { t: 0.38, ease: 'lin',
      pelvis: { f: 0, s: 0.1, tw: TURN * 0.55 }, spine_01: { s: 0.1, tw: -0.3 }, spine_02: { s: 0.15, tw: -0.4 },
      upperarm_r: { f: 1.25, s: 0.95 }, lowerarm_r: { f: 0.9 } },
    { t: 0.46, ease: 'snap',
      pelvis: { f: -0.03, s: 0.2, tw: TURN * 0.75 }, spine_01: { s: 0.15, tw: -0.25 }, spine_02: { s: 0.2, tw: -0.25 }, neck_01: { s: -0.1, tw: -0.25 }, Head: { tw: -0.45 },
      thigh_l: { f: -0.25, s: -0.25 }, calf_l: { f: 0.3 }, foot_l: { f: 0.35 }, thigh_r: { f: 0.2, s: 0.5 }, calf_r: { f: 0.4 },
      upperarm_r: { f: 1.45, s: 1.4 }, lowerarm_r: { f: 0.1 }, upperarm_l: { f: 0.3, s: 1.0 }, lowerarm_l: { f: 0.8 } },
    { t: 0.52, ease: 'lin',
      pelvis: { f: -0.02, s: 0.15, tw: TURN * 0.85 }, upperarm_r: { f: 1.3, s: 1.15 }, lowerarm_r: { f: 0.3 } },
    { t: 0.68, ease: 'out',
      pelvis: { f: 0.08, s: 0.05, tw: TURN }, spine_01: { s: 0, tw: -0.05 }, spine_02: { s: 0.05, tw: -0.1 }, neck_01: { s: 0, tw: -0.05 }, Head: { tw: -0.1 },
      thigh_l: { f: 0.2, s: -0.15 }, calf_l: { f: 0.5 }, foot_l: { f: 0.1 }, thigh_r: { f: 0.3, s: 0.1 }, calf_r: { f: 0.6 }, ...GUARD },
    { t: 0.85, ease: 'io', pelvis: { tw: TURN } },
  ]);

  // Hammer (a finisher): both fists clasped high overhead with the back arched, then the whole
  // body crunches down behind a two-handed smash, knees dropping into it.
  const hammer = make('Punch_Hammer', [
    { t: 0.14, ease: 'out',
      pelvis: { f: -0.05 }, spine_01: { f: -0.15 }, spine_02: { f: -0.3 }, neck_01: { f: 0.2 },
      thigh_l: { f: 0.1, s: -0.1 }, calf_l: { f: 0.2 }, thigh_r: { f: 0.05 }, calf_r: { f: 0.15 }, foot_r: { f: 0.35 },
      upperarm_l: { f: 2.75, s: -0.3 }, lowerarm_l: { f: 0.9 }, upperarm_r: { f: 2.75, s: -0.3 }, lowerarm_r: { f: 0.9 } },
    { t: 0.34, ease: 'snap',
      pelvis: { f: 0.2 }, spine_01: { f: 0.35 }, spine_02: { f: 0.5 }, neck_01: { f: -0.15 },
      thigh_l: { f: 0.55, s: -0.1 }, calf_l: { f: 1.0 }, thigh_r: { f: 0.45 }, calf_r: { f: 1.0 }, foot_r: { f: 0.1 },
      upperarm_l: { f: 0.95, s: -0.25 }, lowerarm_l: { f: 0.35 }, upperarm_r: { f: 0.95, s: -0.25 }, lowerarm_r: { f: 0.35 } },
    { t: 0.42, hold: true, ease: 'lin' },
    { t: 0.58, ease: 'io',
      pelvis: { f: 0.06 }, spine_01: { f: 0.05 }, spine_02: { f: 0.08 }, neck_01: { f: 0 },
      thigh_l: { f: 0.15, s: -0.15 }, calf_l: { f: 0.3 }, thigh_r: { f: 0.1 }, calf_r: { f: 0.25 }, foot_r: { f: 0 }, ...GUARD },
    { t: 0.75, ease: 'io' },
  ]);

  // Side kick: the hips turn side-on, the knee chambers across the body, then the heel drives
  // straight out with the foot blade level, the head keeping the target over the shoulder.
  const side = make('Kick_Side', [
    { t: 0.12, ease: 'in',
      pelvis: { f: 0.12, tw: 0.3 }, spine_02: { f: 0.05, tw: -0.2 }, Head: { tw: -0.1 }, thigh_l: { f: 0.25, s: -0.15 }, calf_l: { f: 0.5 },
      thigh_r: { f: 0.6, s: 0.1, tw: -0.1 }, calf_r: { f: 1.3 }, foot_r: { f: 0.4 }, ...GUARD },
    { t: 0.24, ease: 'out',
      pelvis: { f: 0.05, s: 0.2, tw: 1.0 }, spine_01: { s: 0.15, tw: -0.3 }, spine_02: { s: 0.2, tw: -0.35 }, spine_03: { tw: -0.1 }, neck_01: { tw: -0.25 }, Head: { tw: -0.45 },
      thigh_l: { f: 0.1, s: -0.2, tw: 0.5 }, calf_l: { f: 0.45 }, foot_l: { f: 0.15 },
      thigh_r: { f: 1.5, s: 0.7, tw: -0.4 }, calf_r: { f: 2.2 }, foot_r: { f: -0.3, s: 0.3 },
      upperarm_l: { f: 0.7, s: 0.6 }, lowerarm_l: { f: 1.3 }, upperarm_r: { f: 1.1, s: 0.2 }, lowerarm_r: { f: 1.5 } },
    { t: 0.33, ease: 'snap',
      pelvis: { f: -0.05, s: 0.3, tw: 1.35 }, spine_01: { s: 0.2, tw: -0.35 }, spine_02: { s: 0.25, tw: -0.4 }, spine_03: { tw: -0.15 }, neck_01: { s: -0.15, tw: -0.3 }, Head: { tw: -0.5 },
      thigh_l: { f: -0.2, s: -0.2, tw: 0.8 }, calf_l: { f: 0.25 }, foot_l: { f: 0.35 },
      thigh_r: { f: 0.5, s: 1.3, tw: -0.55 }, calf_r: { f: 0.12 }, foot_r: { f: -0.35, s: 0.3 },
      upperarm_l: { f: 0.4, s: 1.0 }, lowerarm_l: { f: 0.8 }, upperarm_r: { f: 1.2, s: 0 }, lowerarm_r: { f: 1.6 } },
    { t: 0.39, hold: true, ease: 'lin' },
    { t: 0.51, ease: 'io',
      pelvis: { f: 0.05, s: 0.2, tw: 0.9 }, spine_01: { s: 0.15, tw: -0.25 }, spine_02: { s: 0.2, tw: -0.25 }, spine_03: { tw: -0.05 }, neck_01: { s: 0, tw: -0.15 }, Head: { tw: -0.3 },
      thigh_l: { f: 0.1, s: -0.2, tw: 0.5 }, calf_l: { f: 0.45 }, foot_l: { f: 0.15 },
      thigh_r: { f: 1.3, s: 0.6, tw: -0.3 }, calf_r: { f: 2.0 }, foot_r: { f: 0.1, s: 0.1 }, ...GUARD },
    { t: 0.7, ease: 'io' },
  ]);

  // Axe kick (a finisher): the straight right leg swings up past the head, arms out for balance,
  // then the heel chops down through the target with the torso folding over it.
  const axe = make('Kick_Axe', [
    { t: 0.12, ease: 'in',
      pelvis: { f: 0.08 }, thigh_l: { f: 0.2, s: -0.15 }, calf_l: { f: 0.45 }, thigh_r: { f: 0.45 }, calf_r: { f: 0.9 }, ...GUARD },
    { t: 0.3, ease: 'out',
      pelvis: { f: -0.12, tw: 0.2 }, spine_01: { f: -0.15 }, spine_02: { f: -0.2 }, neck_01: { f: 0.2 },
      thigh_l: { f: -0.05, s: -0.15 }, calf_l: { f: 0.2 }, foot_l: { f: 0.3 },
      thigh_r: { f: 2.65, s: 0.3 }, calf_r: { f: 0.12 }, foot_r: { f: -0.25 },
      upperarm_l: { f: 0.7, s: 0.7 }, lowerarm_l: { f: 1.0 }, upperarm_r: { f: 0.7, s: 0.8 }, lowerarm_r: { f: 1.0 } },
    { t: 0.44, ease: 'snap',
      pelvis: { f: 0.12, tw: 0.1 }, spine_01: { f: 0.2 }, spine_02: { f: 0.3 }, neck_01: { f: -0.05 },
      thigh_l: { f: 0.25, s: -0.15 }, calf_l: { f: 0.45 }, foot_l: { f: 0.05 },
      thigh_r: { f: 1.15, s: 0.05 }, calf_r: { f: 0.08 }, foot_r: { f: -0.45 },
      upperarm_l: { f: 0.5, s: 0.4 }, lowerarm_l: { f: 1.3 }, upperarm_r: { f: 0.5, s: 0.5 }, lowerarm_r: { f: 1.3 } },
    { t: 0.5, hold: true, ease: 'lin' },
    { t: 0.62, ease: 'io',
      pelvis: { f: 0.06, tw: 0 }, spine_01: { f: 0.05 }, spine_02: { f: 0.08 }, neck_01: { f: 0 },
      thigh_l: { f: 0.15, s: -0.15 }, calf_l: { f: 0.3 }, foot_l: { f: 0 }, thigh_r: { f: 0.5 }, calf_r: { f: 0.9 }, foot_r: { f: 0.2 }, ...GUARD },
    { t: 0.8, ease: 'io' },
  ]);

  // Low kick: a short, chopping roundhouse to the thigh, the support heel pivoting and the shin
  // swinging in flat just above the knee.
  const low = make('Kick_Low', [
    { t: 0.1, ease: 'in',
      pelvis: { f: 0.1, tw: -0.15 }, spine_02: { tw: -0.1 }, thigh_l: { f: 0.2, s: -0.15 }, calf_l: { f: 0.45 },
      thigh_r: { f: 0.2, s: 0.25, tw: 0.2 }, calf_r: { f: 0.8 }, foot_r: { f: 0.4 }, ...GUARD },
    { t: 0.28, ease: 'snap',
      pelvis: { f: 0.05, s: 0.15, tw: 1.0 }, spine_01: { tw: -0.25 }, spine_02: { s: 0.1, tw: -0.3 }, neck_01: { tw: -0.15 }, Head: { tw: -0.3 },
      thigh_l: { f: -0.1, s: -0.15, tw: 0.7 }, calf_l: { f: 0.35 }, foot_l: { f: 0.3 },
      thigh_r: { f: 0.15, s: 0.8, tw: 0.6 }, calf_r: { f: 0.15 }, foot_r: { f: 0.5 },
      upperarm_l: { f: 0.6, s: 0.6 }, lowerarm_l: { f: 1.2 }, upperarm_r: { f: 1.1, s: -0.05 }, lowerarm_r: { f: 1.4 } },
    { t: 0.33, hold: true, ease: 'lin' },
    { t: 0.45, ease: 'io',
      pelvis: { f: 0.05, s: 0.05, tw: 0.3 }, spine_01: { tw: -0.05 }, spine_02: { s: 0, tw: -0.08 }, neck_01: { tw: 0 }, Head: { tw: -0.05 },
      thigh_l: { f: 0.15, s: -0.15, tw: 0.2 }, calf_l: { f: 0.35 }, foot_l: { f: 0.1 },
      thigh_r: { f: 0.3, s: 0.3, tw: 0.2 }, calf_r: { f: 0.7 }, foot_r: { f: 0.2 }, ...GUARD },
    { t: 0.62, ease: 'io' },
  ]);

  return [uppercut, hook, elbow, backfist, hammer, side, axe, low];
}
