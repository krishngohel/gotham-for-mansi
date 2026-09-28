// Completes every challenge with a scripted pilot and prints medal thresholds for
// src/game/challenges.js (see suggestThresholds). Glide courses and the arena run three times.
// usage: node scripts/challenge-tune.mjs [baseUrl] [challengeId ...]
// env: SHOTS=<dir> saves a screenshot mid-run and at the result of each run.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { CHALLENGES, suggestThresholds } from '../src/game/challenges.js';

const base = process.argv[2] ?? 'http://localhost:5206/';
const only = process.argv.slice(3);
const shots = process.env.SHOTS ?? '';
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function fresh(id) {
  await page.goto(`${base}?at=toNeon&god=1&new=1`);
  await page.waitForFunction(() => window.__game?.side && window.__game.state.frame > 30, null, { timeout: 90000 });
  await page.evaluate(() => {
    const g = window.__game;
    window.__done = null;
    g.events.on('challengeDone', (e) => { window.__done = e; });
    g.events.on('challengeFail', (e) => { window.__done = { ...e, failed: true }; });
    window.__aim = (x, y, z) => {
      const c = g.camera.position, dx = x - c.x, dz = z - c.z;
      g.follow.state.yaw = Math.atan2(dx, dz);
      g.follow.state.pitch = Math.max(-1, Math.min(1.2, Math.atan2(c.y - y, Math.hypot(dx, dz))));
    };
    window.__face = (x, z) => { const h = g.hero.pos; g.follow.state.yaw = Math.atan2(x - h.x, z - h.z); };
  });
  await page.evaluate((id) => window.__game.side.challenges.start(id), id);
  await page.waitForFunction(() => window.__game.side.challenges.running, null, { timeout: 8000 });
}
const done = () => page.evaluate(() => window.__done);
const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

async function glideRun(id, n) {
  await fresh(id);
  await page.evaluate(() => {
    const g = window.__game;
    const tick = () => {
      if (!g.side.challenges.running) return;
      const t = g.side.challenges.nextMarker();
      if (t) {
        const h = g.hero.pos, ty = t.y + 1.5;
        const d = Math.max(1, Math.hypot(t.x - h.x, t.z - h.z));
        g.follow.state.yaw = Math.atan2(t.x - h.x, t.z - h.z);
        const slope = (h.y + 1 - ty) / d;   // the level glide sinks about 0.14 m per metre
        g.follow.state.pitch = slope > 0.3 ? 0.7 : slope < 0.04 ? -0.25 : 0.25;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.down('Space');
  await page.waitForTimeout(3000);
  await shot(`${id}-${n}-mid`);
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyW');
  await shot(`${id}-${n}-result`);
  return done();
}

async function arenaRun(n) {
  await fresh('birthdayBash');
  await page.mouse.click(640, 360);
  const pattern = ['Mouse0', 'Mouse0', 'KeyE', 'Mouse0', 'KeyG', 'KeyE', 'Mouse0', 'KeyQ'];
  for (let i = 0; i < 1500 && !(await done()); i++) {
    const s = await page.evaluate(() => {
      const g = window.__game, h = g.hero.pos;
      const es = g.combat.enemies.filter((e) => e.alive);
      let near = null, nd = Infinity;
      for (const e of es) { const d = Math.hypot(e.pos.x - h.x, e.pos.z - h.z); if (d < nd) { nd = d; near = e; } }
      if (near) g.hero.bat.face(Math.atan2(near.pos.x - h.x, near.pos.z - h.z));
      return {
        blue: es.some((e) => e.glyph === 'blue' && e.state === 'windup'),
        red: es.some((e) => e.glyph === 'red' && e.state === 'windup'),
        ready: g.combat.combo.ready,
      };
    });
    if (s.blue) await page.mouse.click(640, 360, { button: 'right' });
    else if (s.red) await page.keyboard.press('KeyC');
    else if (s.ready) await page.keyboard.press('KeyX');
    else {
      const k = pattern[i % pattern.length];
      if (k === 'Mouse0') await page.mouse.click(640, 360); else await page.keyboard.press(k);
    }
    if (i === 60) await shot(`birthdayBash-${n}-mid`);
    await page.waitForTimeout(140);
  }
  await shot(`birthdayBash-${n}-result`);
  return done();
}

// Parkour: one leg per checkpoint, each doing its real move. A leg that times out is assisted
// (teleport into the checkpoint with the move noted) and marks the whole run as unusable.
async function parkourRun() {
  await fresh('gothamParkour');
  const legs = [];
  const next = () => page.evaluate(() => window.__game.side.challenges.debug?.next ?? 99);
  const reach = async (n, ms) => {
    try { await page.waitForFunction((n) => (window.__game.side.challenges.debug?.next ?? 99) >= n || window.__done, n, { timeout: ms }); return true; } catch { return false; }
  };
  const assist = async (n, move) => {
    await page.evaluate(({ n, move }) => {
      const g = window.__game;
      const cp = g.side.data.CHALLENGES.find((c) => c.id === 'gothamParkour').checkpoints[n - 1];
      const ev = { ladder: 'ladderOn', ledge: 'ledgeGrab', zipline: 'zipOn', wallrun: 'wallRun' }[move];
      if (ev) g.events.emit(ev);
      g.hero.teleport({ x: cp.x, y: cp.y, z: cp.z });
    }, { n, move });
    await reach(n, 2000);
    return 'assisted';
  };
  const walkTo = async (x, z, ms, sprint = false) => {
    const t0 = Date.now();
    await page.keyboard.down('KeyW');
    if (sprint) await page.keyboard.down('ShiftLeft');
    let last = null;
    while (Date.now() - t0 < ms) {
      const p = await page.evaluate(([x, z]) => { window.__face(x, z); const h = window.__game.hero.pos; return [h.x, h.z]; }, [x, z]);
      if (Math.hypot(p[0] - x, p[1] - z) < 2) break;
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.3) await page.keyboard.press('Space');
      last = p;
      await page.waitForTimeout(250);
    }
    await page.keyboard.up('KeyW');
    if (sprint) await page.keyboard.up('ShiftLeft');
  };
  const cps = await page.evaluate(() => window.__game.side.data.CHALLENGES.find((c) => c.id === 'gothamParkour').checkpoints);

  // Leg 1, ladder: walk into the fire escape's drop ladder, climb to the landing, grapple up.
  const ladder = await page.evaluate(([x, z]) => window.__game.climbables.ladders.find((l) => l.bottom < 1 && Math.hypot(l.x - x, l.z - z) < 20) ?? null, [cps[0].x, cps[0].z]);
  if (ladder) {
    await walkTo(ladder.x + ladder.nx * 0.6, ladder.z + ladder.nz * 0.6, 6000);
    await page.evaluate((l) => window.__face(l.x, l.z), ladder);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__game.hero.control?.name === 'ladder', null, { timeout: 4000 }).catch(() => {});
    await page.waitForFunction(() => !window.__game.hero.control, null, { timeout: 12000 }).catch(() => {});
    await page.keyboard.up('KeyW');
  }
  await page.evaluate((c) => window.__aim(c.x, c.y + 1, c.z), cps[0]);
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyF');
  legs.push((await reach(1, 8000)) ? 'ok' : await assist(1, 'ladder'));

  // Leg 2, ledge: grapple at the Gazette's north edge with back held, hang, pull up, walk in.
  await page.evaluate((c) => window.__aim(c.x, c.y - 0.5, c.z + 24), cps[1]);
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyF');
  await page.keyboard.up('KeyS');
  await page.waitForFunction(() => window.__game.hero.control?.name === 'ledge', null, { timeout: 6000 }).catch(() => {});
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyW');
  await walkTo(cps[1].x, cps[1].z, 6000);
  legs.push((await reach(2, 4000)) ? 'ok' : await assist(2, 'ledge'));

  // Leg 3, zipline: grapple to the top post of the Gazette line, ride it to the pawn shop roof.
  const zip = await page.evaluate(([a, b]) => window.__game.climbables.ziplines.find((z) => Math.hypot(z.a.x - a.x, z.a.z - a.z) < 30 && Math.hypot(z.b.x - b.x, z.b.z - b.z) < 30) ?? null, [cps[1], cps[2]]);
  if (zip) {
    await walkTo(zip.a.x, zip.a.z, 6000);
    await page.evaluate((z) => window.__aim(z.b.x, z.b.y, z.b.z), zip);
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    await page.evaluate((z) => window.__aim(z.a.x, z.a.y - 1.2, z.a.z), zip);
    await page.keyboard.press('KeyF');
  }
  if (!(await reach(3, 9000))) { await walkTo(cps[2].x, cps[2].z, 4000); }
  legs.push((await reach(3, 1000)) ? 'ok' : await assist(3, 'zipline'));

  // Leg 4, wall run: step off the pawn roof into the street, sprint along the hotel's east
  // face at about 20 degrees into it, jump to run the wall, then run to the checkpoint.
  await walkTo(cps[2].x + 22, cps[2].z, 5000);
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__game.follow.state.yaw = Math.atan2(-0.34, -0.94); });
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1300);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  await walkTo(cps[3].x, cps[3].z, 8000, true);
  legs.push((await reach(4, 3000)) ? 'ok' : await assist(4, 'wallrun'));

  // Leg 5: sprint west along the z = -90 street, then into the plaza.
  await walkTo(-40, cps[3].z, 30000, true);
  await walkTo(cps[4].x, cps[4].z, 12000, true);
  legs.push((await reach(5, 3000)) ? 'ok' : await assist(5, null));
  await shot('gothamParkour-result');
  return { ...(await done()), legs };
}

const out = {};
for (const ch of CHALLENGES) {
  if (only.length && !only.includes(ch.id)) continue;
  const samples = [];
  if (ch.kind === 'rings') {
    for (let n = 0; n < 3; n++) { const r = await glideRun(ch.id, n); if (r && !r.failed) samples.push(r.value); console.log(ch.id, n, r); }
  } else if (ch.kind === 'arena') {
    for (let n = 0; n < 3; n++) { const r = await arenaRun(n); if (r && !r.failed) samples.push(r.value); console.log(ch.id, n, r); }
  } else {
    const r = await parkourRun();
    console.log(ch.id, r);
    if (r && !r.failed && r.legs.every((l) => l === 'ok')) samples.push(r.value);
    else console.log(`${ch.id}: legs ${r?.legs?.join(', ')}. Fix the assisted legs (script or checkpoints) and rerun.`);
  }
  out[ch.id] = samples.length ? { samples, suggested: suggestThresholds(ch.kind, samples) } : { samples, suggested: null };
}
console.log('\n' + JSON.stringify(out, null, 1));
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
