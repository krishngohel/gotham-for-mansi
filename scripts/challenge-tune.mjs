// Completes every challenge with a scripted pilot and prints medal thresholds for
// src/game/challenges.js (see suggestThresholds). Glide courses and the arena run three times.
// usage: node scripts/challenge-tune.mjs [baseUrl] [challengeId ...]
// env: SHOTS=<dir> saves a screenshot mid-run and at the result of each run.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { CHALLENGES, suggestThresholds } from '../src/game/challenges.js';

const base = process.argv[2] ?? 'http://localhost:5206/';
const only = process.argv.slice(3);
const shots = process.env.SHOTS ?? '';
// REPS=1 for a fast single-run debug iteration; unset (or REPS=3) keeps the real 3-run sampling.
const REPS = Number(process.env.REPS ?? 3);
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function fresh(id, extra = '') {
  await page.goto(`${base}?at=toNeon&god=1&new=1${extra}`);
  await page.waitForFunction(() => window.__game?.side && window.__game.state.frame > 30, null, { timeout: 90000 });
  await page.evaluate(() => {
    const g = window.__game;
    window.__done = null;
    g.events.on('challengeDone', (e) => { window.__done = e; });
    g.events.on('challengeFail', (e) => { window.__done = { ...e, failed: true }; });
    window.__aim = (x, y, z) => {
      const c = g.camera.position, dx = x - c.x, dz = z - c.z;
      g.follow.state.yaw = Math.atan2(dx, dz);
      g.follow.state.pitch = Math.max(-1, Math.min(1.2, Math.atan2(c.y - y, Math.hypot(dx, dz))));
    };
    window.__face = (x, z) => { const h = g.hero.pos; g.follow.state.yaw = Math.atan2(x - h.x, z - h.z); };
  });
  await page.evaluate((id) => window.__game.side.challenges.start(id), id);
  await page.waitForFunction(() => window.__game.side.challenges.running, null, { timeout: 8000 });
}
const done = () => page.evaluate(() => window.__done);
const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

async function glideRun(id, n) {
  await fresh(id);
  await page.evaluate(() => {
    const g = window.__game;
    const tick = () => {
      if (!g.side.challenges.running) return;
      const t = g.side.challenges.nextMarker();
      if (t) {
        const h = g.hero.pos, ty = t.y + 1.5;
        const d = Math.max(1, Math.hypot(t.x - h.x, t.z - h.z));
        g.follow.state.yaw = Math.atan2(t.x - h.x, t.z - h.z);
        const slope = (h.y + 1 - ty) / d;   // the level glide sinks about 0.14 m per metre
        g.follow.state.pitch = slope > 0.3 ? 0.7 : slope < 0.04 ? -0.25 : 0.25;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.down('Space');
  await page.waitForTimeout(3000);
  await shot(`${id}-${n}-mid`);
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyW');
  await shot(`${id}-${n}-result`);
  return done();
}

async function arenaRun(n) {
  await fresh('birthdayBash');
  await page.mouse.click(640, 360);
  const pattern = ['Mouse0', 'Mouse0', 'KeyE', 'Mouse0', 'KeyG', 'KeyE', 'Mouse0', 'KeyQ'];
  for (let i = 0; i < 1500 && !(await done()); i++) {
    const s = await page.evaluate(() => {
      const g = window.__game, h = g.hero.pos;
      const es = g.combat.enemies.filter((e) => e.alive);
      let near = null, nd = Infinity;
      for (const e of es) { const d = Math.hypot(e.pos.x - h.x, e.pos.z - h.z); if (d < nd) { nd = d; near = e; } }
      if (near) g.hero.bat.face(Math.atan2(near.pos.x - h.x, near.pos.z - h.z));
      return {
        blue: es.some((e) => e.glyph === 'blue' && e.state === 'windup'),
        red: es.some((e) => e.glyph === 'red' && e.state === 'windup'),
        ready: g.combat.combo.ready,
      };
    });
    if (s.blue) await page.mouse.click(640, 360, { button: 'right' });
    else if (s.red) await page.keyboard.press('KeyC');
    else if (s.ready) await page.keyboard.press('KeyX');
    else {
      const k = pattern[i % pattern.length];
      if (k === 'Mouse0') await page.mouse.click(640, 360); else await page.keyboard.press(k);
    }
    if (i === 60) await shot(`birthdayBash-${n}-mid`);
    await page.waitForTimeout(140);
  }
  await shot(`birthdayBash-${n}-result`);
  return done();
}

// Parkour: one leg per checkpoint, each doing its real move. A leg that times out is assisted
// (teleport into the checkpoint with the move noted) and marks the whole run as unusable.
async function parkourRun() {
  await fresh('gothamParkour');
  const legs = [];
  const next = () => page.evaluate(() => window.__game.side.challenges.debug?.next ?? 99);
  const reach = async (n, ms) => {
    try { await page.waitForFunction((n) => (window.__game.side.challenges.debug?.next ?? 99) >= n || window.__done, n, { timeout: ms }); return true; } catch { return false; }
  };
  const assist = async (n, move) => {
    await page.evaluate(({ n, move }) => {
      const g = window.__game;
      const cp = g.side.data.CHALLENGES.find((c) => c.id === 'gothamParkour').checkpoints[n - 1];
      const ev = { ladder: 'ladderOn', ledge: 'ledgeGrab', zipline: 'zipOn', wallrun: 'wallRun' }[move];
      if (ev) g.events.emit(ev);
      g.hero.teleport({ x: cp.x, y: cp.y, z: cp.z });
    }, { n, move });
    await reach(n, 2000);
    return 'assisted';
  };
  const walkTo = async (x, z, ms, sprint = false) => {
    const t0 = Date.now();
    await page.keyboard.down('KeyW');
    if (sprint) await page.keyboard.down('ShiftLeft');
    let last = null;
    while (Date.now() - t0 < ms) {
      const p = await page.evaluate(([x, z]) => { window.__face(x, z); const h = window.__game.hero.pos; return [h.x, h.z]; }, [x, z]);
      if (Math.hypot(p[0] - x, p[1] - z) < 2) break;
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.3) await page.keyboard.press('Space');
      last = p;
      await page.waitForTimeout(250);
    }
    await page.keyboard.up('KeyW');
    if (sprint) await page.keyboard.up('ShiftLeft');
  };
  const cps = await page.evaluate(() => window.__game.side.data.CHALLENGES.find((c) => c.id === 'gothamParkour').checkpoints);

  // Leg 1, ladder: walk into the fire escape's drop ladder, climb to the landing, grapple up.
  const ladder = await page.evaluate(([x, z]) => window.__game.climbables.ladders.find((l) => l.bottom < 1 && Math.hypot(l.x - x, l.z - z) < 20) ?? null, [cps[0].x, cps[0].z]);
  if (ladder) {
    await walkTo(ladder.x + ladder.nx * 0.6, ladder.z + ladder.nz * 0.6, 6000);
    await page.evaluate((l) => window.__face(l.x, l.z), ladder);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__game.hero.control?.name === 'ladder', null, { timeout: 4000 }).catch(() => {});
    await page.waitForFunction(() => !window.__game.hero.control, null, { timeout: 12000 }).catch(() => {});
    await page.keyboard.up('KeyW');
  }
  await page.evaluate((c) => window.__aim(c.x, c.y + 1, c.z), cps[0]);
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyF');
  legs.push((await reach(1, 8000)) ? 'ok' : await assist(1, 'ladder'));

  // Leg 2, ledge: grapple at the Gazette's north edge with back held, hang, pull up, walk in.
  await page.evaluate((c) => window.__aim(c.x, c.y - 0.5, c.z + 24), cps[1]);
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyF');
  await page.keyboard.up('KeyS');
  await page.waitForFunction(() => window.__game.hero.control?.name === 'ledge', null, { timeout: 6000 }).catch(() => {});
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyW');
  await walkTo(cps[1].x, cps[1].z, 6000);
  legs.push((await reach(2, 4000)) ? 'ok' : await assist(2, 'ledge'));

  // Leg 3, zipline: grapple to the top post of the Gazette line, ride it to the pawn shop roof.
  const zip = await page.evaluate(([a, b]) => window.__game.climbables.ziplines.find((z) => Math.hypot(z.a.x - a.x, z.a.z - a.z) < 30 && Math.hypot(z.b.x - b.x, z.b.z - b.z) < 30) ?? null, [cps[1], cps[2]]);
  if (zip) {
    await walkTo(zip.a.x, zip.a.z, 6000);
    await page.evaluate((z) => window.__aim(z.b.x, z.b.y, z.b.z), zip);
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    await page.evaluate((z) => window.__aim(z.a.x, z.a.y - 1.2, z.a.z), zip);
    await page.keyboard.press('KeyF');
  }
  if (!(await reach(3, 9000))) { await walkTo(cps[2].x, cps[2].z, 4000); }
  legs.push((await reach(3, 1000)) ? 'ok' : await assist(3, 'zipline'));

  // Leg 4, wall run: step off the pawn roof into the street, sprint along the hotel's east
  // face at about 20 degrees into it, jump to run the wall, then run to the checkpoint.
  await walkTo(cps[2].x + 22, cps[2].z, 5000);
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__game.follow.state.yaw = Math.atan2(-0.34, -0.94); });
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1300);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  await walkTo(cps[3].x, cps[3].z, 8000, true);
  legs.push((await reach(4, 3000)) ? 'ok' : await assist(4, 'wallrun'));

  // Leg 5: sprint west along the z = -90 street, then into the plaza.
  await walkTo(-40, cps[3].z, 30000, true);
  await walkTo(cps[4].x, cps[4].z, 12000, true);
  legs.push((await reach(5, 3000)) ? 'ok' : await assist(5, null));
  await shot('gothamParkour-result');
  return { ...(await done()), legs };
}

// ---- Vehicle challenges (Task 1, 2026-09-30): real steering through src/core/bindings.js's
// default keys, not the runner's own finish() shortcut. Keyboard has no analog stick, so both
// pilots bang-bang the turn keys toward whatever point they are chasing (same idea as
// parkourRun's walkTo/face loop above), re-aiming every tick instead of planning a full path.
// suggestThresholds treats these exactly like the glide courses: lowest sampled time is a clean
// scripted line, so gold is set just above it (hard but reachable), bronze well below it (a
// forgiving first try).
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
async function setKey(cur, want) {
  if (want === cur) return cur;
  if (cur) await page.keyboard.up(cur);
  if (want) await page.keyboard.down(want);
  return want;
}

// Gotham Grand Prix: the Batmobile (already entered by vehicleChallenges.js's 'parkour' prepare
// hook, before fresh() returns) through the 8 street-grid gates. Full throttle, boosting on the
// straights; brakes off the boost and steers hard into the 90-degree corners, since the arcade
// turn rate is speed-independent (vehiclePhysics.js stepDrive) and a fast entry just understeers
// into the buildings lining a 14 m street, costing far more time than the boost saved.
// Both real-input pilots below render the same heavy city scene as every other run, but with no
// pointer-lock or fixed-pixel mouse aim of their own (unlike arenaRun's page.mouse.click(640,
// 360)), so nothing here depends on the page's viewport size. On a software-rendered GPU (no
// hardware accel, e.g. this sandbox's SwiftShader fallback: see the WEBGL_debug_renderer_info
// check this was diagnosed with), 1280x720 can render so slowly that game.js's own per-frame dt
// clamp (step(): `const real = Math.min(0.05, (now - last) / 1000)`) starves the sim of simulated
// time. Shrinking the viewport and switching to the 'low' quality preset (src/render/quality.js:
// no shadows, fewer rain particles, the comic post pass off) for just these two functions cuts
// real time to a result several-fold without touching arenaRun/glideRun/parkourRun's viewport.
const VEHICLE_VIEWPORT = { width: 480, height: 270 };
const FULL_VIEWPORT = { width: 1280, height: 720 };

async function driveRun(id, n) {
  await page.setViewportSize(VEHICLE_VIEWPORT);
  await fresh(id, '&q=low');
  const ch = CHALLENGES.find((c) => c.id === id);
  const cps = ch.checkpoints;
  let steerKey = null, longKey = 'KeyW', boostOn = false;
  await page.keyboard.down('KeyW');
  let shotAt = 1500;
  // Never brakes to slow into a corner: braking kills the very speed the arcade turn rate needs
  // (vehiclePhysics.js stepDrive ramps turnRate in below turnRefSpeed=9 m/s and holds it flat
  // above that, so a near-stopped car barely turns at all). Coasting at non-boosted max speed
  // (32 m/s, turn radius 32/2.1 ~ 15 m) clears a gate; only the boost (46 m/s, ~22 m radius) is
  // held back near a turn. Wedge recovery (truly stuck against something) is the only time this
  // reverses: straight back, no steer, so it does not carve itself deeper into whatever it hit.
  let lastPos = null, lastPosT = 0, recoverUntil = 0;
  const t0 = Date.now();
  while (!(await done()) && Date.now() - t0 < 240000) {
    const s = await page.evaluate(() => {
      const g = window.__game, bm = g.vehicles.batmobile;
      return { x: g.hero.pos.x, z: g.hero.pos.z, yaw: bm.v.yaw, speed: bm.v.speed, next: g.side.challenges.debug?.next ?? 0 };
    });
    const idx = Math.min(s.next, cps.length - 1);
    const cp = cps[idx];
    // Every gate here sits exactly on the street grid, and each leg keeps one axis fixed (see
    // gothamGrandPrix's own comment in src/game/challenges.js: 90-degree turns on real, clear
    // centrelines). Aiming straight at the next gate the instant the one before it is reached cuts
    // the corner diagonally across the block between the two streets, not around it on pavement
    // (that is what stalled run 0/1/2 against a building at Gate 3, confirmed by TRACE: err~0 but
    // speed repeatedly slammed negative by a wall bounce). Instead, rail-follow: snap the aim's
    // fixed axis onto the gate's own line immediately, and carrot the moving axis a lookahead
    // distance ahead, exactly like a human keeping to their lane before the turn.
    const prev = idx === 0 ? ch.start : cps[idx - 1];
    const LOOKAHEAD = 20;
    let aimX, aimZ;
    if (cp.x === prev.x) { aimX = cp.x; aimZ = Math.abs(cp.z - s.z) <= LOOKAHEAD ? cp.z : s.z + Math.sign(cp.z - s.z) * LOOKAHEAD; }
    else { aimZ = cp.z; aimX = Math.abs(cp.x - s.x) <= LOOKAHEAD ? cp.x : s.x + Math.sign(cp.x - s.x) * LOOKAHEAD; }
    const dx = aimX - s.x, dz = aimZ - s.z;
    const dist = Math.hypot(cp.x - s.x, cp.z - s.z);
    const err = wrap(Math.atan2(dx, dz) - s.yaw);
    // Gate 2/4/6 (the "hard right" ones) are where the course actually turns: the leg into them
    // runs one axis, the leg out of them runs the other. Arcade turning has a real radius (turn
    // radius = speed / turnRate, vehiclePhysics.js), so entering one of these at a boosted 40+ m/s
    // swings wide enough to clip the building on the corner (confirmed by TRACE: the car stalling
    // here, wedged a few metres off the street centreline, while `err` stayed small). Brake for
    // these specifically, down to a speed the arcade turn rate is already maxed out at
    // (turnRefSpeed=9 m/s) but not so slow steering stalls out entirely.
    const nextCp = cps[idx + 1];
    const legVertical = cp.x === prev.x;
    const approachingTurn = nextCp ? legVertical !== (nextCp.x === cp.x) : false;
    const now = Date.now();
    if (!lastPos) { lastPos = { x: s.x, z: s.z }; lastPosT = now; }
    else if (now - lastPosT > 900) {
      const moved = Math.hypot(s.x - lastPos.x, s.z - lastPos.z);
      if (moved < 2 && now > recoverUntil) recoverUntil = now + 1100;
      lastPos = { x: s.x, z: s.z }; lastPosT = now;
    }
    const recovering = now < recoverUntil;
    const slowForTurn = !recovering && approachingTurn && dist < 25 && s.speed > 13;
    // D now turns right (steer goes in negated in vehicles.js: "Physics steer is +1 = yaw up = a
    // LEFT turn ... the D key is move.x +1, a right turn, so it goes in negated"). Wanting yaw to
    // increase (err > 0) means holding A, not D.
    steerKey = await setKey(steerKey, recovering ? null : Math.abs(err) < 0.08 ? null : err > 0 ? 'KeyA' : 'KeyD');
    longKey = await setKey(longKey, (recovering || slowForTurn) ? 'KeyS' : 'KeyW');
    const wantBoost = !recovering && !slowForTurn && !(approachingTurn && dist < 25) && Math.abs(err) < 0.25 && dist > 18;
    if (wantBoost !== boostOn) { await page.keyboard[wantBoost ? 'down' : 'up']('ShiftLeft'); boostOn = wantBoost; }
    const elapsed = now - t0;
    if (process.env.TRACE) console.log(`${id}-${n} t=${(elapsed / 1000).toFixed(1)} next=${s.next} x=${s.x.toFixed(1)} z=${s.z.toFixed(1)} dist=${dist.toFixed(1)} spd=${s.speed.toFixed(1)} err=${err.toFixed(2)} rec=${recovering}`);
    if (elapsed >= shotAt) { await shot(`${id}-${n}-mid`); shotAt = Infinity; }
    await page.waitForTimeout(90);
  }
  if (steerKey) await page.keyboard.up(steerKey);
  if (longKey) await page.keyboard.up(longKey);
  if (boostOn) await page.keyboard.up('ShiftLeft');
  await shot(`${id}-${n}-result`);
  const r = await done();
  await page.setViewportSize(FULL_VIEWPORT);
  return r;
}

// Wing Walk: the Batwing (already called and boarded by vehicleChallenges.js's 'rings' prepare
// hook, same timing as above) through the ring loop around the clock tower. Pure pursuit on the
// next ring: pitch (forward/back climbs/dives, see wingFlight.js stepWing) and roll (left/right
// banks and turns) bang-banged toward the bearing to it; boost only when already lined up and far
// out, since a boosted plane turns at the same rate as a cruising one but with a wider radius.
// Walks forward along (prevPt -> rings[idx] -> rings[idx+1] -> ...), a lookahead distance ahead
// of wherever `s` projects onto the first segment, spilling over into later segments instead of
// clamping at the next ring. Clamping there (the first version of this fix) meant the aim point
// collapsed back to the raw ring center for the whole last stretch of every leg, since a 16-22m
// lookahead ate most of a ~29m segment, and TRACE showed exactly the same close-in orbit failure
// as plain pursuit right at that point. Spilling over keeps the plane always aiming somewhat past
// whatever ring is next, so it threads each one on the way through instead of ever needing to
// stop and point straight at it.
function leadPoint(rings, idx, prevPt, s, lookahead) {
  let from = prevPt, i = idx, first = true;
  for (;;) {
    const to = rings[i];
    const sx = to.x - from.x, sy = to.y - from.y, sz = to.z - from.z;
    const segLen = Math.hypot(sx, sy, sz) || 1;
    const ux = sx / segLen, uy = sy / segLen, uz = sz / segLen;
    const proj = first ? Math.max(0, Math.min(segLen, (s.x - from.x) * ux + (s.y - from.y) * uy + (s.z - from.z) * uz)) : 0;
    const avail = segLen - proj;
    if (lookahead <= avail || i === rings.length - 1) {
      const lead = proj + Math.min(lookahead, avail);
      return { x: from.x + ux * lead, y: from.y + uy * lead, z: from.z + uz * lead };
    }
    lookahead -= avail;
    from = to; i += 1; first = false;
  }
}

async function flyRun(id, n) {
  await page.setViewportSize(VEHICLE_VIEWPORT);
  await fresh(id, '&q=low');
  // Lifts the in-page copy's own time limit for this measurement run only (the runner fails the
  // challenge once run.logic.time exceeds it): the current committed limit is itself one of the
  // guessed numbers this script exists to replace, so it must not be allowed to cut a real
  // completion time short before suggestThresholds ever sees it.
  await page.evaluate((id) => { const c = window.__game.side.data.CHALLENGES.find((x) => x.id === id); if (c) c.limit = 999; }, id);
  const flyCh = CHALLENGES.find((c) => c.id === id);
  const rings = flyCh.rings;
  // wingWalk's rings sit exactly on one circle (challenges.js: ringLoop(-62, -160, 46, ...)),
  // derived here rather than hardcoded so this still works if the course geometry ever changes.
  // Ring-to-ring point chasing (the leadPoint chain above) got every leg but one, then locked into
  // a many-second, very slowly converging spiral on the last one or two rings: TRACE showed dist
  // shrink lap over lap (30 -> 20 -> 14 m) but never inside the 5 m ring within a 90+ s window,
  // because the plane's minimum turn radius at brake speed (~20 m) is already close to the 46 m
  // loop radius, so any reactive, late correction overshoots. Flying the circle itself continuously
  // (aim a fixed lead angle ahead of wherever the plane currently sits on the circle, every tick,
  // not just when a ring is reached) keeps it tangent to the curve the whole way, so by the time
  // each ring arrives the plane is already lined up instead of scrambling to intercept it.
  const CENTER_X = rings.reduce((a, r) => a + r.x, 0) / rings.length;
  const CENTER_Z = rings.reduce((a, r) => a + r.z, 0) / rings.length;
  const RADIUS = rings.reduce((a, r) => a + Math.hypot(r.x - CENTER_X, r.z - CENTER_Z), 0) / rings.length;
  const ANGLE_STEP = (Math.PI * 2) / rings.length;
  const LEAD_ANGLE = 0.4; // rad, about 2/3 of one ring's spacing around the loop
  let pitchKey = null, rollKey = null, boostOn = false, brakeKey = null;
  let shotAt = 1500;
  const t0 = Date.now();
  while (!(await done()) && Date.now() - t0 < 240000) {
    const s = await page.evaluate(() => {
      const g = window.__game, st = g.batwing.state;
      return { x: st.x, y: st.y, z: st.z, yaw: st.yaw, roll: st.roll, speed: st.speed, next: g.side.challenges.debug?.next ?? 0 };
    });
    const idx = Math.min(s.next, rings.length - 1);
    const target = rings[idx];
    let aim;
    if (idx === 0) {
      // The one-off run from the clock tower roof to the first ring: not on the circle yet, so
      // this leg is a straight point-chase (no repeated orbit risk, it only ever happens once).
      aim = leadPoint(rings, 0, flyCh.start, s, 14);
    } else {
      // On the circle: aim at a point LEAD_ANGLE further around it than wherever the plane
      // currently projects onto the circle, continuously (not "the next ring" as a fixed point).
      const rawA = Math.atan2(s.x - CENTER_X, s.z - CENTER_Z);
      const idxAngle = idx * ANGLE_STEP;
      let curA = rawA;
      while (curA < idxAngle - Math.PI) curA += Math.PI * 2;
      while (curA > idxAngle + Math.PI) curA -= Math.PI * 2;
      const aimA = curA + LEAD_ANGLE;
      const aFrac = aimA / ANGLE_STEP;
      const i0 = Math.floor(aFrac);
      const w = (i) => rings[((i % rings.length) + rings.length) % rings.length];
      const r0 = w(i0), r1 = w(i0 + 1);
      const t = aFrac - i0;
      aim = { x: CENTER_X + Math.sin(aimA) * RADIUS, y: r0.y + (r1.y - r0.y) * t, z: CENTER_Z + Math.cos(aimA) * RADIUS };
    }
    // Altitude undulates at TWICE the loop's angular rate (ringLoop's sin(2a) in challenges.js),
    // so the same lead angle used for XZ overshoots badly in Y (confirmed by TRACE: closing to
    // 0.7 m horizontally on a ring while 8.7 m off in altitude, since the lookahead point's own Y
    // was already leaning toward the NEXT ring's height). Pitch tracks the actual next ring's
    // altitude, not the lookahead point's.
    const dx = aim.x - s.x, dz = aim.z - s.z, dy = target.y - s.y;
    const dist = Math.hypot(target.x - s.x, target.z - s.z);
    const err = wrap(Math.atan2(dx, dz) - s.yaw);
    // Same D-now-turns-right fix as the car (batwing.js: "Roll +1 banks and turns LEFT ... D and
    // mouse-right mean a right turn, so both go in negated").
    rollKey = await setKey(rollKey, Math.abs(err) < 0.06 ? null : err > 0 ? 'KeyA' : 'KeyD');
    pitchKey = await setKey(pitchKey, Math.abs(dy) < 1.5 ? null : dy > 0 ? 'KeyW' : 'KeyS');
    // Still brake for a large heading error (off the line, or just spawned): shrinks the turn
    // radius (brakeSpeed 20 m/s vs cruise 42) so it can actually get back onto the lookahead line.
    const wantBrake = Math.abs(err) > 0.35;
    brakeKey = await setKey(brakeKey, wantBrake ? 'Space' : null);
    // Boosting was the actual culprit behind the orbit-on-approach failures, not just a close-in
    // turn-radius problem: every ring-to-ring leg on this loop turns about 36 degrees (10 rings
    // evenly spaced around one circle), so arriving at a ring at boost speed (76 m/s, carried
    // from the previous, now-straight-feeling leg) makes the NEXT turn's radius huge, sending the
    // plane on a multi-second detour before it can recover (confirmed by TRACE: dist spiking to
    // 70+ m right after almost every ring pass while boostOn had been true coming in). This loop
    // is flown at cruise the whole way; boost stays off.
    const wantBoost = false;
    if (wantBoost !== boostOn) { await page.keyboard[wantBoost ? 'down' : 'up']('ShiftLeft'); boostOn = wantBoost; }
    const elapsed = Date.now() - t0;
    if (process.env.TRACE) console.log(`${id}-${n} t=${(elapsed / 1000).toFixed(1)} next=${s.next} x=${s.x.toFixed(1)} y=${s.y.toFixed(1)} z=${s.z.toFixed(1)} yaw=${s.yaw.toFixed(2)} aimX=${aim.x.toFixed(1)} aimZ=${aim.z.toFixed(1)} tgtX=${target.x.toFixed(1)} tgtZ=${target.z.toFixed(1)} dist=${dist.toFixed(1)} err=${err.toFixed(2)} dy=${dy.toFixed(1)} brake=${wantBrake} roll=${s.roll.toFixed(2)} spd=${s.speed.toFixed(1)}`);
    if (elapsed >= shotAt) { await shot(`${id}-${n}-mid`); shotAt = Infinity; }
    await page.waitForTimeout(80);
  }
  if (rollKey) await page.keyboard.up(rollKey);
  if (pitchKey) await page.keyboard.up(pitchKey);
  if (brakeKey) await page.keyboard.up(brakeKey);
  if (boostOn) await page.keyboard.up('ShiftLeft');
  await shot(`${id}-${n}-result`);
  const r = await done();
  await page.setViewportSize(FULL_VIEWPORT);
  return r;
}

const out = {};
for (const ch of CHALLENGES) {
  if (only.length && !only.includes(ch.id)) continue;
  const samples = [];
  // gothamGrandPrix and wingWalk are checked by id, not kind: they share 'parkour'/'rings' with
  // the on-foot courses (see vehicleChallenges.js), but need a real driving/flying pilot instead
  // of parkourRun's move-specific legs or glideRun's glide-camera aim.
  if (ch.id === 'gothamGrandPrix') {
    for (let n = 0; n < REPS; n++) { const r = await driveRun(ch.id, n); if (r && !r.failed) samples.push(r.value); console.log(ch.id, n, r); }
  } else if (ch.id === 'wingWalk') {
    for (let n = 0; n < REPS; n++) { const r = await flyRun(ch.id, n); if (r && !r.failed) samples.push(r.value); console.log(ch.id, n, r); }
  } else if (ch.kind === 'rings') {
    for (let n = 0; n < REPS; n++) { const r = await glideRun(ch.id, n); if (r && !r.failed) samples.push(r.value); console.log(ch.id, n, r); }
  } else if (ch.kind === 'arena') {
    for (let n = 0; n < REPS; n++) { const r = await arenaRun(n); if (r && !r.failed) samples.push(r.value); console.log(ch.id, n, r); }
  } else {
    const r = await parkourRun();
    console.log(ch.id, r);
    if (r && !r.failed && r.legs.every((l) => l === 'ok')) samples.push(r.value);
    else console.log(`${ch.id}: legs ${r?.legs?.join(', ')}. Fix the assisted legs (script or checkpoints) and rerun.`);
  }
  out[ch.id] = samples.length ? { samples, suggested: suggestThresholds(ch.kind, samples) } : { samples, suggested: null };
}
console.log('\n' + JSON.stringify(out, null, 1));
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
