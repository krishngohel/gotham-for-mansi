import { test, expect } from '@playwright/test';
import sharp from 'sharp';

const ready = () => window.__game?.state?.ready && window.__game.state.frame > 20;

async function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('title screen renders with no errors', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await expect(page.locator('.title-menu')).toBeVisible();
  const stats = await sharp(await page.screenshot()).stats();
  expect(stats.channels[0].stdev).toBeGreaterThan(8);
  expect(errors).toEqual([]);
});

test('new game: suit select, intro comic, then play', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.locator('.mbtn.primary').click();
  await page.locator('.suit-card.suit-m').click();
  await page.waitForFunction(() => window.__game.flow?.mode === 'cutscene', null, { timeout: 30000 });
  // The intro now plays an optional cinematic push-in (window.__game.cinematic) ahead of the comic
  // pages; Escape skips whichever of the two is currently up.
  await page.keyboard.press('Escape');
  await expect(page.locator('.comic.show')).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__game.flow.mode === 'play', null, { timeout: 10000 });
  expect(await page.locator('.hud-caption .obj').textContent()).toContain('Batsignal');
  expect(errors).toEqual([]);
});

test('a fight can be won and advances the story', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?at=f1&god=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.evaluate(() => window.__game.teleport('wh3Roof'));
  await page.waitForFunction(() => window.__game.enemies.some((e) => e.aware), null, { timeout: 10000 });
  await page.mouse.click(640, 360);
  await page.evaluate(() => window.__game.winFight());
  await page.waitForFunction(() => window.__game.flow.objectives.step.id === 'toYard', null, { timeout: 10000 });
  expect(errors).toEqual([]);
});

test('boss fight begins after its comic', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?at=boss&god=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__game.boss.phase === 1, null, { timeout: 15000 });
  await expect(page.locator('.hud-boss.show')).toBeVisible();
  expect(errors).toEqual([]);
});
