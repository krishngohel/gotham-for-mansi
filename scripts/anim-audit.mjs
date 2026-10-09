// Animation audit: samples the hero's and nearby goons' hands, feet, head and pelvis every frame
// in their own root space (so walking and turning don't count) and flags any frame where a bone
// leaves its smooth path: the distance from where constant velocity would have put it. A pop,
// a snap between clips, a loop seam or an IK jump shows up as one big error frame.
//   node scripts/anim-audit.mjs <url> <outDir> [moves|traverse|fight|all]   (muted, headless)
// Prints the worst events per (who, clip) and writes <outDir>/audit.json; screenshots the
// moment of each event over POP_SHOT metres (default 0.2).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const [url = 'http://localhost:5202/', out = 'anim-audit', which = 'all'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const POP = Number(process.env.POP ?? 0.08), POP_SHOT = Number(process.env.POP_SHOT ?? 0.2);
const b = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'], headless: true });

// In the page: after every frame the game draws, sample every tracked bone.
const sampler = ({ POP }) => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__audit = { events: [], label: '', frames: 0, prev: new Map(), chars: new Map(), shotWanted: null };
  const BONES = ['hand_l', 'hand_r', 'foot_l', 'foot_r', 'Head', 'pelvis'];
  let last = performance.now();
  const sample = () => {
    const G = window.__game, A = window.__audit;
    if (!G?.hero?.bat || !A.label) return;
    const now = performance.now(), dt = (now - last) / 1000;
    last = now;
    if (dt <= 0 || dt > 0.1) { A.prev.clear(); return; } // a hitch: no velocity to compare against
    A.frames++;
    const who = [['hero', G.hero.bat, G.hero]];
    for (const e of G.enemies ?? []) if (e.alive && e.ch?.bone && e.pos.distanceTo(G.hero.pos) < 20) who.push([e.id + ':' + e.type, e.ch, e]);
    for (const [id, ch, owner] of who) {
      const root = ch.root ?? ch.model?.parent?.parent;
      if (!root || !ch.animator?.mixer) continue;
      const clip = ch.animator.currentName ?? null;
      // Game time, from this character's own mixer: it stops for hit-stop and slows for slow
      // motion, so a deliberate freeze isn't a pop.
      const mt = ch.animator.mixer.time, act = ch.animator.currentAction;
      let c = A.chars.get(id);
      // Not sampled last frame (out of range, or new): start its history over.
      if (!c || c.frame !== A.frames - 1) { c = { mt, clip, actT: act?.time ?? 0, changedAt: -1 }; for (const n of BONES) A.prev.delete(id + '/' + n); }
      c.frame = A.frames;
      const gdt = mt - c.mt;
      const actT = act?.time ?? 0;
      if (clip !== c.clip || actT + 1e-4 < c.actT) c.changedAt = mt; // new clip, restart or loop seam
      c.mt = mt; c.clip = clip; c.actT = actT;
      A.chars.set(id, c);
      if (gdt < 0.002) { for (const n of BONES) A.prev.delete(id + '/' + n); continue; }
      const transition = c.changedAt >= 0 && mt - c.changedAt < 0.15;
      // The whole body jumping in the world (a ledge climb snapping to the top, a teleport): the
      // root-space check can't see these. Over 1.5 m in one frame is faster than any lunge.
      if (id === 'hero') {
        const pw = ch.bone('pelvis')?.getWorldPosition(root.position.clone());
        if (pw && c.pw && pw.distanceTo(c.pw) > 1.5) A.events.push({ t: +(now / 1000).toFixed(3), label: A.label, who: id, bone: 'WORLD', err: +pw.distanceTo(c.pw).toFixed(3), clip, prevClip: c.prevClipW ?? clip, transition: true, state: owner.state ?? null, control: owner.control?.name ?? null });
        c.pw = pw; c.prevClipW = clip;
      }
      for (const n of BONES) {
        const bone = ch.bone(n);
        if (!bone) continue;
        const w = bone.getWorldPosition(bone.position.clone());
        const p = root.worldToLocal(w);
        const key = id + '/' + n;
        const h = A.prev.get(key);
        if (h && h.p1 && h.p0) {
          const k = gdt / h.dt1;
          const px = h.p1.x + (h.p1.x - h.p0.x) * k, py = h.p1.y + (h.p1.y - h.p0.y) * k, pz = h.p1.z + (h.p1.z - h.p0.z) * k;
          const err = Math.hypot(p.x - px, p.y - py, p.z - pz);
          if (err > POP) {
            A.events.push({ t: +(now / 1000).toFixed(3), label: A.label, who: id, bone: n, err: +err.toFixed(3), clip, prevClip: h.clip, transition, state: owner.state ?? null, control: owner.control?.name ?? null });
            if (transition && err > (A.shotAt ?? 0.2) && !A.shotWanted) A.shotWanted = { who: id, bone: n, err, clip, label: A.label };
          }
        }
        A.prev.set(key, { p0: h?.p1 ?? null, p1: p, dt1: gdt, clip });
      }
    }
  };
  window.requestAnimationFrame = (cb) => raf((t) => { cb(t); try { sample(); } catch (err) { window.__audit.err = String(err); } });
};

const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(sampler, { POP });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
let shots = 0;
const label = (l) => page.evaluate((l) => { window.__audit.label = l; window.__audit.prev.clear(); }, l);
const pause = async (ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => { const A = window.__audit; const s = A.shotWanted; A.shotWanted = null; return s; });
    if (s && s.err > POP_SHOT && shots < 40) {
      await page.screenshot({ path: `${out}/${String(shots++).padStart(2, '0')}-${s.label.replace(/\W+/g, '_')}-${s.who.replace(/\W+/g, '_')}-${s.bone}-${s.clip}.jpg`, quality: 70 });
    }
    await page.waitForTimeout(50);
  }
};
const kept = [];
let keptFrames = 0;
const boot = async (q) => {
  // A reload wipes the page's log: keep what the last scenario found.
  const prev = await page.evaluate(() => window.__audit ? { events: window.__audit.events, frames: window.__audit.frames } : null).catch(() => null);
  if (prev) { kept.push(...prev.events); keptFrames += prev.frames; }
  await page.goto(url + q);
  await page.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
  await page.evaluate((s) => { window.__audit.shotAt = s; }, POP_SHOT);
  await page.mouse.click(640, 360);
  await page.waitForTimeout(800);
};
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await pause(ms); for (const k of keys) await page.keyboard.up(k); };

// --- Combat moves: every movement combo and the rotations, one goon pinned on the roof.
async function moves() {
  await boot('?at=f1&god=1');
  await page.evaluate(() => window.__game.teleport('wh3Roof'));
  await page.waitForFunction(() => window.__game.enemies.some((e) => e.aware), null, { timeout: 10000 });
  await page.evaluate(() => { const h = window.__game.hero; window.__roof = { x: h.pos.x, y: h.pos.y, z: h.pos.z }; });
  const setup = (d = 2.5, down = false) => page.evaluate(([d, down]) => {
    const G = window.__game, h = G.hero, c = window.__roof;
    let live = G.enemies.filter((e) => e.alive && e.type !== 'joker');
    if (!live.length) { const g = G.spawn('grunt', { x: c.x, y: c.y, z: c.z + 3 }); G.combat.setEnemies([...G.enemies.filter((x) => x.alive), g]); g.wake?.(); live = [g]; }
    const e = live[0];
    // The rest stand still at the far end of the roof, out of the fight.
    for (const o of live.slice(1)) { o.place({ x: c.x + 8, y: c.y, z: c.z - 8 }, 0); o.state = 'idle'; o.aware = false; }
    e.health = 99; e.down = false; e.air = false; e.stunned = false;
    e.vel?.set(0, 0, 0); e.knock?.set(0, 0, 0);
    e.place({ x: c.x, y: c.y, z: c.z + 3 }, Math.PI);
    e.state = 'engage';
    h.control = null; h.state = 'ground'; h.vel.set(0, 0, 0);
    h.pos.set(c.x, c.y, c.z + 3 - d);
    h.bat.face(0);
    if (down) e.applyHit({ outcome: 'knockdown' }, h.pos, { power: 0.2 });
    window.__audit.prev.clear(); window.__audit.chars.clear();
  }, [d, down]).then(() => pause(down ? 1200 : 250)).then(() => page.evaluate(() => { window.__audit.prev.clear(); window.__audit.chars.clear(); }));
  const keyFor = (want) => page.evaluate((want) => {
    const G = window.__game, h = G.hero;
    const e = G.enemies.find((x) => x.alive && x.type !== 'joker' && x.pos.distanceTo(h.pos) < 15);
    const f = G.follow.forward(h.pos.clone()), r = G.follow.right(h.pos.clone());
    const dirs = { KeyW: [f.x, f.z], KeyS: [-f.x, -f.z], KeyD: [r.x, r.z], KeyA: [-r.x, -r.z] };
    const tx = e.pos.x - h.pos.x, tz = e.pos.z - h.pos.z, tl = Math.hypot(tx, tz);
    let best = null, bestScore = -9;
    for (const [k, [x, z]] of Object.entries(dirs)) {
      const l = Math.hypot(x, z), dot = (x * tx + z * tz) / (l * tl), side = tz * x - tx * z;
      const score = want === 'away' ? -dot : (1 - Math.abs(dot)) + (want === 'right' ? (side < 0 ? 1 : -1) : (side > 0 ? 1 : -1));
      if (score > bestScore) { best = k; bestScore = score; }
    }
    return best;
  }, want);
  const withKey = async (k, fn) => { await page.keyboard.down(k); await fn(); await pause(200); await page.keyboard.up(k); };
  const E = () => page.keyboard.press('KeyE'), P = () => page.mouse.click(640, 360);
  const rows = [
    ['punch x8', async () => { for (let i = 0; i < 8; i++) { await setup(); await P(); await pause(450); } }],
    ['kick x7', async () => { for (let i = 0; i < 7; i++) { await setup(); await E(); await pause(550); } }],
    ['flying knee', async () => { await setup(4); await withKey('ShiftLeft', E); }],
    ['running uppercut', async () => { await setup(4); await withKey('ShiftLeft', P); }],
    ['spin back kick', async () => { await setup(); await withKey(await keyFor('away'), E); }],
    ['spin backfist', async () => { await setup(); await withKey(await keyFor('away'), P); }],
    ['side roundhouse L', async () => { await setup(); await withKey(await keyFor('left'), E); }],
    ['side roundhouse R', async () => { await setup(); await withKey(await keyFor('right'), E); }],
    ['side hook L', async () => { await setup(); await withKey(await keyFor('left'), P); }],
    ['side hook R', async () => { await setup(); await withKey(await keyFor('right'), P); }],
    ['axe kick', async () => { await setup(4); await page.keyboard.press('Space'); await pause(200); await E(); }],
    ['backflip kick', async () => { await setup(4); await page.keyboard.press('Space'); await pause(200); await withKey(await keyFor('away'), E); }],
    ['hurricane', async () => { await setup(12); await page.evaluate(() => { window.__game.hero.speed = 11; }); await page.keyboard.down('ShiftLeft'); await page.keyboard.press('Space'); await pause(150); await E(); await pause(200); await page.keyboard.up('ShiftLeft'); }],
    ['leaping smash', async () => { await setup(12); await page.evaluate(() => { window.__game.hero.speed = 11; }); await page.keyboard.down('ShiftLeft'); await page.keyboard.press('Space'); await pause(150); await P(); await pause(200); await page.keyboard.up('ShiftLeft'); }],
    ['stomp', async () => { await setup(2, true); await pause(150); await E(); }],
    ['hammer', async () => { await setup(2, true); await pause(150); await P(); }],
  ];
  for (const [name, act] of rows) { await label('move: ' + name); await act(); await pause(1400); }
}

// --- Traversal: walk, sprint, stop, jump, fall, glide, dive, land, from the GCPD roof.
async function traverse() {
  await boot('?at=signal&god=1');
  await label('trav: idle');
  await pause(1500);
  await label('trav: walk + stop');
  await hold(['KeyW'], 1500); await pause(800);
  await label('trav: sprint + stop');
  await hold(['KeyW', 'ShiftLeft'], 1800); await pause(900);
  await label('trav: turn on the spot');
  await hold(['KeyA'], 700); await hold(['KeyD'], 700); await pause(600);
  await label('trav: jump in place');
  await page.keyboard.press('Space'); await pause(1400);
  await label('trav: running jump');
  await page.keyboard.down('KeyW'); await pause(400); await page.keyboard.press('Space'); await pause(1200); await page.keyboard.up('KeyW'); await pause(600);
  await label('trav: fall + glide + dive + land');
  await page.evaluate(() => { const h = window.__game.hero; h.pos.y += 45; });
  await pause(500);
  await page.keyboard.down('Space'); await pause(2500);
  await page.keyboard.down('ShiftLeft'); await pause(1200); await page.keyboard.up('ShiftLeft');
  await pause(1200); await page.keyboard.up('Space');
  await pause(4000);
  await label('trav: short drop');
  await page.evaluate(() => { const h = window.__game.hero; h.pos.y += 6; });
  await pause(2500);
  await label('trav: long drop no glide');
  await page.evaluate(() => { const h = window.__game.hero; h.pos.y += 30; });
  await pause(4500);
  await label('trav: crouch walk');
  await page.keyboard.press('KeyZ'); await hold(['KeyW'], 1500); await page.keyboard.press('KeyZ'); await pause(800);
  await label('trav: dodge roll');
  await page.keyboard.press('KeyC'); await pause(1200);
  // A ladder, bottom to top: the IK gait and the climb off the top.
  const lad = await page.evaluate(() => {
    const G = window.__game, l = [...G.climbables.ladders].sort((a, b) => (b.top - b.bottom) - (a.top - a.bottom)).find((x) => x.top - x.bottom > 4 && x.top - x.bottom < 14);
    if (!l) return null;
    G.hero.teleport({ x: l.x + l.nx * 1.4, y: l.bottom, z: l.z + l.nz * 1.4 }, Math.atan2(-l.nx, -l.nz));
    G.follow.snapBehind?.(Math.atan2(-l.nx, -l.nz), 0.2);
    return l.top - l.bottom;
  });
  console.log(lad ? `ladder: ${lad.toFixed(1)} m` : 'ladder: none found');
  if (lad) {
    await pause(600);
    await label('trav: ladder');
    await hold(['KeyW'], Math.round((lad / 1.9 + 2.5) * 1000));
    await pause(1500);
  }
}

// --- A real fight: mash, counter when a bolt shows, kicks mixed in; goons sampled too.
async function fight() {
  await boot('?at=f2&god=1');
  await page.waitForFunction(() => window.__game.enemies.some((e) => e.alive), null, { timeout: 10000 });
  await page.evaluate(() => { const G = window.__game; const e = G.enemies.find((x) => x.alive); G.hero.teleport?.({ x: e.pos.x, y: e.pos.y, z: e.pos.z - 4 }, 0); });
  await label('fight: yard');
  for (let i = 0; i < 120; i++) {
    const bolt = await page.evaluate(() => window.__game.enemies.some((e) => e.alive && e.state === 'windup' && e.def?.counterable && e.pos.distanceTo(window.__game.hero.pos) < 7));
    if (bolt) await page.mouse.click(640, 360, { button: 'right' });
    else if (i % 5 === 4) await page.keyboard.press('KeyE');
    else await page.mouse.click(640, 360);
    await pause(250);
    if (i % 30 === 29) await page.evaluate(() => { for (const e of window.__game.enemies) if (e.alive) e.health = Math.max(e.health, 3); });
  }
}

// --- Takedowns and the car: a silent takedown, chain takedowns, getting in and out of the Batmobile.
async function extras() {
  await boot('?at=monarchBalcony&god=1');
  await page.waitForFunction(() => window.__game.stealth?.active, null, { timeout: 30000 });
  await page.evaluate(() => window.__game.comic.playing && window.__game.comic.skip());
  await pause(1500);
  await page.waitForFunction(() => { const e = window.__game.stealth.goons[0]?.e; return e && e.alive && e.state !== 'idle' && Math.abs(Math.sin(e.yaw)) < 0.05; }, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => { const G = window.__game, e = G.stealth.goons[0].e; G.hero.teleport({ x: e.pos.x - Math.sin(e.yaw) * 0.8, y: e.pos.y, z: e.pos.z - Math.cos(e.yaw) * 0.8 }, e.yaw); });
  await pause(150);
  await label('extra: silent takedown');
  await page.mouse.click(640, 360);
  await pause(3500);

  await boot('?at=f1&god=1');
  await page.evaluate(() => window.__game.teleport('wh3Roof'));
  await page.waitForFunction(() => window.__game.enemies.filter((e) => e.alive && e.aware).length >= 2, null, { timeout: 10000 });
  for (const [key, name] of [['Digit1', 'chain 1'], ['Digit2', 'chain 2'], ['Digit3', 'chain 3']]) {
    await page.evaluate(() => {
      const G = window.__game, h = G.hero;
      for (let i = 0; i < 14; i++) G.combat.combo.hit();
      const live = G.enemies.filter((e) => e.alive);
      live.forEach((e, i) => { e.health = 99; e.place({ x: h.pos.x + (i - 1) * 1.6, y: h.pos.y, z: h.pos.z + 2.4 }, Math.PI); e.state = 'engage'; });
      window.__audit.prev.clear(); window.__audit.chars.clear();
    });
    await pause(300);
    await label('extra: ' + name);
    await page.keyboard.press(key);
    await pause(4500);
  }

  await boot('?at=toNeon&god=1');
  await page.evaluate(() => window.__game.teleport({ x: 150, y: 0, z: -14 }));
  await page.evaluate(() => window.__game.vehicles.summon('batmobile', { instant: true }));
  await pause(800);
  await page.evaluate(() => { const G = window.__game, v = G.vehicles.batmobile; const p = v.pos ?? v.root?.position; if (p) G.hero.teleport({ x: p.x + 3, y: p.y, z: p.z }, -Math.PI / 2); });
  await pause(400);
  await label('extra: into the Batmobile');
  await page.keyboard.press('KeyT');
  await pause(1500);
  await label('extra: out of the Batmobile');
  await page.keyboard.press('KeyT');
  await pause(2000);
}

for (const w of which === 'all' ? ['moves', 'traverse', 'fight', 'extras'] : [which]) await ({ moves, traverse, fight, extras })[w]();

const A = await page.evaluate(() => ({ events: window.__audit.events, frames: window.__audit.frames, err: window.__audit.err }));
A.events = [...kept, ...A.events];
A.frames += keptFrames;
writeFileSync(`${out}/audit.json`, JSON.stringify(A, null, 1));
// Worst per (label, who kind, clip, prevClip).
const groups = new Map();
for (const e of A.events) {
  const who = e.who === 'hero' ? 'hero' : 'goon:' + e.who.split(':')[1];
  if (!e.transition && !process.env.ALL) continue;
  const k = `${e.label} | ${who} | ${e.prevClip === e.clip ? e.clip : e.prevClip + ' > ' + e.clip}`;
  const g = groups.get(k) ?? { n: 0, max: 0, bones: new Set() };
  g.n++; g.max = Math.max(g.max, e.err); g.bones.add(e.bone);
  groups.set(k, g);
}
const rows = [...groups].sort((a, b) => b[1].max - a[1].max);
console.log(`frames sampled ${A.frames}, events > ${POP} m: ${A.events.length} (${A.events.filter((e) => e.transition).length} at transitions; ALL=1 lists mid-clip ones too)${A.err ? ', sampler error ' + A.err : ''}`);
for (const [k, g] of rows.slice(0, 60)) console.log(`${g.max.toFixed(2)} m  x${String(g.n).padEnd(3)} ${k}  [${[...g.bones].join(' ')}]`);
console.log(errs.length ? errs.join('\n') : 'no page errors');
await b.close();
