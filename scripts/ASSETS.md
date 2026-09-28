# Rebuilding assets

`assets-src/` is not committed. To rebuild `public/assets/`:

1. Download the Standard zips (free, no account) from
   - https://quaternius.itch.io/universal-base-characters
   - https://quaternius.itch.io/universal-animation-library
   - https://quaternius.itch.io/universal-animation-library-2
2. Copy into `assets-src/`: everything in `Base Characters/Godot - UE/`, `Hairstyles/Origin at 0/glTF (Godot)/Hair_Long.*` and its textures, `UAL1_Standard.glb`, `UAL2_Standard.glb`. The male body references `T_Eye_Normal_png.png` and `T_Hair_1_Normal_png.png`, which the pack does not ship: copy `T_Eye_Normal.png` and `T_Hair_1_Normal.png` to those names.
3. `npm run assets`

## Mocap kicks

`public/assets/anims_mocap.glb` and the generated `src/config/mocapData.js` hold the five kick
clips (Kick_Front, Kick_Round, Kick_Spin, Kick_Flying, Knee_Strike). They come from motion
capture applied to the game's own Batman body, retargeted onto the Quaternius skeleton.

1. Source rig: export the unskinned `SuperHero_Male` body from `assets-src/` in its bind pose
   and upload it to Higgsfield; the `3d_rigging` action auto-rigs it (Meshy, 24-joint
   Mixamo-style skeleton) and applies a clip. Motion ids used: 206 Spartan Kick (front),
   207 Roundhouse Kick, 216 Lunge Spin Kick, 422 Rising Flying Kick, 211 Boxing Guard Step
   Knee Strike. Download each result as GLB into `assets-src/mocap/` as `spartan.glb`,
   `roundhouse.glb`, `spin.glb`, `flying.glb`, `knee.glb` (not committed).
2. Retarget, from the repo root (paths may be absolute or repo-relative; `:calf_r` names the
   knee's striking limb, the kicks pick their own foot):

   ```
   node scripts/retarget-mocap.mjs Kick_Round=assets-src/mocap/roundhouse.glb Kick_Front=assets-src/mocap/spartan.glb Kick_Spin=assets-src/mocap/spin.glb Kick_Flying=assets-src/mocap/flying.glb Knee_Strike=assets-src/mocap/knee.glb:calf_r
   ```

   It writes the GLB and `src/config/mocapData.js` (durations, contact frames, limb reach and
   root motion). `node scripts/optimize-assets.mjs` resamples it with the other packs.
3. Check the result in `tools/pose-viewer.html` (contact sheets via `node tools/kick-sheets.mjs`)
   or loop it live in `tools/kick-live.html`; `node tools/contact-shots.mjs` screenshots every
   move on its contact frame in the fight sandbox.

