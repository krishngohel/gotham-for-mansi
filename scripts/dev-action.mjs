// Dev helper: loads a look-test URL, runs a JS action, waits, screenshots.
import { chromium } from 'playwright-core';
const [url, out, action = '', delay = '240'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(e.message));
await page.goto(url);
await page.waitForFunction('window.__look && window.__look.frame > 90', null, { timeout: 90000 });
if (action) await page.evaluate(action);
await page.waitForTimeout(Number(delay));
await page.screenshot({ path: out });
console.log(logs.join('\n') || 'no console errors', '| fps', await page.evaluate(() => window.__look.fps));
await browser.close();
