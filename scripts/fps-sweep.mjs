// Uncapped frame-time sweep in a visible, maximized Edge at native resolution. Reports median,
// p95 and max frame time per scenario plus draw calls, and lists every hitch (> 25 ms) after the
// first 5 s of play, so hitches show up and not just averages.
//
// Scenarios: five fixed spots (with a separate "arrive" window right after each teleport), a
// long glide across districts, goons spawned mid-play, the ?fight=test sandbox with the hero
// kicking, the boss arena (?at=boss), and a predator stealth room (patrols, detective vision, a
// silent takedown, the alarm).
//
// Usage: node scripts/fps-sweep.mjs [baseUrl] [high|low]
// Env:   OUT=<file.json> writes the raw result; SHOTS=<dir> saves a screenshot at each spot;
//        ONLY=main|fight|boss|side|stealth runs one page only; EXTRA=<query> replaces the default extra URL params (dynres=0).
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5202/';
const q = process.argv[3] ?? 'high';
// Dynamic resolution off by default: with vsync off there is no refresh budget to aim for.
const extra = `&${process.env.EXTRA ?? 'dynres=0'}`;
const only = process.env.ONLY ?? '';
const shots = process.env.SHOTS ?? '';
if (shots) mkdirSync(shots, { recursive: true });

const spots = [
  ['gcpd roof', { x: 6, y: 42, z: 10 }, 2.6],
  ['docks yard', { x: 0, y: 0.15, z: 178 }, 0.2],
  ['neon street', { x: 150, y: 0, z: 10 }, 0],
  ['ace yard', { x: 95, y: 0, z: -140 }, Math.PI],
  ['clock plaza', { x: -62, y: 58, z: -148 }, Math.PI],
];

const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--start-maximized', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport: null });

// Records every rAF delta with the current scenario label, and the draw calls/triangles of the
// whole frame (all passes: shadow, colour, normal, ink quad). The game's own rAF callback is
// registered first, so this one runs right after the frame has been drawn.
async function openGame(query) {
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`${base}?${query}&q=${q}${extra}`);
  await p.waitForFunction(() => window.__game?.comic, null, { timeout: 120000 });
  await p.evaluate(() => {
    const r = window.__game.renderer;
    r.info.autoReset = false;
    const rec = window.__rec = { label: 'boot', frames: [], t0: performance.now() };
    let last = performance.now();
    const f = (n) => {
      rec.frames.push([rec.label, n - last, r.info.render.calls, r.info.render.triangles, n - rec.t0]);
      r.info.reset();
      last = n;
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  return { p, errors };
}
const label = (p, l) => p.evaluate((l) => { window.__rec.label = l; }, l);
const skipComic = async (p) => { for (let i = 0; i < 6; i++) { await p.evaluate(() => window.__game.comic.playing && window.__game.comic.skip()); await p.waitForTimeout(300); } };
async function collect(p, page) {
  const frames = await p.evaluate(() => window.__rec.frames);
  return frames.map(([l, dt, calls, tris, t]) => ({ page, l, dt, calls, tris, t }));
}

const all = [];
const meta = {};

if (!only || only === 'main') {
  const { p, errors } = await openGame('at=start&god=1');
  await p.waitForTimeout(1500);
  await skipComic(p);
  meta.canvas = await p.evaluate(() => [innerWidth, innerHeight, devicePixelRatio, window.__game.renderer.getPixelRatio()]);
  meta.gpu = await p.evaluate(() => { const gl = window.__game.renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; });
  await label(p, 'warmup');
  await p.waitForTimeout(5000);
  for (const [name, pos, yaw] of spots) {
    await label(p, `arrive:${name}`);
    await p.evaluate(([pos, yaw]) => { window.__game.hero.teleport(pos, yaw); window.__game.follow.snapBehind?.(yaw); }, [pos, yaw]);
    await p.waitForTimeout(1500);
    await label(p, name);
    await p.waitForTimeout(3000);
    if (shots) {
      await label(p, 'shot');
      await p.screenshot({ path: `${shots}/${name.replace(/ /g, '-')}.png` });
    }
  }
  // A long glide from the docks across the city centre toward Ace Chemicals.
  await label(p, 'arrive:glide');
  await p.evaluate(() => { const g = window.__game; g.hero.teleport({ x: -170, y: 125, z: 190 }, 2.4); g.follow.snapBehind(2.4); });
  await p.waitForTimeout(300);
  await p.keyboard.down('Space');
  await p.waitForTimeout(1200);
  await label(p, 'glide');
  await p.waitForTimeout(7000);
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/gliding.png` }); await label(p, 'glide'); }
  await p.waitForTimeout(7000);
  await p.keyboard.up('Space');
  meta.glideEnd = await p.evaluate(() => { const h = window.__game.hero; return [h.pos.x, h.pos.y, h.pos.z].map(Math.round).concat(h.state); });
  // Goons spawned mid-play (the first time each enemy type appears).
  await p.evaluate(() => { const g = window.__game; g.hero.teleport({ x: 0, y: 0.15, z: 178 }, 0.2); g.follow.snapBehind(0.2); });
  await p.waitForTimeout(1500);
  await label(p, 'spawn');
  await p.evaluate(() => {
    const g = window.__game;
    const h = g.hero.pos;
    const list = ['grunt', 'knife', 'brute', 'rifle'].map((t, i) => g.spawn(t, { x: h.x - 6 + i * 4, y: h.y, z: h.z + 7 }));
    g.combat.setEnemies([...g.combat.enemies, ...list]);
    for (const e of list) e.wake();
  });
  for (let i = 0; i < 12; i++) { await p.keyboard.press('KeyE'); await p.waitForTimeout(500); }
  all.push(...await collect(p, 'main'));
  meta.errorsMain = errors;
  await p.close();
}

if (!only || only === 'fight') {
  const { p, errors } = await openGame('fight=test&god=1');
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'warmup');
  await p.waitForTimeout(5000);
  await label(p, 'fight');
  for (let i = 0; i < 20; i++) { await p.keyboard.press(i % 3 ? 'KeyE' : 'KeyW'); await p.waitForTimeout(400); }
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/fight.png` }); }
  all.push(...await collect(p, 'fight'));
  meta.errorsFight = errors;
  await p.close();
}

if (!only || only === 'boss') {
  const { p, errors } = await openGame('at=boss&god=1');
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'warmup');
  await p.waitForTimeout(5000);
  await label(p, 'boss');
  for (let i = 0; i < 20; i++) { await p.keyboard.press('KeyE'); await p.waitForTimeout(400); }
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/boss.png` }); }
  all.push(...await collect(p, 'boss'));
  meta.errorsBoss = errors;
  await p.close();
}

if (!only || only === 'side') {
  const { p, errors } = await openGame('at=toNeon&god=1&new=1');
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'warmup');
  await p.waitForTimeout(5000);
  // A glide challenge with its hoops up.
  await label(p, 'challenge');
  await p.evaluate(() => window.__game.side.challenges.start('neonSlalom'));
  await p.waitForTimeout(2600);
  await p.keyboard.down('KeyW');
  await p.waitForTimeout(350);
  await p.keyboard.down('Space');
  await p.waitForTimeout(6000);
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/side-challenge.png` }); await label(p, 'challenge'); }
  await p.keyboard.up('Space');
  await p.keyboard.up('KeyW');
  await p.evaluate(() => window.__game.side.challenges.quit());
  // A street crime: the squad arrives, the civilian cowers, the fight.
  await label(p, 'arrive:crime');
  await p.evaluate(() => window.__game.side.crimes.force({ kind: 'mugging', spotId: 'neonNorth' }));
  await p.waitForTimeout(500);
  await p.evaluate(() => { const g = window.__game; g.hero.teleport({ x: 150, y: 0, z: -8 }, Math.PI); g.follow.snapBehind(Math.PI); });
  await p.waitForTimeout(1500);
  await label(p, 'crime');
  for (let i = 0; i < 12; i++) { await p.keyboard.press(i % 3 ? 'KeyE' : 'KeyW'); await p.waitForTimeout(400); }
  // Photo mode: every filter and frame.
  await label(p, 'photo');
  await p.evaluate(() => window.__game.photo.open());
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Digit1'); await p.waitForTimeout(700); }
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Digit2'); await p.waitForTimeout(700); }
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/side-photo.png` }); await label(p, 'photo'); }
  await p.evaluate(() => window.__game.photo.close());
  all.push(...await collect(p, 'side'));
  meta.errorsSide = errors;
  await p.close();
}
if (!only || only === 'stealth') {
  const { p, errors } = await openGame('at=aceCatwalks&god=1');
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'warmup');
  // Since main's merge, the first click while the pointer isn't locked only acquires the lock
  // and swallows the action it buffered (game.js's canvas click handler, for Safari); spend that
  // click here so the real one below (the silent takedown) fires on its own first try.
  await p.mouse.click(640, 360);
  await p.waitForTimeout(5000);
  // Patrols, line-of-sight rays, awareness rings and the steam vent, from the catwalk overlook.
  await p.evaluate(() => { const g = window.__game; g.hero.teleport({ x: 150, y: 0.15, z: -96 }, Math.PI * 1.25); g.follow.snapBehind(Math.PI * 1.25); });
  await label(p, 'stealth');
  await p.waitForTimeout(4000);
  // Detective vision: cones, x-ray state colours, the armed counter.
  await label(p, 'stealth-detective');
  await p.keyboard.press('KeyV');
  await p.waitForTimeout(3000);
  await p.keyboard.press('KeyV');
  // A silent takedown: both choke clips, the takedown camera, a balloon.
  await p.evaluate(() => { const g = window.__game, e = g.stealth.goons[2].e; g.hero.teleport({ x: e.pos.x - Math.sin(e.yaw) * 1.1, y: e.pos.y, z: e.pos.z - Math.cos(e.yaw) * 1.1 }, e.yaw); });
  await p.waitForTimeout(200);
  await label(p, 'stealth-takedown');
  await p.mouse.click(640, 360);
  await p.waitForTimeout(3000);
  // Spotted: the alarm, rifles aiming and firing, lasers, tracers and flashes.
  await p.evaluate(() => { const g = window.__game, e = g.stealth.goons[3].e; g.hero.teleport({ x: e.pos.x + Math.sin(e.yaw) * 7, y: e.pos.y, z: e.pos.z + Math.cos(e.yaw) * 7 }, e.yaw + Math.PI); });
  await label(p, 'stealth-alarm');
  await p.waitForTimeout(6000);
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/stealth.png` }); }
  all.push(...await collect(p, 'stealth'));
  meta.errorsStealth = errors;
  await p.close();
}
await b.close();

// ---- summary ----
const stat = (fr) => {
  const d = fr.map((f) => f.dt).sort((a, b) => a - b);
  const c = fr.map((f) => f.calls).sort((a, b) => a - b);
  const t = fr.map((f) => f.tris).sort((a, b) => a - b);
  return { n: d.length, medMs: +d[d.length >> 1].toFixed(2), p95Ms: +d[Math.floor(d.length * 0.95)].toFixed(2), maxMs: +d[d.length - 1].toFixed(1), fps: Math.round(1000 / d[d.length >> 1]), calls: c[c.length >> 1], tris: t[t.length >> 1] };
};
const labels = [...new Set(all.map((f) => f.l))].filter((l) => l !== 'boot' && l !== 'shot');
const rows = {};
for (const l of labels) rows[l] = stat(all.filter((f) => f.l === l));
// Hitches: any frame over 25 ms once the warmup is over (screenshots excluded).
const hitches = all.filter((f) => !['boot', 'warmup', 'shot'].includes(f.l) && f.dt > 25).map((f) => ({ page: f.page, l: f.l, ms: +f.dt.toFixed(1), at: +(f.t / 1000).toFixed(2) }));
const result = { quality: q, extra, meta, rows, hitches };
console.log(JSON.stringify({ quality: q, ...meta }));
for (const [l, r] of Object.entries(rows)) console.log(`${l.padEnd(20)} med ${String(r.medMs).padStart(6)}  p95 ${String(r.p95Ms).padStart(6)}  max ${String(r.maxMs).padStart(6)}  fps ${String(r.fps).padStart(4)}  calls ${r.calls}  tris ${r.tris}`);
console.log(`hitches >25ms after warmup: ${hitches.length}`, JSON.stringify(hitches.slice(0, 30)));
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(result, null, 1));
