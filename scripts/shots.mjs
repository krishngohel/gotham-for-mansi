// Captures look-test frames on the real GPU into docs/look-test/.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const shots = [
  ['1-signal', '?cam=hero'],
  ['2-suit-batman', '?cam=face'],
  ['3-suit-batgirl', '?cam=face&suit=f'],
  ['4-punch', '?cam=fight', true],
  ['5-detective', '?cam=fight&detective=1'],
  ['6-rooftop', '?cam=wide'],
];
await mkdir('docs/look-test', { recursive: true });
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
for (const [name, query, punch] of shots) {
  await page.goto(`http://localhost:5200/${query}&fps=1`);
  await page.waitForFunction(() => window.__look?.ready && window.__look.frame > 120, null, { timeout: 90000 });
  if (punch) { await page.evaluate(() => window.__look.punch()); await page.waitForTimeout(240); }
  await page.screenshot({ path: `docs/look-test/${name}.png` });
  console.log(name, await page.evaluate(() => window.__look.fps), 'fps');
}
await browser.close();
