// Pooled gadget visuals: gel blobs, smoke puffs, ice blocks and ice grenades, confetti (and its
// sky lettering), the launcher and batclaw lines, the remote batarang's trail, and debris.
// Everything is built once per run and hidden; nothing is created or added to the scene after
// that, and the per-frame paths only write into preallocated arrays and scratch objects.
// gadgetMaterials() also builds the warm-up copies (createGadgetWarm, drawn at boot by
// warmCast.js), so every shader program here is compiled before play.
import * as THREE from 'three';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';
import { PALETTE } from '../config/palette.js';

export const GFX_LIMITS = { gel: 3, puffs: 14, ice: 6, iceShots: 2, confetti: 900, trail: 32, debris: 40 };
const CONFETTI = [PALETTE.signal, PALETTE.balloon, PALETTE.detective, PALETTE.jokerGreen, PALETTE.jokerPurple, PALETTE.paper];
const UP = new THREE.Vector3(0, 1, 0);

let smokeTex = null;
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const blobs = [[64, 72, 32], [40, 64, 22], [88, 62, 24], [58, 44, 22], [80, 86, 20]];
  g.fillStyle = '#0b0b12';
  for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r + 4, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#bdb9b0';
  for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  // Halftone shading on the lower half, only where there is cloud.
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(11,11,18,0.22)';
  for (let y = 60, row = 0; y < 128; y += 6, row++) {
    for (let x = row % 2 ? 3 : 6; x < 128; x += 6) { g.beginPath(); g.arc(x, y, 1.1 + (y - 60) / 60, 0, Math.PI * 2); g.fill(); }
  }
  smokeTex = new THREE.CanvasTexture(c);
  smokeTex.colorSpace = THREE.SRGBColorSpace;
  return smokeTex;
}

let tinyTex = null;
function tinyTexture() {
  if (!tinyTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    tinyTex = new THREE.CanvasTexture(c);
    tinyTex.colorSpace = THREE.SRGBColorSpace;
  }
  return tinyTex;
}

export function gadgetMaterials() {
  const ice = toonMaterial({ color: 0xcdefff, emissive: 0x24506e });
  ice.transparent = true;
  ice.opacity = 0.72;
  ice.depthWrite = false;
  return {
    gel: toonMaterial({ color: 0x9fe3ff, emissive: 0x1d5f80 }),
    ice,
    smoke: new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false }),
    confetti: new THREE.PointsMaterial({ size: 0.42, vertexColors: true, sizeAttenuation: true }),
    line: new THREE.LineBasicMaterial({ color: PALETTE.ink }),
    trail: new THREE.LineBasicMaterial({ color: PALETTE.signal }),
    debris: toonMaterial({ color: 0xffffff }),
    // Breakables (src/world/breakables.js) use textured toon materials: one warm copy each of the
    // plain and the instanced variant.
    textured: toonMaterial({ color: 0xffffff, map: tinyTexture(), emissive: 0x111111 }),
  };
}

let GEO = null;
function geos() {
  if (!GEO) GEO = {
    gel: new THREE.SphereGeometry(0.34, 12, 8).scale(1, 0.4, 1),
    ice: new THREE.IcosahedronGeometry(0.72, 1).scale(1, 1.5, 1).translate(0, 0.95, 0),
    shot: new THREE.IcosahedronGeometry(0.16, 0),
    debris: new THREE.BoxGeometry(0.32, 0.22, 0.28),
    box: new THREE.BoxGeometry(1, 1, 1),
  };
  return GEO;
}

function lineOf(n, mat) {
  const g = new THREE.BufferGeometry();
  const a = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', a);
  const l = new THREE.Line(g, mat);
  l.layers.set(LAYER_FX);
  l.frustumCulled = false;
  return l;
}

// One of everything, for the boot warm cast.
export function createGadgetWarm() {
  const m = gadgetMaterials(), g = geos();
  const group = new THREE.Group();
  group.name = 'gadgetWarm';
  group.position.y = -50;
  const puff = new THREE.Sprite(m.smoke);
  puff.layers.set(LAYER_FX);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9).fill(1), 3));
  const confetti = new THREE.Points(pg, m.confetti);
  confetti.layers.set(LAYER_FX);
  const debris = new THREE.InstancedMesh(g.debris, m.debris, 1);
  debris.setColorAt(0, new THREE.Color(1, 1, 1));
  const texturedInst = new THREE.InstancedMesh(g.box, m.textured, 1);
  group.add(
    new THREE.Mesh(g.gel, m.gel), new THREE.Mesh(g.ice, m.ice), new THREE.Mesh(g.shot, m.ice), puff, confetti,
    lineOf(2, m.line), lineOf(GFX_LIMITS.trail, m.trail), debris, new THREE.Mesh(g.box, m.textured), texturedInst,
  );
  return group;
}

export function createGadgetFx(scene) {
  const m = gadgetMaterials(), g = geos();
  const tmp = new THREE.Vector3(), to = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), eul = new THREE.Euler(), col = new THREE.Color();

  // ---- debris (instanced chunks: wall bricks, glass, ice) ----
  const D = GFX_LIMITS.debris;
  const dmesh = new THREE.InstancedMesh(g.debris, m.debris, D);
  dmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dmesh.frustumCulled = false;
  const dp = new Float32Array(D * 3), dv = new Float32Array(D * 3), dr = new Float32Array(D * 3), dl = new Float32Array(D), df = new Float32Array(D);
  let dnext = 0, dlive = 0;
  m4.compose(tmp.set(0, -1000, 0), q.identity(), sc.set(0, 0, 0));
  for (let i = 0; i < D; i++) { dmesh.setMatrixAt(i, m4); dmesh.setColorAt(i, col.set(0xffffff)); }
  scene.add(dmesh);
  const debris = {
    burst(center, color, count, speed, floorY = center.y - 1.2) {
      col.setHex(color);
      for (let k = 0; k < count; k++) {
        const i = dnext;
        dnext = (dnext + 1) % D;
        if (dl[i] <= 0) dlive += 1;
        const j = i * 3;
        dp[j] = center.x; dp[j + 1] = center.y; dp[j + 2] = center.z;
        const a = Math.random() * Math.PI * 2, out = speed * (0.4 + Math.random() * 0.8);
        dv[j] = Math.cos(a) * out; dv[j + 1] = speed * (0.3 + Math.random() * 0.8); dv[j + 2] = Math.sin(a) * out;
        dr[j] = Math.random() * 6; dr[j + 1] = Math.random() * 6; dr[j + 2] = Math.random() * 6;
        dl[i] = 1.4 + Math.random() * 0.6;
        df[i] = floorY;
        dmesh.setColorAt(i, col);
      }
      dmesh.instanceColor.needsUpdate = true;
    },
  };
  function updateDebris(dt) {
    if (!dlive) return;
    for (let i = 0; i < D; i++) {
      if (dl[i] <= 0) continue;
      const j = i * 3;
      dl[i] -= dt;
      dv[j + 1] -= 20 * dt;
      dp[j] += dv[j] * dt; dp[j + 1] += dv[j + 1] * dt; dp[j + 2] += dv[j + 2] * dt;
      if (dp[j + 1] < df[i]) { dp[j + 1] = df[i]; dv[j] *= 0.3; dv[j + 2] *= 0.3; dv[j + 1] = Math.abs(dv[j + 1]) * 0.2; }
      if (dl[i] <= 0) { dlive -= 1; tmp.set(0, -1000, 0); q.identity(); sc.set(0, 0, 0); }
      else {
        eul.set(dr[j] * dl[i], dr[j + 1] * dl[i], dr[j + 2] * dl[i]);
        q.setFromEuler(eul);
        tmp.set(dp[j], dp[j + 1], dp[j + 2]);
        sc.setScalar(Math.min(1, dl[i] * 2));
      }
      m4.compose(tmp, q, sc);
      dmesh.setMatrixAt(i, m4);
    }
    dmesh.instanceMatrix.needsUpdate = true;
  }

  // ---- gel blobs ----
  const gels = [];
  for (let i = 0; i < GFX_LIMITS.gel; i++) {
    const mesh = new THREE.Mesh(g.gel, m.gel);
    mesh.visible = false;
    scene.add(mesh);
    gels.push({ mesh, t: 0, live: false });
  }
  const gel = {
    place(spot) {
      const i = gels.findIndex((b) => !b.live);
      if (i < 0) return -1;
      const b = gels[i];
      b.mesh.quaternion.setFromUnitVectors(UP, tmp.set(spot.nx, spot.ny, spot.nz));
      b.mesh.position.set(spot.x + spot.nx * 0.03, spot.y + spot.ny * 0.03, spot.z + spot.nz * 0.03);
      b.mesh.visible = true;
      b.live = true;
      b.t = 0;
      return i;
    },
    clear(i) { const b = gels[i]; if (b) { b.live = false; b.mesh.visible = false; } },
    clearAll() { for (let i = 0; i < gels.length; i++) gel.clear(i); },
  };

  // ---- smoke ----
  const puffs = [];
  for (let i = 0; i < GFX_LIMITS.puffs; i++) {
    const sp = new THREE.Sprite(m.smoke.clone());
    sp.layers.set(LAYER_FX);
    sp.visible = false;
    scene.add(sp);
    puffs.push({ sp, ox: 0, oy: 0, oz: 0, size: 1, t: 0, life: 0, spin: 0 });
  }
  const smokeAt = new THREE.Vector3();
  const smoke = {
    burst(center, radius, life = 6) {
      smokeAt.copy(center);
      puffs.forEach((p, i) => {
        const a = (i / puffs.length) * Math.PI * 2 + Math.random() * 0.4;
        const d = i === 0 ? 0 : radius * (0.35 + Math.random() * 0.55);
        p.ox = Math.cos(a) * d; p.oz = Math.sin(a) * d; p.oy = 0.6 + Math.random() * 1.8;
        p.size = radius * (0.9 + Math.random() * 0.5);
        p.t = 0;
        p.life = life * (0.8 + Math.random() * 0.3);
        p.spin = (Math.random() - 0.5) * 0.6;
        p.sp.material.rotation = Math.random() * Math.PI;
        p.sp.material.opacity = 1;
        p.sp.visible = true;
      });
    },
  };
  function updateSmoke(dt) {
    for (const p of puffs) {
      if (!p.sp.visible) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.sp.visible = false; continue; }
      const grow = Math.min(1, p.t / 0.45);
      p.sp.scale.setScalar(p.size * (0.35 + 0.65 * grow) * (1 + k * 0.25));
      p.sp.position.set(smokeAt.x + p.ox, smokeAt.y + p.oy + k * 0.8, smokeAt.z + p.oz);
      p.sp.material.rotation += p.spin * dt;
      p.sp.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
  }

  // ---- ice blocks and ice grenades ----
  const ices = [];
  for (let i = 0; i < GFX_LIMITS.ice; i++) {
    const mesh = new THREE.Mesh(g.ice, m.ice);
    mesh.visible = false;
    scene.add(mesh);
    ices.push({ mesh, enemy: null, t: 0 });
  }
  const shots = [];
  for (let i = 0; i < GFX_LIMITS.iceShots; i++) {
    const mesh = new THREE.Mesh(g.shot, m.ice);
    mesh.visible = false;
    scene.add(mesh);
    shots.push({ mesh, live: false, getTarget: null, onHit: null, aim: new THREE.Vector3(), t: 0 });
  }
  const ice = {
    attach(enemy) {
      const i = ices.findIndex((c) => !c.enemy);
      if (i < 0) return -1;
      const c = ices[i];
      c.enemy = enemy;
      c.t = 0;
      c.mesh.position.copy(enemy.pos);
      c.mesh.rotation.y = Math.random() * Math.PI;
      c.mesh.visible = true;
      return i;
    },
    release(i, shatter) {
      const c = ices[i];
      if (!c?.enemy) return;
      if (shatter) debris.burst(tmp.copy(c.mesh.position).setY(c.mesh.position.y + 1), 0xcdefff, 14, 6, c.mesh.position.y);
      c.enemy = null;
      c.mesh.visible = false;
    },
    // An ice grenade flying at a moving target: getTarget(out) writes the aim point.
    throw(from, getTarget, onHit) {
      let s = shots.find((x) => !x.live);
      if (!s) { s = shots[0]; s.onHit(); }
      s.mesh.position.copy(from);
      s.mesh.visible = true;
      s.getTarget = getTarget;
      s.onHit = onHit;
      s.live = true;
      s.t = 0;
    },
  };
  function updateIce(dt) {
    for (const c of ices) {
      if (!c.enemy) continue;
      c.t += dt;
      c.mesh.position.copy(c.enemy.pos);
      c.mesh.scale.setScalar((c.enemy.scale ?? 1) * (0.6 + 0.4 * Math.min(1, c.t / 0.12)));
    }
    for (const s of shots) {
      if (!s.live) continue;
      s.t += dt;
      s.getTarget(s.aim);
      to.copy(s.aim).sub(s.mesh.position);
      const d = to.length(), step = 32 * dt;
      s.mesh.rotation.x += dt * 12;
      if (d <= step || s.t > 1.5) {
        s.live = false;
        s.mesh.visible = false;
        if (d <= step + 0.5) s.onHit();
        continue;
      }
      s.mesh.position.addScaledVector(to, step / d);
    }
  }

  // ---- confetti: one Points cloud. Each particle is parked (mode 0), flying (1), homing to a
  // letter cell (2), holding the letter (3) or fluttering down (4). ----
  const N = GFX_LIMITS.confetti;
  const cpos = new Float32Array(N * 3), ccol = new Float32Array(N * 3), cvel = new Float32Array(N * 3), cgoal = new Float32Array(N * 3);
  const cmode = new Uint8Array(N), clife = new Float32Array(N);
  for (let i = 0; i < N; i++) cpos[i * 3 + 1] = -1000;
  const cgeo = new THREE.BufferGeometry();
  const cposAttr = new THREE.BufferAttribute(cpos, 3).setUsage(THREE.DynamicDrawUsage);
  const ccolAttr = new THREE.BufferAttribute(ccol, 3).setUsage(THREE.DynamicDrawUsage);
  cgeo.setAttribute('position', cposAttr);
  cgeo.setAttribute('color', ccolAttr);
  const points = new THREE.Points(cgeo, m.confetti);
  points.layers.set(LAYER_FX);
  points.frustumCulled = false;
  scene.add(points);
  let cnext = 0, clive = 0;
  const take = () => { const i = cnext; cnext = (cnext + 1) % N; if (!cmode[i]) clive += 1; return i; };
  const paint = (i) => {
    col.setHex(CONFETTI[(Math.random() * CONFETTI.length) | 0]);
    ccol[i * 3] = col.r; ccol[i * 3 + 1] = col.g; ccol[i * 3 + 2] = col.b;
  };
  const confetti = {
    burst(center, count) {
      for (let k = 0; k < count; k++) {
        const i = take(), j = i * 3;
        cpos[j] = center.x; cpos[j + 1] = center.y + 0.5; cpos[j + 2] = center.z;
        const a = Math.random() * Math.PI * 2, out = 2 + Math.random() * 6;
        cvel[j] = Math.cos(a) * out; cvel[j + 1] = 5 + Math.random() * 7; cvel[j + 2] = Math.sin(a) * out;
        cmode[i] = 1;
        clife[i] = 2.5 + Math.random() * 1.5;
        paint(i);
      }
      ccolAttr.needsUpdate = true;
    },
    // Confetti flies from `from` to spell `pts` (skyLetters.js) on an upright plane through
    // `anchor`, running along the horizontal unit vector `right`; holds 5 s, then flutters down.
    letters(from, anchor, right, pts) {
      for (const p of pts) {
        const i = take(), j = i * 3;
        cpos[j] = from.x + Math.random() - 0.5; cpos[j + 1] = from.y + 0.5; cpos[j + 2] = from.z + Math.random() - 0.5;
        cgoal[j] = anchor.x + right.x * p.x; cgoal[j + 1] = anchor.y + p.y; cgoal[j + 2] = anchor.z + right.z * p.x;
        cmode[i] = 2;
        clife[i] = 1.1 + Math.random() * 0.5;
        paint(i);
      }
      ccolAttr.needsUpdate = true;
    },
    get live() { return clive; },
  };
  function updateConfetti(dt) {
    if (!clive) return;
    const damp = Math.max(0, 1 - dt * 1.6), home = 1 - Math.exp(-dt * 5);
    for (let i = 0; i < N; i++) {
      const md = cmode[i];
      if (!md) continue;
      const j = i * 3;
      clife[i] -= dt;
      if (md === 1 || md === 4) {
        cvel[j + 1] -= (md === 1 ? 9 : 2) * dt;
        if (md === 4) cvel[j + 1] = Math.max(cvel[j + 1], -2.2);
        cvel[j] *= damp; cvel[j + 2] *= damp;
        cpos[j] += cvel[j] * dt + (md === 4 ? Math.sin(clife[i] * 6 + i) * 0.6 * dt : 0);
        cpos[j + 1] += cvel[j + 1] * dt;
        cpos[j + 2] += cvel[j + 2] * dt;
        if (clife[i] <= 0) { cmode[i] = 0; cpos[j + 1] = -1000; clive -= 1; }
      } else if (md === 2) {
        cpos[j] += (cgoal[j] - cpos[j]) * home; cpos[j + 1] += (cgoal[j + 1] - cpos[j + 1]) * home; cpos[j + 2] += (cgoal[j + 2] - cpos[j + 2]) * home;
        if (clife[i] <= 0) { cmode[i] = 3; clife[i] = 5; cpos[j] = cgoal[j]; cpos[j + 1] = cgoal[j + 1]; cpos[j + 2] = cgoal[j + 2]; }
      } else if (md === 3) {
        cpos[j + 1] = cgoal[j + 1] + Math.sin(clife[i] * 3 + i) * 0.04;
        if (clife[i] <= 0) {
          cmode[i] = 4;
          clife[i] = 3 + Math.random();
          cvel[j] = (Math.random() - 0.5) * 0.6; cvel[j + 1] = -0.5; cvel[j + 2] = (Math.random() - 0.5) * 0.6;
        }
      }
    }
    cposAttr.needsUpdate = true;
  }

  // ---- lines (launcher, batclaw) and the remote batarang trail ----
  const lineObjs = { launcher: lineOf(2, m.line), claw: lineOf(2, m.line) };
  for (const l of Object.values(lineObjs)) { l.visible = false; scene.add(l); }
  const lines = {
    set(name, a, b) {
      const l = lineObjs[name], p = l.geometry.attributes.position;
      p.setXYZ(0, a.x, a.y, a.z);
      p.setXYZ(1, b.x, b.y, b.z);
      p.needsUpdate = true;
      l.visible = true;
    },
    hide(name) { lineObjs[name].visible = false; },
  };
  const T = GFX_LIMITS.trail;
  const trailLine = lineOf(T, m.trail);
  trailLine.visible = false;
  scene.add(trailLine);
  const ring = new Float32Array(T * 3);
  let head = 0;
  function writeTrail() {
    const a = trailLine.geometry.attributes.position;
    for (let k = 0; k < T; k++) {
      const i = (((head - k) % T) + T) % T;
      a.array[k * 3] = ring[i * 3]; a.array[k * 3 + 1] = ring[i * 3 + 1]; a.array[k * 3 + 2] = ring[i * 3 + 2];
    }
    a.needsUpdate = true;
  }
  const trail = {
    start(p) {
      for (let i = 0; i < T; i++) { ring[i * 3] = p.x; ring[i * 3 + 1] = p.y; ring[i * 3 + 2] = p.z; }
      head = 0;
      trailLine.visible = true;
      writeTrail();
    },
    push(p) {
      head = (head + 1) % T;
      ring[head * 3] = p.x; ring[head * 3 + 1] = p.y; ring[head * 3 + 2] = p.z;
      writeTrail();
    },
    stop() { trailLine.visible = false; },
  };

  return {
    gel, smoke, ice, confetti, lines, trail, debris,
    update(dt) {
      for (const b of gels) if (b.live) { b.t += dt; const k = 1 + Math.sin(b.t * 6) * 0.06; b.mesh.scale.set(k, 1, k); }
      updateSmoke(dt);
      updateIce(dt);
      updateConfetti(dt);
      updateDebris(dt);
    },
  };
}
