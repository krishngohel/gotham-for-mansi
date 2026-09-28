// Bare, crooked trees: black branch silhouettes that read like brush strokes against the lit city.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// Returns world-space geometries for one tree rooted at (x, y, z).
export function bareTree(rng, x, y, z, scale = 1, levels = 4) {
  const geos = [];
  const q = new THREE.Quaternion();
  const grow = (start, dir, len, r, depth) => {
    const g = new THREE.CylinderGeometry(r * 0.62, r, len, depth > 2 ? 6 : depth > 0 ? 4 : 3, 1, true).translate(0, len / 2, 0);
    q.setFromUnitVectors(UP, dir);
    g.applyQuaternion(q).translate(start.x, start.y, start.z);
    geos.push(g);
    const end = start.clone().addScaledVector(dir, len);
    if (depth === 0) return;
    const n = rng.int(2, 3);
    for (let k = 0; k < n; k++) {
      const a = rng.range(0, Math.PI * 2);
      const spread = rng.range(0.35, 0.8);
      const d = dir.clone().multiplyScalar(0.8)
        .add(new THREE.Vector3(Math.cos(a) * spread, rng.range(0.1, 0.5), Math.sin(a) * spread)).normalize();
      grow(end, d, len * rng.range(0.6, 0.78), r * 0.62, depth - 1);
    }
  };
  const lean = new THREE.Vector3(rng.range(-0.12, 0.12), 1, rng.range(-0.12, 0.12)).normalize();
  grow(new THREE.Vector3(x, y, z), lean, 2.6 * scale, 0.2 * scale, levels);
  return geos;
}
