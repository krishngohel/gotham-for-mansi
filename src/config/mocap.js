// Motion-capture clips retargeted onto the game skeleton by scripts/retarget-mocap.mjs and
// shipped in public/assets/anims_mocap.glb. A clip listed here replaces the code-authored
// clip of the same name (game.js only fills names that are missing).
export const MOCAP_CLIPS = ['Kick_Round'];

// Per clip: baked duration and the contact frame, in clip seconds (printed by the retarget
// script), plus the playback speed combat uses.
export const MOCAP_BEATS = {
  Kick_Round: { duration: 1.5, contact: 1.0 },
};
export const MOCAP_SPEED = { Kick_Round: 1.4 };
