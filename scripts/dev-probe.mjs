// Dev helper: loads a URL, waits for the game (or look test), evaluates an expression, prints JSON.
import { chromium } from 'playwright-core';
const [url, expr, wait = 'window.__game?.state?.frame > 20 || window.__look?.frame > 20'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 300)); });
await page.goto(url);
await page.waitForFunction(wait, null, { timeout: 90000 });
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
await browser.close();
