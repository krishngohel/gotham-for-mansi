// Boots the production build in Chromium, Edge and Firefox and plays the opening.
import { chromium, firefox } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.env.BASE ?? 'http://localhost:5201/';
const out = process.env.OUT ?? 'browser-check';
mkdirSync(out, { recursive: true });
const targets = [
  ['chromium', () => chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] })],
  ['edge', () => chromium.launch({ channel: 'msedge', args: ['--mute-audio', '--ignore-gpu-blocklist'] })],
  ['firefox', () => firefox.launch({ firefoxUserPrefs: { 'webgl.force-enabled': true, 'media.volume_scale': '0.0' } })],
];
for (const [name, launch] of targets) {
  const errors = [];
  let browser;
  try {
    browser = await launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url + '?new=1');
    await page.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 20, null, { timeout: 120000 });
    const gpu = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return g ? (e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)) : 'NO WEBGL2'; });
    await page.locator('.mbtn.primary').click();
    await page.locator('.suit-card.suit-m').click();
    await page.waitForFunction(() => window.__game.flow?.mode === 'cutscene', null, { timeout: 60000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${name}-comic.png` });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__game.flow.mode === 'play', null, { timeout: 20000 });
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2500);
    await page.keyboard.up('KeyW');
    await page.screenshot({ path: `${out}/${name}-play.png` });
    const fps = await page.evaluate(() => window.__game.state.fps);
    console.log(`${name}: OK | gpu: ${gpu} | fps: ${fps} | errors: ${errors.length ? errors.join(' || ') : 'none'}`);
  } catch (e) {
    console.log(`${name}: FAILED ${e.message.split('\n')[0]} | errors: ${errors.join(' || ')}`);
  } finally {
    await browser?.close();
  }
}
