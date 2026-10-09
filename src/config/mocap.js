// Motion-capture clips retargeted onto the game skeleton by scripts/retarget-mocap.mjs and
// shipped in public/assets/anims_mocap.glb. A clip listed here replaces the code-authored
// clip of the same name (game.js only fills names that are missing). Durations, contact
// frames, limb reach and root motion live in the generated mocapData.js.
import { MOCAP_DATA } from './mocapData.js';

export const MOCAP_CLIPS = Object.keys(MOCAP_DATA);

// Playback speed per clip and where in the clip playback starts (clip seconds), so the long
// mocap wind-ups are skipped and the contact frame arrives quickly in freeflow.
// The Mixamo strikes (scripts/mixamo-fetch.mjs) keep about 0.15 to 0.25 s of wind-up so the blow
// reads, and land 0.15 to 0.2 s after the press (punches), 0.2 to 0.3 s (kicks), a little
// longer for the finishers.
export const MOCAP_SPEED = {
  Kick_Front: 1.5, Kick_Round: 1.6, Kick_Spin: 1.25, Kick_Flying: 1.2, Knee_Strike: 1.8,
  Punch_Jab: 1.3, Punch_Cross: 1.3, Punch_Hook_L: 1.25, Punch_Uppercut: 1.3, Elbow_Strike: 1.3, Melee_Hook: 1.25,
  Kick_Side: 1.3, Kick_Low: 1.3, Kick_Axe: 1.2, Kick_Flip: 1.35,
};
export const MOCAP_START = {
  Kick_Front: 0.25, Kick_Round: 0.5, Kick_Spin: 0.1, Kick_Flying: 0.05, Knee_Strike: 0.25,
  Punch_Jab: 0.2, Punch_Cross: 0.28, Punch_Hook_L: 0.12, Punch_Uppercut: 0.22, Elbow_Strike: 0.38, Melee_Hook: 0.3,
  Kick_Side: 0.3, Kick_Low: 0.22, Kick_Axe: 0.22, Kick_Flip: 0.35,
};

// Kept for the assets test and combat: duration and contact per clip.
export const MOCAP_BEATS = Object.fromEntries(Object.entries(MOCAP_DATA).map(([k, v]) => [k, { duration: v.duration, contact: v.contact }]));
