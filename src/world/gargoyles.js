// Crouching stone gargoyles on cathedral and deco tower corners. Each is a perch to grapple to.
import * as THREE from 'three';

const STONE = 0x55524d;

// yaw is the direction the beast faces (0 = +z), and the grapple normal points the same way, so a
// grapple from the street below reaches the perch on its back. Built from a few blocks and wedges
// so the ink pass gets one clear silhouette: hunched back, raised bat wings, horned head, snout.
export function addGargoyle(ctx, x, y, z, yaw) {
  const stone = (geo, px, py, pz, rx = 0, rz = 0, ry = 0) => geo.rotateY(ry).rotateX(rx).rotateZ(rz).translate(px, py, pz);
  const wing = (s) => stone(new THREE.BoxGeometry(0.06, 1.0, 0.7), s * 0.45, 1.25, -0.25, 0.35, -s * 0.55);
  const wingTip = (s) => stone(new THREE.ConeGeometry(0.16, 0.5, 4).rotateY(Math.PI / 4), s * 0.86, 1.72, -0.42, 0.35, -s * 0.55);
  const parts = [
    stone(new THREE.BoxGeometry(0.9, 0.5, 1.2), 0, 0.25, 0),               // haunches
    stone(new THREE.BoxGeometry(0.7, 0.42, 0.8), 0, 0.6, -0.2, -0.45),      // hunched back
    stone(new THREE.BoxGeometry(0.7, 0.6, 0.7), 0, 0.75, 0.35, -0.3),       // chest
    stone(new THREE.BoxGeometry(0.5, 0.45, 0.55), 0, 1.15, 0.7, 0.2),       // head
    stone(new THREE.ConeGeometry(0.2, 0.45, 4).rotateY(Math.PI / 4), 0, 1.06, 1.05, Math.PI / 2 + 0.2), // snout
    stone(new THREE.ConeGeometry(0.09, 0.35, 5), -0.18, 1.45, 0.6, -0.4),   // horns
    stone(new THREE.ConeGeometry(0.09, 0.35, 5), 0.18, 1.45, 0.6, -0.4),
    wing(-1), wing(1), wingTip(-1), wingTip(1),                             // raised wings
    stone(new THREE.BoxGeometry(0.22, 0.3, 0.5), -0.3, 0.15, 0.75),         // forepaws over the edge
    stone(new THREE.BoxGeometry(0.22, 0.3, 0.5), 0.3, 0.15, 0.75),
    stone(new THREE.ConeGeometry(0.07, 0.8, 5), 0.32, 0.55, -0.72, -0.7),   // tail curling up behind
  ];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const turn = new THREE.Matrix4().makeRotationY(yaw);
  for (const p of parts) {
    p.applyMatrix4(turn).translate(x, y, z);
    ctx.buckets.add('painted', p, STONE);
  }
  // Collision only (a rendered block here would swallow the silhouette): the beast's back is a
  // standable box 0.9 m above its feet, which is where the perch lands.
  const hull = new THREE.BoxGeometry(0.9, 0.9, 1.2).applyMatrix4(turn).translate(x, y + 0.45, z);
  hull.computeBoundingBox();
  const bb = hull.boundingBox;
  ctx.collision.addBox(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z, 'gargoyle');
  ctx.grapple.push({ x, y: y + 0.9, z, nx: s, nz: c, perch: true, gargoyle: true });
}

// A squat stone block for a gargoyle to crouch on where a parapet would otherwise hide it.
export function plinth(ctx, x, y, z, size = 1.1, h = 0.9) {
  ctx.buckets.add('painted', new THREE.BoxGeometry(size, h, size).translate(x, y + h / 2, z), STONE);
  ctx.buckets.add('painted', new THREE.BoxGeometry(size + 0.16, 0.12, size + 0.16).translate(x, y + h - 0.06, z), 0x8c877d);
  ctx.collision.addBox(x - size / 2, y, z - size / 2, x + size / 2, y + h, z + size / 2, 'plinth');
}
