// Throwaway: which tutorial cards show during a step's fight, and a screenshot of each.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const [url, step, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'], headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(`${url}?at=${step}&god=1`);
await p.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
await p.mouse.click(640, 360);
const seen = [];
for (let i = 0; i < 90; i++) {
  const t = await p.evaluate(() => [...document.querySelectorAll('.hint, .hud-hint, [class*=hint]')].filter((n) => n.offsetParent && n.textContent.trim()).map((n) => n.textContent.trim()).join(' | '));
  if (t && !seen.includes(t)) { seen.push(t); await p.screenshot({ path: `${out}/${step}-${seen.length}.jpg`, quality: 70 }); console.log(`${(i * 0.5).toFixed(1)}s ${t.slice(0, 150)}`); }
  await p.waitForTimeout(500);
}
await b.close();
