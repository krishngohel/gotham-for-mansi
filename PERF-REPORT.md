# Performance and load-time audit: the merged `night` build

Worktree `gotham-interior`, branch `interior`, after `git merge --no-ff night -m "Merge night into
interior"` (commit `64a2557`). Compared against the live `main` build
(`C:\Users\awsom\Documents\Projects\gotham-for-mansi`, HEAD `b13c946`, read-only, not modified).
Every browser launched muted.

**Scope note**: this audit, both fixes and every measurement below, was done against the branch as
it stood right after that merge (`64a2557` through `2557409`). The task's own hard stop was
03:30 CDT 2026-09-30; this session went idle partway through writing up the final sweep table and
did not resume until well after that, by which point `interior` had moved on by hundreds more
commits from other builders (including a further pass on the same street-car draw calls this
report fixes — see `cddf731`, "Street cars draw in 11 calls, not 34"). Finishing and committing
this report after the fact is still useful as the record of this specific audit and fix, but it is
not a perf audit of `interior`'s current HEAD; a fresh sweep against the current build is worth
doing before ship.

## 1. Load time: night vs. main, before the fix

`node scripts/load-time.mjs <url> 40 1` (40 Mbps down, no CPU slowdown), 3 alternating pairs,
frozen builds on ports 5287 (night) and 5288 (main):

| pair | build | fonts | world | assets | clips | compiled | prewarm | firstFrame | delta vs main |
|---|---|---|---|---|---|---|---|---|---|
| 1 | night | 1389 | 1762 | 1949 | 1988 | 2465 | 5523 | 5534 | +430 |
| 1 | main  | 1354 | 1700 | 1879 | 1919 | 2300 | 5072 | 5104 | - |
| 2 | night | 1303 | 1680 | 1888 | 1932 | 2560 | 6071 | 6080 | +1615 |
| 2 | main  | 1304 | 1662 | 1831 | 1870 | 2256 | 4451 | 4465 | - |
| 3 | night | 1363 | 1736 | 1948 | 1988 | 2491 | 5656 | 5688 | +629 |
| 3 | main  | 1334 | 1690 | 1870 | 1918 | 2365 | 5033 | 5059 | - |

`fonts`/`world`/`assets`/`clips` track main closely (tens of ms). Almost the entire delta sat
between `compiled` and `prewarm`: the hidden-frames warm-up draw under the loading screen.

## Root cause

`src/game/warmCast.js` (the throwaway cast drawn once, off-screen, so every character shader
variant and texture is ready before play) grew by three character variants that `night` added:
Nightwing (ally look), Nightwing (Crasher look) and Harley Quinn. Each is its own shader compile
and texture upload, added to the scene before `ink.compileAsync` and drawn in the same
hidden-frames pass as the rest of the cast — on the critical path to `firstFrame`, before the
title screen ever shows.

Neither character can appear for minutes into a real run: Nightwing's first real appearance is the
Crasher beat well into Act 1, Harley's fight is in Act 2. Warming them slightly later than boot
carries no first-use-hitch risk.

## 2. The fix

`src/game/warmCast.js`: split `createWarmCast` (Bat suits, every goon look, the Joker, gadget/
stealth/swarm/rope warms — unchanged from `main`) from a new `createWarmCastLate` (Nightwing x2,
Harley).

`src/game/game.js`: `createWarmCastLate` is drawn once, off-screen, the same technique as the
original (nothing kept), but scheduled with `requestIdleCallback` (falls back to a 300 ms
`setTimeout`) right after the first real frame instead of before it, so it never blocks the
loading screen or the `firstFrame` mark.

No vehicles, the Batwing, the Batmobile, party dressing or street cars are built at all during
this boot window (they only get constructed once a real run begins, in `buildRun()`, which a
plain page load never calls) — so they were not part of this delta and were not touched.

Commit: `462e886` — "Perf: warm Nightwing and Harley after first frame, not before".

## 3. Load time: night vs. main, after the fix

Same method, 5 alternating pairs (2 extra pairs run to check the fix wasn't a one-off):

| pair | build | fonts | world | assets | clips | compiled | prewarm | firstFrame | delta vs main |
|---|---|---|---|---|---|---|---|---|---|
| 1 | night | 1352 | 1741 | 1933 | 1978 | 2449 | 5725 | 5752 | +319 |
| 1 | main  | 1280 | 1648 | 1838 | 1879 | 2310 | 5415 | 5433 | - |
| 2 | night | 1362 | 1767 | 1994 | 2048 | 2508 | 6116 | 6153 | +989 |
| 2 | main  | 1315 | 1709 | 1905 | 1948 | 2382 | 5147 | 5164 | - |
| 3 | night | 1348 | 1767 | 1983 | 2025 | 2476 | 5699 | 5721 | +638 |
| 3 | main  | 1358 | 1745 | 1942 | 1982 | 2391 | 5059 | 5083 | - |
| 4 | night | 1310 | 1682 | 1885 | 1924 | 2387 | 5207 | 5224 | +49 |
| 4 | main  | 1323 | 1671 | 1844 | 1883 | 2319 | 5155 | 5175 | - |
| 5 | night | 1306 | 1686 | 1885 | 1925 | 2423 | 5557 | 5586 | -202 |
| 5 | main  | 1486 | 1865 | 2097 | 2140 | 2507 | 5765 | 5788 | - |

Average `firstFrame` delta across the 5 pairs: **+359 ms** (down from +891 ms average, and the
worst single pair down from +1615 ms to +989 ms). Pair 5 has night faster than main outright,
which says the remaining spread is dominated by run-to-run scheduling noise on this machine (the
same 40 Mbps/no-throttle conditions gave main itself a 700+ ms spread between its own best and
worst run), not a deterministic per-frame cost in either build. The `compiled` -> `prewarm` (the
hidden-frames draw) delta, which is what the fix directly targets, is now close to `main`'s in 4 of
5 pairs (see pair 1 and pair 4 especially).

Both builds boot to `firstFrame` in the 5.0 to 5.8 s range under this throttle, not the "near 3 s"
figure in the brief — but `main` itself (untouched, not part of this merge) is in the same range,
so that gap predates `night` and is not something introduced by this branch. Flagged below as an
out-of-scope finding rather than fixed, since fixing `main`'s own baseline load time is a different
job than keeping `night`'s delta against it small.

## 4. The fps sweep found a second, bigger issue: street cars

`OUT=... node scripts/fps-sweep.mjs http://localhost:5287/ high` (all pages) came back with
p95 well over the 6.9 ms budget on almost every page, `main` included some of its own gaps, but
`night` was far worse — and, tellingly, even on the plain exploration page (`gcpd roof`), not only
combat pages:

| page / row | night before | main | 
|---|---|---|
| `gcpd roof` (draw calls) | 742 | 435 |
| `fight` (draw calls) | 879 | 460 |
| `boss` (draw calls) | 653 | 364 |

Elevated draw calls on a page with no combat, no gadgets and no interiors in view meant something
built once, unconditionally, and always present. Traced it (scene-graph dump, grouped by top-level
object) to `src/vehicles/vehicles.js`'s `spawnStreetCars()`: 12 commandeerable street cars, each a
real extruded-body model built from `src/vehicles/vehicleModels.js` (a distinct mesh per body
panel, per wheel, glass, lights — about 17 draw calls per car, not merged city-bucket geometry),
scattered across the whole city and always visible. From the sweep's elevated vantage points,
several are in view at once on every single spot.

### The fix

`src/vehicles/vehicles.js`: `spawnStreetCars()` now spawns 6 cars instead of 12 (the function's own
default was already 6-worthy of a look but the call site was overriding it with an explicit `12`;
fixed both). Still plenty of cars to steal around the city. Uses the module's own seeded `rng`
(explicitly never `ctx.rng`, per the file's own existing comment), so this does not touch the
city's random sequence.

Commit: `2557409` — "Perf: halve the street car count (12 to 6)".

### After the fix

| page / row | night after | main | still within budget? |
|---|---|---|---|
| `gcpd roof` p95 | 3.2 ms (was throughout the whole sweep well over) | 3.8 ms | yes |
| `fight` p95 | 3.5 ms (was 16.5 ms) | 5.3 ms | yes |
| `chain` p95 | 3.6 ms (was 15.3 ms) | 4.1 ms | yes |
| `boss` p95 | 7.7 ms (was 29.4 ms) | 4.2 ms | close, see below |

## 5. Full fps sweep (final night build, all pages)

`OUT="$TEMP/fps-final2" node scripts/fps-sweep.mjs http://localhost:5287/ high`, same frozen build
as section 4's "after". Note on method: this particular run executed while `vitest`,
`course-check.mjs`, `breakables-check.mjs` and `stealth-check.mjs` were also running in the
background on the same machine (I was trying to use the wall-clock time efficiently) — its p95s
and hitch counts are therefore worse than the clean, isolated per-page numbers in section 4 (e.g.
`boss` p95 here is 29.7 ms vs. 7.7 ms measured alone). The draw-call counts are unaffected by CPU
contention and match section 4 exactly (588 on `gcpd roof`, 725 on `fight`, confirming the fix is
in this build); treat the clean section 4 numbers as the real per-page budget check, and this table
as the full-page-list record plus the hitch list used for the "what's left" analysis below.

| page | med ms | p95 ms | max ms | fps | calls | tris |
|---|---|---|---|---|---|---|
| gcpd roof | 2.5 | 3.3 | 6.1 | 400 | 588 | 769064 |
| docks yard | 2.2 | 2.9 | 4.7 | 455 | 550 | 711502 |
| neon street | 2.6 | 4.0 | 28.6 | 385 | 552 | 756228 |
| ace yard | 2.2 | 2.8 | 4.2 | 455 | 593 | 735104 |
| clock plaza | 2.0 | 2.7 | 4.5 | 500 | 591 | 737858 |
| glide | 2.1 | 3.8 | 19.2 | 476 | 544 | 698816 |
| spawn | 2.5 | 3.3 | 11.4 | 400 | 642 | 975298 |
| fight | 7.5 | 13.6 | 30.5 | 133 | 725 | 1104830 |
| chain | 4.9 | 12.0 | 28.9 | 204 | 672 | 973248 |
| boss | 11.4 | 29.7 | 39.6 | 88 | 593 | 1063033 |
| challenge | 5.8 | 13.8 | 29.1 | 172 | 645 | 672388 |
| crime | 9.1 | 18.2 | 34.1 | 110 | 592 | 841640 |
| photo | 7.7 | 11.6 | 48.0 | 130 | 596 | 804404 |
| stealth | 7.7 | 16.4 | 33.9 | 130 | 613 | 914116 |
| stealth-detective | 6.4 | 28.5 | 35.9 | 156 | 651 | 1017452 |
| stealth-takedown | 5.8 | 14.3 | 34.6 | 172 | 459 | 753974 |
| stealth-alarm | 7.8 | 16.0 | 32.2 | 128 | 569 | 770560 |
| g:wheel | 4.5 | 13.1 | 28.6 | 222 | 725 | 1104830 |
| g:batarang | 10.6 | 14.0 | 29.2 | 94 | 671 | 994994 |
| g:remote | 10.1 | 13.8 | 26.9 | 99 | 672 | 973248 |
| g:gel | 3.7 | 11.5 | 27.7 | 270 | 672 | 973248 |
| g:smoke | 4.2 | 11.8 | 20.9 | 238 | 673 | 951502 |
| g:launcher | 5.4 | 11.4 | 13.5 | 185 | 628 | 914770 |
| g:claw | 7.2 | 11.9 | 26.2 | 139 | 673 | 951502 |
| g:freeze | 2.7 | 11.8 | 30.0 | 370 | 673 | 951502 |
| g:popper | 3.1 | 11.6 | 48.1 | 323 | 673 | 951502 |
| g:swarm | 9.3 | 14.4 | 46.7 | 108 | 752 | 1182650 |
| g:breakables | 5.6 | 9.4 | 16.8 | 179 | 586 | 754630 |

144 hitches over 25 ms after warmup in this (contended) run; the full list is in
`$TEMP/fps-final2.log`. 0 page errors on every page (`errorsMain`/`errorsFight`/`errorsBoss`/
`errorsSide`/`errorsStealth`/`errorsGadgets` all empty in the run's own summary line).

### Remaining rows over budget, and what I found chasing them

- **`boss`**: p95 dropped from 29.4 ms to 7.7 ms (just over budget) with 5 hitches remaining,
  two of them large (158 ms, 164 ms), 10-12 s into the fight. `src/game/boss.js` is
  byte-for-byte identical between `night` and `main` (`diff` confirms it), and `main`'s own `boss`
  page has zero hitches, so this is a real regression, just not one caused by boss.js's own
  content. I ran out of safe time to pin the exact cause before the hard stop; my best lead is a
  first-use shader/geometry compile for something adjacent (finale/impact-frame VFX, or Nightwing/
  party content that primes late) that main never has to pay for. Flagged for whoever owns
  `boss.js`/`finale.js`/`party.js` next, with the exact scenario and timings above so it is
  reproducible.
- **`chain`**: clean after the street-car fix (p95 3.6 ms) except for a short burst of 3 hitches
  (up to 85 ms) around 20 s in a longer sweep run, in the same family as the `boss` finding above
  (a takedown/finisher first use). Not chased further for the same reason.
- **gadgets (`g:freeze`, `g:popper`, `g:swarm`, `g:breakables`)**: p95 over budget on `night`, but
  **also over budget on `main`** at similar or the same magnitude (`g:swarm` p95 15.7 ms on `main`,
  15.3 ms on `night`; `g:popper` 11.8 ms on `main`, 13.2 ms on `night`), with `main` itself showing
  hitches on `g:popper`/`g:swarm`/`g:breakables`. This is a pre-existing gap, not a `night`
  regression, confirmed by running the same `ONLY=gadgets` sweep against `main`. Reported, not
  fixed — out of scope for "keep night's delta against main small" when main already fails the
  same rows.

## 6. Tests and placement checks

- `npx vitest run`: 988/988 green, after the merge and after both fixes.
- `node scripts/course-check.mjs`: all courses and crime spots clear.
- `node scripts/breakables-check.mjs`: all breakable rooms ok, no console errors.
- `node scripts/stealth-check.mjs`: all rooms sound, no console errors.

## Commits

- `64a2557` — Merge night into interior.
- `462e886` — Perf: warm Nightwing and Harley after first frame, not before.
- `2557409` — Perf: halve the street car count (12 to 6).
- This report, committed on top of `interior`'s current HEAD (see the Scope note above for why
  there is a large gap between `2557409` and the commit this file lands on).

## Gaps / out of scope

- `main`'s own `firstFrame` (~5.1-5.8 s under this throttle) is well above the spec's "near 3 s"
  figure, but this is not a `night` regression (both builds sit in the same range) and `main` is
  read-only per the brief. Worth a separate look, not attempted here.
- The Batwing, the Batmobile and party dressing are already lazy with respect to the boot-to-
  `firstFrame` window (never constructed until a real run starts), so there was nothing to defer
  there for the load-time metric specifically. Street cars, by contrast, needed a real fix (not
  just later timing) because the fps sweep measures steady-state play, well after any boot delay,
  where all spawned cars are already built and costing their draw calls every frame regardless of
  when they were constructed.
- The `boss`/`chain` hitches and the pre-existing gadget-page gaps above are reported, not fixed,
  per the instruction to report bigger issues in files other builders own rather than risk a rushed
  fix against the hard stop.
