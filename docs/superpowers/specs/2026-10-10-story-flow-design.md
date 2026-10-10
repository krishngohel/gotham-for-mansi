# Story flow: hand-offs, a party checklist, clearer goals

Owner request (2026-10-08, picked from a list): the story has **abrupt jumps**, it is **unclear what
to do**, and the **pacing is repetitive**. Answers in brainstorming (2026-10-10): keep all 15 fights;
yes to a party checklist; yes to an objective banner, an idle nudge and calmer tip cards. Mid-session
(2026-10-10): "the batwing pop the balloons quest doesn't work, get rid of it".

Evidence: `scripts/story-walk.mjs` on a frozen build (134 shots, every beat). After every fight a new
"go here" box appears with no one saying why (`toYard`, `toShip`, `toNeon` "The party was hauled to
Neon Row" out of nowhere, `toStreet`, `toMonarch`, `toFactory`); fight tip cards linger into the
next step (the kick card on the walk to the yard); timed side tips (photo mode, 120 s after
`toDocks`) and gadget cards stack over "go" steps.

## 1. Radio hand-offs

- Any reach, fight, collect or board step may carry `lines`; `enterStep()` plays them with
  `radio.say()` without blocking the step (today only async types and `interior` play them).
- Hand-off lines (1 to 3 each) on: `toRoofAfterChase`, `toYard`, `toShip`, `presents`, `toNeon`,
  `toStreet`, `toMonarch`, `party`, `toBruteFight`, `toFactory`, `toVat`, `toCatwalks`, `cake`,
  `toPlaza`, optionally `toTower`. Each says what just happened, what is next and why it gets her
  party back. `toNeon` is where someone says the party went to Neon Row, and keeps the masked
  crasher thread alive between the Batsignal and the Monarch. `toFactory` gives the roof fight a
  reason.
- Objective `text` rewritten as what + where for every step that shows one.
- **Copy:** authored by Fable 5.1 (owner rule: all AI-written game copy comes from Fable 5.1),
  pasted in chat for the owner before it goes in. No em or en dashes, no invented memories about
  Mansi or the gift-giver.

## 2. Party checklist

- `src/game/partyChecklist.js` (pure, like `partyStory.js`): five items, each ticked by a step id.

  | Item | Ticked when this step starts |
  |---|---|
  | Gifts | `toNeon` (after the freighter presents) |
  | DJ rig and band gear | `aceClueRadio` |
  | Cake | `crasherReveal` |
  | Fireworks | `harleyRadio` (after Harley's van chase) |
  | Guests and the band | `rescueGuestsRadio` |

  `checklistAt(stepIndex, steps)` returns every item with `done`. Derived from the save's step, so
  no new save field and old saves show the right ticks.
- On the tick step's `step` event, a comic card (`hud.card`, which already queues) shows the
  title, the list with ticks and the item's one-line "got it" text (Fable copy).
- The pause menu gets a **Party** button opening a page with the same list.

## 3. Clarity

- **Objective banner:** when the objective text changes, it shows large in the middle of the
  screen for about 2 s, then the corner caption takes over (the existing `.new` animation stays on
  the caption). Not during cutscenes, comics or cinematics (shown when they end).
- **Idle nudge** (`src/game/nudge.js`, pure timer): on reach, board, interior and collect steps
  only. If her best distance to the target has not improved by 5 m in 45 s, play the step's
  `nudge` line (Fable copy; fallback: the objective text) on the radio and pulse the marker.
  The timer resets on progress and after a nudge; at most 3 per step; it does not run while a
  radio line, comic, cinematic or menu is up.
- **Calmer tips:**
  - When a fight step ends, its own tip cards (on screen or queued) are dropped.
  - Side tips that are not the current step's own (`detective`, `balloons`, `photo`, gadget news,
    `wayneTech`) wait while the banner or a radio line is on screen and during the first 8 s of a
    step.

## 4. The balloon run goes

- Delete the `armadaRun` step. The `armada` mission type, the Batwing and free-roam flying stay.
- Nightwing's Batwing hand-over moves into `nightwingTagRadio`; the `callBatwing` tip moves to
  `toPlaza`.
- Saves sitting on a removed step: `storyMigrate.js` gets `RETIRED = { armadaRun: 'nightwingTagRadio' }`,
  checked before falling back to the top (a save on a missing id restarts the story today).

## 5. Also shipping: knocked-out goons fall at once

Owner (2026-10-10): "goons stay on screen and not falling over for a bit after they are taken
down". Measured: 1.3 to 1.65 s from the KO to the floor. Cause: a critical KO (most movement moves
are crits now) runs 0.55 s at 0.28 speed, and both KO clips open on their feet (Death01 sags for
0.8 s). Fix (commit 1ece802): `KO_FALL` starts Death01 at 0.6 s and Hit_Knockback at 0.3 s, a
little faster; now 0.65 to 1.0 s, falling from the first frame.

## Testing

- Unit: every fight followed by a go step has `lines` on that go step; `checklistAt` at every
  step; nudge timer (progress resets, cap of 3, paused states); retired-id migration; banner
  shows on text change only; fight-end tip drop and side-tip wait rules; no dash characters in
  story copy (checked from char codes).
- `scripts/story-walk.mjs` photographs every beat (banner, hand-off radio, checklist card).
- Release gates: vitest, e2e, playthrough to credits, WebKit, live smoke after the push.

## Out of scope

Cutting or merging fights. New voice acting (radio stays comic text). Changes to the Batwing
itself.
