// Measures how long a Monarch Balcony goon takes to notice Batman: one goon is pinned facing him
// at 8 m and 14 m while he stands in lamplight, crouches in lamplight or crouches in shadow, and
// the other goons are pinned at the far end looking away. Times are from the goon turning round
// to the ring first showing (meter above 0), turning yellow (search) and going red (alarm).
// Usage: node scripts/stealth-timing.mjs [url]   (point it at a frozen build: vite preview)
import { chromium } from 'playwright-core';

const base = (process.argv[2] ?? 'http://localhost:5210/').replace(/\/$/, '');
// Lamp over the north doorway: (200.6, -50), r 3.5. Shadow lane along the rail at x 205.
const SPOTS = {
  'standing, lamplight': { x: 201.2, z: -50, crouch: false },
  'crouched, lamplight': { x: 201.2, z: -50, crouch: true },
  'crouched, shadow': { x: 205, z: -45, crouch: true },
  // For comparison: a goon already searching (it heard something) starts yellow and half full.
  'standing, lamplight, goon already searching': { x: 201.2, z: -50, crouch: false, searching: true },
};
const DISTANCES = [8, 14];
const LIMIT = 8000;

const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const rows = [];
const errors = [];
for (const [label, spot] of Object.entries(SPOTS)) {
  for (const d of spot.searching ? [14] : DISTANCES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/?at=monarchBalcony&god=1`);
    await page.waitForFunction(() => window.__game?.state?.frame > 30 && window.__game.stealth?.active, null, { timeout: 120000 });
    await page.evaluate(() => window.__game.comic.playing && window.__game.comic.skip());
    await page.waitForTimeout(1500);
    // Pin every goon each frame: goon 0 d metres north of Batman facing away (for now), the rest
    // at the far north end looking north.
    await page.evaluate(({ spot, d }) => {
      const G = window.__game;
      const pin = G.__pin = { yaw: Math.PI, spot };
      G.hero.teleport({ x: spot.x, y: 13, z: spot.z }, Math.PI);
      const tick = () => {
        G.stealth.goons.forEach((g, i) => {
          if (!g.e.alive) return;
          if (i === 0) g.e.place({ x: spot.x, y: 13, z: spot.z - d }, pin.yaw);
          else g.e.place({ x: 200.8 + i * 1.4, y: 13, z: -77.5 }, Math.PI);
        });
        requestAnimationFrame(tick);
      };
      tick();
    }, { spot, d });
    await page.waitForTimeout(400);
    if (spot.crouch) {
      await page.keyboard.press('KeyZ');
      await page.waitForFunction(() => window.__game.hero.crouched, null, { timeout: 3000 });
    }
    await page.waitForTimeout(300);
    const r = await page.evaluate(({ limit, spot }) => new Promise((resolve) => {
      const G = window.__game, m = G.stealth.goons[0].mind;
      if (spot.searching) { m.alert = 'search'; m.meter = 0.5; m.searchLeft = 20; } else { m.alert = 'patrol'; m.meter = 0; }
      const t0 = performance.now();
      G.__pin.yaw = 0; // turn round to face Batman (yaw 0 faces +z, south)
      const out = { ring: null, search: null, alarm: null, crouched: G.hero.crouched };
      const f = () => {
        const t = performance.now() - t0;
        if (out.ring === null && m.meter > 0) out.ring = t;
        if (out.search === null && (m.alert === 'search' || m.meter >= 0.5)) out.search = spot.searching ? 0 : t;
        if (out.alarm === null && (m.alert === 'engage' || G.stealth.alarm)) out.alarm = t;
        if (out.alarm !== null || t > limit) { out.meter = m.meter; out.crouchedEnd = G.hero.crouched; resolve(out); return; }
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }), { limit: LIMIT, spot });
    rows.push({ label, d, ...r });
    await page.close();
  }
}
await browser.close();

const s = (t) => (t === null ? `none in ${LIMIT / 1000} s` : `${(t / 1000).toFixed(2)} s`);
console.log('| Case | Distance | Ring shows | Yellow (search) | Red (alarm) | Meter at end |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) {
  const flag = r.crouched === r.crouchedEnd ? '' : ' (crouch changed!)';
  console.log(`| ${r.label}${flag} | ${r.d} m | ${s(r.ring)} | ${s(r.search)} | ${s(r.alarm)} | ${r.meter.toFixed(2)} |`);
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
