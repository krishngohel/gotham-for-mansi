// Foot-planting audit: lowest skinned vertex of each foot vs the collision ground under it, per frame.
// usage: node foot-audit.mjs <baseUrl> <outDir> [quick]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const [base, outDir, quick] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
console.log('audit start');
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));

const HELPERS = `
window.__audit = (() => {
  const G = window.__game;
  const col = G.world.collision;
  function meshesOf(root) {
    const out = [];
    root.traverse((o) => {
      if (!o.isSkinnedMesh || !o.visible) return;
      const m = o.material;
      if (!m || m.side === 1 || m.transparent || m.depthTest === false) return; // hulls, x-ray
      out.push(o);
    });
    return out;
  }
  // Lowest vertex per side ('l' / 'r' by the dominant bone name) in world space.
  function lowest(root, meshes) {
    root.updateMatrixWorld(true);
    const res = { l: null, r: null };
    for (const mesh of meshes) {
      mesh.skeleton.update();
      const pos = mesh.geometry.attributes.position;
      const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
      const v = mesh.position.clone();
      const idx = mesh.geometry.index;
      const n = idx ? idx.count : pos.count;
      const seen = new Set();
      for (let k = 0; k < n; k++) {
        const i = idx ? idx.getX(k) : k;
        if (seen.has(i)) continue; seen.add(i);
        // dominant bone
        let best = 0, bw = -1;
        for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; best = si.getComponent(i, c); } }
        const bname = mesh.skeleton.bones[best]?.name ?? '';
        const side = /_l(\\b|$|_)/.test(bname) ? 'l' : /_r(\\b|$|_)/.test(bname) ? 'r' : null;
        if (!side) continue;
        if (!/foot|ball|calf/.test(bname)) continue;
        v.fromBufferAttribute(pos, i);
        mesh.applyBoneTransform(i, v);
        v.applyMatrix4(mesh.matrixWorld);
        if (!res[side] || v.y < res[side].y) res[side] = { x: v.x, y: v.y, z: v.z, mesh: mesh.parent?.name || mesh.name || 'part', bone: bname };
      }
    }
    return res;
  }
  function groundAt(p) {
    const g = col.groundBelow(p.x, p.y + 0.3, p.z, 0.01);
    return g;
  }
  function sampleOnce(ch, meshes) {
    const low = lowest(ch.root, meshes);
    const out = {};
    for (const s of ['l', 'r']) {
      const p = low[s]; if (!p) continue;
      const g = groundAt(p);
      out[s] = { d: g === -Infinity ? null : +(p.y - g).toFixed(4), y: +p.y.toFixed(3), g: g === -Infinity ? null : +g.toFixed(3), mesh: p.mesh, bone: p.bone };
    }
    out.rootY = +ch.root.position.y.toFixed(3);
    out.rootG = +col.groundBelow(ch.root.position.x, ch.root.position.y + 0.3, ch.root.position.z, 0.01).toFixed(3);
    out.lift = +(ch.model.position.y + 1).toFixed(4);
    return out;
  }
  // Samples a character for ms milliseconds after a settle, one sample per frame.
  function sample(ch, ms, settle = 350) {
    const meshes = meshesOf(ch.root);
    return new Promise((resolve) => {
      const t0 = performance.now();
      const rows = [];
      const tick = () => {
        const t = performance.now() - t0;
        if (t > settle) rows.push(sampleOnce(ch, meshes));
        if (t < ms + settle) requestAnimationFrame(tick); else resolve(summarize(rows));
      };
      requestAnimationFrame(tick);
    });
  }
  function summarize(rows) {
    const ds = [];
    for (const r of rows) for (const s of ['l', 'r']) if (r[s] && r[s].d !== null) ds.push(r[s].d);
    ds.sort((a, b) => a - b);
    const lows = rows.map((r) => Math.min(r.l?.d ?? 9, r.r?.d ?? 9)).sort((a, b) => a - b);
    return {
      n: rows.length,
      minD: ds[0], maxD: ds[ds.length - 1],
      // per frame: the planted (lowest) foot's gap
      plantedMin: lows[0], plantedMed: lows[Math.floor(lows.length / 2)], plantedMax: lows[lows.length - 1],
      lift: rows[rows.length - 1]?.lift, meshes: [...new Set(rows.map((r) => r.l?.mesh))].join('/'),
    };
  }
  function tryPlay(ch, clip) {
    try { ch.animator.play(clip, { fade: 0.05 }); return true; } catch { return false; }
  }
  function findSurfaces() {
    const S = G.world?.SITES;
    const boxes = col.boxes;
    const near = (b, x, z, r) => Math.hypot((b.minX + b.maxX) / 2 - x, (b.minZ + b.maxZ) / 2 - z) < r;
    const parapet = boxes.find((b) => b.maxY > 42.5 && b.maxY < 43.5 && (b.maxX - b.minX < 0.5 || b.maxZ - b.minZ < 0.5) && near(b, 6, 10, 40));
    const curb = boxes.find((b) => b.maxY > 0.1 && b.maxY < 0.35 && b.minY <= 0.01 && near(b, 150, 40, 40) && (b.maxX - b.minX) > 2 && (b.maxZ - b.minZ) > 2);
    const landing = boxes.filter((b) => Math.abs((b.maxY - b.minY) - 0.08) < 0.01 && Math.abs(b.maxY - 6.84) < 0.1).sort((a, b) => Math.hypot((a.minX + a.maxX) / 2 - 150, (a.minZ + a.maxZ) / 2 - 62) - Math.hypot((b.minX + b.maxX) / 2 - 150, (b.minZ + b.maxZ) / 2 - 62))[0];
    const pier = boxes.find((b) => b.tag === 'pier');
    const c = (b) => b && { x: (b.minX + b.maxX) / 2, y: b.maxY, z: (b.minZ + b.maxZ) / 2, box: { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, maxY: b.maxY } };
    return { parapet: c(parapet), curb: c(curb), landing: c(landing), pier: c(pier) };
  }
  return { meshesOf, sample, tryPlay, findSurfaces, sampleOnce, lowest };
})();
`;

async function open(query) {
  await page.goto(base + query);
  await page.waitForFunction('window.__game?.state?.frame > 30 && !!window.__game.hero', null, { timeout: 90000 });
  console.log('page ready');
  await page.evaluate(HELPERS);
  await page.waitForTimeout(500);
}

const heroClips = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Idle_Shield_Loop', 'Crouch_Idle_Loop', 'Punch_Jab', 'Punch_Cross', 'Melee_Hook', 'Kick_Front', 'Kick_Round', 'Kick_Flying', 'Jump_Land', 'Roll', 'ClimbUp_1m', 'Ladder_Idle', 'Ladder_Climb', 'Hang_Idle', 'Shimmy', 'NinjaJump_Land', 'Spell_Simple_Shoot', 'OverhandThrow'];
const goonClips = ['Idle_Loop', 'Idle_Talking_Loop', 'Idle_TalkingPhone_Loop', 'Idle_FoldArms_Loop', 'Walk_Loop', 'Zombie_Walk_Fwd_Loop', 'Jog_Fwd_Loop', 'Punch_Jab', 'Punch_Cross', 'Melee_Hook', 'Sword_Idle', 'Sword_Regular_A', 'Sword_Heavy_Combo', 'Shield_Dash', 'Hit_Chest', 'Hit_Head', 'Idle_Shield_Break', 'Yes', 'Idle_No_Loop', 'LayToIdle'];
const results = [];

// Joker mode: the boss fight in the arena, sampled as he plays his own moves for a while.
if (quick === 'joker') {
  await page.goto(base + '?at=boss&god=1');
  await page.waitForFunction('window.__game?.state?.frame > 30 && !!window.__game.hero', null, { timeout: 90000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction('window.__game.boss?.phase === 1', null, { timeout: 20000 });
  await page.evaluate(HELPERS);
  await page.evaluate('window.__game.hero.frozen = true');
  const perClip = {};
  for (let i = 0; i < 14; i++) {
    const clip = await page.evaluate('window.__game.boss.joker.ch.animator.currentName');
    const r = await page.evaluate('window.__audit.sample(window.__game.boss.joker.ch, 700, 0)');
    const row = perClip[clip] ?? (perClip[clip] = { who: 'joker', spot: 'arena', clip, plantedMin: 9, plantedMed: 9, maxD: -9, lift: r.lift });
    row.plantedMin = Math.min(row.plantedMin, r.plantedMin ?? 9); row.plantedMed = Math.min(row.plantedMed, r.plantedMed ?? 9); row.maxD = Math.max(row.maxD, r.maxD ?? -9);
    console.log('joker', clip, JSON.stringify(r));
  }
  const rows = Object.values(perClip);
  const lines = ['| who | spot | clip | planted min | planted med | any foot max | lift |', '|---|---|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.who} | ${r.spot} | ${r.clip} | ${(r.plantedMin * 100).toFixed(1)} cm | ${(r.plantedMed * 100).toFixed(1)} cm | ${(r.maxD * 100).toFixed(1)} cm | ${(r.lift * 100).toFixed(1)} cm |`);
  writeFileSync(`${outDir}/joker.md`, lines.join('\n'));
  console.log(lines.join('\n'));
  await page.evaluate(`(() => { const G = window.__game; const j = G.boss.joker; G.follow.update = () => {}; const f = j.ch.root.position;
    G.camera.position.set(f.x + 1.5, f.y + 0.3, f.z + 1.2); G.camera.lookAt(f.x, f.y + 0.08, f.z); })()`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/ankle-joker.png` });
  await browser.close();
  process.exit(0);
}

await open('?at=f1&god=1');
const surfaces = await page.evaluate('window.__audit.findSurfaces()');
console.log('surfaces', JSON.stringify(surfaces));
const spots = {
  roof: { x: 6, y: 42, z: 10, yaw: 0 },
  parapet: surfaces.parapet && { x: surfaces.parapet.x, y: surfaces.parapet.y, z: surfaces.parapet.z, yaw: 0 },
  // Root just outside the ground-disc reach of the curb, facing it, so the leading foot hangs over the kerb.
  curb: surfaces.curb && { x: surfaces.curb.box.minX - 0.26, y: 0, z: (surfaces.curb.box.minZ + surfaces.curb.box.maxZ) / 2, yaw: Math.PI / 2 },
  curbTop: surfaces.curb && { x: surfaces.curb.box.minX + 0.12, y: surfaces.curb.y, z: (surfaces.curb.box.minZ + surfaces.curb.box.maxZ) / 2, yaw: -Math.PI / 2 },
  landing: surfaces.landing && { x: surfaces.landing.x, y: surfaces.landing.y, z: surfaces.landing.z, yaw: 0 },
  arena: { x: -62, y: 58, z: -154, yaw: 0 },
  pier: surfaces.pier && { x: surfaces.pier.x, y: surfaces.pier.y, z: surfaces.pier.z, yaw: 0 },
  docksRoof: { x: -60, y: 16, z: 180, yaw: 0 },
};
const heroSpots = quick ? ['roof', 'curb'] : Object.keys(spots).filter((k) => spots[k]);
for (const spot of heroSpots) {
  const p = spots[spot];
  await page.evaluate(`(() => { const G = window.__game; G.teleport({x:${p.x}, y:${p.y}, z:${p.z}}); G.hero.bat.face(${p.yaw}); G.hero.frozen = true; G.combat.setEnemies([]); })()`);
  await page.waitForTimeout(300);
  const rootInfo = await page.evaluate('({y: window.__game.hero.pos.y, x: window.__game.hero.pos.x, z: window.__game.hero.pos.z})');
  const clips = quick ? [...heroClips.slice(0, 6), 'Melee_Hook', 'Kick_Front'] : heroClips;
  for (const clip of clips) {
    const ok = await page.evaluate(`window.__audit.tryPlay(window.__game.hero.bat, ${JSON.stringify(clip)})`);
    if (!ok) { results.push({ who: 'hero', spot, clip, missing: true }); continue; }
    const r = await page.evaluate('window.__audit.sample(window.__game.hero.bat, 1100)');
    results.push({ who: 'hero', spot, clip, ...r });
    console.log('hero', spot, clip, JSON.stringify(r));
  }
  console.log('root', spot, JSON.stringify(rootInfo));
}
// Goons: spawned beside the hero on the roof and the curb, driven clip by clip.
const goonSpots = quick ? ['roof', 'curb'] : ['roof', 'curb', 'landing'];
for (const spot of goonSpots) {
  const p = spots[spot];
  if (!p) continue;
  for (const type of ['grunt', 'knife', 'brute']) {
    await page.evaluate(`(() => { const G = window.__game; G.teleport({x:${p.x}, y:${p.y}, z:${p.z}}); G.hero.frozen = true; G.hero.bat.root.position.x += 2.5;
      for (const e of G.enemies) e.remove(); G.combat.setEnemies([]);
      const e = G.spawn(${JSON.stringify(type)}, {x:${p.x}, y:${p.y} + 0.5, z:${p.z}});
      const g = G.world.collision.groundBelow(${p.x}, ${p.y} + 0.5, ${p.z}, 0.25);
      e.place({x:${p.x}, y: g, z:${p.z}}, ${p.yaw}); e.state = 'grabbed'; G.combat.setEnemies([e]); window.__goon = e; })()`);
    await page.waitForTimeout(400);
    for (const clip of (quick ? ['Idle_Loop', 'Walk_Loop', 'Zombie_Walk_Fwd_Loop', 'Sword_Heavy_Combo', 'Shield_Dash', 'Hit_Knockback'] : goonClips)) {
      const ok = await page.evaluate(`window.__audit.tryPlay(window.__goon.ch, ${JSON.stringify(clip)})`);
      if (!ok) { results.push({ who: type, spot, clip, missing: true }); continue; }
      const r = await page.evaluate('window.__audit.sample(window.__goon.ch, 1000)');
      results.push({ who: type, spot, clip, ...r });
      console.log(type, spot, clip, JSON.stringify(r));
    }
  }
}
// Ankle-height screenshots at the roof and the curb, hero idle + walk, one goon idle.
async function ankleShot(name, focusExpr) {
  await page.evaluate(`(() => { const G = window.__game; const f = ${focusExpr}; G.follow.update = () => {};
    const yaw = G.hero.bat.yaw; G.camera.position.set(f.x + Math.sin(yaw + 1.2) * 1.6, f.y + 0.28, f.z + Math.cos(yaw + 1.2) * 1.6); G.camera.lookAt(f.x, f.y + 0.08, f.z); })()`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/${name}.png` });
}
await page.evaluate(`(() => { const G = window.__game; const p = ${JSON.stringify(spots.roof)}; G.teleport(p); G.hero.frozen = true; G.hero.bat.animator.play('Idle_Loop', {fade: 0}); for (const e of G.enemies) e.remove(); G.combat.setEnemies([]); })()`);
await page.waitForTimeout(600);
await ankleShot('ankle-roof-idle', 'G.hero.pos');
await page.evaluate(`window.__game.hero.bat.animator.play('Walk_Loop', {fade: 0})`);
await page.waitForTimeout(700);
await ankleShot('ankle-roof-walk', 'G.hero.pos');
await page.evaluate(`window.__game.hero.bat.animator.play('Punch_Cross', {fade: 0})`);
await page.waitForTimeout(400);
await ankleShot('ankle-roof-punch', 'G.hero.pos');
if (spots.curb) {
  await page.evaluate(`(() => { const G = window.__game; const p = ${JSON.stringify(spots.curb)}; G.teleport(p); G.hero.bat.face(p.yaw); G.hero.frozen = true; G.hero.bat.animator.play('Idle_Loop', {fade: 0}); })()`);
  await page.waitForTimeout(600);
  await ankleShot('ankle-curb-idle', 'G.hero.pos');
  await page.evaluate(`window.__game.hero.bat.animator.play('Walk_Loop', {fade: 0})`);
  await page.waitForTimeout(500);
  await ankleShot('ankle-curb-walk', 'G.hero.pos');
}
writeFileSync(`${outDir}/audit.json`, JSON.stringify(results, null, 1));

// Table
const lines = ['| who | spot | clip | planted min | planted med | any foot max | lift |', '|---|---|---|---|---|---|---|'];
for (const r of results) lines.push(r.missing ? `| ${r.who} | ${r.spot} | ${r.clip} | missing | | | |` : `| ${r.who} | ${r.spot} | ${r.clip} | ${(r.plantedMin * 100).toFixed(1)} cm | ${(r.plantedMed * 100).toFixed(1)} cm | ${(r.maxD * 100).toFixed(1)} cm | ${(r.lift * 100).toFixed(1)} cm |`);
writeFileSync(`${outDir}/audit.md`, lines.join('\n'));
console.log(lines.join('\n'));
await browser.close();
