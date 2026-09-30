// Films a ladder climb (side-on camera; CAM=game keeps the gameplay camera) into <outDir>. MODE=moves films idle, climbing down and the slide.
// usage: node scripts/ladder-film.mjs <url> <outDir>   env: STEP=<ms between shots> N=<shots>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const [url, out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(url + '?at=toDocks&god=1');
await p.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
for (let i = 0; i < 25; i++) { await p.evaluate(() => { const G = window.__game; G.cinematic?.active && G.cinematic.skip(); G.comic.playing && G.comic.skip(); G.radio?.playing && G.radio.skip(); }); await p.waitForTimeout(150); }
await p.mouse.click(640, 360); await p.waitForTimeout(300);
const l = await p.evaluate(() => {
  const G = window.__game, l = G.climbables.ladders.find((l) => l.bottom < 0.5 && l.top > 6);
  G.hero.teleport({ x: l.x + l.nx * 1.3, y: 0.15, z: l.z + l.nz * 1.3 }, Math.atan2(-l.nx, -l.nz));
  G.follow.snapBehind(Math.atan2(-l.nx, -l.nz));
  return { x: l.x, z: l.z, nx: l.nx, nz: l.nz, top: l.top };
});
await p.keyboard.down('KeyW');
await p.waitForTimeout(700);
// Side camera: override the camera every frame after the game renders its own.
if (process.env.CAM !== 'game') await p.evaluate((l) => {
  const G = window.__game, cam = G.camera;
  const sx = -l.nz, sz = l.nx; // along the wall
  const f = () => { const h = G.hero.pos; cam.position.set(h.x + sx * 3.2 + l.nx * 1.6, h.y + 1.1, h.z + sz * 3.2 + l.nz * 1.6); cam.lookAt(h.x, h.y + 0.9, h.z); window.__camRaf = requestAnimationFrame(f); };
  const orig = G.renderer.render.bind(G.renderer);
  G.renderer.render = (s, c) => { if (c === cam) { const h = G.hero.pos; cam.position.set(h.x + sx * 3.2 + l.nx * 1.6, h.y + 1.1, h.z + sz * 3.2 + l.nz * 1.6); cam.lookAt(h.x, h.y + 0.9, h.z); cam.updateMatrixWorld(); } return orig(s, c); };
}, l);
const ctl = await p.evaluate(() => window.__game.hero.control?.name ?? null);
console.log('ladder', JSON.stringify(l), 'control', ctl);
const shot = async (name) => p.screenshot({ path: `${out}/${name}.png`, clip: { x: 390, y: 60, width: 500, height: 600 } });
if (process.env.MODE === 'moves') {
  await p.waitForTimeout(500); await p.keyboard.up('KeyW'); await p.waitForTimeout(500); await shot('m0-idle');
  await p.keyboard.down('KeyS'); for (let i = 1; i <= 3; i++) { await p.waitForTimeout(110); await shot(`m${i}-down`); } await p.keyboard.up('KeyS');
  await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW');
  await p.keyboard.down('ShiftLeft'); for (let i = 4; i <= 6; i++) { await p.waitForTimeout(90); await shot(`m${i}-slide`); } await p.keyboard.up('ShiftLeft');
  await p.waitForTimeout(500); await shot('m7-after');
  console.log('state', JSON.stringify(await p.evaluate(() => ({ c: window.__game.hero.control?.name ?? null, s: window.__game.hero.state, y: +window.__game.hero.pos.y.toFixed(2) }))));
} else {
for (let i = 0; i < Number(process.env.N ?? 8); i++) { await p.waitForTimeout(Number(process.env.STEP ?? 125)); await shot(`climb-${i}`); }
await p.keyboard.up('KeyW');
await p.waitForTimeout(600);
await shot('idle');
}
await b.close();
