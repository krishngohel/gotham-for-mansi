// Gadget poses and hit reactions, authored in code on the shared skeleton (poseAuthor, same
// conventions as kicks.js and strikes.js: f = forward swing, s = sideways, tw = twist). Every
// character uses the same skeleton, so the goons' reactions are built once and shared.
import { sampleRest, discoverFrames, compileClip } from './poseAuthor.js';

export const REACTION_CLIPS = {
  Gadget_Aim: 0.55,      // Batclaw and gel: launcher arm out straight, the other hand bracing it
  Gadget_Toss: 0.6,      // smoke pellet: a quick underhand flick at the floor ahead
  Hit_Head_Snap: 0.55,   // head and shoulders snapped back by a blow to the face, a step back
  Hit_Gut_Fold: 0.6,     // folded over a blow to the body, arms clutching
  Hit_Spin: 0.65,        // spun half round by a hook or a kick from the side
};

export function buildReactionClips(model, clips, fwd = 1) {
  const rest = sampleRest(model, clips.get('Idle_Loop'), 0);
  const frames = discoverFrames(model, fwd);
  const make = (name, keys, plant = null) => compileClip(name, REACTION_CLIPS[name], keys, { model, frames, rest, plant });
  const GUARD_L = { upperarm_l: { f: 0.9, s: -0.1 }, lowerarm_l: { f: 1.3 } };

  // Gadget aim: the right arm snaps out level, wrist cocked, the left hand coming up under the
  // forearm to steady it, the body turning side-on behind the shot and leaning in. A small
  // recoil kicks the arm up, then back to guard.
  const aim = make('Gadget_Aim', [
    { t: 0.09, ease: 'out',
      pelvis: { tw: 0.35 }, spine_02: { f: 0.08, tw: 0.25 }, neck_01: { tw: -0.25 }, Head: { tw: -0.3 },
      thigh_l: { f: 0.25, s: -0.1 }, calf_l: { f: 0.4 }, thigh_r: { f: -0.1, s: 0.1 }, calf_r: { f: 0.25 },
      upperarm_r: { f: 1.6, s: 0.1 }, lowerarm_r: { f: -0.7 }, hand_r: { f: 0.2 },
      upperarm_l: { f: 1.3, s: -0.55 }, lowerarm_l: { f: 1.5 } },
    { t: 0.2, hold: true, ease: 'lin' },
    { t: 0.26, ease: 'out', upperarm_r: { f: 1.9, s: 0.1 }, lowerarm_r: { f: -0.4 }, spine_02: { f: 0.0, tw: 0.25 } },
    { t: 0.42, ease: 'io',
      pelvis: { tw: 0.1 }, spine_02: { f: 0.03, tw: 0.05 }, neck_01: { tw: 0 }, Head: { tw: 0 },
      thigh_l: { f: 0.15, s: -0.1 }, calf_l: { f: 0.3 }, thigh_r: { f: 0, s: 0 }, calf_r: { f: 0.1 },
      upperarm_r: { f: 0.9, s: -0.1 }, lowerarm_r: { f: 1.3 }, hand_r: { f: 0 }, ...GUARD_L },
    { t: 0.55, ease: 'io' },
  ], 'ball_l');

  // Smoke pellet: a short crouch and an underhand flick of the right hand at the floor ahead.
  const toss = make('Gadget_Toss', [
    { t: 0.12, ease: 'in',
      pelvis: { f: 0.15 }, spine_02: { f: 0.25 }, thigh_l: { f: 0.45, s: -0.1 }, calf_l: { f: 0.8 }, thigh_r: { f: 0.35 }, calf_r: { f: 0.75 },
      upperarm_r: { f: -0.45, s: 0.25 }, lowerarm_r: { f: 0.6 }, ...GUARD_L },
    { t: 0.26, ease: 'snap',
      pelvis: { f: 0.05 }, spine_02: { f: 0.12 }, thigh_l: { f: 0.25, s: -0.1 }, calf_l: { f: 0.45 }, thigh_r: { f: 0.2 }, calf_r: { f: 0.45 },
      upperarm_r: { f: 0.95, s: 0.05 }, lowerarm_r: { f: -0.6 }, hand_r: { f: -0.4 } },
    { t: 0.4, ease: 'io',
      pelvis: { f: 0.04 }, spine_02: { f: 0.05 }, thigh_l: { f: 0.15, s: -0.1 }, calf_l: { f: 0.3 }, thigh_r: { f: 0.1 }, calf_r: { f: 0.25 },
      upperarm_r: { f: 0.9, s: -0.1 }, lowerarm_r: { f: 1.3 }, hand_r: { f: 0 } },
    { t: 0.6, ease: 'io' },
  ], 'ball_l');

  // Head snap: the chin flies up and the shoulders follow, arms thrown out, one stumbling step
  // back on the right foot, then he recovers his guard.
  const headSnap = make('Hit_Head_Snap', [
    { t: 0.06, ease: 'out',
      spine_01: { f: -0.25 }, spine_02: { f: -0.4 }, neck_01: { f: -0.45 }, Head: { f: -0.4, tw: 0.15 },
      upperarm_l: { f: 0.5, s: 0.7 }, lowerarm_l: { f: 0.6 }, upperarm_r: { f: 0.4, s: 0.8 }, lowerarm_r: { f: 0.5 },
      thigh_r: { f: -0.35 }, calf_r: { f: 0.3 }, thigh_l: { f: 0.2 }, calf_l: { f: 0.3 } },
    { t: 0.22, ease: 'io',
      spine_01: { f: -0.15 }, spine_02: { f: -0.22 }, neck_01: { f: -0.2 }, Head: { f: -0.15, tw: 0.1 },
      upperarm_l: { f: 0.6, s: 0.5 }, lowerarm_l: { f: 0.9 }, upperarm_r: { f: 0.55, s: 0.5 }, lowerarm_r: { f: 0.8 },
      thigh_r: { f: -0.2 }, calf_r: { f: 0.25 }, thigh_l: { f: 0.3 }, calf_l: { f: 0.5 } },
    { t: 0.55, ease: 'io' },
  ]);

  // Gut fold: doubled over a body blow, arms wrapping the stomach, knees buckling.
  const gutFold = make('Hit_Gut_Fold', [
    { t: 0.07, ease: 'out',
      pelvis: { f: -0.1 }, spine_01: { f: 0.45 }, spine_02: { f: 0.55 }, neck_01: { f: 0.25 }, Head: { f: 0.15 },
      upperarm_l: { f: 0.55, s: -0.35 }, lowerarm_l: { f: 1.9 }, upperarm_r: { f: 0.55, s: -0.35 }, lowerarm_r: { f: 1.9 },
      thigh_l: { f: 0.45 }, calf_l: { f: 0.8 }, thigh_r: { f: 0.35 }, calf_r: { f: 0.75 } },
    { t: 0.3, ease: 'io',
      pelvis: { f: -0.05 }, spine_01: { f: 0.3 }, spine_02: { f: 0.35 }, neck_01: { f: 0.15 }, Head: { f: 0.05 },
      thigh_l: { f: 0.3 }, calf_l: { f: 0.55 }, thigh_r: { f: 0.25 }, calf_r: { f: 0.5 } },
    { t: 0.6, ease: 'io' },
  ]);

  // Spin: the shoulders whipped round a quarter turn and the head with them, arms flung, then
  // he turns back to face the fight.
  const spin = make('Hit_Spin', [
    { t: 0.08, ease: 'out',
      pelvis: { tw: -0.5 }, spine_01: { tw: -0.35, s: 0.15 }, spine_02: { tw: -0.5, s: 0.2 }, neck_01: { tw: -0.35 }, Head: { tw: -0.4, s: 0.2 },
      upperarm_l: { f: 0.3, s: 1.1 }, lowerarm_l: { f: 0.4 }, upperarm_r: { f: 0.8, s: 0.3 }, lowerarm_r: { f: 1.1 },
      thigh_l: { f: 0.25, tw: -0.25 }, calf_l: { f: 0.45 }, thigh_r: { f: -0.15 }, calf_r: { f: 0.3 } },
    { t: 0.28, ease: 'io',
      pelvis: { tw: -0.3 }, spine_01: { tw: -0.2, s: 0.05 }, spine_02: { tw: -0.3, s: 0.1 }, neck_01: { tw: -0.15 }, Head: { tw: -0.2, s: 0.05 },
      upperarm_l: { f: 0.5, s: 0.6 }, lowerarm_l: { f: 0.9 } },
    { t: 0.65, ease: 'io' },
  ]);

  return [aim, toss, headSnap, gutFold, spin];
}
