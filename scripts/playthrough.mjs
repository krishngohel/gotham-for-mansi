// Automated run through every story step: teleports to each objective, wins each fight,
// grabs each item, reads each comic. Screenshots of every comic page go to $OUT.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:5200/';
const out = process.env.OUT ?? 'playthrough';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const start = process.env.START;
await page.goto(base + (start ? `?at=${start}&god=1` : '?new=1&god=1'));
await page.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 20, null, { timeout: 90000 });
if (!start) await page.evaluate(() => { document.querySelector('.mbtn.primary').click(); document.querySelector('.suit-card.suit-m').click(); });
await page.waitForFunction(() => window.__game?.gadgets, null, { timeout: 60000 });
await page.evaluate(() => {
  const G = window.__game;
  G.__unlocked = [];
  G.events.on('gadgetUnlocked', ({ id }) => G.__unlocked.push(id));
});

const state = () => page.evaluate(() => {
  const G = window.__game, s = G.flow.objectives.step;
  return { id: s?.id ?? null, type: s?.type ?? null, mode: G.flow.mode, site: G.flow.target, phase: G.boss?.phase, joker: G.boss?.joker.state };
});
let shotN = 0;
// Part S: skip radio dialogue instantly (a real player reads it at typewriter pace; the script
// just needs the beat to finish so its async step, if any, can proceed or degrade).
async function skipRadio() { await page.evaluate(() => { if (window.__game.radio?.playing) window.__game.radio.skip(); }); }
for (let guard = 0; guard < 600; guard++) {
  await page.waitForTimeout(400);
  await skipRadio();
  const s = await state();
  if (!s.id) break;
  if (s.mode === 'cutscene' || s.mode === 'dead') {
    // Read every page of the comic.
    for (let k = 0; k < 8; k++) {
      await page.waitForTimeout(350);
      if (!(await page.evaluate(() => window.__game.comic.playing))) break;
      await page.screenshot({ path: `${out}/${String(shotN++).padStart(2, '0')}-${s.id}.png` });
      for (let j = 0; j < 4; j++) await page.keyboard.press('Space');
    }
    continue;
  }
  if (s.mode === 'finale') { await page.waitForTimeout(3000); await page.screenshot({ path: `${out}/${String(shotN++).padStart(2, '0')}-finale.png` }); await page.waitForTimeout(19000); continue; }
  if (s.mode === 'credits') { await page.screenshot({ path: `${out}/${String(shotN++).padStart(2, '0')}-credits.png` }); await page.evaluate(() => document.querySelector('.credits-menu .mbtn').click()); break; }
  if (s.type === 'boss') {
    // Clear the goon waves, then force the phases along.
    await page.evaluate(() => window.__game.winFight());
    await page.evaluate(() => {
      const B = window.__game.boss;
      if (B.phase === 2 && B.joker.state === 'roam') { B.joker.state = 'throw'; B.joker.t = 0; B.joker.applyHit({ outcome: 'stun' }, B.joker.pos); for (let i = 0; i < 5; i++) B.joker.applyHit({ outcome: 'hit' }, window.__game.hero.pos); }
      if (B.phase === 3 && ['approach', 'windup', 'backoff'].includes(B.joker.state)) { B.joker.state = 'staggered'; B.joker.finishable = true; B.joker.applyHit({ outcome: 'hit' }, window.__game.hero.pos); }
    });
    await page.waitForTimeout(1400);
    continue;
  }
  if (s.site) await page.evaluate((p) => window.__game.teleport({ x: p.x, y: p.y, z: p.z }), s.site);
  if (s.type === 'fight') { await page.waitForTimeout(600); await page.evaluate(() => window.__game.winFight()); await page.waitForTimeout(1800); await page.evaluate(() => window.__game.winFight()); await page.waitForTimeout(1800); await page.evaluate(() => window.__game.winFight()); }
}
const end = await state();
console.log('ended at', JSON.stringify(end));
console.log('comic pages captured:', shotN);
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
const report = await page.evaluate(() => ({ unlocked: window.__game.__unlocked, wayne: { xp: window.__game.wayne.xp, level: window.__game.wayne.level }, gadgets: window.__game.progress.gadgets.unlocked }));
console.log('gadgets unlocked in order:', JSON.stringify(report.unlocked));
console.log('saved gadget unlocks:', JSON.stringify(report.gadgets), 'wayne:', JSON.stringify(report.wayne));
await browser.close();
