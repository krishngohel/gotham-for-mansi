import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ready = () => window.__game?.state?.ready && window.__game.state.frame > 20;
async function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
const pauseButton = (page, text) => page.locator('.pause-menu .mbtn', { hasText: text });

test('a glide challenge counts down, runs and can be quit from the pause menu', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?at=toNeon&god=1&new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.evaluate(() => window.__game.side.challenges.start('neonSlalom'));
  await expect(page.locator('.ch-panel.show')).toBeVisible();
  await page.waitForFunction(() => window.__game.side.challenges.running, null, { timeout: 10000 });
  await page.keyboard.press('Escape');
  await pauseButton(page, 'Quit challenge').click();
  await page.waitForFunction(() => !window.__game.side.challenges.active, null, { timeout: 5000 });
  const d = await page.evaluate(() => { const h = window.__game.hero.pos; return Math.hypot(h.x - 163, h.z - 100); });
  expect(d).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('a street crime spawns, is won and counted', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?at=toNeon&god=1&new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.evaluate(() => window.__game.side.crimes.force({ kind: 'robbery', spotId: 'neonNorth' }));
  await page.waitForFunction(() => !!window.__game.side.crimes.active, null, { timeout: 5000 });
  await expect(page.locator('.radio.show')).toContainText('Robbery on Neon Row');
  await page.evaluate(() => window.__game.teleport({ x: 150, y: 0, z: -14 }));
  await page.waitForFunction(() => window.__game.enemies.some((e) => e.aware), null, { timeout: 10000 });
  await page.waitForFunction(() => { window.__game.winFight(); return window.__game.progress.crimes.stopped === 1; }, null, { timeout: 20000, polling: 500 });
  expect(errors).toEqual([]);
});

test('photo mode opens with O, cycles filters and saves a PNG', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?at=toNeon&god=1&new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.keyboard.press('KeyO');
  await expect(page.locator('.photo-panel')).toBeVisible();
  expect(await page.evaluate(() => window.__game.state.paused)).toBe(true);
  await page.keyboard.press('Digit1');
  expect(await page.evaluate(() => window.__game.ink.uniforms.uFilter.value)).toBe(1);
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  expect(download.suggestedFilename()).toMatch(/^gotham-for-mansi-\d{8}-\d{6}\.png$/);
  expect([...readFileSync(await download.path()).subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.photo-panel')).toHaveCount(0);
  expect(await page.evaluate(() => [window.__game.ink.uniforms.uFilter.value, window.__game.state.paused])).toEqual([0, false]);
  expect(errors).toEqual([]);
});

test('the progress page shows the percentage, every part and the map', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?at=toNeon&god=1&new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.keyboard.press('Escape');
  await pauseButton(page, 'Progress').click();
  await expect(page.locator('.progress-menu h2')).toContainText('%');
  expect(await page.locator('.progress-menu .pg-row').count()).toBe(6);
  await expect(page.locator('.progress-menu canvas.pg-map')).toBeVisible();
  await page.locator('.progress-menu .mbtn', { hasText: 'Back' }).click();
  await pauseButton(page, 'Challenges').click();
  expect(await page.locator('.challenges-menu .cr-row').count()).toBe(5);
  expect(errors).toEqual([]);
});
