// Captures a set of gameplay screenshots on the real GPU into docs/screens/.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE ?? 'http://localhost:5200/';
const shots = [
  ['title', '?new=1', null],
  ['docks', '?at=toDocks', "window.__game.teleport({x: -70, y: 16, z: 170}); window.__game.follow.snapBehind(0.4, 0.3)"],
  ['neon', '?at=toStreet', "window.__game.teleport({x: 150, y: 0, z: 20}); window.__game.follow.snapBehind(0, 0.12)"],
  ['ace', '?at=toFactory', "window.__game.teleport({x: 140, y: 25.1, z: -160}); window.__game.follow.snapBehind(Math.PI, 0.35)"],
  ['tower', '?at=toTower', "window.__game.teleport({x: -40, y: 0, z: -110}); window.__game.follow.snapBehind(-2.3, -0.6)"],
];
await mkdir('docs/screens', { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
for (const [name, query, setup] of shots) {
  await page.goto(base + query + '&god=1');
  await page.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
  if (setup) { await page.evaluate(setup); await page.waitForTimeout(1800); }
  await page.screenshot({ path: `docs/screens/${name}.png` });
  console.log(name, await page.evaluate(() => window.__game.state.fps), 'fps');
}
await browser.close();
