// Dev helper: runs a scripted play session and captures screenshots.
// usage: node scripts/dev-play.mjs <url> <outDir> '<steps json>'
// steps: [{ "hold": ["KeyW"], "ms": 800 }, { "press": "Space" }, { "type": "text" }, { "eval": "js" }, { "shot": "name" }, { "wait": 300 }]
// { "type": "text" } types text into the focused field. The third argument can also be a path to a JSON file of steps.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [url, outDir, stepsJson] = process.argv.slice(2);
const steps = JSON.parse(stepsJson.trim().startsWith('[') ? stepsJson : (await import('node:fs')).readFileSync(stepsJson, 'utf8'));
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
// Photo mode saves go to the output folder.
page.on('download', async (d) => { const f = `${outDir}/${d.suggestedFilename()}`; await d.saveAs(f); console.log('download:', f); });
await page.goto(url);
await page.waitForFunction('window.__game?.state?.frame > 30', null, { timeout: 90000 });
for (const s of steps) {
  if (s.hold) {
    for (const k of s.hold) await page.keyboard.down(k);
    await page.waitForTimeout(s.ms ?? 500);
    for (const k of s.hold) await page.keyboard.up(k);
  }
  if (s.down) for (const k of s.down) await page.keyboard.down(k);
  if (s.up) for (const k of s.up) await page.keyboard.up(k);
  if (s.press) await page.keyboard.press(s.press);
  if (s.type) await page.keyboard.type(s.type, { delay: 20 });
  if (s.click !== undefined) { await page.mouse.move(640, 360); await page.mouse.down({ button: s.click === 2 ? 'right' : 'left' }); await page.waitForTimeout(40); await page.mouse.up({ button: s.click === 2 ? 'right' : 'left' }); }
  if (s.eval) {
    const r = await page.evaluate(`(async () => { const v = await (0, eval)(${JSON.stringify(s.eval)}); try { return JSON.parse(JSON.stringify(v)); } catch { return '[object]'; } })()`).catch((e) => 'eval error: ' + e.message);
    if (r !== undefined && r !== '[object]') console.log('eval:', JSON.stringify(r));
  }
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.shot) await page.screenshot({ path: `${outDir}/${s.shot}.png` });
}
console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close();
