# Gotham for Mansi: full-game expansion

Date: 2026-09-28. Status: approved by the owner's standing instruction for the overnight push ("keep adding more gadgets and other cool stuff all night... go CRAZY... make it a full on game").

This builds on the traversal and comic spec (`2026-09-28-traversal-comic-content-design.md`, Parts A to D). That spec's Part C (challenges, street crimes, photo mode, progress tracker) and Part D (predator stealth) still stand. This spec adds Parts E to H. Every part ships separately, after its own tests, scripted play, the full playthrough, the fps sweep and a review, because pushing `main` redeploys the live site.

## Part E. Chain takedowns (multi-goon combos)

The owner asked for this: "when your combo is high enough or you sneak in, hitting 1, 2 or 3 gives you different attacks that go from one goon to the next in a chain and has its own finisher, like them being tied together or heads smashed together."

### E1. When they're available
- **In a fight:** at combo 6 or higher, the HUD combo counter shows three chain icons (1, 2, 3), each lit when affordable. The costs are:
  - 1 (Rope-a-Dope): 6
  - 2 (Headbanger): 9
  - 3 (Domino Drop): 12

  Using a chain spends that much combo and keeps the rest.
- **From stealth:** when Batman is within 6 m of 2 or more goons that haven't noticed him, all three are free and silent. Goons outside the chain don't hear it unless they're within 8 m.
- **Targets:** a chain picks up to 3 nearby goons (within 9 m, in line of sight). It needs at least 2 goons. Armored brutes can be chained but not as the first target. The Joker can never be chained.

### E2. The three chains
Each is a scripted sequence: Batman moves between targets with short, fast lunges (hero control `chain`), each hit lands on its contact frame with hit-stop, and it ends with a signature finisher shown by the action camera in slow motion.
1. **Rope-a-Dope:** a grapple line fires through each goon in turn, wrapping them. The lines are drawn in ink between the goons. Batman yanks, the goons slam together and fall in a tangled heap. They stay tied for 6 s, can't get up, and any one more hit knocks all of them out.
2. **Headbanger:** Batman dashes between two goons, grabs both heads and smashes them together ("KONK!"). With a third goon, he flips over the pile and drives a heel into the third. Finisher: the first two drop unconscious.
3. **Domino Drop:** Batman leaps goon to goon, bouncing off each head with a stomp. The last bounce goes high into a dive-bomb shockwave that knocks everyone nearby down ("KA-BLAM!").

Outcomes: every chained goon is knocked out, except armored brutes, which are only knocked down. Each chain has its own sound words, sounds, camera angle and speed lines.

### E3. Controls and teaching
- **New actions:** "Chain takedown 1/2/3", default keys `Digit1`, `Digit2` and `Digit3`, rebindable. Gamepad: D-pad left, up and right while the block button is held.
- **Teaching:** a first-time prompt the first time a chain is affordable, plus a help page section.

## Part F. Gadgets

### F1. Gadget wheel
- **Opening it:** hold `Tab` (a new action, "Gadget wheel") to slow time to 20% and show a radial comic-panel wheel. Pick with the mouse direction or keys 1 to 8. Releasing it equips the gadget.
- **Firing:** the equipped gadget fires with `R`. The existing batarang is the first slot. Gamepad: hold the right bumper for the wheel and pick with the right stick.
- **Status:** the HUD shows the equipped gadget icon and its charges or cooldown.

### F2. Gadgets
1. **Batarang:** exists today. Upgrades (Part G) add a triple batarang.
2. **Remote batarang:** time slows while the player steers it with the mouse for up to 3 s. It stuns every goon it passes and breaks glass signs.
3. **Explosive gel:** spray on the floor or walls (3 charges), then press R again to detonate. Knocks goons down in 4 m and breaks cracked walls (new marked weak walls hide balloons, crates and shortcuts).
4. **Smoke pellet:** a cloud 5 m across. Goons inside are stunned and lose track of Batman; in stealth it resets every goon's alert to searching. Cooldown 12 s.
5. **Line launcher:** fires a horizontal line to the wall ahead (up to 40 m) and rides it like a zipline. It reuses the zip control, so it can also cross a street mid-glide.
6. **Batclaw:** yanks one goon toward Batman into a free punch, pulls shields off, pulls goons off ledges, and tears down vent covers or weak railings.
7. **Freeze blast:** freezes one goon in ice for 5 s. A hit shatters the ice and knocks the goon out.
8. **Party popper (birthday special):** a confetti bomb that stuns every goon in 6 m and makes them dance for 3 s. It shows "HAPPY BIRTHDAY MANSI!" in the sky as confetti lettering. It unlocks after the story ends.

Each gadget has a prompt, a help entry, a code-drawn HUD icon in ink style, sounds and sound words.

## Part G. Upgrades (WayneTech)

- **Earning points:** XP comes from fights (combo length, variety, takedowns), chain takedowns, challenge medals, balloons, crimes stopped, side missions and Joker crates. Every 1,000 XP gives 1 upgrade point; a level-up is announced with a comic caption.
- **Upgrade menu:** a comic-book "WayneTech" screen in the pause menu with four trees of 5 upgrades each:
  - **Armor:** plus 25 max health, twice; takes less damage from knives and guns; faster health recovery out of combat.
  - **Combat:** longer counter window; combo kept after being hit once; chain takedowns cost 2 less; a 4th chain (a "Bat Swarm" cinematic finisher unlocked at the end of the tree); special takedown at combo 6 instead of 8.
  - **Gadgets:** triple batarang; bigger gel blast; faster smoke cooldown; batclaw pulls two goons; freeze lasts longer.
  - **Traversal:** stronger grapple boost; faster glide dive; wall run lasts longer; ladder slide speed; dive bomb radius.
- **Saving:** points and purchases save in progress. The menu shows current XP, the next level and every upgrade with its effect.

## Part H. After the party: post-game world

Once the credits have rolled, free roam becomes "After the Party". The city stays alive, and a new objective list and map markers appear.

1. **Joker Crates:** 20 purple crates hidden across the city, each with a small puzzle. Some need a gadget (gel wall, batclaw vent), some a traversal move (ladder, zip, wall run), some a short race. Each gives XP; collecting all 20 unlocks the "Harley's Party Hat" cowl variant (a cosmetic party hat on the cowl).
2. **Missing Guests:** 6 party guests held by goon squads around the city (fights, a stealth room, a timed rescue). Each rescue adds the guest to a rooftop party at the GCPD roof that grows as you rescue more, with the NPCs dancing (Dance_Loop).
3. **Cake Bombs:** 5 Joker cake bombs on timers. Reach each one before the fuse runs out (it needs a glide route and a zip), then defuse it by beating the goon guarding it or with a counter-timing minigame.
4. **Balloon Army:** hostile Joker balloons drift over a district carrying spray cans. Pop them all with batarangs and the remote batarang.
5. **Joker's Encore:** a harder rematch of the boss fight with new patterns, unlocked after all 5 cake bombs. It gives a gold medal and a new comic page.
6. **Endless Party Crashers:** a survival arena on the Monarch roof. Waves grow without limit; there's a best-wave record and a medal at waves 5, 10 and 20.
7. **New Game Plus:** replay the story with the gold suit, harder goons, all gadgets and upgrades kept.

Everything post-game is tracked in the Progress tracker (Part C4 of the earlier spec), which grows with these categories.

## Constraints (carried over)
- Art and lettering are authored in code or taken from CC0 sources. Higgsfield is used only where the owner approved it (the voice, suit reference art, mocap kicks).
- No em dashes in game copy.
- Commits are authored by Krishn Gohel only, with no trailers.
- Frame rate: keep 144 fps or better on the owner's laptop. The fps sweep's worst 5% of frames stay at or under 6.9 ms, with no frame over 25 ms after the first 5 s. Every new effect goes into the warm-up pre-compile (`src/game/warmCast.js`).
- Load time: the first frame stays near 3 s. New assets are small and load after boot where possible.
- The Safari engine is checked for every release.
