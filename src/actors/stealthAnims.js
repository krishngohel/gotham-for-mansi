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
// How far behind the goon Batman snaps for the silent takedown (Task 10's createSilentTakedown
// places him here). Pulled in from 0.55m so the choke's reach across the goon's shoulder doesn't
// have to stretch the arm past what reads as a held grip.
export const CHOKE_OFFSET = 0.42;
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
  // Aiming: stock in the right shoulder, cheek down, left arm out along the barrel. The rifle is
  // rigidly attached to hand_r in its bind pose (barrel along the bind pose's own forward axis;
  // Task 6, characters.js), and hand_r itself is never keyed, so the barrel's world direction comes
  // entirely from the accumulated spine/clavicle/upperarm/lowerarm rotation up to hand_r: the twist
  // terms here are load-bearing (they roll the barrel level and forward), not stylistic.
  const AIM = {
    spine_02: { tw: -0.6 }, neck_01: { tw: -0.35, f: 0.15 },
    clavicle_r: { f: -0.1 }, upperarm_r: { f: 0.3, s: 0.9, tw: 0.3 }, lowerarm_r: { f: 0.5, tw: -1.3 },
    upperarm_l: { f: 1.5, s: -0.15 }, lowerarm_l: { f: 0.4 },
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

  // Batman's choke: from directly behind (CHOKE_OFFSET back, same yaw as the goon), the right arm
  // reaches forward over the goon's shoulder and across its throat, the left hand comes in to grip
  // that wrist, then a slight lean back to lift. A wide, braced two-footed stance throughout (no
  // stepping leg, no raised knee) with the left foot's ball kept from sliding.
  const LOCK = {
    clavicle_r: { f: 1.6 }, upperarm_r: { f: 1.35, s: -0.3 }, lowerarm_r: { f: 0.9 },
    clavicle_l: { f: 1.3 }, upperarm_l: { f: 0.75, s: -0.5 }, lowerarm_l: { f: 1.85 },
  };
  const choke = make('Takedown_Choke', STEALTH_BEATS.Takedown_Choke.duration, [
    { t: 0.15, ease: 'out', spine_02: { f: 0.1 },
      upperarm_r: { f: 1.3, s: -0.2 }, lowerarm_r: { f: 1.9 }, upperarm_l: { f: 1.2, s: -0.1 }, lowerarm_l: { f: 1.7 },
      thigh_l: { f: 0.3 }, calf_l: { f: 0.4 }, thigh_r: { f: 0.3 }, calf_r: { f: 0.4 } },
    { t: 0.35, ease: 'io', spine_02: { f: -0.06 }, neck_01: { f: 0.1 }, ...LOCK,
      thigh_l: { f: 0.32 }, calf_l: { f: 0.42 }, thigh_r: { f: 0.32 }, calf_r: { f: 0.42 } },
    { t: 0.75, ease: 'io', spine_02: { f: -0.1, s: 0.04 }, neck_01: { f: 0.1 }, ...LOCK,
      thigh_l: { f: 0.32 }, calf_l: { f: 0.42 }, thigh_r: { f: 0.32 }, calf_r: { f: 0.42 } },
    { t: 1.25, ease: 'io', spine_02: { f: -0.1, s: -0.04 }, neck_01: { f: 0.1 }, ...LOCK,
      thigh_l: { f: 0.34 }, calf_l: { f: 0.44 }, thigh_r: { f: 0.34 }, calf_r: { f: 0.44 } },
    { t: 1.5, ease: 'io', spine_02: { f: -0.05 }, neck_01: { f: 0.1 }, ...LOCK,
      thigh_l: { f: 0.4 }, calf_l: { f: 0.5 }, thigh_r: { f: 0.4 }, calf_r: { f: 0.5 } },
    { t: 1.8, ease: 'io', spine_02: { f: 0.2 }, ...LOCK,
      thigh_l: { f: 0.65 }, calf_l: { f: 0.95 }, thigh_r: { f: 0.65 }, calf_r: { f: 0.95 } },
    { t: STEALTH_BEATS.Takedown_Choke.duration, ease: 'io' },
  ], 'ball_l');

  // The goon: hands up to the arm at its throat, kicking and twisting, then the knees go together
  // and it sags, supported by Batman. Both feet stay under it the whole time (symmetric knee bend,
  // left ball kept from sliding) so it never reads as a floating squat. It ends slumped (held), and
  // the knockout clip takes over from there.
  const choked = make('Choked', STEALTH_BEATS.Choked.duration, [
    { t: 0.15, ease: 'out', spine_02: { f: -0.2 }, neck_01: { f: -0.3 },
      upperarm_l: { f: 1.1, s: 0.3 }, lowerarm_l: { f: 2.0 }, upperarm_r: { f: 1.1, s: 0.3 }, lowerarm_r: { f: 2.0 },
      thigh_l: { f: 0.15 }, calf_l: { f: 0.2 }, thigh_r: { f: 0.15 }, calf_r: { f: 0.2 } },
    { t: 0.55, ease: 'io', spine_02: { f: -0.24, s: 0.06 }, neck_01: { f: -0.32 },
      upperarm_l: { f: 1.2, s: 0.25 }, lowerarm_l: { f: 2.1 }, upperarm_r: { f: 1.0, s: 0.35 }, lowerarm_r: { f: 1.9 },
      thigh_l: { f: 0.32 }, calf_l: { f: 0.42 }, thigh_r: { f: 0.32 }, calf_r: { f: 0.42 } },
    { t: 1.35, ease: 'io', spine_02: { f: -0.22, s: -0.06 }, neck_01: { f: -0.3 },
      upperarm_l: { f: 1.0, s: 0.35 }, lowerarm_l: { f: 1.9 }, upperarm_r: { f: 1.2, s: 0.25 }, lowerarm_r: { f: 2.1 },
      thigh_l: { f: 0.34 }, calf_l: { f: 0.44 }, thigh_r: { f: 0.34 }, calf_r: { f: 0.44 } },
    { t: 1.85, ease: 'in', spine_02: { f: 0.1 }, neck_01: { f: 0.3 },
      upperarm_l: { f: 0.4, s: 0.25 }, lowerarm_l: { f: 0.5 }, upperarm_r: { f: 0.4, s: 0.25 }, lowerarm_r: { f: 0.5 },
      thigh_l: { f: 0.9 }, calf_l: { f: 1.35 }, thigh_r: { f: 0.9 }, calf_r: { f: 1.35 } },
    { t: STEALTH_BEATS.Choked.duration, hold: true, ease: 'lin' },
  ], 'ball_l');

  return [rifleIdle, rifleWalk, rifleAim, rifleSearch, choke, choked];
}
