import { chromium } from 'playwright-core';
const [url, expr] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(url);
await page.waitForFunction('window.__look && window.__look.frame > 30', null, { timeout: 90000 });
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
await browser.close();
