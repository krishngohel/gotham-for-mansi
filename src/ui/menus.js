// Title, suit select, pause, settings (with key rebinding), controls help and credits.
import { ACTIONS, DEFAULT_BINDINGS, keyLabel, rebind } from '../core/bindings.js';
import { saveSettings } from '../core/settings.js';
import { promptText } from './prompts.js';
import MANSI from '../mansi.config.js';

const MOVING_AROUND = ['ladder', 'ledge', 'zip', 'wallrun', 'divebomb', 'takedown'];

const PAD_LAYOUT = [
  ['Move / camera', 'Left stick / right stick'], ['Jump, glide', 'A'], ['Punch', 'X'], ['Kick', 'B'], ['Block, counter', 'Y'],
  ['Grab and throw', 'D-pad right'], ['Grapple', 'LB'], ['Cape stun', 'RB'], ['Dodge', 'LT'], ['Batarang', 'RT'], ['Sprint', 'L3'], ['Special takedown', 'R3'],
  ['Detective vision', 'View'], ['Pause', 'Menu'],
];

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function createMenus({ root, settings, storage, input, sound = () => {}, onChange = () => {} }) {
  const layer = el('div', 'menu-layer');
  root.appendChild(layer);
  let current = null;

  function show(node) {
    layer.innerHTML = '';
    layer.appendChild(node);
    layer.classList.add('show');
    current = node;
    node.querySelector('button')?.focus({ preventScroll: true });
  }
  function hide() { layer.classList.remove('show'); layer.innerHTML = ''; current = null; }

  const button = (label, fn, cls = '') => {
    const b = el('button', `mbtn ${cls}`, label);
    b.addEventListener('click', (e) => { e.stopPropagation(); sound('uiSelect'); fn(); });
    b.addEventListener('mouseenter', () => sound('uiMove'));
    return b;
  };

  function save() { saveSettings(storage, settings); onChange(settings); }

  // ---------- title ----------
  function title({ canContinue, onContinue, onNew, onCredits }) {
    const node = el('div', 'menu title-menu');
    node.appendChild(el('div', 'logo', `<span class="kicker">A birthday special</span><span class="l1">Gotham needs you,</span><span class="l2">${MANSI.name}</span>`));
    const list = el('div', 'mlist');
    if (canContinue) list.appendChild(button('Continue', onContinue, 'primary'));
    list.appendChild(button(canContinue ? 'New game' : 'Start', onNew, canContinue ? '' : 'primary'));
    list.appendChild(button('Settings', () => openSettings(() => title({ canContinue, onContinue, onNew, onCredits }))));
    list.appendChild(button('Controls', () => help(() => title({ canContinue, onContinue, onNew, onCredits }))));
    list.appendChild(button('Credits', () => credits({ onClose: () => title({ canContinue, onContinue, onNew, onCredits }) })));
    node.appendChild(list);
    node.appendChild(el('div', 'foot', 'Best with a mouse and headphones.'));
    show(node);
  }

  // ---------- suit select ----------
  function suitSelect({ gold, onPick, onBack }) {
    const node = el('div', 'menu suit-menu');
    node.appendChild(el('h2', '', 'Choose your suit'));
    const row = el('div', 'suits');
    // Card art: front views from the suit reference sheets. The gold suit reuses Batman's card
    // with a CSS gold tint.
    const suits = [['m', 'The Bat', 'Grey suit, black cape, black bat.', 'card_m'], ['f', 'Bat, with style', 'Dark suit, gold bat, red hair.', 'card_f']];
    if (gold) suits.push(['gold', 'Gold Birthday', 'Unlocked by finding all twelve balloons.', 'card_m']);
    for (const [id, name, desc, art] of suits) {
      const card = el('button', `suit-card suit-${id}`, `<div class="swatch"><img src="./assets/art/${art}.webp" alt="" draggable="false"></div><div class="sname">${name}</div><div class="sdesc">${desc}</div>`);
      card.addEventListener('click', () => { sound('uiSelect'); onPick(id); });
      card.addEventListener('mouseenter', () => sound('uiMove'));
      row.appendChild(card);
    }
    node.appendChild(row);
    if (onBack) node.appendChild(button('Back', onBack, 'small'));
    show(node);
  }

  // ---------- pause ----------
  function pause({ onResume, onRestart, onTitle }) {
    const node = el('div', 'menu pause-menu');
    node.appendChild(el('h2', '', 'Paused'));
    const list = el('div', 'mlist');
    list.appendChild(button('Resume', onResume, 'primary'));
    list.appendChild(button('Controls', () => help(() => pause({ onResume, onRestart, onTitle }))));
    list.appendChild(button('Settings', () => openSettings(() => pause({ onResume, onRestart, onTitle }))));
    list.appendChild(button('Restart from checkpoint', onRestart));
    list.appendChild(button('Quit to title', onTitle));
    node.appendChild(list);
    show(node);
  }

  // ---------- controls help ----------
  function help(onBack) {
    const node = el('div', 'menu help-menu');
    node.appendChild(el('h2', '', 'Controls'));
    const cols = el('div', 'help-cols');
    for (const group of ['Move', 'Fight', 'Other']) {
      const col = el('div', 'help-col');
      col.appendChild(el('h3', '', group));
      for (const a of ACTIONS.filter((x) => x.group === group)) {
        col.appendChild(el('div', 'help-row', `<span>${a.label}</span><kbd>${keyLabel(settings.bindings[a.id][0])}</kbd>`));
      }
      cols.appendChild(col);
    }
    const pad = el('div', 'help-col');
    pad.appendChild(el('h3', '', 'Gamepad'));
    for (const [a, k] of PAD_LAYOUT) pad.appendChild(el('div', 'help-row', `<span>${a}</span><kbd>${k}</kbd>`));
    cols.appendChild(pad);
    node.appendChild(cols);
    node.appendChild(el('h3', '', 'Moving around'));
    for (const id of MOVING_AROUND) node.appendChild(el('p', 'tip', promptText(id, settings.bindings)));
    node.appendChild(el('p', 'tip', 'Tips: counter every blue bolt, dodge the red ones. Kick or cape-stun knife goons. Batarang the Joker mid-throw.'));
    node.appendChild(button('Back', onBack, 'small'));
    show(node);
  }

  // ---------- settings ----------
  function openSettings(onBack, tab = 'controls') {
    const node = el('div', 'menu settings-menu');
    node.appendChild(el('h2', '', 'Settings'));
    const tabs = el('div', 'tabs');
    const body = el('div', 'tab-body');
    const TABS = { controls: 'Controls', camera: 'Camera', video: 'Video', audio: 'Audio', gameplay: 'Gameplay' };
    for (const [id, label] of Object.entries(TABS)) {
      const t = button(label, () => openSettings(onBack, id), `tab ${id === tab ? 'on' : ''}`);
      tabs.appendChild(t);
    }
    node.appendChild(tabs);
    node.appendChild(body);

    const slider = (label, value, min, max, step, fn, fmt = (v) => v) => {
      const row = el('label', 'set-row');
      row.appendChild(el('span', '', label));
      const r = el('input');
      r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = value;
      const out = el('output', '', fmt(value));
      r.addEventListener('input', () => { out.textContent = fmt(Number(r.value)); fn(Number(r.value)); save(); });
      row.append(r, out);
      return row;
    };
    const toggle = (label, value, fn) => {
      const row = el('label', 'set-row');
      row.appendChild(el('span', '', label));
      const b = button(value ? 'On' : 'Off', () => { value = !value; b.textContent = value ? 'On' : 'Off'; fn(value); save(); }, 'small toggle');
      row.appendChild(b);
      return row;
    };
    const choice = (label, value, options, fn) => {
      const row = el('div', 'set-row');
      row.appendChild(el('span', '', label));
      const group = el('div', 'choices');
      for (const [id, name] of options) {
        const b = button(name, () => { fn(id); save(); openSettings(onBack, tab); }, `small ${id === value ? 'on' : ''}`);
        group.appendChild(b);
      }
      row.appendChild(group);
      return row;
    };

    if (tab === 'controls') {
      const list = el('div', 'binds');
      for (const a of ACTIONS) {
        const row = el('div', 'set-row');
        row.appendChild(el('span', '', a.label));
        const b = button(keyLabel(settings.bindings[a.id][0]), () => {
          b.textContent = 'Press a key...';
          b.classList.add('listening');
          input.captureNext((code) => {
            b.classList.remove('listening');
            if (code) { settings.bindings = rebind(settings.bindings, a.id, code); input.setBindings(settings.bindings); save(); }
            openSettings(onBack, 'controls');
          });
        }, 'small rebind');
        row.appendChild(b);
        list.appendChild(row);
      }
      body.appendChild(list);
      body.appendChild(button('Reset to defaults', () => {
        settings.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
        input.setBindings(settings.bindings);
        save();
        openSettings(onBack, 'controls');
      }, 'small'));
    } else if (tab === 'camera') {
      body.appendChild(slider('Mouse sensitivity', settings.sensitivity, 0.2, 3, 0.05, (v) => { settings.sensitivity = v; }, (v) => v.toFixed(2)));
      body.appendChild(toggle('Invert Y', settings.invertY, (v) => { settings.invertY = v; }));
      body.appendChild(slider('Field of view', settings.fov, 50, 90, 1, (v) => { settings.fov = v; }, (v) => `${v}°`));
      body.appendChild(toggle('Camera shake', settings.cameraShake, (v) => { settings.cameraShake = v; }));
      body.appendChild(toggle('Action camera on critical hits', settings.actionCam, (v) => { settings.actionCam = v; }));
      body.appendChild(toggle('Line wobble', settings.lineWobble, (v) => { settings.lineWobble = v; }));
      body.appendChild(toggle('Impact frames (flashing)', settings.impactFrames, (v) => { settings.impactFrames = v; }));
      body.appendChild(toggle('Auto ledge grab', settings.autoLedge, (v) => { settings.autoLedge = v; }));
    } else if (tab === 'video') {
      body.appendChild(choice('Quality', settings.quality, [['high', 'High'], ['low', 'Low']], (v) => { settings.quality = v; }));
      body.appendChild(el('p', 'note', 'Quality changes apply the next time the game loads.'));
      body.appendChild(slider('Render scale', settings.renderScale, 0.5, 1, 0.05, (v) => { settings.renderScale = v; }, (v) => `${Math.round(v * 100)}%`));
      body.appendChild(toggle('Dynamic resolution', settings.dynamicRes, (v) => { settings.dynamicRes = v; }));
      body.appendChild(el('p', 'note', 'Lowers the render scale a little when frames run late, and raises it again when there is room.'));
      body.appendChild(slider('Halftone dots', settings.halftone, 0, 1.5, 0.05, (v) => { settings.halftone = v; }, (v) => `${Math.round(v * 100)}%`));
      body.appendChild(toggle('Show FPS', settings.showFps, (v) => { settings.showFps = v; }));
      body.appendChild(toggle('FPS details (GPU, render scale)', settings.fpsDetails, (v) => { settings.fpsDetails = v; }));
    } else if (tab === 'audio') {
      body.appendChild(slider('Master', settings.volume.master, 0, 1, 0.05, (v) => { settings.volume.master = v; }, (v) => `${Math.round(v * 100)}%`));
      body.appendChild(slider('Music', settings.volume.music, 0, 1, 0.05, (v) => { settings.volume.music = v; }, (v) => `${Math.round(v * 100)}%`));
      body.appendChild(slider('Effects', settings.volume.sfx, 0, 1, 0.05, (v) => { settings.volume.sfx = v; }, (v) => `${Math.round(v * 100)}%`));
    } else if (tab === 'gameplay') {
      body.appendChild(choice('Difficulty', settings.difficulty, [['story', 'Story'], ['normal', 'Normal'], ['hard', 'Hard']], (v) => { settings.difficulty = v; }));
      body.appendChild(el('p', 'note', 'Story: goons hit softer and telegraph longer. Hard: faster, meaner goons.'));
      body.appendChild(toggle('Tutorial prompts', settings.hints, (v) => { settings.hints = v; }));
    }
    node.appendChild(button('Back', () => { input.cancelCapture(); onBack(); }, 'small back'));
    show(node);
  }

  // ---------- credits ----------
  function credits({ onClose, final = false }) {
    const node = el('div', `menu credits-menu ${final ? 'final' : ''}`);
    const roll = el('div', 'roll');
    roll.innerHTML = `
      ${final ? `<h1>Happy birthday, ${MANSI.name}!</h1><p class="final-msg">${MANSI.finalMessage}</p><p class="from">From ${MANSI.fromName}</p>` : '<h2>Credits</h2>'}
      <h3>Made for</h3><p>${MANSI.name}</p>
      <h3>Made by</h3><p>${MANSI.fromName}</p>
      <h3>Characters and animation</h3><p>Universal Base Characters and Universal Animation Library 1 and 2 by Quaternius (CC0)</p>
      <h3>Type</h3><p>Bangers, Patrick Hand SC and Barlow Condensed via Google Fonts (SIL Open Font License)</p>
      <h3>Music and voice</h3><p>Finale: "Happy Birthday To You" (orchestral) by Tom Kincaid / VOLE.wtf (CC0). The Joker's voice: Seed Audio 1.0 on Higgsfield.</p>
      <h3>Everything else</h3><p>City, comics, score and sound effects are built in code, in the browser.</p>
      <p class="legal">Batman, Batgirl, the Joker and Gotham City belong to DC. This is a non-commercial fan-made birthday gift.</p>`;
    node.appendChild(roll);
    node.appendChild(button(final ? 'Keep exploring Gotham' : 'Back', onClose, final ? 'primary' : 'small'));
    show(node);
  }

  return { title, suitSelect, pause, help, openSettings, credits, hide, get open() { return !!current; } };
}
