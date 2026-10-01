import { test, expect } from '@playwright/test';

const ready = () => window.__game?.state?.ready && window.__game.state.frame > 20;
async function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('a free-roam Joker van chase spawns, is won by real driving, and is counted', async ({ page }) => {
  test.setTimeout(60000);
  const errors = await collectErrors(page);
  await page.goto('/?at=toNeon&god=1&new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  // A known clear street spot (the same one the street-crime e2e test above uses): `?at=toNeon`
  // can otherwise leave her up on a roof, nowhere near a real road to drive on.
  await page.evaluate(() => window.__game.teleport({ x: 150, y: 0, z: -14 }));

  // Spawn one through the same public entry point the free-roam scheduler itself uses
  // (src/game/vanChaseDirector.js), instead of waiting out its real 90 to 210 s gap.
  await page.waitForFunction(() => window.__game.vehicles.trySpawnSideChase(window.__game.hero.pos), null, { timeout: 10000 });
  await expect(page.locator('.radio.show')).toContainText('Joker van');

  // Get into the Batmobile for real: summon it, then press the vehicle key, same as a player.
  await page.evaluate(() => window.__game.vehicles.summon('batmobile', { instant: true }));
  await page.waitForTimeout(400);
  await page.evaluate(() => { const v = window.__game.vehicles; if (!v.active) v.enter(v.batmobile); });
  await page.waitForFunction(() => window.__game.vehicles.active?.kind === 'batmobile', null, { timeout: 5000 });
  // Pointer lock first, the same as a player clicking into the game before driving.
  await page.mouse.click(640, 400);
  await page.waitForTimeout(250);

  // Real driving: steer toward wherever the van actually is right now, correcting every tick the
  // same way a player's hands would, with a little hysteresis so it doesn't flap the keys back
  // and forth right on a zero crossing. Gas while the van is roughly ahead; once she's overtaken
  // it (it's fallen mostly behind), brake instead so speed (and turn radius) drops and she can
  // wheel back around rather than ballooning out into a huge loop, and hold the handbrake into a
  // hard turn for a tighter circle. Keeps going until it's rammed 3 times (vehicles.js's own ram
  // rule) or we give up.
  let hits = 0, heldSteer = 0, heldPedal = 0, cooldown = 0;
  for (let i = 0; i < 260 && hits < 3; i++) {
    const info = await page.evaluate(() => {
      const G = window.__game;
      const van = G.vehicles.sideChase?.van;
      const bm = G.vehicles.batmobile.group.position;
      if (!van) return null;
      const dx = van.group.position.x - bm.x, dz = van.group.position.z - bm.z;
      const wantYaw = Math.atan2(dx, dz);
      const yaw = G.vehicles.batmobile.v.yaw;
      return {
        hits: G.vehicles.sideChase?.ramCounter.hits ?? 0,
        speed: G.vehicles.batmobile.v.speed,
        delta: Math.atan2(Math.sin(wantYaw - yaw), Math.cos(wantYaw - yaw)),
      };
    });
    if (!info) break;
    const justRammed = info.hits > hits;
    hits = info.hits;
    if (hits >= 3) break;
    // Right after a ram, brake hard for a beat regardless of heading: a fresh contact is almost
    // always still carrying a lot of speed past a much slower van, and that speed is exactly what
    // turns the next approach into a wide, slow loop instead of a quick second pass.
    if (justRammed) cooldown = 10; // ticks (~1s at 100ms)
    if (cooldown > 0) cooldown -= 1;
    // steer +1 (A) turns left (raises yaw); steer -1 (D) turns right. delta > 0: the van is left.
    let want = heldSteer;
    if (Math.abs(info.delta) < 0.06) want = 0;
    else if (info.delta > 0.15) want = 1;
    else if (info.delta < -0.15) want = -1;
    if (want !== heldSteer) {
      if (heldSteer === 1) await page.keyboard.up('KeyA');
      if (heldSteer === -1) await page.keyboard.up('KeyD');
      if (want === 1) await page.keyboard.down('KeyA');
      if (want === -1) await page.keyboard.down('KeyD');
      heldSteer = want;
    }
    const pedal = (cooldown <= 0 && Math.abs(info.delta) < 1.7) ? 1 : -1;
    if (pedal !== heldPedal) {
      if (heldPedal === 1) await page.keyboard.up('KeyW');
      if (heldPedal === -1) await page.keyboard.up('KeyS');
      if (pedal === 1) await page.keyboard.down('KeyW');
      if (pedal === -1) await page.keyboard.down('KeyS');
      heldPedal = pedal;
    }
    await page.keyboard[(want !== 0 && info.speed > 8) ? 'down' : 'up']('Space');
    await page.waitForTimeout(100);
  }
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyS');
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyD');
  await page.keyboard.up('Space');

  // The van (and so `info`/`hits`) disappears the instant the 3rd ram lands, in the same tick
  // vehicles.js clears it, so the real pass/fail signal is the counted result, not whatever hit
  // count this loop last happened to read.
  await page.waitForFunction(() => window.__game.progress.vanChases.stopped === 1, null, { timeout: 5000 });
  await expect(page.locator('.side-toast.show .toast-title')).toContainText('Van chase won');
  expect(errors).toEqual([]);
});

test('ignoring a free-roam van chase lets it drive off and despawn, uncounted', async ({ page }) => {
  test.setTimeout(30000);
  const errors = await collectErrors(page);
  await page.goto('/?at=toNeon&god=1&new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.waitForFunction(() => window.__game.vehicles.trySpawnSideChase(window.__game.hero.pos), null, { timeout: 10000 });
  expect(await page.evaluate(() => !!window.__game.vehicles.sideChase?.active)).toBe(true);
  // A story mission that needs the Batmobile for real cancels a running side chase at once,
  // the same as a fight, the boss or a cutscene would (src/game/vanChaseDirector.js).
  await page.evaluate(() => window.__game.events.emit('step', { step: { type: 'board' }, index: 0 }));
  expect(await page.evaluate(() => window.__game.vehicles.sideChase)).toBe(null);
  expect(await page.evaluate(() => window.__game.progress.vanChases.stopped)).toBe(0);
  expect(errors).toEqual([]);
});
