// Contact sheets of animation clips on the hero, rendered through the comic camera
// (__game.stage.shot), so every frame is the clip at an exact time with nothing else moving it.
//   node scripts/clip-sheet.mjs <url> <outDir> Clip[:frames] ...   (muted, headless)
// Each clip becomes <outDir>/<Clip>.png: `frames` (default 8) evenly spaced from start to end,
// three-quarter front view (the hero faces +z, toward the camera's right), the frame nearest the clip's contact time (mocapData) outlined in red.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { MOCAP_DATA } from '../src/config/mocapData.js';

const [url, out, ...clips] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'], headless: true });
const p = await b.newPage({ viewport: { width: 640, height: 480 } });
await p.goto(url + (url.includes('?') ? '&' : '?') + 'at=signal&god=1');
await p.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
for (const spec of clips) {
  const [name, nS] = spec.split(':');
  const n = Number(nS ?? 8);
  const dur = await p.evaluate((name) => window.__game.hero.bat.animator.durationOf?.(name) ?? null, name);
  const d = dur ?? MOCAP_DATA[name]?.duration ?? 1.2;
  const contact = MOCAP_DATA[name]?.contact ?? null;
  const files = [];
  for (let i = 0; i < n; i++) {
    const t = (d * i) / (n - 1);
    const url64 = await p.evaluate(([name, t]) => {
      const G = window.__game, at = [6, 42, 10];
      const shot = G.stage.shot({ cam: [at[0] + 2.3, at[1] + 1.35, at[2] + 2.9], look: [at[0] + 0.1, at[1] + 1.05, at[2] + 0.5], fov: 40, hero: { at, yaw: 0, anim: name, time: Math.max(0.0001, t) } });
      return typeof shot === 'string' ? shot : shot.toDataURL('image/jpeg', 0.85);
    }, [name, t]);
    const f = `${out}/${name}-${String(i).padStart(2, '0')}.jpg`;
    writeFileSync(f, Buffer.from(url64.split(',')[1], 'base64'));
    files.push([f, t]);
  }
  const hit = contact === null ? -1 : files.reduce((bi, [, t], i) => (Math.abs(t - contact) < Math.abs(files[bi][1] - contact) ? i : bi), 0);
  const py = `
from PIL import Image, ImageDraw
fs=${JSON.stringify(files.map(([f, t]) => [f, +t.toFixed(2)]))}
ims=[Image.open(f).resize((256,192)) for f,_ in fs]
W=Image.new('RGB',(256*min(len(ims),8),192*((len(ims)+7)//8)),'black')
for i,(im,(f,t)) in enumerate(zip(ims,fs)):
  x,y=(i%8)*256,(i//8)*192
  W.paste(im,(x,y)); d=ImageDraw.Draw(W); d.text((x+6,y+4),'${name} %.2fs'%t,fill='yellow')
  if i==${hit}: d.rectangle([x+1,y+1,x+254,y+190],outline='red',width=4)
W.save(${JSON.stringify(out + '/' + name + '.png')})`;
  execFileSync('python', ['-c', py]);
  console.log(`${name}: ${d.toFixed(2)} s, contact ${contact ?? '?'} -> ${out}/${name}.png`);
}
await b.close();
