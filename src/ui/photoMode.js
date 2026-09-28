// Photo mode: frozen time, a free or orbiting camera within 20 m of Batman, comic filters,
// frames, an editable caption, Batman hidden or shown, and a PNG saved with a browser download.
// Everything stays in the browser. Keys inside photo mode are fixed (only the key that opens it
// is rebindable), listed on the panel; the pad uses its raw buttons.
import * as THREE from 'three';
import {
  FILTERS, FRAMES, FILTER_LABEL, FRAME_LABEL, DEFAULT_CAPTION, CAPTION_PRESETS, cycle, createPhotoCam, setPhotoMode, stepPhotoCam,
  photoView, sanitizeCaption, photoFileName,
} from '../game/photoMath.js';
import { drawPhotoFrame } from './photoFrame.js';

const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export function createPhotoMode({ root, camera, renderer, ink, scene, hero, input, sound = () => {}, getTime, getIssue, onOpen = () => {}, onClose = () => {}, onSaved = () => {} }) {
  const overlay = document.createElement('canvas');
  overlay.className = 'photo-overlay';
  const flash = document.createElement('div');
  flash.className = 'photo-flash';
  const panel = document.createElement('div');
  panel.className = 'menu photo-panel';
  panel.innerHTML = `
    <h2>Photo mode</h2>
    <div class="ph-row"><span>Filter</span><button class="mbtn small ph-filter"></button></div>
    <div class="ph-row"><span>Frame</span><button class="mbtn small ph-frame"></button></div>
    <div class="ph-row"><span>Camera</span><button class="mbtn small ph-mode"></button></div>
    <div class="ph-row"><span>Batman</span><button class="mbtn small ph-bat"></button></div>
    <label class="ph-row ph-cap"><span>Caption</span><input type="text" maxlength="48" spellcheck="false"></label>
    <div class="ph-actions"><button class="mbtn primary ph-save">Save photo</button><button class="mbtn small ph-exit">Exit</button></div>
    <p class="note ph-keys">WASD move · Arrows or drag to look · R and F up and down · Q and E roll · Z and X or the wheel zoom · 1 filter · 2 frame · 3 Batman · G orbit · T caption · H hide panel · Enter save · Esc exit</p>
    <p class="note ph-keys">Pad: sticks move and look · LT and RT down and up · LB and RB roll · D-pad up and down zoom · D-pad left and right caption · X filter · Y frame · View Batman · L3 orbit · R3 hide panel · A save · B exit</p>`;
  const q = (s) => panel.querySelector(s);
  const capInput = q('input');

  const held = new Set();
  let active = false;
  let cam = null;
  let anchor = { x: 0, y: 0, z: 0 };
  let filter = 'ink', frame = 'none', caption = DEFAULT_CAPTION, hideBat = false, panelHidden = false;
  let drag = null, lookX = 0, lookY = 0, wheel = 0;
  capInput.value = caption;

  function drawOverlay() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    overlay.width = Math.round(innerWidth * dpr);
    overlay.height = Math.round(innerHeight * dpr);
    const g = overlay.getContext('2d');
    g.clearRect(0, 0, overlay.width, overlay.height);
    drawPhotoFrame(g, overlay.width, overlay.height, { frame, caption, issue: getIssue() });
  }
  function refresh() {
    q('.ph-filter').textContent = FILTER_LABEL[filter];
    q('.ph-frame').textContent = FRAME_LABEL[frame];
    q('.ph-mode').textContent = cam?.mode === 'orbit' ? 'Orbit' : 'Free';
    q('.ph-bat').textContent = hideBat ? 'Hidden' : 'Shown';
    panel.classList.toggle('hidden', panelHidden);
    ink.setFilter(filter);
    hero.bat.root.visible = !hideBat;
    hero.cape.mesh.visible = !hideBat;
    drawOverlay();
  }
  const act = {
    filter: (d = 1) => { filter = cycle(FILTERS, filter, d); sound('uiMove'); refresh(); },
    frame: (d = 1) => { frame = cycle(FRAMES, frame, d); sound('uiMove'); refresh(); },
    bat: () => { hideBat = !hideBat; sound('uiMove'); refresh(); },
    mode: () => { cam = setPhotoMode(cam, cam.mode === 'orbit' ? 'free' : 'orbit', anchor); sound('uiMove'); refresh(); },
    panel: () => { panelHidden = !panelHidden; refresh(); },
    caption: (d) => { caption = cycle(CAPTION_PRESETS, caption, d); capInput.value = caption; refresh(); },
  };
  q('.ph-filter').addEventListener('click', () => act.filter());
  q('.ph-frame').addEventListener('click', () => act.frame());
  q('.ph-mode').addEventListener('click', () => act.mode());
  q('.ph-bat').addEventListener('click', () => act.bat());
  q('.ph-save').addEventListener('click', () => save());
  q('.ph-exit').addEventListener('click', () => close());
  capInput.addEventListener('input', () => { caption = sanitizeCaption(capInput.value); drawOverlay(); });
  capInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); capInput.blur(); }
  });

  const onKey = (e) => {
    if (e.target === capInput) return;
    if (e.type === 'keyup') { held.delete(e.code); return; }
    if (e.repeat) return;
    held.add(e.code);
    switch (e.code) {
      case 'Digit1': act.filter(); break;
      case 'Digit2': act.frame(); break;
      case 'Digit3': act.bat(); break;
      case 'KeyG': act.mode(); break;
      case 'KeyH': act.panel(); break;
      case 'KeyT': e.preventDefault(); capInput.focus(); capInput.select(); break;
      case 'Enter': case 'Space': e.preventDefault(); save(); break;
      default: return;
    }
  };
  const onDown = (e) => { if (!e.target.closest?.('.photo-panel')) drag = { x: e.clientX, y: e.clientY }; };
  const onMove = (e) => {
    if (!drag) return;
    lookX += e.clientX - drag.x;
    lookY += e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
  };
  const onUp = () => { drag = null; };
  const onWheel = (e) => { if (!e.target.closest?.('.photo-panel')) { wheel += Math.sign(e.deltaY) * 3; e.preventDefault(); } };
  const listeners = [['keydown', onKey], ['keyup', onKey], ['mousedown', onDown], ['mousemove', onMove], ['mouseup', onUp]];

  function apply() {
    const v = photoView(cam);
    camera.position.set(v.position.x, v.position.y, v.position.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(v.target.x, v.target.y, v.target.z);
    camera.rotateZ(v.roll);
    if (Math.abs(camera.fov - v.fov) > 0.01) { camera.fov = v.fov; camera.updateProjectionMatrix(); }
  }

  function open() {
    if (active) return;
    active = true;
    anchor = { x: hero.pos.x, y: hero.pos.y, z: hero.pos.z };
    const dir = camera.getWorldDirection(new THREE.Vector3());
    cam = createPhotoCam({ position: camera.position, target: camera.position.clone().add(dir), fov: camera.fov });
    held.clear();
    root.append(overlay, flash, panel);
    for (const [ev, fn] of listeners) window.addEventListener(ev, fn);
    window.addEventListener('wheel', onWheel, { passive: false });
    onOpen();
    refresh();
  }

  function close() {
    if (!active) return;
    active = false;
    capInput.blur();
    for (const [ev, fn] of listeners) window.removeEventListener(ev, fn);
    window.removeEventListener('wheel', onWheel);
    ink.setFilter('ink');
    hero.bat.root.visible = true;
    hero.cape.mesh.visible = true;
    overlay.remove();
    flash.remove();
    panel.remove();
    onClose();
  }

  // Renders a fresh frame and reads it back in the same task (no preserveDrawingBuffer needed),
  // then adds the frame and caption and downloads a PNG.
  function save() {
    if (!active) return;
    const w = renderer.domElement.width, h = renderer.domElement.height;
    ink.render(scene, camera, getTime());
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const g = out.getContext('2d');
    g.drawImage(renderer.domElement, 0, 0, w, h);
    drawPhotoFrame(g, w, h, { frame, caption, issue: getIssue() });
    sound('uiSelect');
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = photoFileName(new Date());
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      onSaved();
      drawOverlay();
    }, 'image/png');
  }

  function update(real) {
    if (!active) return;
    const k = (c) => (held.has(c) ? 1 : 0);
    const st = input.stick, ph = (i) => (input.padButtonHeld(i) ? 1 : 0);
    cam = stepPhotoCam(cam, {
      moveX: k('KeyD') - k('KeyA') + st.mx,
      moveY: k('KeyW') - k('KeyS') - st.my,
      up: k('KeyR') - k('KeyF') + ph(PAD.RT) - ph(PAD.LT),
      lookX: lookX + (k('ArrowRight') - k('ArrowLeft')) * 500 * real + st.lx * 700 * real,
      lookY: lookY + (k('ArrowDown') - k('ArrowUp')) * 400 * real + st.ly * 500 * real,
      roll: k('KeyE') - k('KeyQ') + ph(PAD.RB) - ph(PAD.LB),
      zoom: k('KeyX') - k('KeyZ') + ph(PAD.DOWN) - ph(PAD.UP),
      fovDelta: wheel,
    }, real, anchor);
    lookX = 0; lookY = 0; wheel = 0;
    apply();
    if (input.padButton(PAD.X)) act.filter();
    if (input.padButton(PAD.Y)) act.frame();
    if (input.padButton(PAD.VIEW)) act.bat();
    if (input.padButton(PAD.L3)) act.mode();
    if (input.padButton(PAD.R3)) act.panel();
    if (input.padButton(PAD.LEFT)) act.caption(-1);
    if (input.padButton(PAD.RIGHT)) act.caption(1);
    if (input.padButton(PAD.A)) save();
    if (input.padButton(PAD.B)) close();
  }

  return { get active() { return active; }, open, close, update, save };
}
