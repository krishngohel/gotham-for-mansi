import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [url, out, ...shots] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'], headless: true });
const p = await b.newPage({ viewport: { width: 640, height: 480 } });
await p.goto(url + '?at=signal&god=1');
await p.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
let i = 0;
for (const s of shots) {
  const [name, t] = s.split('@');
  const u = await p.evaluate(([name, t]) => { const G = window.__game, at = [6, 42, 10]; const r = G.stage.shot({ cam: [at[0] + 0.2, at[1] + 4.2, at[2] + 0.6], look: [at[0], at[1], at[2] + 0.2], fov: 50, hero: { at, yaw: 0, anim: name, time: +t } }); return typeof r === 'string' ? r : r.toDataURL('image/jpeg'); }, [name, t]);
  writeFileSync(`${out}-${i++}.jpg`, Buffer.from(u.split(',')[1], 'base64'));
}
await b.close();
