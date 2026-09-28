// Checks both predator rooms against the live city (src/stealth/roomCheck.js): patrol floors and
// legs, perches, the entry, the huddle, the vent and overlapping set pieces.
// Usage: node scripts/stealth-check.mjs [url]   (point it at a frozen build: vite preview)
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5210/';
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game?.state?.ready, null, { timeout: 120000 });
const report = await page.evaluate(() => window.__game.checkStealthRooms());
for (const r of report) console.log(`${r.room.padEnd(16)} ${r.kind.padEnd(14)} ${r.detail}`);
console.log(report.length ? `${report.length} problems` : 'all rooms sound');
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
process.exit(report.length || errors.length ? 1 : 0);
