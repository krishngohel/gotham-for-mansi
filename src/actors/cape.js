import * as THREE from 'three';
import { createCloth, hangFrom, stepCloth } from './verlet.js';
import { toonMaterial } from '../render/toon.js';
import { bindPosition } from './rig.js';


function gridIndex(cols, rows) {
  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      idx.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
    }
  }
  return idx;
}

// anchor 'shoulders' is the cape; 'waist' hangs coat tails from the hips (the Joker's).
export function createCape(ch, color, {
  cols: COLS = 9, rows: ROWS = 12, topWidth = 0.5, bottomWidth = 1.15, length = 1.32, pointDrop = 0.12, anchor: mode = 'shoulders',
} = {}) {
  const cloth = createCloth({ cols: COLS, rows: ROWS, topWidth, bottomWidth, length, pointDrop });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cloth.pos, 3));
  geo.setIndex(gridIndex(COLS, ROWS));
  const mesh = new THREE.Mesh(geo, toonMaterial({ color, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.castShadow = true;

  const b = {
    hl: ch.bone('hand_l'), hr: ch.bone('hand_r'),
    ul: ch.bone('upperarm_l'), ur: ch.bone('upperarm_r'),
    s2: ch.bone('spine_02'), s3: ch.bone('spine_03'), pelvis: ch.bone('pelvis'),
    tl: ch.bone('thigh_l'), tr: ch.bone('thigh_r'), cl: ch.bone('calf_l'), cr: ch.bone('calf_r'), fl: ch.bone('foot_l'), fr: ch.bone('foot_r'),
  };
  const pins = new Float32Array(COLS * 3);
  const colliders = Array.from({ length: 9 }, () => ({ x: 0, y: 0, z: 0, r: 0 }));
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), anchor = new THREE.Vector3();
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  let placed = false;
  // Which way the shoulder line's cross product points relative to the chest, fixed from the bind pose.
  const flip = Math.sign(bindPosition(ch.body, 'upperarm_l').x - bindPosition(ch.body, 'upperarm_r').x) * ch.lm.fwd;
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3();
  // Gliding: the bottom corners are held by the hands so the cape spreads into wings.
  const cornerL = (ROWS - 1) * COLS, cornerR = ROWS * COLS - 1;
  let wings = false;
  const hand = new THREE.Vector3();

  const setSphere = (s, v, r, push = 0) => { s.x = v.x + fwd.x * push; s.y = v.y; s.z = v.z + fwd.z * push; s.r = r; };
  const mid = (a, bb) => a.getWorldPosition(va).add(bb.getWorldPosition(vb)).multiplyScalar(0.5);

  function update(dt, wind = [0.6, 0, 0.3]) {
    ch.root.updateMatrixWorld(true);
    // Follow the torso, not the root: idle stances twist the shoulders well off the root's facing.
    b.ul.getWorldPosition(va);
    b.ur.getWorldPosition(vb);
    side.subVectors(va, vb).setY(0);
    right.copy(side).normalize();
    fwd.crossVectors(side, up).setY(0).normalize().multiplyScalar(flip);
    if (mode === 'waist') {
      // Coat tails: a straight line across the back of the hips.
      b.pelvis.getWorldPosition(anchor);
      anchor.y += 0.1;
      for (let c = 0; c < COLS; c++) {
        const t = c / (COLS - 1) - 0.5;
        pins[c * 3] = anchor.x + right.x * t * topWidth - fwd.x * 0.2;
        pins[c * 3 + 1] = anchor.y;
        pins[c * 3 + 2] = anchor.z + right.z * t * topWidth - fwd.z * 0.2;
      }
    } else {
      anchor.addVectors(va, vb).multiplyScalar(0.5);
      anchor.y += 0.1;
      // Top edge wraps over the shoulders: well behind the neck at the center, near the shoulder tops at the ends.
      for (let c = 0; c < COLS; c++) {
        const t = c / (COLS - 1) - 0.5;
        const back = 0.17 - t * t * 0.5;
        pins[c * 3] = anchor.x + right.x * t * 0.56 - fwd.x * back;
        pins[c * 3 + 1] = anchor.y - t * t * 0.3;
        pins[c * 3 + 2] = anchor.z + right.z * t * 0.56 - fwd.z * back;
      }
    }
    if (!placed) { hangFrom(cloth, pins); placed = true; }
    setSphere(colliders[7], b.ul.getWorldPosition(va), 0.11);
    setSphere(colliders[8], b.ur.getWorldPosition(va), 0.11);
    setSphere(colliders[0], b.s2.getWorldPosition(va), 0.2, -0.02);
    setSphere(colliders[1], b.s3.getWorldPosition(va), 0.21, -0.02);
    setSphere(colliders[2], b.pelvis.getWorldPosition(va), 0.19, -0.01);
    setSphere(colliders[3], mid(b.tl, b.cl), 0.1);
    setSphere(colliders[4], mid(b.tr, b.cr), 0.1);
    setSphere(colliders[5], mid(b.cl, b.fl), 0.075);
    setSphere(colliders[6], mid(b.cr, b.fr), 0.075);
    if (wings) {
      // Column 0 sits on the upperarm_r side of the shoulder line.
      for (const [i, bone] of [[cornerL, b.hr], [cornerR, b.hl]]) {
        bone.getWorldPosition(hand);
        cloth.pinned[i] = 1;
        cloth.pos[i * 3] = cloth.prev[i * 3] = hand.x;
        cloth.pos[i * 3 + 1] = cloth.prev[i * 3 + 1] = hand.y;
        cloth.pos[i * 3 + 2] = cloth.prev[i * 3 + 2] = hand.z;
      }
    }
    if (dt <= 0) return;
    const steps = Math.min(4, Math.ceil(dt / (1 / 120)));
    for (let s = 0; s < steps; s++) stepCloth(cloth, dt / steps, { wind, damping: 0.04, iterations: 8, colliders, pins });
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  return {
    mesh,
    update,
    setWings(on) {
      if (on === wings) return;
      wings = on;
      if (!on) { cloth.pinned[cornerL] = 0; cloth.pinned[cornerR] = 0; }
    },
    reset() { placed = false; },
  };
}
