// Exports contact sheets of the kick clips from tools/pose-viewer.html.
//   node tools/kick-sheets.mjs <outDir> [--kicks=<module path>] [--suits=m,f] [--frames=9] [--views=side,front,quarter,back,backq,top] [--measure[=N]] [clip ...]
// Serves the repo with vite on an ephemeral port, drives a small headless Chromium page
// (software GL, 1024x640, renders only on demand) and writes <outDir>/<clip>-<suit>.png.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const positional = args.filter((a) => !a.startsWith('--'));
const outDir = positional[0] ?? 'sheets';
const clips = positional.slice(1);
const suits = (flags.suits ?? 'm,f').split(',');
const views = (flags.views ?? 'side,front,quarter').split(',');
const frames = Number(flags.frames ?? 9);
mkdirSync(outDir, { recursive: true });

const server = await createServer({ configFile: 'vite.config.js', server: { port: 5210, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const port = server.config.server.port;
const url = `http://127.0.0.1:${port}/tools/pose-viewer.html${flags.kicks ? `?kicks=${encodeURIComponent(flags.kicks)}` : ''}`;

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__viewer?.ready, null, { timeout: 90000 });
  const list = clips.length ? clips : Object.keys(await page.evaluate(() => window.__viewer.beats)).length
    ? await page.evaluate(() => Object.keys(window.__viewer.beats))
    : ['Kick_Front', 'Kick_Round', 'Kick_Flying'];
  for (const clip of list) {
    for (const suit of suits) {
      const data = await page.evaluate((o) => window.__viewer.sheet(o), { clip, suit, views, frames });
      const file = join(outDir, `${clip}-${suit}.png`);
      writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
      console.log('wrote', file);
    }
    if (flags.measure) {
      const rows = await page.evaluate((o) => window.__viewer.measure(o), { clip, suit: suits[0], frames: Number(flags.measure) || 16 });
      writeFileSync(join(outDir, `${clip}-measure.json`), JSON.stringify(rows, null, 1));
      const fmt = (r) => `t=${r.t.toFixed(2)} ballL=(${r.ballL.join(',')}) ballR=(${r.ballR.join(',')}) pelvis=(${r.pelvis.join(',')}) kneeL=${r.kneeL} kneeR=${r.kneeR} footR=(${r.footR.join(',')}) lift=${r.lift.toFixed(3)}`;
      console.log(`--- ${clip}\n` + rows.map(fmt).join('\n'));
    }
  }
} finally {
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await browser.close();
  await server.close();
}
