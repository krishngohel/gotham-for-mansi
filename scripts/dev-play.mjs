// Dev helper: runs a scripted play session and captures screenshots.
// usage: node scripts/dev-play.mjs <url> <outDir> '<steps json>'
// steps: [{ "hold": ["KeyW"], "ms": 800 }, { "press": "Space" }, { "eval": "js" }, { "shot": "name" }, { "wait": 300 }]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [url, outDir, stepsJson] = process.argv.slice(2);
const steps = JSON.parse(stepsJson);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url);
await page.waitForFunction('window.__game?.state?.frame > 30', null, { timeout: 90000 });
for (const s of steps) {
  if (s.hold) {
    for (const k of s.hold) await page.keyboard.down(k);
    await page.waitForTimeout(s.ms ?? 500);
    for (const k of s.hold) await page.keyboard.up(k);
  }
  if (s.down) for (const k of s.down) await page.keyboard.down(k);
  if (s.up) for (const k of s.up) await page.keyboard.up(k);
  if (s.press) await page.keyboard.press(s.press);
  if (s.click !== undefined) { await page.mouse.move(640, 360); await page.mouse.down({ button: s.click === 2 ? 'right' : 'left' }); await page.waitForTimeout(40); await page.mouse.up({ button: s.click === 2 ? 'right' : 'left' }); }
  if (s.eval) { const r = await page.evaluate(s.eval); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.shot) await page.screenshot({ path: `${outDir}/${s.shot}.png` });
}
console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close();
