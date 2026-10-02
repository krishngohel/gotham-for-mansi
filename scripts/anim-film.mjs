// Films the hero's moves frame by frame, with real key presses, from a camera that tracks him
// side-on, and tiles each move into one contact sheet: <outDir>/<move>.png (needs Python + Pillow
// for the sheet; the single frames stay either way). Moves: glide, land, ledge, wallrun, zip,
// grapple, punch, kick, counter, roll, carIn, carOut, run.
// usage: node scripts/anim-film.mjs <url> <outDir> [move ...]   (muted)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [url, out, ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(url + (url.includes('?') ? '&' : '?') + 'fight=test&god=1');
await p.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
for (let i = 0; i < 25; i++) { await p.evaluate(() => { const G = window.__game; G.cinematic?.active && G.cinematic.skip(); G.comic.playing && G.comic.skip(); G.radio?.playing && G.radio.skip(); }); await p.waitForTimeout(150); }
await p.mouse.click(640, 360); await p.waitForTimeout(200); await p.mouse.click(640, 360); await p.waitForTimeout(300);
await p.evaluate(() => {
  const G = window.__game;
  for (const el of document.querySelectorAll('.hud, .waypoint, .fps')) el.style.display = 'none';
  // A tracking side camera: `window.__cam = { side, up, back }` relative to the hero's facing.
  const cam = G.camera, render = G.renderer.render.bind(G.renderer);
  window.__cam = null;
  G.renderer.render = (s, c) => {
    const k = window.__cam;
    if (c === cam && k && k.at) { cam.position.set(...k.at); cam.lookAt(...k.look3); cam.fov = 45; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); }
    else if (c === cam && k) {
      const h = G.hero.pos, yaw = G.hero.bat.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
      cam.position.set(h.x + rx * k.side - fx * k.back, h.y + k.up, h.z + rz * k.side - fz * k.back);
      cam.lookAt(h.x, h.y + (k.look ?? 1), h.z); cam.fov = 45; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    }
    return render(s, c);
  };
});
const clearGoons = () => p.evaluate(() => { const G = window.__game; for (const e of [...G.combat.enemies]) G.despawn(e); G.combat.setEnemies([]); });
const goons = (n = 1) => p.evaluate((n) => { const G = window.__game, h = G.hero.pos, yaw = G.hero.bat.yaw; const list = []; for (let i = 0; i < n; i++) list.push(G.spawn('grunt', { x: h.x + Math.sin(yaw) * 2.2 + i * 1.5, y: h.y, z: h.z + Math.cos(yaw) * 2.2 })); G.combat.setEnemies(list); list.forEach((e) => e.wake()); return list.length; }, n);
const place = (x, y, z, yaw) => p.evaluate(([x, y, z, yaw]) => { const G = window.__game; G.vehicles.active && G.vehicles.exit(); G.hero.control = null; G.hero.teleport({ x, y, z }, yaw); G.hero.bat.face(yaw); G.follow.snapBehind(yaw); }, [x, y, z, yaw]);
const cam = (c) => p.evaluate((c) => { window.__cam = c; }, c);
// Takes `n` frames `ms` apart into <move>-NN.png.
async function film(move, n, ms, act) {
  const files = [];
  let started = false;
  for (let i = 0; i < n; i++) {
    if (!started && act) { started = true; act(); }
    await p.waitForTimeout(ms);
    const f = `${out}/${move}-${String(i).padStart(2, '0')}.png`;
    await p.screenshot({ path: f, clip: { x: 340, y: 60, width: 600, height: 600 } });
    files.push(f);
  }
  try {
    execFileSync('python', ['-c', `
import sys
from PIL import Image, ImageDraw
fs=sys.argv[2:]; ims=[Image.open(f).resize((300,300)) for f in fs]
cols=min(6,len(ims)); rows=(len(ims)+cols-1)//cols
m=Image.new('RGB',(300*cols,300*rows),'white'); d=ImageDraw.Draw(m)
for i,im in enumerate(ims): m.paste(im,((i%cols)*300,(i//cols)*300)); d.text(((i%cols)*300+4,(i//cols)*300+4),str(i),fill='yellow')
m.save(sys.argv[1])`, `${out}/${move}.png`, ...files]);
  } catch { /* frames stay */ }
  console.log(move, 'filmed');
}
const key = (k, ms) => p.keyboard.down(k).then(() => p.waitForTimeout(ms)).then(() => p.keyboard.up(k));

const MOVES = {
  run: async () => { await clearGoons(); await place(6, 42.2, 10, Math.PI); await cam({ side: 4.5, up: 1.2, back: 0 }); await film('run', 12, 120, async () => { await key('KeyW', 500); await p.keyboard.down('ShiftLeft'); await key('KeyW', 900); await p.keyboard.up('ShiftLeft'); }); },
  glide: async () => { await clearGoons(); await place(6, 42.2, 10, Math.PI); await cam({ side: 5, up: 1.4, back: 1 }); await film('glide', 12, 160, async () => { await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.down('Space'); await p.waitForTimeout(1600); await p.keyboard.up('Space'); await p.keyboard.up('KeyW'); }); },
  glideAir: async () => { await clearGoons(); await place(6, 70, 10, Math.PI); await p.evaluate(() => { const G = window.__game; G.hero.vel.set(0, 0, -12); }); await cam({ side: 5, up: 0.8, back: 0, look: 0.6 }); await film('glideAir', 12, 140, async () => { await p.waitForTimeout(250); await p.keyboard.down('Space'); await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW'); await p.keyboard.up('Space'); }); },
  glideBack: async () => { await clearGoons(); await place(6, 70, 10, Math.PI); await p.evaluate(() => { const G = window.__game; G.hero.vel.set(0, 0, -12); }); await cam({ side: 0.6, up: 1.6, back: 4.5, look: 1 }); await film('glideBack', 6, 220, async () => { await p.waitForTimeout(250); await p.keyboard.down('Space'); await p.waitForTimeout(1300); await p.keyboard.up('Space'); }); },
  fallBack: async () => { await clearGoons(); await place(6, 90, 10, Math.PI); await cam({ side: 3.5, up: 0.8, back: 3, look: 1 }); await film('fallBack', 6, 200); },
  land: async () => { await clearGoons(); await place(6, 52, 10, Math.PI); await cam({ side: 5, up: 1.2, back: 0, look: 0.6 }); await film('land', 12, 90); },
  punch: async () => { await clearGoons(); await place(6, 42.2, 10, Math.PI); await goons(1); await cam({ side: 4.5, up: 1.4, back: -0.8 }); await film('punch', 12, 80, async () => { for (let i = 0; i < 3; i++) { await p.mouse.click(640, 360); await p.waitForTimeout(260); } }); },
  kick: async () => { await clearGoons(); await place(6, 42.2, 10, Math.PI); await goons(1); await cam({ side: 4.5, up: 1.4, back: -0.8 }); await film('kick', 12, 80, async () => { for (let i = 0; i < 2; i++) { await p.keyboard.press('KeyE'); await p.waitForTimeout(380); } }); },
  roll: async () => { await clearGoons(); await place(6, 42.2, 10, Math.PI); await cam({ side: 4.5, up: 1.2, back: 0 }); await film('roll', 10, 70, async () => { await p.keyboard.down('KeyW'); await p.keyboard.press('KeyC'); await p.waitForTimeout(600); await p.keyboard.up('KeyW'); }); },
  ledge: async () => { await clearGoons(); const l = await p.evaluate(() => { const G = window.__game; const pts = G.world.grapplePoints.filter((g) => !g.perch && g.y > 8 && g.y < 30); const g = pts[3]; G.hero.teleport({ x: g.x + g.nx * 0.6, y: g.y + 1.2, z: g.z + g.nz * 0.6 }, Math.atan2(-g.nx, -g.nz)); return g; }); await cam({ side: 3.5, up: 0.4, back: -1.8, look: 0.6 }); await film('ledge', 12, 140, async () => { await p.waitForTimeout(600); await key('KeyA', 700); await key('KeyW', 300); }); },
  zip: async () => { await clearGoons(); await p.evaluate(() => { const G = window.__game; const z = G.world.grapplePoints.find((g) => g.zip); if (z) { G.hero.teleport({ x: z.x, y: z.y + 0.2, z: z.z }); } }); await cam({ side: 5, up: 0.5, back: 0, look: 0 }); await film('zip', 8, 150, async () => { await p.keyboard.press('KeyF'); }); },
  wallrun: async () => { await clearGoons(); await place(-120, 0.2, -102, 0); await cam({ side: -5, up: 1.4, back: 0 }); await film('wallrun', 12, 110, async () => { await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await p.waitForTimeout(500); await p.keyboard.press('Space'); await p.waitForTimeout(900); await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft'); }); },
  carIn: async () => { await clearGoons(); await place(-93, 0.2, 60, 0.4); await p.evaluate(() => { const G = window.__game; G.vehicles.summon('batmobile', { instant: true }); const b = G.vehicles.batmobile.group; b.position.set(-90, 0, 64); G.vehicles.batmobile.v.yaw = 0; b.rotation.y = 0; }); await cam({ at: [-81, 2.6, 58], look3: [-90.5, 1, 62] }); await film('carIn', 10, 60, async () => { await p.keyboard.press('KeyT'); }); },
  carOut: async () => { await p.waitForTimeout(400); await cam({ at: [-81, 2.6, 58], look3: [-90.5, 1, 62] }); await film('carOut', 10, 70, async () => { await p.keyboard.press('KeyT'); }); },
};
for (const [name, fn] of Object.entries(MOVES)) { if (only.length && !only.includes(name)) continue; try { await fn(); } catch (e) { console.log(name, 'failed:', e.message.split('\n')[0]); } }
await b.close();
