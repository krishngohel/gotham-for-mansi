// A handful of real point lights reassigned to the light spots nearest the player.
// Everything else in the city glows with emissive color and halos.
import * as THREE from 'three';

export function createLightPool(scene, spots, count = 4) {
  const lights = Array.from({ length: count }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 10, 2);
    scene.add(l);
    return l;
  });
  let timer = 0;
  const order = [];
  return {
    update(dt, focus) {
      timer -= dt;
      if (timer > 0) return;
      timer = 0.2;
      order.length = 0;
      for (const s of spots) {
        const d = (s.x - focus.x) ** 2 + (s.y - focus.y) ** 2 * 0.5 + (s.z - focus.z) ** 2;
        if (d < 90 * 90) order.push([d, s]);
      }
      order.sort((a, b) => a[0] - b[0]);
      lights.forEach((l, i) => {
        const s = order[i]?.[1];
        if (!s) { l.intensity = 0; return; }
        l.position.set(s.x, s.y, s.z);
        l.color.set(s.color);
        l.intensity = s.intensity;
        l.distance = s.distance;
      });
    },
  };
}
