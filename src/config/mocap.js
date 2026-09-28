// Motion-capture clips retargeted onto the game skeleton by scripts/retarget-mocap.mjs and
// shipped in public/assets/anims_mocap.glb. A clip listed here replaces the code-authored
// clip of the same name (game.js only fills names that are missing). Durations, contact
// frames, limb reach and root motion live in the generated mocapData.js.
import { MOCAP_DATA } from './mocapData.js';

export const MOCAP_CLIPS = Object.keys(MOCAP_DATA);

// Playback speed per clip and where in the clip playback starts (clip seconds), so the long
// mocap wind-ups are skipped and the contact frame arrives quickly in freeflow.
export const MOCAP_SPEED = { Kick_Front: 1.5, Kick_Round: 1.6, Kick_Spin: 1.25, Kick_Flying: 1.2, Knee_Strike: 1.8 };
export const MOCAP_START = { Kick_Front: 0.25, Kick_Round: 0.5, Kick_Spin: 0.1, Kick_Flying: 0.05, Knee_Strike: 0.25 };

// Kept for the assets test and combat: duration and contact per clip.
export const MOCAP_BEATS = Object.fromEntries(Object.entries(MOCAP_DATA).map(([k, v]) => [k, { duration: v.duration, contact: v.contact }]));
