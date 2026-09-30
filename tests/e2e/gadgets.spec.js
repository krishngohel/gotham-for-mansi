import { test, expect } from '@playwright/test';

async function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
async function boot(page, query) {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__game?.gadgets && window.__game?.wayne, null, { timeout: 90000 });
  // A query with no ?at= (this file's first test) lands on 'intro', which may play an optional
  // cinematic (window.__game.cinematic) ahead of its comic; skip both, in order.
  await page.evaluate(() => window.__game.cinematic?.skip());
  await page.waitForFunction(() => !window.__game.cinematic?.active, null, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => window.__game.comic.playing && window.__game.comic.skip());
  await page.waitForTimeout(800);
}

test('the gadget wheel opens on Tab, 3 picks gel, and no chain fires', async ({ page }) => {
  const errors = await collectErrors(page);
  // at=signal: this test is about the gadget wheel over the GCPD-roof combat sandbox, not the
  // story; skips the intro's comic (and its optional cinematic) so the awakened ?fight=test squad
  // can't land a free hit on Mansi during that handoff before the assertions below run.
  await boot(page, 'fight=test&god=1&gadgets=all&at=signal');
  await page.keyboard.down('Tab');
  await page.waitForTimeout(300);
  await expect(page.locator('.gwheel.show')).toBeVisible();
  expect(await page.evaluate(() => window.__game.time.held)).toBeCloseTo(0.2);
  await page.keyboard.press('Digit3');
  await page.keyboard.up('Tab');
  await page.waitForTimeout(300);
  await expect(page.locator('.gwheel.show')).toHaveCount(0);
  expect(await page.evaluate(() => [window.__game.gadgets.state.equipped, window.__game.hero.control?.name ?? null])).toEqual(['gel', null]);
  await expect(page.locator('.ghud .gh-name')).toHaveText(/Explosive Gel/i);
  expect(errors).toEqual([]);
});

test('explosive gel opens the Monarch booth and the balloon inside', async ({ page }) => {
  const errors = await collectErrors(page);
  // No `gadgets=all` here: gel is already unlocked naturally at this step (its unlock, toNeon,
  // comes earlier in STEPS), and `gadgets=all` sets breakables' own `dev` flag (game.js), which
  // deliberately keeps `progress.gadgets.broken` untouched for the session (same isolation as
  // WayneTech's dev-run xp copy), and this test needs that array to actually update.
  await boot(page, 'at=toMonarch&god=1&new=1');
  await page.evaluate(() => {
    const G = window.__game;
    G.gadgets.equip('gel');
    G.teleport({ x: 152.5, y: 0.15, z: -60 });
    G.hero.bat.face(Math.PI / 2);
    G.follow.snapBehind(Math.PI / 2, 0.15);
  });
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(400);
  await page.keyboard.down('KeyR');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyR');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__game.progress.gadgets.broken)).toContain('wallMonarchBooth');
  await page.evaluate(() => window.__game.hero.teleport({ x: 158.3, y: 0.15, z: -60 }, Math.PI / 2));
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__game.progress.balloons)).toContain(6);
  expect(errors).toEqual([]);
});

test('a WayneTech purchase shows on the page and survives a reload', async ({ page }) => {
  const errors = await collectErrors(page);
  await boot(page, 'at=toNeon&god=1&new=1');
  await page.evaluate(() => window.__game.wayne.award(1000, 'test'));
  await expect(page.locator('.hud-card.show')).toContainText('LEVEL 2');
  await page.keyboard.press('Escape');
  await page.locator('.pause-menu .mbtn', { hasText: 'WayneTech' }).click();
  await expect(page.locator('.wt-menu')).toBeVisible();
  await page.locator('.wt-card.buyable', { hasText: 'Reinforced Plating' }).click();
  await expect(page.locator('.wt-card.owned', { hasText: 'Reinforced Plating' })).toBeVisible();
  expect(await page.evaluate(() => window.__game.hero.maxHealth)).toBe(125);
  await boot(page, 'at=toNeon&god=1');
  expect(await page.evaluate(() => [window.__game.wayne.xp, window.__game.progress.wayne.owned, window.__game.hero.maxHealth])).toEqual([1000, ['plating1'], 125]);
  expect(errors).toEqual([]);
});
