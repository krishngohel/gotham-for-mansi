// Gadget breakables in the city (src/world/breakableSpots.js): cracked walls (explosive gel),
// glass signs (remote batarang), vent covers and weak railings (batclaw), and the WayneTech
// caches behind them. Built once per run. The solid parts of every shed merge into one mesh;
// each breakable part is its own mesh with its own collision box, taken out of the world when
// it breaks. Broken parts and found caches are saved in progress.gadgets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';
import { PALETTE } from '../config/palette.js';
import { batSvgPath } from '../config/batShape.js';
import { BREAKABLES, CACHES, FACES, roomWalls, cageRoom, nearestLadder, roofEdgeRail, boxDistance } from './breakableSpots.js';

const COLORS = { weakWall: 0x8a5a44, glass: 0x9fd8e8, vent: 0x8a8f98, railing: 0x6d737c };
const WORD = { weakWall: 'KA-CHUNK!', glass: 'KSSSSH!', vent: 'KLANG!', railing: 'SKREEK!' };
const EVENT = { weakWall: 'wallBroken', glass: 'glassBroken', vent: 'ventOpen', railing: 'railingDown' };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function bricks(g, w, h, cracked) {
  g.fillStyle = '#6b3f33';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#0b0b12';
  g.lineWidth = 3;
  for (let y = 0, row = 0; y < h; y += 32, row++) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    for (let x = row % 2 ? 32 : 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
  }
  if (!cracked) return;
  // Cracks from the middle and a yellow chalk ring: the mark for "gel works here".
  g.lineWidth = 5;
  const cx = w / 2, cy = h / 2;
  for (let i = 0; i < 9; i++) {
    let x = cx, y = cy;
    const a = (i / 9) * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { const b = a + (k % 2 ? 0.35 : -0.35); x += Math.cos(b) * 26; y += Math.sin(b) * 26; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = '#f2d24b';
  g.lineWidth = 7;
  g.beginPath(); g.arc(cx, cy, w * 0.36, 0, Math.PI * 2); g.stroke();
}
function signTex(g, w, h) {
  g.fillStyle = '#bfe6ef';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.moveTo(40, 0); g.lineTo(90, 0); g.lineTo(30, h); g.lineTo(-20, h); g.fill();
  g.font = "84px Bangers, Impact, sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = '#0b0b12';
  g.strokeText("JOKER'S PARTY!", w / 2, h / 2 + 4);
  g.fillStyle = '#6c3fa3';
  g.fillText("JOKER'S PARTY!", w / 2, h / 2 + 4);
  g.lineWidth = 10;
  g.strokeRect(5, 5, w - 10, h - 10);
}
function grilleTex(g, w, h) {
  g.fillStyle = '#8a8f98';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#0b0b12';
  for (let y = 12; y < h - 8; y += 20) g.fillRect(10, y, w - 20, 8);
  g.lineWidth = 8;
  g.strokeStyle = '#0b0b12';
  g.strokeRect(4, 4, w - 8, h - 8);
}
// Diagonal yellow/black hazard stripes: a flat PALETTE.slate railing was invisible against a dark
// rooftop at night (found during placement review), so it gets the same "notice me, gadget spot"
// treatment as the weak wall's chalk ring, in a pattern that survives narrow 0.15 m-thick faces.
function railTex(g, w, h) {
  g.fillStyle = '#1a1a1a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2d24b';
  const stripe = 22;
  for (let x = -h; x < w; x += stripe * 2) {
    g.beginPath();
    g.moveTo(x, h); g.lineTo(x + stripe, h); g.lineTo(x + stripe + h, 0); g.lineTo(x + h, 0);
    g.fill();
  }
}
function cacheTex(g, w, h) {
  g.fillStyle = '#1d2230';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2d24b';
  g.fill(new Path2D(batSvgPath(0.9, w / 2, h / 2)));
  g.lineWidth = 8;
  g.strokeStyle = '#f2d24b';
  g.strokeRect(6, 6, w - 12, h - 12);
}

const boxGeo = (b) => new THREE.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ)
  .translate((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);

export function createBreakables({ scene, collision, climbables, progress, save, events, gfx }) {
  const mats = {
    shed: toonMaterial({ color: 0xffffff, map: canvasTex(256, 256, (g, w, h) => bricks(g, w, h, false)) }),
    weakWall: toonMaterial({ color: 0xffffff, map: canvasTex(256, 256, (g, w, h) => bricks(g, w, h, true)) }),
    glass: toonMaterial({ color: 0xffffff, map: canvasTex(512, 128, signTex), emissive: 0x16323a }),
    vent: toonMaterial({ color: 0xffffff, map: canvasTex(128, 128, grilleTex) }),
    railing: toonMaterial({ color: 0xffffff, map: canvasTex(128, 32, railTex) }),
    cache: toonMaterial({ color: 0xffffff, map: canvasTex(128, 128, cacheTex), emissive: 0x3a3000 }),
  };
  const broken = new Set(progress.gadgets.broken);
  const solid = [], wires = [], items = [], byBox = new Map(), problems = [];

  function addPart(spot, box, mat, extra = {}) {
    const mesh = new THREE.Mesh(boxGeo(box), mat);
    mesh.receiveShadow = true;
    const item = {
      id: spot.id, kind: spot.kind, spot, bounds: box, box: null, mesh, broken: broken.has(spot.id),
      center: new THREE.Vector3((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2),
      normal: extra.normal ?? { nx: 0, nz: 0 }, cachePos: extra.cachePos ?? null, room: extra.room ?? null,
    };
    mesh.visible = !item.broken;
    scene.add(mesh);
    if (!item.broken) {
      item.box = collision.addBox(box.minX, box.minY, box.minZ, box.maxX, box.maxY, box.maxZ, 'breakable');
      byBox.set(item.box, item);
    }
    items.push(item);
  }
  function addSolid(b) {
    solid.push(boxGeo(b));
    collision.addBox(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, 'shed');
  }

  for (const spot of BREAKABLES) {
    if (spot.kind === 'weakWall' || spot.kind === 'vent') {
      let room = spot.room;
      if (spot.ladderNear) {
        const l = nearestLadder(climbables.ladders, spot.ladderNear.x, spot.ladderNear.z);
        if (!l) { problems.push({ id: spot.id, problem: 'no street-level ladder within 12 m' }); continue; }
        room = cageRoom(l);
      }
      const walls = roomWalls(room, spot.kind === 'vent' ? 0.12 : 0.3);
      for (const b of walls.solid) addSolid(b);
      if (walls.roof) addSolid(walls.roof);
      addPart(spot, walls.weak, spot.kind === 'vent' ? mats.vent : mats.weakWall, {
        normal: FACES[room.open], cachePos: { x: room.x, y: room.y, z: room.z }, room,
      });
    } else if (spot.kind === 'glass') {
      const b = spot.box;
      const box = { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minY: b.y, maxY: b.y + b.h, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 };
      // Strung on wires that run 7 m past each end and up 1.5 m, like a banner across the street.
      const alongX = b.w >= b.d, half = (alongX ? b.w : b.d) / 2, top = b.y + b.h;
      for (const s of [-1, 1]) {
        const ex = alongX ? b.x + s * half : b.x, ez = alongX ? b.z : b.z + s * half;
        wires.push(ex, top, ez, alongX ? ex + s * 7 : ex, top + 1.5, alongX ? ez : ez + s * 7);
      }
      addPart(spot, box, mats.glass);
    } else if (spot.kind === 'railing') {
      const { x, y, z } = spot.site;
      const roof = collision.query(x - 0.2, z - 0.2, x + 0.2, z + 0.2)
        .filter((o) => Math.abs(o.maxY - y) < 0.4 && o.tag !== 'bound')
        .sort((a, b) => (b.maxX - b.minX) * (b.maxZ - b.minZ) - (a.maxX - a.minX) * (a.maxZ - a.minZ))[0];
      if (!roof) { problems.push({ id: spot.id, problem: `no roof at y ${y}` }); continue; }
      const rail = roofEdgeRail(roof, x, z, spot.len);
      addPart(spot, rail, mats.railing, { normal: { nx: rail.nx, nz: rail.nz } });
    }
  }
  if (solid.length) {
    const sheds = new THREE.Mesh(mergeGeometries(solid), mats.shed);
    sheds.receiveShadow = true;
    sheds.castShadow = true;
    scene.add(sheds);
    for (const g of solid) g.dispose();
  }
  if (wires.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wires), 3));
    const w = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: PALETTE.ink }));
    w.layers.set(LAYER_FX);
    scene.add(w);
  }

  // Caches: one instanced mesh, each crate hidden (scale 0) until its wall or vent is open.
  const cacheGeo = new THREE.BoxGeometry(0.7, 0.5, 0.7).translate(0, 0.25, 0);
  const cacheMesh = new THREE.InstancedMesh(cacheGeo, mats.cache, CACHES.length);
  cacheMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const caches = CACHES.map((c, index) => {
    const owner = items.find((it) => it.spot.hides?.id === c.id) ?? null;
    return {
      id: c.id, xp: c.xp, index, owner, taken: progress.gadgets.caches.includes(c.id),
      pos: owner?.cachePos ? new THREE.Vector3(owner.cachePos.x, owner.cachePos.y, owner.cachePos.z) : null,
    };
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function writeCache(c, t) {
    const show = c.pos && !c.taken;
    q.setFromAxisAngle(up, show ? t * 1.5 + c.index : 0);
    pos.copy(c.pos ?? up).setY(show ? c.pos.y + 0.1 + Math.sin(t * 2 + c.index) * 0.08 : -1000);
    sc.setScalar(show ? 1 : 0);
    cacheMesh.setMatrixAt(c.index, m4.compose(pos, q, sc));
  }
  for (const c of caches) writeCache(c, 0);
  scene.add(cacheMesh);

  function smash(item, from) {
    if (!item || item.broken) return false;
    item.broken = true;
    if (item.box) { collision.removeBox(item.box); byBox.delete(item.box); item.box = null; }
    item.mesh.visible = false;
    const floor = collision.groundBelow(item.center.x, item.center.y, item.center.z, 0.3);
    gfx.debris.burst(item.center, COLORS[item.kind], item.kind === 'glass' ? 16 : 22, item.kind === 'glass' ? 5 : 7, floor > -Infinity ? floor : item.center.y - 1.2);
    if (!progress.gadgets.broken.includes(item.id)) progress.gadgets.broken.push(item.id);
    save();
    events.emit(EVENT[item.kind], { id: item.id, pos: item.center.clone(), item, from });
    events.emit('word', { text: WORD[item.kind], pos: item.center.clone(), big: item.kind === 'weakWall' });
    return true;
  }

  return {
    items,
    caches,
    smash,
    // Calls fn(item) for every unbroken breakable of `kind` within r of pos (no allocation).
    forNear(p, r, kind, fn) {
      for (const it of items) if (!it.broken && it.kind === kind && boxDistance(it.bounds, p) <= r) fn(it);
    },
    // The breakable the ray hits first, if it is one of `kinds` and nothing solid is in front.
    aimed(eye, dir, range, kinds) {
      const hit = collision.raycast(eye, dir, range);
      const it = hit ? byBox.get(hit.box) : null;
      return it && kinds.includes(it.kind) ? it : null;
    },
    update(t, heroPos) {
      let dirty = false;
      for (const c of caches) {
        if (c.taken || !c.pos || !c.owner?.broken) continue;
        writeCache(c, t);
        dirty = true;
        if (Math.hypot(heroPos.x - c.pos.x, heroPos.z - c.pos.z) < 1.4 && Math.abs(heroPos.y - c.pos.y) < 1.5) {
          c.taken = true;
          writeCache(c, t);
          if (!progress.gadgets.caches.includes(c.id)) progress.gadgets.caches.push(c.id);
          save();
          events.emit('cacheFound', { id: c.id, xp: c.xp, pos: c.pos.clone() });
        }
      }
      if (dirty) cacheMesh.instanceMatrix.needsUpdate = true;
    },
    // Placement report for scripts/breakables-check.mjs. `sites` is a list of { name, x, y, z }.
    check(sites = []) {
      const out = problems.map((p) => ({ id: p.id, ok: false, problems: [p.problem] }));
      const ours = new Set(['shed', 'breakable']);
      for (const it of items) {
        const list = [];
        const b = it.room ? { minX: it.room.x - it.room.w / 2, maxX: it.room.x + it.room.w / 2, minZ: it.room.z - it.room.d / 2, maxZ: it.room.z + it.room.d / 2, minY: it.room.y, maxY: it.room.y + it.room.h } : it.bounds;
        for (const o of collision.query(b.minX, b.minZ, b.maxX, b.maxZ)) {
          if (ours.has(o.tag) || o.tag === 'bound' || o.removed) continue;
          const inside = o.minX < b.maxX - 0.05 && o.maxX > b.minX + 0.05 && o.minZ < b.maxZ - 0.05 && o.maxZ > b.minZ + 0.05 && o.minY < b.maxY - 0.05 && o.maxY > b.minY + 0.05;
          if (inside) list.push(`overlaps a ${o.tag || 'box'} (${o.minX.toFixed(1)}..${o.maxX.toFixed(1)}, ${o.minZ.toFixed(1)}..${o.maxZ.toFixed(1)}, top ${o.maxY.toFixed(1)})`);
        }
        const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
        const ground = collision.groundBelow(cx, b.minY + 0.3, cz, 0.3);
        if (it.room && Math.abs(ground - b.minY) > 0.3) list.push(`floor is at ${ground.toFixed(2)}, room at ${b.minY}`);
        if (it.kind === 'glass' && b.minY - collision.groundBelow(cx, b.minY - 0.1, cz, 0.3) < 3.5) list.push('less than 3.5 m of clearance under the sign');
        if (it.kind === 'railing') {
          const ox = cx + it.normal.nx * 1.2, oz = cz + it.normal.nz * 1.2;
          if (b.minY - collision.groundBelow(ox, b.minY + 0.5, oz, 0.2) < 4) list.push('no 4 m drop behind the railing');
        }
        if (it.room && it.kind === 'weakWall') {
          for (const s of sites) if (Math.hypot(s.x - cx, s.z - cz) < 6 && Math.abs(s.y - b.minY) < 3) list.push(`within 6 m of site ${s.name}`);
        }
        out.push({ id: it.id, ok: list.length === 0, problems: list });
      }
      return out;
    },
  };
}
