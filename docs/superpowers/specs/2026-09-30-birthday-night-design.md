# Gotham for Mansi: Mansi's Birthday Night (the Arkham Knight-style rework)

Date: 2026-09-30, 00:20 CDT. Approved by the owner in chat:
- all four story problems fixed (too thin, too short, weak presentation, birthday bolted on);
- the premises mixed together;
- Mansi is the player;
- about 2 hours of main story;
- comic radio plus a few key voices (voices need a credit quote first, so tonight is text only);
- a full save reset;
- approach A (systems ship first, then the story swaps in).

The deadline is 8:00 today, and the owner said "go crazy". The team builds in parallel and integrates at the end. Anything not solid by 06:30 is cut and the rest ships.

## The story

**Mansi's Birthday Night**: one night, played as the hero Mansi picked (Batman, Batgirl or the gold suit). Everyone talks to her directly.

- **Prologue: GCPD roof.** Gordon on the radio: Gotham is throwing Mansi a citywide birthday at midnight. The Joker hijacks the Batsignal (it projects a cake). His broadcast says he has stolen her birthday: the gifts, the band, the cake and the guests. He has hidden them behind a trail of clues. A masked Party Crasher grabs the first gift before she can.
- **Act 1: Docks and Neon Row.**
  - Alfred delivers the Batmobile.
  - A Batmobile chase of a Joker getaway van.
  - The docks fights.
  - The Monarch stealth balcony.
  - Rescue guest 1, the DJ.
  - The first clash with the Crasher on a rooftop, who escapes on a line.
  - The Joker's clue points to Ace Chemicals.
- **Act 2: Ace Chemicals.**
  - A Batmobile battle in the yard: the cannon against Joker drone tanks.
  - The catwalk stealth room.
  - A Harley Quinn fight.
  - Rescue guest 2 (the baker) and the cake.
  - The Crasher's mask comes off: Nightwing, secretly running a surprise the Bat-family planned.
- **Act 3: Clock plaza.**
  - A Batwing run through the Joker's balloon armada.
  - Nightwing tag-team fights, with Gordon's GCPD backing her up.
  - The Joker's funhouse, inside the cathedral.
  - Rescue the last guests.
  - The Joker finale.
- **Finale.** Everyone rescued celebrates on the GCPD roof with fireworks and HAPPY BIRTHDAY MANSI, then the credits. Free roam stays open with every vehicle, stealable cars and the challenges.

## Parts built tonight (parallel worktrees)

Each part lives in new modules. game.js gets one small, clearly marked hook block per part.

| Part | Worktree / branch | Delivers |
|---|---|---|
| V1 Ground vehicles | `gotham-veh` / `veh` | Batmobile (summon, drive, boost, handbrake drift, ram, eject into a glide), cannon battle mode vs drone tanks, commandeer any street car and drive it, and a chase-mission helper |
| V2 Batwing | `gotham-wing` / `wing` | Call the Batwing and fly it (pitch, roll, boost, camera), pop Joker balloons (the armada set piece), land or eject into a glide |
| S Story | `gotham-story` / `story` | New STEPS for all acts, a comic radio and cutscene panel system (portraits, typewriter text, no dashes), Party Crasher encounters, new mission types wired to the vehicle and wing contracts, and a full reset through a new save key |
| N Nightwing | `gotham-nightwing` / `nightwing` | A Nightwing character (code-painted suit: black with a blue chevron, domino mask), an ally AI that fights goons, a team takedown, and Crasher mode (masked, flees) |
| I Interiors | `gotham-interior` / `interior` | Enterable buildings: the Joker funhouse inside the cathedral (the finale arena), plus the Ace Chemicals interior hall. Doors in and out, interior collision, lighting, warmed materials |

## Contracts between parts (exact names)

- **Vehicles (V1):**
  - `createVehicles(deps)` returns `vehicles` with `summon(kind = 'batmobile')`, `enter(v)`, `exit()`, `active` (vehicle or null), `update(dt, real)`, `startChase({ path, onDone })`, `startBattle({ site, drones, onDone })`.
  - Events: `vehicleEnter { kind }`, `vehicleExit { kind }`, `chaseDone { ok }`, `battleDone { ok }`.
  - The hero's control name while driving is `'drive'`.
- **Batwing (V2):**
  - `createBatwing(deps)` returns `batwing` with `call()`, `exit()`, `active`, `update(dt, real)`, `startArmada({ balloons, onDone })`.
  - Events: `wingEnter`, `wingExit`, `armadaDone { ok }`.
  - Hero control name `'fly'`.
- **Nightwing (N):**
  - `createNightwing(deps)` returns `nightwing` with `spawn(p, mode)` (mode is `'ally'` or `'crasher'`), `despawn()`, `actor`, `update(dt)`, `crasherFlee(to)`.
  - Events: `teamTakedown`, `crasherEscaped`.
- **Interiors (I):**
  - `createInteriors(deps)` returns `interiors` with `rooms` (by id: `funhouse`, `aceHall`), `enter(id)`, `exit()`, `inside` (id or null).
  - New SITES: `funhouse`, `aceHall`.
  - Events: `roomEnter { id }`, `roomExit { id }`.
- **Story (S):** consumes all of the above through `window.__game`. Every mission type degrades safely when a part is missing: it logs, then completes, so the story can always be played end to end.
- **New keys:**
  - `vehicle` on KeyT (summon or enter) and pad D-pad down;
  - `batwing` on KeyY;
  - the cannon is the punch button while in `'drive'` battle mode.

  No part may change existing bindings.

## Constraints (carried over)

- All art and copy are made in code and Fable-authored. No new AI assets without owner approval.
- No em or en dashes in player-visible text.
- Commits are authored by Krishn Gohel only, with no trailers. Only the coordinator pushes, and only verified work.
- Every test browser launches muted (`--mute-audio`). The owner is using the laptop.
- No per-frame allocation. New materials are warmed. fps sweep p95 ≤ 6.9 ms, first frame near 3 s.
- The city is built from one seeded rng: never change its draw count (see the sawtooth fix).
- Never rm node_modules paths (they are junctions). Subagents never create worktrees.
