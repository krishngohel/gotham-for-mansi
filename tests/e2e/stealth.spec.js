import { test, expect } from '@playwright/test';

const ready = () => window.__game?.state?.ready && window.__game.state.frame > 20;
async function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
async function enterRoom(page, step) {
  await page.goto(`/?at=${step}&god=1`);
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.waitForFunction(() => window.__game.stealth?.active, null, { timeout: 30000 });
  await page.evaluate(() => window.__game.comic.playing && window.__game.comic.skip());
  // The pointer isn't locked yet on a direct ?at= entry (no title-screen click acquired it), and
  // since main's merge the first unlocked click only re-acquires the lock and swallows whatever
  // action it buffered (src/game/game.js's canvas click handler, for Safari). Spend that click
  // here, harmlessly, so the click used for the actual takedown below fires normally.
  await page.mouse.click(640, 360);
  await page.waitForTimeout(1000);
}

test('a predator room patrols, and a silent takedown from behind lands', async ({ page }) => {
  const errors = await collectErrors(page);
  await enterRoom(page, 'monarchBalcony');
  const before = await page.evaluate(() => window.__game.stealth.goons.map((g) => [g.e.pos.x, g.e.pos.z]));
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => window.__game.stealth.goons.map((g) => [g.e.pos.x, g.e.pos.z]));
  expect(after.some((p, i) => Math.hypot(p[0] - before[i][0], p[1] - before[i][1]) > 1)).toBe(true);
  // Catch it mid-leg, walking straight: at a waypoint it turns, and Batman would end up at its side.
  await page.waitForFunction(() => {
    const e = window.__game.stealth.goons[0].e;
    return e.pos.z > -70 && e.pos.z < -50 && Math.abs(Math.sin(e.yaw)) < 0.05;
  }, null, { timeout: 30000 });
  await page.evaluate(() => {
    const G = window.__game, e = G.stealth.goons[0].e;
    G.hero.teleport({ x: e.pos.x - Math.sin(e.yaw) * 0.8, y: e.pos.y, z: e.pos.z - Math.cos(e.yaw) * 0.8 }, e.yaw);
  });
  await page.waitForTimeout(100);
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => !window.__game.stealth.goons[0].e.alive, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__game.stealth.alarm)).toBe(false);
  expect(errors).toEqual([]);
});

test('clearing a predator room moves the story on', async ({ page }) => {
  const errors = await collectErrors(page);
  await enterRoom(page, 'aceCatwalks');
  await page.evaluate(() => window.__game.winFight());
  await page.waitForFunction(() => window.__game.flow.objectives.step?.id === 'cake', null, { timeout: 10000 });
  expect(await page.evaluate(() => window.__game.stealth.active)).toBe(false);
  expect(errors).toEqual([]);
});

test('a save under the new (v2) key resumes on its saved step id', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.evaluate(() => localStorage.setItem('gotham-mansi-progress-v2', JSON.stringify({ stepId: 'cake', balloons: [], suit: 'm' })));
  await page.reload();
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.evaluate(() => window.__game.begin('m', false));
  await page.waitForFunction(() => window.__game.flow?.objectives?.step, null, { timeout: 10000 });
  expect(await page.evaluate(() => window.__game.flow.objectives.step.id)).toBe('cake');
  expect(errors).toEqual([]);
});
