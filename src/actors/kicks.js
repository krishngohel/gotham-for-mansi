// Kick animations authored in code on the shared skeleton (see poseAuthor.js for the frame
// conventions: f = forward swing, s = sideways, tw = twist; positive twist turns the torso
// and head left and rotates limbs outward). Every kick is a rear-leg (right) technique from
// the idle stance, which already has the left foot forward. The left ball is pinned so the
// support leg's bend and heel pivot come from the hips moving, not the foot sliding.
//
// Beats per kick: anticipation (weight onto the support leg, hips wind), chamber (knee up),
// snap (fast extension into contact), impact hold, recoil (rechamber) and recovery to idle.
import { sampleRest, discoverFrames, compileClip } from './poseAuthor.js';

// Contact frame per clip in clip seconds (combatSystem divides by playback speed).
export const KICK_BEATS = {
  Kick_Front: { duration: 0.66, contact: 0.29 },
  Kick_Round: { duration: 0.74, contact: 0.36 },
  Kick_Side: { duration: 0.7, contact: 0.33 },
  Kick_Spin: { duration: 0.9, contact: 0.5 },
  Kick_Flying: { duration: 0.7, contact: 0.3 },
  Knee_Strike: { duration: 0.5, contact: 0.2 },
};

// Guard: fists up in front of the chin, elbows in.
const GUARD_L = { upperarm_l: { f: 0.9, s: -0.1 }, lowerarm_l: { f: 1.3 } };
const GUARD_R = { upperarm_r: { f: 0.9, s: -0.1 }, lowerarm_r: { f: 1.3 } };

export function buildKickClips(model, clips, fwd = 1) {
  const rest = sampleRest(model, clips.get('Idle_Loop'), 0);
  const frames = discoverFrames(model, fwd);
  const make = (name, keys, plant = 'ball_l') => compileClip(name, KICK_BEATS[name].duration, keys, { model, frames, rest, plant });

  // 1. Front snap kick to the chest: knee chambers high, the shin snaps out, hips drive
  // through, the support heel lifts at contact for reach, torso leans back off the strike.
  const front = make('Kick_Front', [
    { t: 0.1, ease: 'in',
      pelvis: { f: 0.12, tw: -0.1 }, spine_02: { f: 0.1, tw: -0.15 }, thigh_l: { f: 0.2, s: -0.15 }, calf_l: { f: 0.4 },
      thigh_r: { f: 0.35 }, calf_r: { f: 1.0 }, foot_r: { f: 0.5 }, ...GUARD_L, ...GUARD_R },
    { t: 0.2, ease: 'out',
      pelvis: { f: 0.05, tw: 0.15 }, spine_01: { f: -0.05 }, spine_02: { f: -0.1, tw: -0.2 }, neck_01: { f: 0.1 },
      thigh_l: { f: 0.15, s: -0.25 }, calf_l: { f: 0.35 },
      thigh_r: { f: 1.9, s: -0.05 }, calf_r: { f: 2.3 }, foot_r: { f: 0.6 },
      upperarm_l: { f: 1.0, s: 0.0 }, lowerarm_l: { f: 1.4 }, upperarm_r: { f: 0.6, s: 0.1 }, lowerarm_r: { f: 1.5 } },
    { t: 0.29, ease: 'snap',
      pelvis: { f: -0.05, tw: 0.3 }, spine_01: { f: -0.2, tw: -0.15 }, spine_02: { f: -0.25, tw: -0.2 }, neck_01: { f: 0.25 }, Head: { f: 0.1 },
      thigh_l: { f: 0.0, s: -0.25 }, calf_l: { f: 0.15 }, foot_l: { f: 0.3 },
      thigh_r: { f: 1.8, s: -0.1 }, calf_r: { f: 0.12 }, foot_r: { f: -0.35 },
      upperarm_l: { f: 1.1, s: 0.1 }, lowerarm_l: { f: 1.2 }, upperarm_r: { f: 0.1, s: 0.25 }, lowerarm_r: { f: 1.7 } },
    { t: 0.35, hold: true, ease: 'lin' },
    { t: 0.46, ease: 'io',
      pelvis: { f: 0.08, tw: 0.15 }, spine_01: { f: 0 }, spine_02: { f: 0 }, neck_01: { f: 0.05 }, Head: { f: 0 },
      thigh_l: { f: 0.15, s: -0.2 }, calf_l: { f: 0.35 }, foot_l: { f: 0.05 },
      thigh_r: { f: 1.2 }, calf_r: { f: 1.8 }, foot_r: { f: 0.4 }, ...GUARD_L, ...GUARD_R },
    { t: 0.66, ease: 'io' },
  ]);

  // 2. Roundhouse to the head: the support heel pivots as the hips turn over, the knee leads
  // out and around, the shin whips across with the torso counter-leaning away from it.
  const round = make('Kick_Round', [
    { t: 0.12, ease: 'in',
      pelvis: { f: 0.1, tw: -0.2 }, spine_02: { tw: -0.15 }, thigh_l: { f: 0.2, s: -0.15 }, calf_l: { f: 0.45 },
      thigh_r: { f: 0.3, s: 0.35, tw: 0.2 }, calf_r: { f: 1.1 }, foot_r: { f: 0.5 }, ...GUARD_L, ...GUARD_R },
    { t: 0.25, ease: 'out',
      pelvis: { f: 0.0, s: 0.2, tw: 0.6 }, spine_01: { s: 0.1, tw: -0.2 }, spine_02: { s: 0.15, tw: -0.25 }, neck_01: { tw: -0.1 }, Head: { tw: -0.2 },
      thigh_l: { f: -0.1, s: -0.2, tw: 0.45 }, calf_l: { f: 0.4 }, foot_l: { f: 0.15 },
      thigh_r: { f: 0.9, s: 1.2, tw: 0.5 }, calf_r: { f: 2.1 }, foot_r: { f: 0.6 },
      upperarm_l: { f: 0.8, s: 0.5 }, lowerarm_l: { f: 1.2 }, upperarm_r: { f: 1.0, s: 0.3 }, lowerarm_r: { f: 1.3 } },
    { t: 0.36, ease: 'snap',
      pelvis: { f: -0.05, s: 0.3, tw: 1.2 }, spine_01: { s: 0.15, tw: -0.3 }, spine_02: { s: 0.2, tw: -0.35 }, spine_03: { tw: -0.15 }, neck_01: { s: -0.15, tw: -0.2 }, Head: { tw: -0.35 },
      thigh_l: { f: -0.25, s: -0.15, tw: 0.9 }, calf_l: { f: 0.3 }, foot_l: { f: 0.35 },
      thigh_r: { f: 0.55, s: 1.55, tw: 0.7 }, calf_r: { f: 0.15 }, foot_r: { f: 0.55 },
      upperarm_l: { f: 0.5, s: 0.9 }, lowerarm_l: { f: 0.9 }, upperarm_r: { f: 1.3, s: -0.1, tw: 0.3 }, lowerarm_r: { f: 1.5 } },
    { t: 0.42, hold: true, ease: 'lin' },
    { t: 0.54, ease: 'io',
      pelvis: { f: 0.05, s: 0.2, tw: 0.8 }, spine_01: { s: 0.1, tw: -0.2 }, spine_02: { s: 0.15, tw: -0.2 }, spine_03: { tw: -0.05 }, neck_01: { s: 0, tw: -0.1 }, Head: { tw: -0.2 },
      thigh_l: { f: 0.0, s: -0.2, tw: 0.6 }, calf_l: { f: 0.45 }, foot_l: { f: 0.15 },
      thigh_r: { f: 0.8, s: 1.0, tw: 0.5 }, calf_r: { f: 1.9 }, foot_r: { f: 0.5 }, ...GUARD_L, ...GUARD_R },
    { t: 0.74, ease: 'io' },
  ]);

  // 3. Side kick: the hips turn side-on, the knee chambers across the body, then the heel
  // drives out with the foot blade horizontal; the head keeps the target over the shoulder.
  const side = make('Kick_Side', [
    { t: 0.12, ease: 'in',
      pelvis: { f: 0.12, tw: 0.3 }, spine_02: { f: 0.05, tw: -0.2 }, Head: { tw: -0.1 }, thigh_l: { f: 0.25, s: -0.15 }, calf_l: { f: 0.5 },
      thigh_r: { f: 0.6, s: 0.1, tw: -0.1 }, calf_r: { f: 1.3 }, foot_r: { f: 0.4 }, ...GUARD_L, ...GUARD_R },
    { t: 0.24, ease: 'out',
      pelvis: { f: 0.05, s: 0.2, tw: 1.0 }, spine_01: { s: 0.15, tw: -0.3 }, spine_02: { s: 0.2, tw: -0.35 }, spine_03: { tw: -0.1 }, neck_01: { tw: -0.25 }, Head: { tw: -0.45 },
      thigh_l: { f: 0.1, s: -0.2, tw: 0.5 }, calf_l: { f: 0.45 }, foot_l: { f: 0.15 },
      thigh_r: { f: 1.5, s: 0.7, tw: -0.4 }, calf_r: { f: 2.2 }, foot_r: { f: -0.3, s: 0.3 },
      upperarm_l: { f: 0.7, s: 0.6 }, lowerarm_l: { f: 1.3 }, upperarm_r: { f: 1.1, s: 0.2 }, lowerarm_r: { f: 1.5 } },
    { t: 0.33, ease: 'snap',
      pelvis: { f: -0.05, s: 0.3, tw: 1.35 }, spine_01: { s: 0.2, tw: -0.35 }, spine_02: { s: 0.25, tw: -0.4 }, spine_03: { tw: -0.15 }, neck_01: { s: -0.15, tw: -0.3 }, Head: { tw: -0.5 },
      thigh_l: { f: -0.2, s: -0.2, tw: 0.8 }, calf_l: { f: 0.25 }, foot_l: { f: 0.35 },
      thigh_r: { f: 0.5, s: 1.3, tw: -0.55 }, calf_r: { f: 0.12 }, foot_r: { f: -0.35, s: 0.3 },
      upperarm_l: { f: 0.4, s: 1.0 }, lowerarm_l: { f: 0.8 }, upperarm_r: { f: 1.2, s: 0.0 }, lowerarm_r: { f: 1.6 } },
    { t: 0.39, hold: true, ease: 'lin' },
    { t: 0.51, ease: 'io',
      pelvis: { f: 0.05, s: 0.2, tw: 0.9 }, spine_01: { s: 0.15, tw: -0.25 }, spine_02: { s: 0.2, tw: -0.25 }, spine_03: { tw: -0.05 }, neck_01: { s: 0, tw: -0.15 }, Head: { tw: -0.3 },
      thigh_l: { f: 0.1, s: -0.2, tw: 0.5 }, calf_l: { f: 0.45 }, foot_l: { f: 0.15 },
      thigh_r: { f: 1.3, s: 0.6, tw: -0.3 }, calf_r: { f: 2.0 }, foot_r: { f: 0.1, s: 0.1 }, ...GUARD_L, ...GUARD_R },
    { t: 0.7, ease: 'io' },
  ]);

  // 4. Spinning heel kick: the whole turn is in the clip. The head leads the spin over the
  // right shoulder, the body pivots a full turn on the left ball, the right leg fires out
  // side-on at three quarters of the turn and the heel hooks through the target.
  const T = -Math.PI * 2;
  const spin = make('Kick_Spin', [
    { t: 0.1, ease: 'in',
      pelvis: { f: 0.12, tw: 0.2 }, spine_01: { tw: 0.1 }, spine_02: { tw: 0.15 }, thigh_l: { f: 0.25, s: -0.1 }, calf_l: { f: 0.5 },
      thigh_r: { f: 0.2, s: 0.1 }, calf_r: { f: 0.6 }, ...GUARD_L, ...GUARD_R },
    { t: 0.24, ease: 'in',
      pelvis: { f: 0.05, s: 0.1, tw: T * 0.25 }, spine_01: { tw: -0.25 }, spine_02: { tw: -0.35 }, spine_03: { tw: -0.15 }, neck_01: { tw: -0.4 }, Head: { tw: -0.6 },
      thigh_l: { f: -0.25, s: -0.3, tw: -0.2 }, calf_l: { f: 0.5 }, foot_l: { f: 0.2 },
      thigh_r: { f: 0.35, s: 0.4, tw: 0.2 }, calf_r: { f: 1.2 }, foot_r: { f: 0.5 },
      upperarm_l: { f: 0.6, s: 0.8 }, lowerarm_l: { f: 1.0 }, upperarm_r: { f: 0.8, s: 0.6 }, lowerarm_r: { f: 1.2 } },
    { t: 0.38, ease: 'lin',
      pelvis: { f: 0.0, s: 0.2, tw: T * 0.5 }, spine_01: { s: 0.1, tw: -0.3 }, spine_02: { s: 0.15, tw: -0.4 }, spine_03: { tw: -0.15 }, neck_01: { tw: -0.4 }, Head: { tw: -0.6 },
      thigh_l: { f: -0.3, s: -0.3, tw: -0.1 }, calf_l: { f: 0.45 }, foot_l: { f: 0.3 },
      thigh_r: { f: 0.9, s: 0.9, tw: 0.4 }, calf_r: { f: 2.0 }, foot_r: { f: 0.4 },
      upperarm_l: { f: 0.4, s: 1.1 }, lowerarm_l: { f: 0.7 }, upperarm_r: { f: 0.5, s: 1.1 }, lowerarm_r: { f: 0.8 } },
    { t: 0.5, ease: 'snap',
      pelvis: { f: -0.05, s: 0.35, tw: T * 0.75 }, spine_01: { s: 0.2, tw: -0.3 }, spine_02: { s: 0.25, tw: -0.3 }, spine_03: { tw: -0.1 }, neck_01: { s: -0.15, tw: -0.3 }, Head: { tw: -0.5 },
      thigh_l: { f: -0.3, s: -0.25, tw: 0 }, calf_l: { f: 0.3 }, foot_l: { f: 0.4 },
      thigh_r: { f: 0.3, s: 1.5, tw: 0.3 }, calf_r: { f: 0.2 }, foot_r: { f: -0.3 },
      upperarm_l: { f: 0.2, s: 1.2 }, lowerarm_l: { f: 0.6 }, upperarm_r: { f: 1.2, s: 0.3 }, lowerarm_r: { f: 1.4 } },
    { t: 0.56, ease: 'lin',
      pelvis: { f: -0.02, s: 0.25, tw: T * 0.875 }, spine_01: { s: 0.1, tw: -0.2 }, spine_02: { s: 0.15, tw: -0.2 }, spine_03: { tw: -0.05 }, neck_01: { s: -0.05, tw: -0.2 }, Head: { tw: -0.3 },
      thigh_l: { f: -0.2, s: -0.15, tw: 0 }, calf_l: { f: 0.35 }, foot_l: { f: 0.35 },
      thigh_r: { f: -0.3, s: 1.4, tw: 0.3 }, calf_r: { f: 0.9 }, foot_r: { f: -0.1 },
      upperarm_l: { f: 0.3, s: 1.1 }, lowerarm_l: { f: 0.7 }, upperarm_r: { f: 1.0, s: 0.4 }, lowerarm_r: { f: 1.3 } },
    { t: 0.68, ease: 'out',
      pelvis: { f: 0.08, s: 0.15, tw: T }, spine_01: { s: 0.05, tw: -0.05 }, spine_02: { s: 0.1, tw: -0.1 }, spine_03: { tw: 0 }, neck_01: { s: 0, tw: -0.05 }, Head: { tw: -0.1 },
      thigh_l: { f: 0.2, s: -0.15, tw: 0 }, calf_l: { f: 0.5 }, foot_l: { f: 0.15 },
      thigh_r: { f: 0.8, s: 0.5, tw: 0.3 }, calf_r: { f: 1.7 }, foot_r: { f: 0.3 }, ...GUARD_L, ...GUARD_R },
    { t: 0.9, ease: 'io', pelvis: { tw: T } },
  ]);

  // 5. Flying kick: a crouched launch, then the lead leg extends with the trailing leg tucked,
  // torso back and arms flung for the leap. No planted foot; the game moves the body.
  const flying = make('Kick_Flying', [
    { t: 0, ease: 'lin',
      pelvis: { f: 0.2 }, spine_02: { f: 0.3 }, neck_01: { f: -0.1 },
      thigh_l: { f: 0.9 }, calf_l: { f: 1.4 }, thigh_r: { f: 0.9 }, calf_r: { f: 1.4 },
      upperarm_l: { f: -0.5, s: 0.2 }, lowerarm_l: { f: 0.6 }, upperarm_r: { f: -0.5, s: 0.2 }, lowerarm_r: { f: 0.6 } },
    { t: 0.13, ease: 'out',
      pelvis: { f: 0.05, tw: 0.2 }, spine_02: { f: 0.0 }, neck_01: { f: 0 },
      thigh_l: { f: -0.2 }, calf_l: { f: 1.5 }, foot_l: { f: 0.6 }, thigh_r: { f: 1.8, s: 0.15 }, calf_r: { f: 2.2 }, foot_r: { f: 0.5 },
      upperarm_l: { f: 1.2, s: 0.5 }, lowerarm_l: { f: 0.9 }, upperarm_r: { f: 0.6, s: 0.7 }, lowerarm_r: { f: 1.0 } },
    { t: 0.3, ease: 'snap',
      pelvis: { f: -0.15, tw: 0.4 }, spine_01: { f: -0.2, tw: -0.2 }, spine_02: { f: -0.3, tw: -0.2 }, neck_01: { f: 0.3 }, Head: { f: 0.1 },
      thigh_l: { f: 0.5, s: 0.2 }, calf_l: { f: 2.3 }, foot_l: { f: 0.7 }, thigh_r: { f: 1.75, s: 0.0 }, calf_r: { f: 0.15 }, foot_r: { f: -0.35 },
      upperarm_l: { f: 1.3, s: 0.6 }, lowerarm_l: { f: 0.7 }, upperarm_r: { f: -0.4, s: 0.9 }, lowerarm_r: { f: 1.1 } },
    { t: 0.42, hold: true, ease: 'lin' },
    { t: 0.58, ease: 'io',
      pelvis: { f: 0.1, tw: 0.15 }, spine_01: { f: 0 }, spine_02: { f: 0.1 }, neck_01: { f: 0.05 }, Head: { f: 0 },
      thigh_l: { f: 0.5 }, calf_l: { f: 1.1 }, foot_l: { f: 0.2 }, thigh_r: { f: 0.7 }, calf_r: { f: 1.2 }, foot_r: { f: 0.2 },
      upperarm_l: { f: 0.6, s: 0.9 }, lowerarm_l: { f: 0.8 }, upperarm_r: { f: 0.6, s: 0.9 }, lowerarm_r: { f: 0.8 } },
    { t: 0.7, ease: 'out',
      pelvis: { f: 0.15 }, spine_02: { f: 0.2 },
      thigh_l: { f: 0.55 }, calf_l: { f: 0.9 }, thigh_r: { f: 0.55 }, calf_r: { f: 0.9 }, ...GUARD_L, ...GUARD_R },
  ], null);

  // 6. Knee strike: hands clinch and pull down while the hips drive the right knee up into
  // the body, torso crunching to meet it.
  const knee = make('Knee_Strike', [
    { t: 0.09, ease: 'in',
      pelvis: { f: -0.05, tw: -0.1 }, spine_02: { f: 0.1 }, thigh_l: { f: 0.2, s: -0.15 }, calf_l: { f: 0.4 },
      thigh_r: { f: 0.2 }, calf_r: { f: 0.8 }, foot_r: { f: 0.5 },
      upperarm_l: { f: 1.6, s: 0.2 }, lowerarm_l: { f: 1.1 }, upperarm_r: { f: 1.6, s: 0.2 }, lowerarm_r: { f: 1.1 } },
    { t: 0.2, ease: 'snap',
      pelvis: { f: 0.1, tw: 0.35 }, spine_01: { f: 0.2, tw: -0.15 }, spine_02: { f: 0.3, tw: -0.2 }, neck_01: { f: 0.25 },
      thigh_l: { f: 0.05, s: -0.25 }, calf_l: { f: 0.2 }, foot_l: { f: 0.35 },
      thigh_r: { f: 2.05, s: 0.05 }, calf_r: { f: 2.4 }, foot_r: { f: 0.7 },
      upperarm_l: { f: 0.7, s: 0.3 }, lowerarm_l: { f: 1.9 }, upperarm_r: { f: 0.7, s: 0.3 }, lowerarm_r: { f: 1.9 } },
    { t: 0.26, hold: true, ease: 'lin' },
    { t: 0.36, ease: 'io',
      pelvis: { f: 0.05, tw: 0.15 }, spine_01: { f: 0.05 }, spine_02: { f: 0.1 }, neck_01: { f: 0.1 },
      thigh_l: { f: 0.15, s: -0.2 }, calf_l: { f: 0.35 }, foot_l: { f: 0.1 },
      thigh_r: { f: 1.2 }, calf_r: { f: 1.7 }, foot_r: { f: 0.4 },
      upperarm_l: { f: 0.9, s: 0.1 }, lowerarm_l: { f: 1.4 }, upperarm_r: { f: 0.9, s: 0.1 }, lowerarm_r: { f: 1.4 } },
    { t: 0.5, ease: 'io' },
  ]);

  return [front, round, side, spin, flying, knee];
}
