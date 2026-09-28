// Chain takedown clips authored in code on the shared skeleton, with the kicks' pose toolkit
// (poseAuthor.js: f = forward swing, s = sideways, tw = twist; +X is the character's left).
// Lengths and beats live in CHAIN_BEATS so the timelines and the clips can't drift apart.
import { sampleRest, discoverFrames, compileClip } from './poseAuthor.js';
import { CHAIN_BEATS } from '../combat/chainTimeline.js';

export const CHAIN_CLIPS = ['Chain_GrabHeads', 'Chain_Yank', 'Chain_Stomp'];

export function buildChainClips(model, clips, fwd = 1) {
  const rest = sampleRest(model, clips.get('Idle_Loop'), 0);
  const frames = discoverFrames(model, fwd);
  const make = (name, keys, plant = null) => compileClip(name, CHAIN_BEATS[name].duration, keys, { model, frames, rest, plant });
  const G = CHAIN_BEATS.Chain_GrabHeads;

  // Headbanger: arms fling out wide to both heads, close on them at the grab beat, pull apart a
  // touch, then drive both hands together in front of the chest for the smash.
  const grab = make('Chain_GrabHeads', [
    { t: 0.1, ease: 'out', spine_02: { f: -0.08 },
      upperarm_l: { f: 0.25, s: 1.9 }, lowerarm_l: { f: 0.1 }, upperarm_r: { f: 0.25, s: 1.9 }, lowerarm_r: { f: 0.1 } },
    { t: G.grab, ease: 'io',
      upperarm_l: { f: 0.45, s: 1.9 }, lowerarm_l: { f: 0.1 }, upperarm_r: { f: 0.45, s: 1.9 }, lowerarm_r: { f: 0.1 } },
    { t: 0.3, ease: 'in', spine_02: { f: -0.12 },
      upperarm_l: { f: 0.5, s: 1.45 }, lowerarm_l: { f: 0.35 }, upperarm_r: { f: 0.5, s: 1.45 }, lowerarm_r: { f: 0.35 } },
    { t: G.contact, ease: 'snap', spine_02: { f: 0.22 }, neck_01: { f: 0.1 },
      upperarm_l: { f: 1.5, s: 0 }, lowerarm_l: { f: 1.25 }, upperarm_r: { f: 1.5, s: 0 }, lowerarm_r: { f: 1.25 } },
    { t: G.contact + 0.08, hold: true, ease: 'lin' },
    { t: G.duration, ease: 'io' },
  ], 'ball_l');

  // Rope-a-Dope: both hands reach forward together to grip one line, then a two-handed heave
  // rips them back past the hips with the torso leaning away, braced on a wide planted stance
  // (left foot back, right foot forward) so nothing lifts off the ground. No single-foot plant:
  // the stance is authored on both legs against a fixed pelvis so it can't clip through the floor.
  const Y = CHAIN_BEATS.Chain_Yank;
  const yank = make('Chain_Yank', [
    { t: 0.08, ease: 'out', spine_02: { f: 0.15 },
      upperarm_l: { f: 1.25, s: -0.05 }, lowerarm_l: { f: 0.25 }, upperarm_r: { f: 1.25, s: -0.05 }, lowerarm_r: { f: 0.25 },
      thigh_l: { f: 0.18 }, calf_l: { f: 0.32 }, thigh_r: { f: 0.38 }, calf_r: { f: 0.4 } },
    { t: Y.contact, ease: 'snap', pelvis: { f: -0.08 }, spine_01: { f: -0.15 }, spine_02: { f: -0.28 }, neck_01: { f: 0.2 },
      upperarm_l: { f: -0.35, s: 0.15 }, lowerarm_l: { f: 1.4 }, upperarm_r: { f: -0.35, s: 0.15 }, lowerarm_r: { f: 1.4 },
      thigh_l: { f: 0.4 }, calf_l: { f: 0.62 }, thigh_r: { f: 0.22 }, calf_r: { f: 0.32 } },
    { t: Y.contact + 0.1, hold: true, ease: 'lin' },
    { t: Y.duration, ease: 'io' },
  ]);

  // Domino Drop: knees tucked to the chest in the air (anticipation), then the left leg drives
  // straight down heel-first onto the head below while the right knee stays cocked up high and
  // the torso hunches over the strike, then a small bounce back up (the chain carries on to the
  // next goon, not a return to standing). Airborne, so nothing planted.
  const S = CHAIN_BEATS.Chain_Stomp;
  const stomp = make('Chain_Stomp', [
    { t: 0.07, ease: 'out', spine_02: { f: 0.25 },
      thigh_l: { f: 1.7 }, calf_l: { f: 2.1 }, thigh_r: { f: 1.6 }, calf_r: { f: 2.0 },
      upperarm_l: { f: 0.4, s: 1.2 }, lowerarm_l: { f: 0.6 }, upperarm_r: { f: 0.4, s: 1.2 }, lowerarm_r: { f: 0.6 } },
    { t: S.contact, ease: 'snap', spine_02: { f: 0.55 }, neck_01: { f: 0.2 },
      thigh_l: { f: 0.02 }, calf_l: { f: -0.05 }, foot_l: { f: -0.45 },
      thigh_r: { f: 0.8 }, calf_r: { f: 1.15 }, foot_r: { f: 0.15 },
      upperarm_l: { f: 0.95, s: 0.15 }, lowerarm_l: { f: 1.45 }, upperarm_r: { f: 0.85, s: -0.2 }, lowerarm_r: { f: 1.5 } },
    { t: S.contact + 0.04, hold: true, ease: 'lin' },
    { t: 0.26, ease: 'out', spine_02: { f: 0.35 },
      thigh_l: { f: 0.75 }, calf_l: { f: 1.0 }, foot_l: { f: 0.1 },
      thigh_r: { f: 1.15 }, calf_r: { f: 1.55 },
      upperarm_l: { f: 0.6, s: 0.5 }, lowerarm_l: { f: 0.9 }, upperarm_r: { f: 0.55, s: -0.1 }, lowerarm_r: { f: 0.9 } },
    { t: 0.36, ease: 'io', thigh_l: { f: 0.4 }, calf_l: { f: 0.6 }, thigh_r: { f: 0.6 }, calf_r: { f: 0.8 } },
    { t: S.duration, ease: 'io' },
  ]);

  return [grab, yank, stomp];
}
