// Photo mode maths: the free and orbit camera, filters and frames, caption text and file names.
// Pure. Pitch is positive looking up; forward = (sin yaw cos pitch, sin pitch, cos yaw cos pitch).
import MANSI from '../mansi.config.js';

export const FILTERS = ['ink', 'noir', 'pop', 'sepia'];
export const FRAMES = ['none', 'panel', 'cover'];
export const FILTER_LABEL = { ink: 'Ink', noir: 'Noir', pop: 'Pop', sepia: 'Sepia' };
export const FRAME_LABEL = { none: 'None', panel: 'Panel border', cover: 'Cover' };
export const DEFAULT_CAPTION = `HAPPY BIRTHDAY ${MANSI.name.toUpperCase()}`;
export const CAPTION_PRESETS = [DEFAULT_CAPTION, 'MEANWHILE, IN GOTHAM...', 'THE NIGHT BELONGS TO US', ''];
export const PHOTO_LIMITS = {
  maxDist: 20, minFov: 20, maxFov: 100, maxRoll: Math.PI / 4, maxPitch: 1.45, speed: 6, lookRate: 0.0035,
  rollRate: 1.2, fovRate: 35, minOrbit: 1.5, pivotY: 1.2,
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function cycle(list, cur, dir = 1) {
  const i = list.indexOf(cur);
  return i < 0 ? list[0] : list[(i + dir + list.length) % list.length];
}

export function createPhotoCam({ position, target, fov }) {
  const dx = target.x - position.x, dy = target.y - position.y, dz = target.z - position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return {
    mode: 'free', x: position.x, y: position.y, z: position.z,
    yaw: Math.atan2(dx, dz), pitch: Math.asin(clamp(dy / len, -1, 1)), roll: 0, fov,
    orbitYaw: 0, orbitPitch: 0.25, orbitDist: 4,
  };
}

// Switching to orbit keeps the camera where it is and orbits the point above Batman's feet.
export function setPhotoMode(cam, mode, anchor, L = PHOTO_LIMITS) {
  if (mode === cam.mode) return cam;
  if (mode === 'free') return { ...cam, mode };
  const ox = cam.x - anchor.x, oy = cam.y - (anchor.y + L.pivotY), oz = cam.z - anchor.z;
  const d = Math.hypot(ox, oy, oz) || 1;
  return {
    ...cam, mode,
    orbitDist: clamp(d, L.minOrbit, L.maxDist - 0.5),
    orbitPitch: clamp(Math.asin(clamp(oy / d, -1, 1)), -0.3, 1.35),
    orbitYaw: Math.atan2(-ox, -oz),
  };
}

export function stepPhotoCam(cam, cmd, dt, anchor, L = PHOTO_LIMITS) {
  const c = { ...cam };
  const { moveX = 0, moveY = 0, up = 0, lookX = 0, lookY = 0, roll = 0, zoom = 0, fovDelta = 0 } = cmd;
  c.roll = clamp(c.roll + roll * L.rollRate * dt, -L.maxRoll, L.maxRoll);
  c.fov = clamp(c.fov + zoom * L.fovRate * dt + fovDelta, L.minFov, L.maxFov);
  const py = anchor.y + L.pivotY;
  if (c.mode === 'orbit') {
    c.orbitYaw += -lookX * L.lookRate + moveX * 1.5 * dt;
    c.orbitPitch = clamp(c.orbitPitch + lookY * L.lookRate + up * dt, -0.3, 1.35);
    c.orbitDist = clamp(c.orbitDist - moveY * L.speed * dt, L.minOrbit, L.maxDist - 0.5);
    const cp = Math.cos(c.orbitPitch);
    c.x = anchor.x - Math.sin(c.orbitYaw) * cp * c.orbitDist;
    c.y = py + Math.sin(c.orbitPitch) * c.orbitDist;
    c.z = anchor.z - Math.cos(c.orbitYaw) * cp * c.orbitDist;
    c.yaw = c.orbitYaw;
    c.pitch = -c.orbitPitch;
  } else {
    c.yaw -= lookX * L.lookRate;
    c.pitch = clamp(c.pitch - lookY * L.lookRate, -L.maxPitch, L.maxPitch);
    const cp = Math.cos(c.pitch), k = L.speed * dt;
    const fx = Math.sin(c.yaw) * cp, fy = Math.sin(c.pitch), fz = Math.cos(c.yaw) * cp;
    const rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw);
    c.x += (fx * moveY + rx * moveX) * k;
    c.y += (fy * moveY + up) * k;
    c.z += (fz * moveY + rz * moveX) * k;
  }
  const ox = c.x - anchor.x, oy = c.y - py, oz = c.z - anchor.z;
  const d = Math.hypot(ox, oy, oz);
  if (d > L.maxDist) { const s = L.maxDist / d; c.x = anchor.x + ox * s; c.y = py + oy * s; c.z = anchor.z + oz * s; }
  c.y = Math.max(c.y, 0.3);
  return c;
}

export function photoView(cam) {
  const cp = Math.cos(cam.pitch);
  return {
    position: { x: cam.x, y: cam.y, z: cam.z },
    target: { x: cam.x + Math.sin(cam.yaw) * cp, y: cam.y + Math.sin(cam.pitch), z: cam.z + Math.cos(cam.yaw) * cp },
    roll: cam.roll, fov: cam.fov,
  };
}

// Sizes in units of 1% of the picture's short side, so the preview and the saved PNG match.
export function frameLayout(frame, w, h) {
  const u = Math.min(w, h) / 100;
  const inset = frame === 'panel' ? u * 3 : frame === 'cover' ? u * 2.4 : 0;
  const border = frame === 'none' ? 0 : Math.max(2, Math.round(u * (frame === 'panel' ? 1.1 : 0.8)));
  const masthead = frame === 'cover' ? { x: inset, y: inset, w: w - inset * 2, h: u * 15 } : null;
  const issue = masthead ? { x: masthead.x + masthead.w - u * 16, y: masthead.y + u * 2, w: u * 13, h: u * 11 } : null;
  const capH = u * 8;
  const left = inset + u * 3;
  const caption = { x: left, y: h - inset - u * 3 - capH, maxW: Math.min(w * 0.62, w - left * 2), h: capH, font: u * 4 };
  return { u, inset, border, masthead, issue, caption };
}

export function sanitizeCaption(text) {
  return String(text ?? '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 48);
}

const two = (n) => String(n).padStart(2, '0');
export function photoFileName(d) {
  return `gotham-for-mansi-${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}.png`;
}
