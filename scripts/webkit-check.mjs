// Boots a build in WebKit (Safari's engine) and plays into the opening. Usage: node scripts/webkit-check.mjs [url] [outDir]
import { webkit } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5202/';
const out = process.argv[3] ?? 'webkit-check';
const b = await webkit.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
// WebKit has no --mute-audio: the game boots with its saved volume at 0 instead.
await p.addInitScript(() => {
  try {
    const k = 'gotham-mansi-settings-v1', s = JSON.parse(localStorage.getItem(k) ?? '{}');
    localStorage.setItem(k, JSON.stringify({ ...s, volume: { master: 0, music: 0, sfx: 0 } }));
  } catch { /* storage blocked: nothing to mute through */ }
});
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(e.message));
const t0 = Date.now();
await p.goto(url);
await p.waitForFunction(() => performance.getEntriesByName('boot:firstFrame').length > 0 || document.querySelector('#loading.error'), null, { timeout: 180000 });
const boot = await p.evaluate(() => ({ error: !!document.querySelector('#loading.error'), marks: Object.fromEntries(performance.getEntriesByType('mark').filter((e) => e.name.startsWith('boot:')).map((e) => [e.name.slice(5), Math.round(e.startTime)])) }));
console.log('boot', Date.now() - t0, 'ms', JSON.stringify(boot));
await p.screenshot({ path: `${out}/title.png` });
if (!boot.error) {
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'at=start');
  await p.waitForFunction(() => window.__game?.comic, null, { timeout: 180000 });
  await p.waitForTimeout(2000);
  await p.evaluate(() => window.__game.comic.skip());
  await p.waitForTimeout(3000);
  const s = await p.evaluate(() => ({ mode: window.__game.flow.mode, frame: window.__game.state.frame, fps: window.__game.state.fps }));
  console.log('play', JSON.stringify(s));
  await p.screenshot({ path: `${out}/play.png` });
  await p.keyboard.down('Tab');
  await p.waitForTimeout(600);
  const wheel = await p.evaluate(() => [window.__game.gadgets.wheelOpen, !!document.querySelector('.gwheel.show')]);
  console.log('wheel', JSON.stringify(wheel));
  await p.screenshot({ path: `${out}/wheel.png` });
  await p.keyboard.up('Tab');
}
console.log(errors.length ? 'errors:\n' + errors.slice(0, 10).join('\n') : 'no console errors');
await b.close();
