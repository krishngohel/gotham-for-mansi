// src/ui/cinematic.js
// In-engine cinematic camera (Arkham Knight-style establishing and cutscene shots), playing
// over the live game world rather than a comic panel: sliding letterbox bars, a HUD fade, an
// optional subtitle (or the radio, if present) per shot, and a smooth ease back to the follow
// camera when it's done. Esc or Space skips straight to that handoff.
import * as THREE from 'three';
import { sampleSequence, totalDuration, orbitShots } from './cinematicShots.js';

const RETURN_DUR = 0.7; // seconds: the ease back to the follow camera once shots (or a skip) end

function buildLetterbox(root) {
  const mk = (edge) => {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'left:0', 'right:0', `${edge}:0`, 'height:11%', 'background:#0b0b12',
      `transform:translateY(${edge === 'top' ? '-100%' : '100%'})`,
      'transition:transform 0.45s ease', 'z-index:7', 'pointer-events:none',
      // The ink edge: a drawn stroke where the bar meets the live footage.
      `box-shadow:0 ${edge === 'top' ? '3px' : '-3px'} 0 #0b0b12, 0 ${edge === 'top' ? '4px' : '-4px'} 0 rgba(239,230,207,0.35)`,
    ].join(';');
    root.appendChild(el);
    return el;
  };
  const top = mk('top'), bottom = mk('bottom');
  const sub = document.createElement('div');
  sub.style.cssText = [
    'position:fixed', 'left:6%', 'right:6%', 'bottom:2.4%', 'text-align:center',
    'font:26px "Patrick Hand SC",cursive', 'color:#efe6cf', 'text-shadow:0 2px 0 #000',
    'z-index:8', 'opacity:0', 'transition:opacity 0.3s', 'pointer-events:none',
  ].join(';');
  bottom.appendChild(sub);
  return { top, bottom, sub };
}

export function createCinematic({ camera, hero, hudRoot }) {
  const { top, bottom, sub } = buildLetterbox(document.body);
  const hudEl = hudRoot?.querySelector?.('.hud') ?? hudRoot ?? null;

  // Reused every frame: no per-frame allocation.
  const pos = { x: 0, y: 0, z: 0 };
  const look = new THREE.Vector3();
  const returnFromPos = new THREE.Vector3(), returnFromQuat = new THREE.Quaternion();
  const snapPos = new THREE.Vector3(), snapQuat = new THREE.Quaternion();
  const blendPos = new THREE.Vector3(), blendQuat = new THREE.Quaternion();

  let shots = [], lines = [], total = 0, t = 0, phase = 'idle'; // idle | shots | returning
  let onDone = null, wasFrozen = false, returnT = 0, shownLine = -1;

  function showLine(index) {
    if (shownLine === index) return;
    shownLine = index;
    const line = lines[index];
    const text = typeof line === 'string' ? line : line?.text;
    if (!text) { sub.style.opacity = '0'; return; }
    // The radio, if the story branch's src/ui/radio.js is wired in, speaks the line; otherwise a
    // plain subtitle in the letterbox does.
    if (window.__game?.radio?.say) {
      try { window.__game.radio.say(text, line); sub.style.opacity = '0'; return; } catch { /* best effort */ }
    }
    sub.textContent = text;
    sub.style.opacity = '1';
  }

  function finishReturn() {
    phase = 'idle';
    top.style.transform = 'translateY(-100%)';
    bottom.style.transform = 'translateY(100%)';
    sub.style.opacity = '0';
    if (hudEl) hudEl.style.opacity = '';
    if (hero) hero.frozen = wasFrozen;
    const cb = onDone;
    onDone = null;
    cb?.();
  }

  function beginReturn() {
    phase = 'returning';
    returnT = 0;
    returnFromPos.copy(camera.position);
    returnFromQuat.copy(camera.quaternion);
    sub.style.opacity = '0';
  }

  function skip() {
    if (phase === 'shots') beginReturn();
    else if (phase === 'returning') finishReturn();
  }

  // Capture phase, like src/ui/comic.js's own skip key: stops the key reaching anything else.
  const onKey = (e) => {
    if (phase === 'idle') return;
    if (e.code === 'Escape' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); skip(); }
  };
  window.addEventListener('keydown', onKey, true);

  const api = {
    get active() { return phase !== 'idle'; },
    // play(shots, { lines, onDone }): shots is [{ from, to, look, lookTo?, dur, fov? }, ...] in
    // world coordinates. Player input is paused (the hero freezes; the rest of the world, and
    // game time, keep running) for the duration. Returns false if a cinematic is already playing.
    play(inShots, { lines: inLines = [], onDone: cb } = {}) {
      if (phase !== 'idle' || !inShots?.length) return false;
      shots = inShots;
      lines = inLines;
      total = totalDuration(shots);
      t = 0;
      shownLine = -1;
      phase = 'shots';
      onDone = cb ?? null;
      wasFrozen = !!hero?.frozen;
      if (hero) hero.frozen = true;
      if (hudEl) hudEl.style.opacity = '0';
      top.style.transform = 'translateY(0)';
      bottom.style.transform = 'translateY(0)';
      return true;
    },
    // A quick establishing shot: an arc around `center` at `radius`/`height` over `dur` seconds.
    // `opts` doubles as orbitShots' own options (segments, startAngle, sweep, fov) and play()'s
    // (lines, onDone): unused keys on either side are just ignored.
    orbit(center, radius, height, dur, opts = {}) {
      return api.play(orbitShots(center, radius, height, dur, opts.segments, opts), opts);
    },
    skip,
    // Call once per frame, after follow.update(): it overrides whatever camera it just set.
    update(dt) {
      if (phase === 'shots') {
        t += dt;
        const s = sampleSequence(shots, t, pos, total);
        if (s.index !== shownLine) showLine(s.index);
        camera.position.set(s.x, s.y, s.z);
        look.set(s.lx, s.ly, s.lz);
        camera.lookAt(look);
        if (Math.abs(camera.fov - s.fov) > 0.05) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
        if (s.done) beginReturn();
      } else if (phase === 'returning') {
        // follow.update() already computed and set its own answer on the camera this frame;
        // that live answer is this frame's return target, read before it's overwritten below, so
        // the handoff stays smooth even while the follow camera is still settling.
        snapPos.copy(camera.position);
        snapQuat.copy(camera.quaternion);
        returnT += dt;
        const k = Math.min(1, returnT / RETURN_DUR);
        const e = k * k * (3 - 2 * k);
        blendPos.lerpVectors(returnFromPos, snapPos, e);
        blendQuat.copy(returnFromQuat).slerp(snapQuat, e);
        camera.position.copy(blendPos);
        camera.quaternion.copy(blendQuat);
        if (k >= 1) finishReturn();
      }
    },
    dispose() { window.removeEventListener('keydown', onKey, true); top.remove(); bottom.remove(); },
  };
  return api;
}
