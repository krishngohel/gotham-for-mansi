// Collects static geometry per material and per 80 m chunk, then merges each group into one mesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CHUNK = 80;
const ATTRS = ['position', 'normal', 'uv', 'color'];

export function createBuckets(materials) {
  const groups = new Map();
  const tmp = new THREE.Vector3();

  // geometry must already be in world space. color (hex) fills a vertex color attribute when the
  // material uses vertex colors.
  function add(key, geometry, color = null) {
    const mat = materials[key];
    if (!mat) throw new Error(`Unknown material ${key}`);
    let g = geometry.index ? geometry.toNonIndexed() : geometry;
    for (const name of Object.keys(g.attributes)) if (!ATTRS.includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (mat.vertexColors) {
      if (!g.attributes.color) {
        const c = new THREE.Color(color ?? 0xffffff);
        const n = g.attributes.position.count;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      }
    } else if (g.attributes.color) g.deleteAttribute('color');
    g.computeBoundingBox();
    g.boundingBox.getCenter(tmp);
    // Cheap flat overlays (userData.global) go in one city-wide mesh: fewer draw calls beats culling.
    const id = mat.userData.global ? key : `${key}|${Math.floor(tmp.x / CHUNK)},${Math.floor(tmp.z / CHUNK)}`;
    if (!groups.has(id)) groups.set(id, { key, list: [] });
    groups.get(id).list.push(g);
  }

  function flush(parent, { castShadow = true, receiveShadow = true } = {}) {
    const meshes = [];
    for (const { key, list } of groups.values()) {
      const merged = mergeGeometries(list, false);
      if (!merged) { console.warn('merge failed for', key); continue; }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.castShadow = castShadow && !materials[key].userData.noShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.name = key;
      if (materials[key].userData.layer) mesh.layers.set(materials[key].userData.layer);
      parent.add(mesh);
      meshes.push(mesh);
    }
    groups.clear();
    return meshes;
  }

  return { add, flush };
}

// ---- geometry helpers (all return world-space BufferGeometry) ----

// A box with per-face UV scaling so textures tile in meters. uvScale: [metersPerU, metersPerV].
export function tiledBox(w, h, d, x, y, z, { uvScale = [1, 1], uOffset = 0, faces = 'all' } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const [su, sv] = uvScale;
  for (let f = 0; f < 6; f++) {
    const spanU = f < 2 ? d : w;
    const spanV = f === 2 || f === 3 ? d : h;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uOffset + (uv.getX(i) * spanU) / su, (uv.getY(i) * spanV) / sv);
    }
  }
  if (faces !== 'all') {
    // Keep only the listed faces (0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z).
    const keep = new Set(faces);
    const index = [];
    for (let f = 0; f < 6; f++) if (keep.has(f)) index.push(...g.index.array.slice(f * 6, f * 6 + 6));
    g.setIndex(index);
  }
  return g.translate(x, y, z);
}

export function box(w, h, d, x, y, z) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

export function cylinder(rTop, rBottom, h, x, y, z, seg = 12, open = false) {
  return new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open).translate(x, y, z);
}

// Triangular prism along x (ridge on top), used for pitched and sawtooth roofs.
export function prism(w, h, d, x, y, z, { sawtooth = false } = {}) {
  const shape = new THREE.Shape();
  if (sawtooth) { shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(d / 2, h); shape.lineTo(-d / 2, 0); }
  else { shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, h); shape.lineTo(-d / 2, 0); }
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return g.translate(x, y, z);
}

export function rotatedY(g, angle, cx, cz) {
  return g.translate(-cx, 0, -cz).rotateY(angle).translate(cx, 0, cz);
}
