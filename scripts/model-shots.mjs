// Photographs the code-built models (Batmobile, Batwing, Joker van, drone tank, street car) from
// six angles each, on a clear street, with the HUD and Batman hidden, into <outDir>/<model>-<view>.png
// plus one contact sheet per model (<model>.png, if Python with Pillow is around to tile them).
// usage: node scripts/model-shots.mjs <url> <outDir> [model ...]   (muted)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [url, out, ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(url + (url.includes('?') ? '&' : '?') + 'at=toDocks&god=1');
await p.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
for (let i = 0; i < 25; i++) { await p.evaluate(() => { const G = window.__game; G.cinematic?.active && G.cinematic.skip(); G.comic.playing && G.comic.skip(); G.radio?.playing && G.radio.skip(); }); await p.waitForTimeout(150); }

// Each model is placed on the dock road at (-90, ground, 120), facing +z, sized by `span` (how
// far the camera stands back).
const MODELS = {
  batmobile: { span: 1, build: () => { const G = window.__game; G.vehicles.summon('batmobile', { instant: true }); return G.vehicles.batmobile.group; } },
  batwing: { span: 2.6, lift: 6, build: async () => { const m = (await import('/src/vehicles/wingModel.js')).buildBatwingMesh().mesh; m.visible = true; return m; } },
  jokerVan: { span: 0.9, build: async () => (await import('/src/vehicles/vehicleModels.js')).createJokerVan().group },
  droneTank: { span: 0.8, build: async () => (await import('/src/vehicles/vehicleModels.js')).createDroneTank().group },
  streetCar: { span: 0.8, build: async () => (await import('/src/vehicles/vehicleModels.js')).createStreetCar(0x2f3f5a, 'sedan').group },
};
await p.evaluate(() => {
  const G = window.__game;
  G.hero.teleport({ x: -80, y: 0.2, z: 90 }, 0);
  G.hero.bat.root.visible = false; G.hero.cape.mesh.visible = false;
  for (const el of document.querySelectorAll('.hud, .waypoint, .fps')) el.style.display = 'none';
  const cam = G.camera, render = G.renderer.render.bind(G.renderer);
  window.__shot = null;
  G.renderer.render = (s, c) => {
    if (c === cam && window.__shot) { cam.position.set(...window.__shot.p); cam.lookAt(...window.__shot.l); cam.fov = 40; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); }
    return render(s, c);
  };
});
const views = (k, y) => ({
  front34: [[-90 + 6 * k, y + 2.4 * k, 120 + 7 * k]], side: [[-90 + 8.5 * k, y + 1.3 * k, 120]], rear34: [[-90 - 5 * k, y + 2.6 * k, 120 - 7 * k]],
  top: [[-90, y + 13 * k, 120.1]], front: [[-90, y + 0.9 * k, 120 + 8 * k]], rear: [[-90, y + 1.6 * k, 120 - 9 * k]],
});
for (const [name, m] of Object.entries(MODELS)) {
  if (only.length && !only.includes(name)) continue;
  const y = m.lift ?? 0;
  // Dev builds can import the source modules; a built bundle cannot, so those models are skipped there.
  const ok = await p.evaluate(async ([name, src, y]) => {
    try {
      window.__model?.parent?.remove(window.__model);
      const G = window.__game, build = eval(`(${src})`);
      const g = await build();
      if (name !== 'batmobile') { G.scene.add(g); G.vehicles.batmobile.group.visible = false; } else g.visible = true;
      g.position.set(-90, y, 120); g.rotation.set(0, 0, 0);
      window.__model = name === 'batmobile' ? null : g;
      if (name === 'batmobile') { g.position.set(-90, 0, 120); }
      return true;
    } catch (e) { return String(e); }
  }, [name, m.build.toString(), y]);
  if (ok !== true) { console.log(name, 'skipped:', ok); continue; }
  const files = [];
  for (const [view, [pos]] of Object.entries(views(m.span, y))) {
    await p.evaluate(([pos, look]) => { window.__shot = { p: pos, l: look }; }, [pos, [-90, y + 0.8, 120]]);
    await p.waitForTimeout(450);
    const f = `${out}/${name}-${view}.png`;
    await p.screenshot({ path: f, clip: { x: 240, y: 110, width: 800, height: 500 } });
    files.push(f);
  }
  try {
    execFileSync('python', ['-c', `
import sys
from PIL import Image
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]
m=Image.new('RGB',(800*3,500*2))
for i,im in enumerate(ims): m.paste(im,((i%3)*800,(i//3)*500))
m.resize((1800,750)).save(sys.argv[1])`, `${out}/${name}.png`, ...files]);
  } catch { /* no Python/Pillow: the single shots are still there */ }
  console.log(name, 'done');
}
await b.close();
