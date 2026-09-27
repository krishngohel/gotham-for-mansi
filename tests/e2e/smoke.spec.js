import { test, expect } from '@playwright/test';
import sharp from 'sharp';

for (const url of ['/?cam=fight', '/?cam=face&suit=f&q=low']) {
  test(`look test renders ${url}`, async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__look?.ready && window.__look.frame > 20, null, { timeout: 90000 });
    await page.evaluate(() => window.__look.punch());
    await page.waitForTimeout(400);
    const stats = await sharp(await page.screenshot()).stats();
    expect(stats.channels[0].stdev).toBeGreaterThan(8);
    expect(await page.locator('.hud-combo .n').textContent()).toBe('1');
    expect(errors).toEqual([]);
  });
}
