// Dynamic resolution in a normal (vsync on) maximized Edge: measured refresh, then how the scale
// reacts to an artificial GPU load (the ink quad drawn many extra times, which costs more at
// higher resolution) and recovers when it is removed. Prints the scale and fps once a second.
// Usage: node scripts/dynres-check.mjs [baseUrl] [extraDraws]
import { chromium } from 'playwright-core';
const base = process.argv[2] ?? 'http://localhost:5208/';
const draws = Number(process.argv[3] ?? 40);
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--start-maximized'] });
const p = await (await b.newContext({ viewport: null })).newPage();
await p.goto(`${base}?at=start&god=1&gputime=1`);
await p.waitForFunction(() => window.__game?.comic, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__game.comic.skip());
const sample = async (label, seconds) => {
  const rows = [];
  for (let i = 0; i < seconds; i++) {
    await p.waitForTimeout(1000);
    rows.push(await p.evaluate(() => `${Math.round(window.__game.dynRes.scale * 100)}%/${window.__game.state.fps}`));
  }
  console.log(label.padEnd(8), rows.join(' '));
};
await sample('normal', 15);
console.log('refresh', await p.evaluate(() => window.__game.dynRes.refreshHz), 'gpuMs', await p.evaluate(() => window.__game.ink.gpuMs));
await p.evaluate((draws) => {
  const r = window.__game.renderer; const orig = r.render;
  window.__unload = () => { r.render = orig; };
  r.render = function (sc, cam) {
    orig.call(this, sc, cam);
    if (r.getRenderTarget() === null && !sc.overrideMaterial && sc !== window.__game.scene) {
      const ac = r.autoClear; r.autoClear = false;
      for (let i = 0; i < draws; i++) orig.call(this, sc, cam);
      r.autoClear = ac;
    }
  };
}, draws);
await sample('loaded', 30);
await p.evaluate(() => window.__unload());
await sample('unload', 30);
await b.close();
