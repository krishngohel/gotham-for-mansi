// The Joker boss fight on the clock tower roof, in three phases.
//  1: he heckles from the balcony while goons attack and joy-buzzer tiles shock the floor.
//  2: he drops in and lobs laughing gas; a batarang mid-throw stuns him, then 5 hits knock him away (x3).
//  3: one-on-one: 3-hit combos that must each be countered; a clean chain staggers him for a finisher (x3).
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';
import { ENEMY, damageToHero, DIFFICULTY } from '../combat/rules.js';
import { createJoker } from '../actors/characters.js';
import { createCape } from '../actors/cape.js';
import { SITES } from '../world/mapData.js';

const ARENA = { x: -62, y: 58, minX: -80.5, maxX: -43.5, minZ: -164.5, maxZ: -141.5 };
const BALCONY = { x: SITES.balcony.x, y: SITES.balcony.y, z: -163.5 };
const TILE_COLS = 4, TILE_ROWS = 3;
const WAVES = [
  [['grunt', -8, 6], ['grunt', 8, 6], ['grunt', 0, 10], ['knife', -12, 2]],
  [['grunt', -10, 4], ['knife', 10, 4], ['knife', 0, 9], ['brute', 0, 0]],
];
const LINES = {
  phase1: ['Welcome to the party, birthday bat!', 'Careful, the floor is ticklish!', 'Boys! Our guest of honor is here!', 'Is it hot up here, or is it just the buzzers?', 'I planned games. So many games!'],
  drop: 'Fine! If you want a job done right...',
  phase2: ['Catch! HA HA!', 'Laughing gas! Doctor recommended!', 'Hold your breath, birthday bat!', 'Party favors for everyone!'],
  stunned: ['Ow! Cheater!', 'That is not how we play!', 'My hat! I am not even wearing a hat!'],
  phase3: 'Enough games. Let us dance!',
  chain: ['Lucky!', 'Okay, okay, not bad!', 'You fight like a birthday cake. Sweet!'],
  hurt: ['Is that all?', 'Again! Again!'],
};

export function createBoss({ assets, scene, rng, combat, events, hud, spawn, despawn, hero, time, getDifficulty }) {
  const ch = createJoker(assets);
  scene.add(ch.root);
  const coat = createCape(ch, PALETTE.jokerPurple, { cols: 7, rows: 7, topWidth: 0.42, bottomWidth: 0.62, length: 0.9, pointDrop: 0.08, anchor: 'waist' });
  scene.add(coat.mesh);
  ch.root.visible = coat.mesh.visible = false;
  const pos = ch.root.position;
  const pick = (a) => a[Math.floor(rng.next() * a.length)];
  const tmp = new THREE.Vector3();

  // ---- joy-buzzer tiles ----
  const tileW = (ARENA.maxX - ARENA.minX) / TILE_COLS, tileD = (ARENA.maxZ - ARENA.minZ) / TILE_ROWS;
  const tiles = [];
  for (let r = 0; r < TILE_ROWS; r++) {
    for (let c = 0; c < TILE_COLS; c++) {
      const cx = ARENA.minX + (c + 0.5) * tileW, cz = ARENA.minZ + (r + 0.5) * tileD;
      const mat = new THREE.MeshBasicMaterial({ color: PALETTE.signal, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tileW - 0.4, tileD - 0.4).rotateX(-Math.PI / 2), mat);
      m.position.set(cx, ARENA.y + 0.03, cz);
      m.layers.set(LAYER_FX);
      m.visible = false;
      scene.add(m);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(tileW - 0.2, tileD - 0.2).rotateX(-Math.PI / 2)), new THREE.LineBasicMaterial({ color: PALETTE.ink }));
      edge.position.copy(m.position);
      edge.visible = false;
      edge.layers.set(LAYER_FX);
      scene.add(edge);
      tiles.push({ m, edge, cx, cz, state: 'off', t: 0 });
    }
  }
  const onTile = (p, tile) => Math.abs(p.x - tile.cx) < tileW / 2 && Math.abs(p.z - tile.cz) < tileD / 2 && Math.abs(p.y - ARENA.y) < 1.2;

  // ---- gas grenades and clouds ----
  const grenades = [];
  const clouds = [];
  const gasMat = new THREE.MeshBasicMaterial({ color: PALETTE.jokerGreen, transparent: true, opacity: 0.35, depthWrite: false });
  function throwGrenade(target) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: PALETTE.jokerPurple }));
    ch.bone('hand_r').getWorldPosition(m.position);
    scene.add(m);
    grenades.push({ m, from: m.position.clone(), to: new THREE.Vector3(target.x, ARENA.y, target.z), t: 0 });
    events.emit('throw');
  }
  function spawnCloud(p) {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(1.2, 2), 12, 10), gasMat);
      puff.position.set(rng.range(-1.6, 1.6), rng.range(0.4, 1.4), rng.range(-1.6, 1.6));
      puff.layers.set(LAYER_FX);
      g.add(puff);
    }
    g.position.copy(p);
    scene.add(g);
    clouds.push({ g, p: p.clone(), t: 0, tick: 0 });
    events.emit('gas');
  }

  // ---- the Joker as a combat enemy ----
  const joker = {
    id: 'joker', type: 'joker', ch, pos, scale: 1, radius: 0.45,
    health: ENEMY.joker.health, alive: true, down: false, stunned: false, aware: true,
    state: 'idle', t: 0, glyph: null, windupDur: 0.5, finishable: false,
    get def() {
      const armored = phase === 2 ? !this.stunned : phase === 3 ? this.state !== 'windup' && !this.finishable : true;
      return { ...ENEMY.joker, armored, parry: false };
    },
    get x() { return pos.x; },
    get z() { return pos.z; },
    wake() {},
    ready: () => false,
    startWindup() {},
    remove() {},
    applyHit(result, from) {
      tmp.set(pos.x - from.x, 0, pos.z - from.z).normalize();
      if (phase === 2) {
        if (result.outcome === 'stun') {
          if (joker.state === 'throw') {
            joker.stunned = true; joker.state = 'stunned'; joker.t = 0; hits = 0;
            ch.animator.play('Idle_Shield_Break', { once: true, timeScale: 0.7, fade: 0.1 });
            say(pick(LINES.stunned), 2);
          } else say('Missed me!', 1.5);
          return false;
        }
        if (joker.stunned && result.outcome !== 'immune') {
          hits += 1;
          ch.animator.play(rng.chance(0.5) ? 'Hit_Chest' : 'Hit_Head', { once: true, timeScale: 1.5, fade: 0.05 });
          if (hits >= 5) {
            cycles += 1;
            joker.stunned = false;
            joker.state = 'knocked'; joker.t = 0;
            knock.copy(tmp).multiplyScalar(6);
            ch.animator.play('Hit_Knockback', { once: true, fade: 0.05 });
            events.emit('bossHit', { phase, progress: progress() });
          }
        }
        return false;
      }
      if (phase === 3) {
        if (result.outcome === 'ko' || (joker.finishable && result.outcome !== 'immune')) {
          // The finisher.
          joker.finishable = false;
          chains += 1;
          joker.state = 'knocked'; joker.t = 0;
          knock.copy(tmp).multiplyScalar(7);
          ch.animator.play('Hit_Knockback', { once: true, fade: 0.05 });
          events.emit('bossHit', { phase, progress: progress() });
          if (chains >= 3) finish();
          else say(pick(LINES.chain), 2.2);
          return false;
        }
        if (joker.state === 'windup' && result.outcome !== 'immune') {
          // Countered one hit of the combo.
          chainHits += 1;
          joker.glyph = null;
          joker.state = 'flinch'; joker.t = 0;
          ch.animator.play('Hit_Chest', { once: true, timeScale: 1.6, fade: 0.05 });
          knock.copy(tmp).multiplyScalar(1.5);
          if (chainHits >= 3) {
            joker.state = 'staggered'; joker.t = 0;
            joker.finishable = true;
            ch.animator.play('Idle_Shield_Break', { once: true, timeScale: 0.6, fade: 0.1 });
            events.emit('bossStaggered');
          }
          return true;
        }
      }
      return false;
    },
  };

  let phase = 0;
  let wave = 0;
  let goons = [];
  const spawned = [];
  let hits = 0, cycles = 0, chainHits = 0, chains = 0;
  let buzzT = 4, lineT = 3, throwT = 2.5, speech = null;
  const knock = new THREE.Vector3();
  const strafe = { angle: 0, dir: 1, t: 2 };

  const progress = () => {
    // 1 for the goon phase, 3 gas cycles, 3 counter chains.
    const p1 = phase > 1 ? 1 : wave / 2;
    return 1 - Math.min(1, (p1 + cycles + chains) / 7);
  };

  function say(text, secs = 2.5) {
    speech = { text, t: secs };
    hud.speech(text);
    events.emit('laughMaybe');
  }

  function faceHero(rate, dt) {
    const target = Math.atan2(hero.pos.x - pos.x, hero.pos.z - pos.z);
    const d = Math.atan2(Math.sin(target - ch.yaw), Math.cos(target - ch.yaw));
    ch.face(ch.yaw + (rate ? d * Math.min(1, rate * dt) : d));
  }

  function clampArena() {
    pos.x = THREE.MathUtils.clamp(pos.x, ARENA.minX + 1, ARENA.maxX - 1);
    pos.z = THREE.MathUtils.clamp(pos.z, ARENA.minZ + 1, ARENA.maxZ - 1);
    pos.y = ARENA.y;
  }

  function spawnWave(i) {
    goons = WAVES[i].map(([type, dx, dz]) => spawn(type, { x: ARENA.x + dx, y: ARENA.y, z: ARENA.maxZ - 3 - dz }));
    spawned.push(...goons);
    for (const g of goons) g.wake();
    combat.setEnemies([...goons]);
  }

  function startPhase(p) {
    phase = p;
    hud.bossBar(true, progress(), p);
    if (p === 1) {
      pos.set(BALCONY.x, BALCONY.y, BALCONY.z);
      ch.face(0);
      ch.animator.play('Idle_Rail_Call', { fade: 0.2 });
      wave = 0;
      spawnWave(0);
      buzzT = 5;
      say(LINES.phase1[0], 3);
    } else if (p === 2) {
      for (const g of spawned) despawn(g);
      spawned.length = 0;
      goons = [];
      combat.setEnemies([joker]);
      joker.state = 'drop'; joker.t = 0;
      say(LINES.drop, 2.5);
      events.emit('bossPhase', { phase: 2 });
      ch.animator.play('NinjaJump_Start', { once: true, fade: 0.1 });
      throwT = 2;
    } else if (p === 3) {
      for (const cl of clouds) scene.remove(cl.g);
      clouds.length = 0;
      joker.state = 'approach'; joker.t = 0;
      chainHits = 0;
      say(LINES.phase3, 2.5);
      events.emit('bossPhase', { phase: 3 });
    }
  }

  function finish() {
    phase = 4;
    joker.finishable = false;
    time.slowMo(1.4, 0.25);
    hud.bossBar(false);
    for (const t of tiles) { t.m.visible = t.edge.visible = false; }
    combat.setEnemies([]);
    setTimeout(() => events.emit('bossDefeated'), 1800);
  }

  function updateTiles(dt) {
    if (phase !== 1) { for (const t of tiles) { t.state = 'off'; t.m.visible = t.edge.visible = false; } return; }
    buzzT -= dt;
    if (buzzT <= 0) {
      buzzT = rng.range(6, 8);
      const n = rng.int(4, 6);
      const order = [...tiles].sort(() => rng.next() - 0.5).slice(0, n);
      for (const t of order) { t.state = 'warn'; t.t = 0; }
      say(pick(LINES.phase1), 2.4);
    }
    for (const t of tiles) {
      t.t += dt;
      if (t.state === 'warn') {
        t.m.visible = t.edge.visible = true;
        t.m.material.color.set(PALETTE.signal);
        t.m.material.opacity = 0.25 + 0.25 * Math.sin(t.t * 22) ** 2;
        if (t.t > 1.4) {
          t.state = 'shock'; t.t = 0;
          events.emit('buzzer');
          if (onTile(hero.pos, t) && hero.invulnerable <= 0 && !hero.dead) {
            const dmg = damageToHero('buzzer', { difficulty: getDifficulty() });
            hero.health = Math.max(0, hero.health - dmg);
            events.emit('heroHurt', { kind: 'buzzer', damage: dmg });
            if (hero.health <= 0) { hero.dead = true; events.emit('heroDown'); }
          }
          for (const g of goons) if (g.alive && onTile(g.pos, t)) g.applyHit({ outcome: 'stun', stun: 2 }, { x: t.cx, z: t.cz });
        }
      } else if (t.state === 'shock') {
        t.m.material.color.set(t.t % 0.1 < 0.05 ? 0xffffff : PALETTE.jokerGreen);
        t.m.material.opacity = 0.7;
        if (t.t > 0.7) { t.state = 'off'; t.m.visible = t.edge.visible = false; }
      }
    }
  }

  function updateGas(dt) {
    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i];
      g.t += dt / 0.9;
      const k = Math.min(1, g.t);
      g.m.position.lerpVectors(g.from, g.to, k);
      g.m.position.y += Math.sin(k * Math.PI) * 5;
      if (k >= 1) { scene.remove(g.m); grenades.splice(i, 1); spawnCloud(g.to); }
    }
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      c.t += dt;
      c.g.scale.setScalar(Math.min(1, c.t * 2) * (c.t > 5.5 ? Math.max(0, (6.2 - c.t) / 0.7) : 1));
      c.g.rotation.y += dt * 0.3;
      const inside = Math.hypot(hero.pos.x - c.p.x, hero.pos.z - c.p.z) < 3.3;
      if (inside && !hero.dead) {
        c.tick -= dt;
        if (c.tick <= 0) {
          c.tick = 0.5;
          const dmg = damageToHero('gas', { difficulty: getDifficulty(), invulnerable: hero.invulnerable > 0 });
          if (dmg > 0) {
            hero.health = Math.max(0, hero.health - dmg);
            events.emit('heroHurt', { kind: 'gas', damage: dmg });
            events.emit('hint', { id: 'gas' });
            if (hero.health <= 0) { hero.dead = true; events.emit('heroDown'); }
          }
        }
      }
      if (c.t > 6.2) { scene.remove(c.g); clouds.splice(i, 1); }
    }
  }

  // Phase 2/3 movement and attacks. Called through combat.update as an enemy.
  joker.update = (dt, ectx) => {
    joker.t += dt;
    if (knock.lengthSq() > 0.001) { pos.addScaledVector(knock, dt); knock.multiplyScalar(Math.max(0, 1 - dt * 4)); }
    const dx = hero.pos.x - pos.x, dz = hero.pos.z - pos.z;
    const dist = Math.hypot(dx, dz);
    let speed = 0, mx = 0, mz = 0;
    switch (joker.state) {
      case 'drop': {
        // Leap from the balcony into the arena.
        const k = Math.min(1, joker.t / 1.1);
        pos.set(BALCONY.x, BALCONY.y + Math.sin(k * Math.PI) * 4 - (BALCONY.y - ARENA.y) * k, BALCONY.z + 10 * k);
        if (k >= 1) { joker.state = 'roam'; joker.t = 0; ch.animator.play('NinjaJump_Land', { once: true, fade: 0.05 }); events.emit('land', { hard: true }); }
        ch.animator.update(dt);
        return;
      }
      case 'roam': {
        // Keep a lob's distance and circle.
        strafe.t -= dt;
        if (strafe.t <= 0) { strafe.dir *= -1; strafe.t = rng.range(1.5, 3); }
        strafe.angle += strafe.dir * dt * 0.5;
        const want = 8.5;
        const tx = hero.pos.x + Math.sin(strafe.angle) * want, tz = hero.pos.z + Math.cos(strafe.angle) * want;
        const gx = tx - pos.x, gz = tz - pos.z, gd = Math.hypot(gx, gz);
        if (gd > 0.5) { speed = gd > 3 ? 5 : 2.2; mx = gx / gd; mz = gz / gd; }
        faceHero(8, dt);
        ch.animator.play(speed > 3 ? 'Jog_Fwd_Loop' : speed ? 'Walk_Loop' : 'Idle_FoldArms_Loop', { fade: 0.2 });
        throwT -= dt;
        if (throwT <= 0 && phase === 2) {
          joker.state = 'throw'; joker.t = 0;
          ch.animator.play('OverhandThrow', { once: true, timeScale: 0.55, fade: 0.1 });
          joker.glyph = 'yellow';
          if (cycles === 0) events.emit('hint', { id: 'joker-throw' });
        }
        break;
      }
      case 'throw':
        faceHero(10, dt);
        if (joker.t > 0.95) {
          throwGrenade(hero.pos);
          if (rng.chance(0.4)) say(pick(LINES.phase2), 2);
          joker.state = 'roam'; joker.t = 0; joker.glyph = null;
          throwT = rng.range(2.4, 3.4);
        }
        break;
      case 'stunned':
        joker.glyph = null;
        if (joker.t > 3.6) { joker.stunned = false; joker.state = 'roam'; joker.t = 0; hits = 0; throwT = 1.5; say('Recess is over!', 1.8); }
        break;
      case 'knocked':
        joker.stunned = false;
        if (joker.t > 1.3) {
          // Cartwheel away laughing.
          pos.set(ARENA.x + rng.range(-12, 12), ARENA.y, ARENA.minZ + rng.range(3, 8));
          ch.animator.play('LayToIdle', { once: true, timeScale: 1.6, fade: 0.1 });
          events.emit('laugh');
          joker.t = 0;
          joker.state = phase === 2 ? (cycles >= 3 ? 'toPhase3' : 'roam') : phase === 3 ? 'approach' : 'idle';
          throwT = 2.2;
          chainHits = 0;
        }
        break;
      case 'toPhase3':
        if (joker.t > 1) startPhase(3);
        break;
      case 'approach':
        faceHero(10, dt);
        if (dist > 2.3) { speed = 3.8; mx = dx / dist; mz = dz / dist; ch.animator.play('Jog_Fwd_Loop', { fade: 0.15 }); }
        else if (joker.t > 0.6) { joker.state = 'windup'; joker.t = 0; startSwing(); }
        break;
      case 'windup':
        faceHero(12, dt);
        if (joker.t >= joker.windupDur) {
          joker.state = 'swing'; joker.t = 0; joker.glyph = null;
          ch.animator.play(ch.animator.currentName, { once: true, timeScale: 1.8 });
        }
        break;
      case 'swing':
        if (joker.t > 0.14 && joker.t - dt <= 0.14 && dist < 2.4) {
          ectx.onAttackLand(joker, 'joker');
          chainHits = 0;
          if (rng.chance(0.5)) say(pick(LINES.hurt), 1.6);
        }
        if (joker.t > 0.45) { joker.state = chainHits === 0 ? 'backoff' : 'approach'; joker.t = 0; }
        break;
      case 'flinch':
        if (joker.t > 0.35) { joker.state = 'windup'; joker.t = 0; startSwing(); }
        break;
      case 'backoff':
        speed = 3; mx = -dx / (dist || 1); mz = -dz / (dist || 1);
        ch.animator.play('Walk_Loop', { fade: 0.2 });
        faceHero(8, dt);
        if (joker.t > 1.4) { joker.state = 'approach'; joker.t = 0; }
        break;
      case 'staggered':
        if (joker.t > 4) { joker.finishable = false; joker.state = 'approach'; joker.t = 0; chainHits = 0; say('Too slow!', 1.5); }
        break;
      default:
        break;
    }
    pos.x += mx * speed * dt;
    pos.z += mz * speed * dt;
    clampArena();
    ch.animator.update(dt);
  };

  function startSwing() {
    joker.windupDur = DIFFICULTY[getDifficulty()].windup * 0.85;
    joker.glyph = 'blue';
    ch.animator.play(pick(['Punch_Jab', 'Punch_Cross', 'Melee_Hook']), { once: true, timeScale: 0.3, fade: 0.08 });
  }

  return {
    joker,
    get phase() { return phase; },
    get active() { return phase > 0 && phase < 4; },
    get speech() { return speech; },
    headWorld: (out) => ch.headWorld(out, 0.5),
    // Pose for comic panels.
    pose(p, yaw, anim, t = 0.5) {
      ch.root.visible = coat.mesh.visible = true;
      pos.set(p[0], p[1], p[2]);
      ch.face(yaw);
      ch.animator.play(anim, { fade: 0 });
      ch.animator.update(t);
      coat.reset();
      for (let i = 0; i < 60; i++) coat.update(1 / 60);
    },
    begin() {
      ch.root.visible = coat.mesh.visible = true;
      cycles = 0; chains = 0; hits = 0; chainHits = 0;
      joker.finishable = false; joker.stunned = false;
      startPhase(1);
    },
    restart() {
      for (const g of spawned) despawn(g);
      spawned.length = 0;
      goons = [];
      for (const c of clouds) scene.remove(c.g);
      clouds.length = 0;
      for (const g of grenades) scene.remove(g.m);
      grenades.length = 0;
      const p = phase;
      if (p === 1) startPhase(1);
      else if (p === 2) { cycles = 0; startPhase(2); pos.set(ARENA.x, ARENA.y, ARENA.minZ + 4); joker.state = 'roam'; }
      else if (p === 3) { chains = Math.min(chains, 2); startPhase(3); }
    },
    hide() { ch.root.visible = coat.mesh.visible = false; hud.bossBar(false); },
    update(dt) {
      if (!ch.root.visible) return;
      if (speech) { speech.t -= dt; if (speech.t <= 0) { speech = null; hud.speech(null); } }
      if (phase === 1) {
        // The Joker on his balcony, heckling.
        faceHero(3, dt);
        ch.animator.update(dt);
        lineT -= dt;
        if (lineT <= 0) { lineT = rng.range(5, 8); if (!speech) say(pick(LINES.phase1), 2.4); if (rng.chance(0.4)) events.emit('laugh'); }
        const left = goons.filter((g) => g.alive).length;
        if (left === 0 && goons.length) {
          if (wave === 0) { wave = 1; setTimeout(() => { if (phase === 1) spawnWave(1); }, 1200); goons = []; }
          else if (wave === 1) { wave = 2; startPhase(2); }
        }
      }
      if (phase === 1 || phase === 2) updateTiles(dt);
      updateGas(dt);
      coat.update(dt, [0.3, 0, 0.2]);
      if (phase > 0 && phase < 4) hud.bossBar(true, progress(), phase);
    },
  };
}
