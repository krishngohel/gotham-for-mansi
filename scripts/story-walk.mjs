// A visual walk through the whole story, from the title screen, the way a player sees it: a
// screenshot at the start of every step (the player's own camera, objective card and marker),
// on arrival, at each fight's start, every comic page, every radio call and a frame of every
// cinematic, plus a log of anything a player would notice: the hero jumping more than 25 m in a
// quarter second without this script moving her (a cut), falling far below where a step put
// her, deaths, and console errors. Travel is still a teleport onto each site and fights are still
// won through winFight(), like scripts/playthrough.mjs, but every beat is photographed first.
// usage: node scripts/story-walk.mjs <url> <outDir>   (muted)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5202/';
const out = process.argv[3] ?? 'story-walk';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

let n = 0;
const log = [];
const shot = async (tag) => { const f = `${String(n++).padStart(3, '0')}-${tag}.png`; await page.screenshot({ path: `${out}/${f}` }); return f; };

const startAt = process.env.START;
await page.goto(base + (startAt ? `?at=${startAt}&god=1` : '?new=1&god=1'));
await page.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 20, null, { timeout: 90000 });
await page.waitForTimeout(1500);
if (!startAt) {
  await shot('title');
  await page.evaluate(() => document.querySelector('.mbtn.primary').click());
  await page.waitForTimeout(800);
  await shot('suit-select');
  await page.evaluate(() => document.querySelector('.suit-card.suit-m').click());
}
await page.waitForFunction(() => window.__game?.flow, null, { timeout: 60000 });

// In-page watcher: hero position every 250 ms; a jump of more than 25 m not inside one of this
// script's own moves (window.__mine) is logged as a cut.
await page.evaluate(() => {
  const G = window.__game;
  window.__mine = 0;
  window.__cuts = [];
  window.__events = [];
  let last = null;
  setInterval(() => {
    const p = G.hero.pos, step = G.flow.objectives.step?.id;
    if (last && Date.now() > window.__mine) {
      const d = Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z);
      if (d > 25) window.__cuts.push({ step, d: Math.round(d), from: [last.x, last.y, last.z].map(Math.round), to: [p.x, p.y, p.z].map(Math.round), ctl: G.hero.control?.name ?? null, veh: G.vehicles?.active?.kind ?? null });
    }
    last = { x: p.x, y: p.y, z: p.z };
  }, 250);
  for (const ev of ['heroDown', 'vehicleEnter', 'vehicleExit', 'wingEnter', 'wingExit', 'chaseDone', 'battleDone', 'armadaDone']) G.events.on(ev, () => window.__events.push([ev, G.flow.objectives.step?.id]));
});
// Marks a window in which a big move is this script's doing, not the game's.
const mine = (ms = 1500) => page.evaluate((ms) => { window.__mine = Date.now() + ms; }, ms);

const state = () => page.evaluate(() => {
  const G = window.__game, s = G.flow.objectives.step;
  return {
    id: s?.id ?? null, type: s?.type ?? null, mode: G.flow.mode, text: document.querySelector('.hud-objective, .objective')?.textContent?.trim().slice(0, 140) ?? s?.text ?? '',
    site: G.flow.target ? { x: G.flow.target.x, y: G.flow.target.y, z: G.flow.target.z } : null,
    hero: [G.hero.pos.x, G.hero.pos.y, G.hero.pos.z].map((v) => +v.toFixed(1)),
    comic: G.comic.playing, cine: !!G.cinematic?.active, radio: !!G.radio?.playing, veh: G.vehicles?.active?.kind ?? null, fly: G.batwing?.active ?? false,
  };
});

let lastStep = null;
for (let guard = 0; guard < 900; guard++) {
  await page.waitForTimeout(300);
  let s = await state();
  if (!s.id && s.mode !== 'credits') break;
  if (s.id !== lastStep) {
    // A new step: the player's view as it begins.
    await page.waitForTimeout(900);
    s = await state();
    const d = s.site ? Math.round(Math.hypot(s.site.x - s.hero[0], s.site.z - s.hero[2])) : null;
    const dy = s.site ? Math.round(s.site.y - s.hero[1]) : null;
    const f = await shot(`${s.id}-start`);
    log.push({ step: s.id, type: s.type, mode: s.mode, text: s.text, hero: s.hero, site: s.site, distance: d, climb: dy, veh: s.veh, shot: f });
    lastStep = s.id;
  }
  // Talk and cinematics: photograph, then move on.
  if (s.cine) { await page.waitForTimeout(700); await shot(`${s.id}-cinematic`); await page.evaluate(() => window.__game.cinematic.skip()); continue; }
  if (s.radio) { await page.waitForTimeout(500); await shot(`${s.id}-radio`); await page.evaluate(() => window.__game.radio.skip()); continue; }
  if (s.mode === 'cutscene' || s.mode === 'dead') {
    for (let k = 0; k < 8; k++) {
      await page.waitForTimeout(400);
      if (!(await page.evaluate(() => window.__game.comic.playing))) break;
      await shot(`${s.id}-comic${k}`);
      for (let j = 0; j < 4; j++) await page.keyboard.press('Space');
    }
    continue;
  }
  if (s.mode === 'finale') { await page.waitForTimeout(3000); await shot('finale-a'); await page.waitForTimeout(8000); await shot('finale-b'); await page.waitForTimeout(11000); continue; }
  if (s.mode === 'credits') { await shot('credits'); break; }
  if (s.type === 'boss') {
    await shot(`${s.id}-phase`);
    await page.evaluate(() => window.__game.winFight());
    await page.evaluate(() => {
      const B = window.__game.boss;
      if (B.phase === 2 && B.joker.state === 'roam') { B.joker.state = 'throw'; B.joker.t = 0; B.joker.applyHit({ outcome: 'stun' }, B.joker.pos); for (let i = 0; i < 5; i++) B.joker.applyHit({ outcome: 'hit' }, window.__game.hero.pos); }
      if (B.phase === 3 && ['approach', 'windup', 'backoff'].includes(B.joker.state)) { B.joker.state = 'staggered'; B.joker.finishable = true; B.joker.applyHit({ outcome: 'hit' }, window.__game.hero.pos); }
    });
    await page.waitForTimeout(1400);
    continue;
  }
  if (s.type === 'board') {
    await page.waitForFunction(() => !window.__game.vehicles?.batmobile?.arriving, null, { timeout: 5000 }).catch(() => {});
    await shot(`${s.id}-car-waiting`);
    await mine(); await page.evaluate(() => { const v = window.__game.vehicles; if (v && !v.active) v.enter(v.batmobile); });
    continue;
  }
  if (s.type === 'chase' || s.type === 'battle' || s.type === 'armada') {
    const running = await page.evaluate(() => !!(window.__game.vehicles?.chase?.active || window.__game.vehicles?.battle?.active || window.__game.batwing?.armada?.active));
    if (!running) continue;
    // Drive (or fly) for real for two seconds, then photograph the mission in progress.
    await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW');
    await shot(`${s.id}-mission`);
    await page.evaluate(() => { window.__game.vehicles?.debugWin?.(); window.__game.batwing?.debugWin?.(); });
    await page.waitForTimeout(800);
    continue;
  }
  if (s.type === 'fight') {
    // A fight that starts far from the player has no travel step leading to it: log it (a real
    // player has to find their own way there), then go there so the walk can carry on.
    const far = s.site ? Math.hypot(s.site.x - s.hero[0], s.site.z - s.hero[2]) : 0;
    if (far > 40) {
      log.push({ step: s.id, issue: `fight starts ${Math.round(far)} m from the player, with no travel step` });
      await mine(3000);
      await page.evaluate(() => { const v = window.__game.vehicles, w = window.__game.batwing; if (v?.active) v.exit(); if (w?.active) w.exit(); });
      await page.evaluate((p) => window.__game.teleport({ x: p.x, y: p.y, z: p.z }), s.site);
      await page.waitForTimeout(1200);
    }
    await page.waitForTimeout(700);
    await shot(`${s.id}-fight`);
    for (let k = 0; k < 3; k++) { await page.evaluate(() => window.__game.winFight()); await page.waitForTimeout(1800); }
    continue;
  }
  // Travel (and collect, interior...): out of any vehicle, onto the site, photograph arrival.
  await mine(3000);
  await page.evaluate(() => { const v = window.__game.vehicles, w = window.__game.batwing; if (v?.active) v.exit(); if (w?.active) w.exit(); });
  if (s.site) {
    await page.evaluate((p) => window.__game.teleport({ x: p.x, y: p.y, z: p.z }), s.site);
    await page.waitForTimeout(700);
    const st = await state();
    if (st.id === s.id) await shot(`${s.id}-arrived`);
  }
}
const end = await state();
const extra = await page.evaluate(() => ({ cuts: window.__cuts, events: window.__events }));
writeFileSync(`${out}/walk.json`, JSON.stringify({ end, steps: log, ...extra, errors }, null, 1));
console.log('ended at', end.id, end.mode, '| shots', n, '| steps', log.length);
console.log('cuts (hero jumps the script did not make):', JSON.stringify(extra.cuts));
console.log('events:', JSON.stringify(extra.events));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
