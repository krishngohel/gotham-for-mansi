// Stealth clips authored in code on the shared skeleton with the kicks' pose toolkit
// (poseAuthor.js: f = forward swing, s = sideways, tw = twist; +X is the character's left).
// The rifle idle and walk only change the arms: they are laid over the stock idle and walk, so
// the legs keep their motion capture. The aim, the search and both halves of the choke are
// whole-body clips.
import * as THREE from 'three';
import { sampleRest, discoverFrames, compileClip } from './poseAuthor.js';

export const STEALTH_CLIPS = ['Rifle_Idle', 'Rifle_Walk', 'Rifle_Aim', 'Rifle_Search', 'Takedown_Choke', 'Choked'];
export const STEALTH_BEATS = {
  Rifle_Aim: { duration: 1 },
  Rifle_Search: { duration: 3 },
  Takedown_Choke: { duration: 2 }, // matches STEALTH.silentTime
  Choked: { duration: 2 },
};
const ARMS = ['clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r'];
const boneOf = (t) => t.name.slice(0, t.name.lastIndexOf('.'));

// `base` with the rotations of `bones` taken from `top` instead (same length as base).
export function overlayClip(name, base, top, bones) {
  const set = new Set(bones);
  const keep = base.tracks.filter((t) => !set.has(boneOf(t)));
  const add = top.tracks.filter((t) => set.has(boneOf(t)) && t.name.endsWith('.quaternion'));
  return new THREE.AnimationClip(name, base.duration, [...keep, ...add]);
}

export function buildStealthClips(model, clips, fwd = 1) {
  const rest = sampleRest(model, clips.get('Idle_Loop'), 0);
  const frames = discoverFrames(model, fwd);
  const make = (name, duration, keys, plant = null) => compileClip(name, duration, keys, { model, frames, rest, plant });

  // Port arms: rifle across the body, right hand on the grip at the hip, left hand forward under the barrel.
  const HOLD = {
    upperarm_r: { f: 0.35, s: 0.2 }, lowerarm_r: { f: 1.35 },
    upperarm_l: { f: 0.95, s: -0.45 }, lowerarm_l: { f: 0.55 },
  };
  // Aiming: stock in the right shoulder, cheek down, left arm out along the barrel.
  const AIM = {
    spine_02: { tw: 0.25 }, neck_01: { tw: -0.2, f: 0.1 },
    upperarm_r: { f: 1.05, s: 0.55 }, lowerarm_r: { f: 1.6 },
    upperarm_l: { f: 1.35, s: -0.35 }, lowerarm_l: { f: 0.35 },
  };
  const walk = clips.get('Walk_Loop'), idle = clips.get('Idle_Loop');
  const hold = (dur) => make('hold', dur, [{ t: 0, ...HOLD }, { t: dur, ...HOLD }]);
  const rifleIdle = overlayClip('Rifle_Idle', idle, hold(idle.duration), ARMS);
  const rifleWalk = overlayClip('Rifle_Walk', walk, hold(walk.duration), ARMS);

  const aimDur = STEALTH_BEATS.Rifle_Aim.duration;
  const rifleAim = make('Rifle_Aim', aimDur, [{ t: 0, ...AIM }, { t: aimDur, ...AIM }]);

  // Search: rifle held, torso and head turning left, then right, then back.
  const searchDur = STEALTH_BEATS.Rifle_Search.duration;
  const rifleSearch = make('Rifle_Search', searchDur, [
    { t: 0, ...HOLD },
    { t: 0.75, ease: 'io', ...HOLD, spine_02: { tw: 0.45 }, neck_01: { tw: 0.3 } },
    { t: 2.25, ease: 'io', ...HOLD, spine_02: { tw: -0.45 }, neck_01: { tw: -0.3 } },
    { t: searchDur, ease: 'io', ...HOLD },
  ]);

  // Batman's choke: step in, lock the arm round the neck, lean back and squeeze, rock, then lower
  // the goon and let go. The left foot stays planted.
  const LOCK = {
    clavicle_r: { f: 1.3 }, upperarm_r: { f: 1.25, s: -0.35 }, lowerarm_r: { f: 2.1 },
    clavicle_l: { f: 1.3 }, upperarm_l: { f: 1.1, s: -0.3 }, lowerarm_l: { f: 1.9 },
  };
  const choke = make('Takedown_Choke', STEALTH_BEATS.Takedown_Choke.duration, [
    { t: 0.15, ease: 'out', spine_02: { f: 0.1 },
      upperarm_r: { f: 1.3, s: -0.2 }, lowerarm_r: { f: 1.9 }, upperarm_l: { f: 1.2, s: -0.1 }, lowerarm_l: { f: 1.7 },
      thigh_l: { f: 0.35 }, calf_l: { f: 0.5 }, thigh_r: { f: 0.1 }, calf_r: { f: 0.3 } },
    { t: 0.35, ease: 'io', spine_02: { f: -0.14 }, neck_01: { f: 0.1 }, ...LOCK,
      thigh_l: { f: 0.45 }, calf_l: { f: 0.7 }, thigh_r: { f: 0.15 }, calf_r: { f: 0.4 } },
    { t: 1.0, ease: 'io', spine_02: { f: -0.1, s: 0.06 }, neck_01: { f: 0.1 }, ...LOCK,
      thigh_l: { f: 0.45 }, calf_l: { f: 0.7 }, thigh_r: { f: 0.15 }, calf_r: { f: 0.4 } },
    { t: 1.5, ease: 'io', spine_02: { f: -0.06, s: -0.06 }, neck_01: { f: 0.1 }, ...LOCK,
      thigh_l: { f: 0.5 }, calf_l: { f: 0.8 }, thigh_r: { f: 0.2 }, calf_r: { f: 0.5 } },
    { t: 1.8, ease: 'io', spine_02: { f: 0.25 }, ...LOCK,
      thigh_l: { f: 0.9 }, calf_l: { f: 1.3 }, thigh_r: { f: 0.6 }, calf_r: { f: 1.1 } },
    { t: STEALTH_BEATS.Takedown_Choke.duration, ease: 'io' },
  ], 'ball_l');

  // The goon: hands up to the arm at its throat, kicking and twisting, then the knees go and it
  // slumps. It ends slumped (held), and the knockout clip takes over from there.
  const choked = make('Choked', STEALTH_BEATS.Choked.duration, [
    { t: 0.15, ease: 'out', spine_02: { f: -0.2 }, neck_01: { f: -0.3 },
      upperarm_l: { f: 1.1, s: 0.3 }, lowerarm_l: { f: 2.0 }, upperarm_r: { f: 1.1, s: 0.3 }, lowerarm_r: { f: 2.0 } },
    { t: 0.7, ease: 'io', spine_02: { f: -0.25, s: 0.1 }, neck_01: { f: -0.35 },
      upperarm_l: { f: 1.2, s: 0.25 }, lowerarm_l: { f: 2.1 }, upperarm_r: { f: 1.0, s: 0.35 }, lowerarm_r: { f: 1.9 },
      thigh_l: { f: 0.3 }, calf_l: { f: 0.5 }, thigh_r: { f: 0.2 }, calf_r: { f: 0.4 } },
    { t: 1.3, ease: 'io', spine_02: { f: -0.2, s: -0.1 }, neck_01: { f: -0.3 },
      upperarm_l: { f: 1.0, s: 0.35 }, lowerarm_l: { f: 1.9 }, upperarm_r: { f: 1.2, s: 0.25 }, lowerarm_r: { f: 2.1 },
      thigh_l: { f: 0.6 }, calf_l: { f: 1.0 }, thigh_r: { f: 0.5 }, calf_r: { f: 0.9 } },
    { t: 1.85, ease: 'in', spine_02: { f: 0.2 }, neck_01: { f: 0.4 },
      upperarm_l: { f: 0.3, s: 0.2 }, lowerarm_l: { f: 0.4 }, upperarm_r: { f: 0.3, s: 0.2 }, lowerarm_r: { f: 0.4 },
      thigh_l: { f: 1.2 }, calf_l: { f: 1.9 }, thigh_r: { f: 1.1 }, calf_r: { f: 1.8 } },
    { t: STEALTH_BEATS.Choked.duration, hold: true, ease: 'lin' },
  ], 'ball_l');

  return [rifleIdle, rifleWalk, rifleAim, rifleSearch, choke, choked];
}
