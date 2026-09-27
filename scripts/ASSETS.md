# Rebuilding assets

`assets-src/` is not committed. To rebuild `public/assets/`:

1. Download the Standard zips (free, no account) from
   - https://quaternius.itch.io/universal-base-characters
   - https://quaternius.itch.io/universal-animation-library
   - https://quaternius.itch.io/universal-animation-library-2
2. Copy into `assets-src/`: everything in `Base Characters/Godot - UE/`, `Hairstyles/Origin at 0/glTF (Godot)/Hair_Long.*` and its textures, `UAL1_Standard.glb`, `UAL2_Standard.glb`. The male body references `T_Eye_Normal_png.png` and `T_Hair_1_Normal_png.png`, which the pack does not ship: copy `T_Eye_Normal.png` and `T_Hair_1_Normal.png` to those names.
3. `npm run assets`
