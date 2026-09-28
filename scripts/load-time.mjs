// Measures boot time with a throttled network and CPU, like a mid-range laptop on home wifi.
// Usage: node scripts/load-time.mjs [url] [downMbps] [cpuSlowdown]
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5202/';
const mbps = Number(process.argv[3] ?? 40);
const cpu = Number(process.argv[4] ?? 2);
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 30, downloadThroughput: (mbps * 1e6) / 8, uploadThroughput: 5e6 / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
let bytes = 0;
page.on('response', async (r) => { try { bytes += Number(r.headers()['content-length'] ?? 0) || (await r.body()).length; } catch {} });
const t0 = Date.now();
await page.goto(url);
await page.waitForFunction(() => performance.getEntriesByName('boot:firstFrame').length > 0, null, { timeout: 300000 });
await page.waitForTimeout(3000);
const r = await page.evaluate(() => {
  const m = Object.fromEntries(performance.getEntriesByType('mark').filter((e) => e.name.startsWith('boot:')).map((e) => [e.name.slice(5), Math.round(e.startTime)]));
  const frames = window.__game?.state?.frame;
  return { marks: m, frames };
});
console.log(JSON.stringify({ url, mbps, cpu, wallMs: Date.now() - t0, MB: +(bytes / 1e6).toFixed(1), ...r }));
await browser.close();
