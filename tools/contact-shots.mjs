// Screenshots every strike on its contact frame in the ?fight=test sandbox, to check that the
// fist or foot really touches the goon. Each move is staged (target placed in front of the
// hero, others moved away), triggered with the real key bindings, and captured while the
// game's hit-stop holds both fighters on the contact frame (?hitstop=0.6 stretches it).
//   node tools/contact-shots.mjs [outDir] [base url]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'C:/Users/awsom/AppData/Local/Temp/mocap/contact';
const base = process.argv[3] ?? 'http://localhost:5212/';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '?fight=test&god=1&suit=m&hitstop=0.6');
await page.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 20, null, { timeout: 120000 });
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__game.flow?.mode === 'play', null, { timeout: 20000 });
await page.waitForTimeout(800);
const report = [];
const log = (...a) => { console.log(...a); report.push(a.join(' ')); };
log('reach table:', JSON.stringify(await page.evaluate(() => Object.fromEntries(Object.entries(window.__game.reach).map(([k, v]) => [k, { contact: v.contact, limb: v.limb, reach: v.reach }])))));

// On every impact, record where the striking limbs are relative to the target on that exact
// frame (the screenshot itself comes a few frames later, once Playwright has captured it).
await page.evaluate(() => {
  const G = window.__game;
  G.events.on('impact', ({ target }) => {
    const h = G.hero, e = target;
    const V = h.pos.constructor;
    const limbs = {};
    for (const b of ['hand_l', 'hand_r', 'ball_l', 'ball_r', 'calf_r']) { const p = h.bat.bone(b).getWorldPosition(new V()); limbs[b] = +Math.hypot(p.x - e.pos.x, p.z - e.pos.z).toFixed(2); }
    window.__contact = { heroToTarget: +Math.hypot(h.pos.x - e.pos.x, h.pos.z - e.pos.z).toFixed(2), limbToTargetAxis: limbs, targetRadius: +e.radius.toFixed(2), clip: h.bat.animator.currentName };
  });
});
// Remember where the sandbox starts: every move is staged from here so lunges and jumps
// cannot walk the hero off the roof over a run.
await page.evaluate(() => { const h = window.__game.hero; window.__base = { x: h.pos.x, y: h.pos.y, z: h.pos.z }; });

// Put one goon of `type` `dist` metres in front of the hero, everyone else far away. The
// hero is reset to the base point, facing a direction with level roof for 6 m ahead.
async function stage(type, dist, { hp = 60, camSide = -1.15, pick = 0, extra = null } = {}) {
  await page.evaluate(({ type, dist, hp, camSide, pick, extra }) => {
    const G = window.__game, hero = G.hero, b = window.__base;
    const level = (yaw) => [dist, dist + 3, 6].every((r) => Math.abs(G.world.collision.groundBelow(b.x + Math.sin(yaw) * r, b.y + 2, b.z + Math.cos(yaw) * r, 0.3) - b.y) < 0.5);
    let yaw = 0;
    for (const cand of [0, Math.PI / 2, -Math.PI / 2, Math.PI, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4]) if (level(cand)) { yaw = cand; break; }
    hero.teleport(b, yaw);
    hero.control = null;
    hero.vel.set(0, 0, 0);
    hero.invulnerable = 30;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let target = null, seen = 0, extraDone = false;
    for (const e of G.enemies) {
      const revive = () => { e.alive = true; e.down = false; e.air = false; e.stunned = false; e.countered = false; e.health = e.def.health; e.state = 'engage'; e.aware = true; e.vel?.set?.(0, 0, 0); };
      if (!target && e.type === type && seen++ === pick) { target = e; revive(); e.health = hp; e.pos.set(hero.pos.x + fx * dist, hero.pos.y, hero.pos.z + fz * dist); e.ch.face(yaw + Math.PI); }
      else if (extra && !extraDone && e.type === type) { extraDone = true; revive(); e.health = hp; e.pos.set(hero.pos.x + fx * extra.dist + fz * extra.side, hero.pos.y, hero.pos.z + fz * extra.dist - fx * extra.side); e.ch.face(yaw + Math.PI); }
      // Everyone else: alive but asleep and far, so nobody runs in and staggers the hero mid-move.
      else { revive(); e.aware = false; e.state = 'idle'; e.pos.set(hero.pos.x - fx * 40 + (Math.random() - 0.5) * 6, hero.pos.y, hero.pos.z - fz * 40); }
    }
    hero.bat.face(yaw);
    // Camera off to the side of the attack line so the contact reads in profile.
    G.follow.snapBehind(yaw + camSide, 0.12);
    window.__stageTarget = target?.id ?? null;
    window.__stageYaw = yaw;
  }, { type, dist, hp, camSide, pick, extra });
  await page.waitForTimeout(350);
}
const impacts = () => page.evaluate(() => window.__impacts ?? 0);
async function shotOnImpact(name, { after = 0, timeout = 2500, since = null } = {}) {
  const n0 = since ?? await impacts();
  const t0 = Date.now();
  try {
    await page.waitForFunction((n0) => (window.__impacts ?? 0) > n0, n0, { timeout, polling: 'raf' });
  } catch {
    log(`${name}: NO IMPACT within ${timeout} ms`);
    await page.screenshot({ path: join(out, `${name}-noimpact.png`) });
    return false;
  }
  if (after) await page.waitForTimeout(after);
  await page.screenshot({ path: join(out, `${name}.png`) });
  const info = await page.evaluate(() => ({ move: window.__lastImpact?.move, outcome: window.__lastImpact?.outcome, ...window.__contact }));
  log(`${name}: ${Date.now() - t0} ms, ${JSON.stringify(info)}`);
  return true;
}
const click = async (button = 'left') => { await page.mouse.move(640, 360); await page.mouse.down({ button }); await page.waitForTimeout(30); await page.mouse.up({ button }); };
const settle = (ms = 1400) => page.waitForTimeout(ms);
// ?hitstop=0.6 freezes the game for 0.6 s after every impact; inputs must wait it out.
const FREEZE = 750;

// Punch chain: jab, cross, jab, then the haymaker (critical: action camera).
await stage('grunt', 2.2);
for (const name of ['punch1-jab', 'punch2-cross', 'punch3-jab']) { await click(); await shotOnImpact(name); await page.waitForTimeout(FREEZE); }
await click();
if (await shotOnImpact('punch4-haymaker')) { await page.waitForTimeout(450); await page.screenshot({ path: join(out, 'punch4-haymaker-actioncam.png') }); }
await settle();

// Kick chain: front push kick, roundhouse, then the lunge spin kick finisher.
// A fresh goon for each kick: a kick on a goon the last kick floored is an instant KO by rule.
await stage('grunt', 2.4, { pick: 0 });
await page.keyboard.press('KeyE'); await shotOnImpact('kick1-front'); await page.waitForTimeout(FREEZE);
await stage('grunt', 2.6, { pick: 1 });
await page.keyboard.press('KeyE'); await shotOnImpact('kick2-roundhouse'); await page.waitForTimeout(FREEZE);
await stage('grunt', 3.0, { pick: 2 });
await page.keyboard.press('KeyE');
if (await shotOnImpact('kick3-spin-finisher')) { await page.waitForTimeout(450); await page.screenshot({ path: join(out, 'kick3-spin-finisher-actioncam.png') }); }
await settle();

// Flying kick: jump, then kick in the air at a goon 4 m out.
await stage('grunt', 4);
const beforeJump = await impacts();
await page.keyboard.press('Space'); await page.waitForTimeout(320);
await page.keyboard.press('KeyE');
await shotOnImpact('flying-kick', { timeout: 3000, since: beforeJump });
await settle();

// Knee: cape-stun the brute, then beat it down (punch, knee).
await stage('brute', 2.0);
await page.keyboard.press('KeyQ'); await shotOnImpact('cape-stun'); await page.waitForTimeout(FREEZE + 150);
await click(); await shotOnImpact('beatdown1-punch'); await page.waitForTimeout(FREEZE);
await click(); await shotOnImpact('beatdown2-knee'); await page.waitForTimeout(FREEZE);
await click(); await shotOnImpact('beatdown3-punch');
await settle();

// Counter: a grunt winds up, block is tapped on the glyph.
await stage('grunt', 2.6);
await page.evaluate(() => { const G = window.__game; const e = G.enemies.find((x) => x.id === window.__stageTarget); e.startWindup(1.4, G.hero); });
await page.waitForTimeout(150);
await click('right'); await shotOnImpact('counter-hook');
await settle();
await stage('grunt', 2.6, { pick: 1, extra: { dist: 2.4, side: 1.6 } });
await page.evaluate(() => { const G = window.__game; for (const e of G.enemies) if (e.type === 'grunt' && e.pos.distanceTo(G.hero.pos) < 4) e.startWindup(1.4, G.hero); });
await page.waitForTimeout(150);
await click('right'); await shotOnImpact('counter2-hook-first'); await shotOnImpact('counter2-kick-second', { timeout: 1500 });
await settle();

// Special takedown on a full combo meter.
await stage('grunt', 3);
await page.evaluate(() => { for (let i = 0; i < 9; i++) window.__game.combat.combo.hit(); });
await page.keyboard.press('KeyX'); await page.waitForTimeout(150);
log('after special press:', JSON.stringify(await page.evaluate(() => ({ control: window.__game.hero.control?.name ?? null, ready: window.__game.combat.combo.ready, value: window.__game.combat.combo.value }))));
if (await shotOnImpact('special', { timeout: 3000 })) { await page.waitForTimeout(450); await page.screenshot({ path: join(out, 'special-actioncam.png') }); }

writeFileSync(join(out, 'contact-log.txt'), report.join('\n') + '\n');
// Labelled grids of every shot, three per row, for review.
const sharp = (await import('sharp')).default;
const { readdirSync } = await import('node:fs');
const files = readdirSync(out).filter((f) => f.endsWith('.png') && !f.startsWith('grid')).sort();
const W = 640, H = 360, COLS = 3;
for (let g = 0; g * 9 < files.length; g++) {
  const part = files.slice(g * 9, g * 9 + 9);
  const rows = Math.ceil(part.length / COLS);
  const tiles = [];
  for (let i = 0; i < part.length; i++) {
    const img = await sharp(join(out, part[i])).resize(W, H).toBuffer();
    const label = Buffer.from(`<svg width="${W}" height="28"><rect width="${W}" height="28" fill="#111" opacity="0.75"/><text x="8" y="20" font-family="monospace" font-size="16" fill="#fff">${part[i].replace('.png', '')}</text></svg>`);
    tiles.push({ input: await sharp(img).composite([{ input: label, top: 0, left: 0 }]).toBuffer(), left: (i % COLS) * W, top: Math.floor(i / COLS) * H });
  }
  await sharp({ create: { width: W * COLS, height: H * rows, channels: 3, background: '#222' } }).composite(tiles).png().toFile(join(out, `grid-${g + 1}.png`));
}
console.log('grids:', Math.ceil(files.length / 9));

log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
await browser.close();
