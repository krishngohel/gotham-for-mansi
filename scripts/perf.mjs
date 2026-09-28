// Measures frame rate at a spot in each district, on High and Low. Edge headless is uncapped.
import { chromium } from 'playwright-core';

const base = process.env.BASE ?? 'http://localhost:5200/';
const spots = [
  ['gcpd roof', 'toDocks', { x: 0, y: 42, z: 5 }, 2.6, 0.2],
  ['docks', 'toYard', { x: -60, y: 16, z: 175 }, 0.2, 0.25],
  ['neon street', 'toStreet', { x: 150, y: 0, z: 10 }, 0, 0.1],
  ['ace chemicals', 'toFactory', { x: 140, y: 25.1, z: -160 }, Math.PI, 0.3],
  ['clock plaza', 'toTower', { x: -62, y: 58, z: -148 }, Math.PI, 0.1],
];
const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge', args: ['--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--mute-audio'] });
for (const q of ['high', 'low']) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [name, step, p, yaw, pitch] of spots) {
    await page.goto(`${base}?at=${step}&god=1&q=${q}`);
    await page.waitForFunction(() => window.__game?.state?.ready && window.__game.teleport && window.__game.state.frame > 30, null, { timeout: 120000 });
    await page.evaluate(([p, yaw, pitch]) => { window.__game.teleport(p); window.__game.follow.snapBehind(yaw, pitch); }, [p, yaw, pitch]);
    await page.waitForTimeout(1200);
    const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(f); }));
    console.log(`${q.padEnd(4)} ${name.padEnd(14)} ${fps} fps`);
  }
  await page.close();
}
await browser.close();
