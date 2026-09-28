// Title, suit select, pause, settings (with key rebinding), controls help and credits.
import { ACTIONS, DEFAULT_BINDINGS, keyLabel, rebind } from '../core/bindings.js';
import { saveSettings } from '../core/settings.js';
import { promptText } from './prompts.js';
import { drawProgressMap } from './progressMap.js';
import MANSI from '../mansi.config.js';

const MOVING_AROUND = ['ladder', 'ledge', 'zip', 'wallrun', 'divebomb', 'takedown'];
const CHAIN_TIPS = ['chain', 'chainTied'];

const PAD_LAYOUT = [
  ['Move / camera', 'Left stick / right stick'], ['Jump, glide', 'A'], ['Punch', 'X'], ['Kick', 'B'], ['Block, counter', 'Y'],
  ['Grab and throw', 'D-pad right'], ['Grapple', 'LB'], ['Cape stun', 'RB (tap)'], ['Dodge', 'LT'], ['Use gadget', 'RT'], ['Sprint', 'L3'], ['Special takedown', 'R3'],
  ['Chain takedowns', 'Hold Y, then D-pad left, up or right'], ['Chain takedown 4 (Bat Swarm)', 'Hold Y, then LB'],
  ['Gadget wheel', 'Hold RB, pick with the right stick'],
  ['Detective vision', 'View'], ['Photo mode', 'D-pad up'], ['Pause', 'Menu'],
];

// Some gadget prompts already open with "Name: ..." (see src/ui/prompts.js); the help list
// prepends its own bold name, so drop a matching leading "Name:" here rather than show it twice.
// Never touches the prompt text itself, only this one rendering.
function dropLeadingName(name, text) {
  const prefix = `${name}:`;
  return text.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase()
    ? text.slice(prefix.length).trimStart()
    : text;
}

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
  let gadgetHelp = () => [];

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
  function title(opts) {
    const { canContinue, percent = null, onContinue, onNew } = opts;
    const again = () => title(opts);
    const node = el('div', 'menu title-menu');
    node.appendChild(el('div', 'logo', `<span class="kicker">A birthday special</span><span class="l1">Gotham needs you,</span><span class="l2">${MANSI.name}</span>`));
    const list = el('div', 'mlist');
    if (canContinue) list.appendChild(button(percent == null ? 'Continue' : `Continue, ${percent}%`, onContinue, 'primary'));
    list.appendChild(button(canContinue ? 'New game' : 'Start', onNew, canContinue ? '' : 'primary'));
    list.appendChild(button('Settings', () => openSettings(again)));
    list.appendChild(button('Controls', () => help(again)));
    list.appendChild(button('Credits', () => credits({ onClose: again })));
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
  // opts: { onResume, onRestart, onTitle, info?: { challenge, crimesStopped, percent },
  //         onQuitChallenge?, onChallenges?, onProgress?, onPhoto? }
  function pause(opts) {
    const { onResume, onRestart, onTitle, info = {}, onQuitChallenge, onChallenges, onProgress, onPhoto, onWayneTech } = opts;
    const again = () => pause(opts);
    const node = el('div', 'menu pause-menu');
    node.appendChild(el('h2', '', 'Paused'));
    const list = el('div', 'mlist');
    list.appendChild(button('Resume', onResume, 'primary'));
    if (info.challenge && onQuitChallenge) list.appendChild(button('Quit challenge', onQuitChallenge));
    if (onChallenges) list.appendChild(button('Challenges', onChallenges));
    if (onProgress) list.appendChild(button(info.percent != null ? `Progress, ${info.percent}%` : 'Progress', onProgress));
    if (onWayneTech) list.appendChild(button(info.wayneFree ? `WayneTech, ${info.wayneFree} to spend` : 'WayneTech', onWayneTech, info.wayneFree ? 'glow' : ''));
    if (onPhoto) list.appendChild(button('Photo mode', onPhoto));
    list.appendChild(button('Controls', () => help(again)));
    list.appendChild(button('Settings', () => openSettings(again)));
    list.appendChild(button('Restart from checkpoint', onRestart));
    list.appendChild(button('Quit to title', onTitle));
    node.appendChild(list);
    if (info.crimesStopped != null) node.appendChild(el('p', 'note', `Crimes stopped: ${info.crimesStopped}`));
    show(node);
  }

  // ---------- challenges ----------
  function challengesPage(data, { onBack, onRead }) {
    const node = el('div', 'menu challenges-menu');
    node.appendChild(el('h2', '', 'Challenges'));
    const list = el('div', 'cr-list');
    for (const c of data.list) {
      const row = el('div', `cr-row medal-${c.medal ?? 'none'}`, '<span class="cr-medal"></span><span class="cr-title"></span><span class="cr-best"></span><span class="cr-blurb"></span><span class="cr-goal"></span>');
      row.querySelector('.cr-title').textContent = c.name;
      row.querySelector('.cr-best').textContent = c.best ?? 'Not tried yet';
      row.querySelector('.cr-blurb').textContent = c.blurb;
      row.querySelector('.cr-goal').textContent = c.goal;
      list.appendChild(row);
    }
    node.appendChild(list);
    node.appendChild(el('p', 'note', 'Walk into a glowing bat pillar to start. Detective vision shows every pillar through walls.'));
    if (data.goldStandard) node.appendChild(button(`Read: ${MANSI.name}'s Gold Standard`, onRead, 'primary'));
    else node.appendChild(el('p', 'note', `Gold in every challenge unlocks a comic page: ${MANSI.name}'s Gold Standard.`));
    node.appendChild(button('Back', onBack, 'small'));
    show(node);
  }

  // ---------- progress ----------
  function progressPage(data, { onBack, onRead }) {
    const node = el('div', 'menu progress-menu');
    node.appendChild(el('h2', '', `Progress: ${data.percent}%`));
    const wrap = el('div', 'pg-wrap');
    const map = el('canvas', 'pg-map');
    const parts = el('div', 'pg-parts');
    for (const p of data.parts) {
      const row = el('div', 'pg-row', '<div class="pg-head"><span class="pg-label"></span><span class="pg-count"></span></div><div class="pg-bar"><i></i></div><div class="pg-detail"></div>');
      row.querySelector('.pg-label').textContent = p.label;
      row.querySelector('.pg-count').textContent = `${p.done}/${p.total}`;
      row.querySelector('.pg-bar i').style.width = `${Math.round(p.fraction * 100)}%`;
      row.querySelector('.pg-detail').textContent = p.detail;
      parts.appendChild(row);
    }
    wrap.append(map, parts);
    node.appendChild(wrap);
    const stats = el('p', 'pg-stats');
    stats.textContent = data.statsLine;
    node.appendChild(stats);
    if (data.fromKrishn) node.appendChild(button(`Read: From ${MANSI.fromName}`, onRead, 'primary'));
    node.appendChild(button('Back', onBack, 'small'));
    show(node);
    // Sized and drawn once the map is actually laid out, so the backing store matches its real
    // CSS box (min(320px, 80vw), see .pg-map) instead of guessing it. Backing store = CSS size x
    // device pixel ratio (capped at 2), floored at 540 so non-Retina screens keep today's crispness.
    // drawProgressMap scales its own drawing to canvas.width/height, so this alone fixes the soft
    // render on Retina screens (DPR 2, e.g. a 2021 MacBook Air); it's still one draw per open, no
    // per-frame redraw.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const boxSize = map.getBoundingClientRect().width || 320;
    const backing = Math.max(540, Math.round(boxSize * dpr));
    map.width = backing;
    map.height = backing;
    drawProgressMap(map, data.map);
  }

  // ---------- WayneTech ----------
  // data: wayne.page(). Every card is a button so a gamepad can browse them; only buyable ones buy.
  // Text goes in with textContent.
  const WT_STATE = { owned: 'Built', buyable: 'Build it: 1 point', poor: 'Needs 1 point', locked: 'Needs the one above' };
  function wayneTechPage(data, { onBuy, onBack, focus = null }) {
    const node = el('div', 'menu wt-menu');
    node.appendChild(el('div', 'wt-head', '<span class="wt-logo">WAYNETECH</span><span class="wt-sub">Applied Sciences Division</span>'));
    const bar = el('div', 'wt-xp', '<div class="wt-level"></div><div class="wt-bar"><i></i></div><div class="wt-points"></div><div class="wt-next"></div>');
    bar.querySelector('.wt-level').textContent = `Level ${data.level}`;
    bar.querySelector('.wt-bar i').style.width = `${Math.round(data.fraction * 100)}%`;
    bar.querySelector('.wt-points').textContent = data.allOwned ? 'Every upgrade built' : data.free === 1 ? '1 point to spend' : `${data.free} points to spend`;
    bar.querySelector('.wt-next').textContent = `${data.xp.toLocaleString('en-US')} XP. ${data.need.toLocaleString('en-US')} more to level ${data.level + 1}.`;
    node.appendChild(bar);
    const trees = el('div', 'wt-trees');
    for (const t of data.trees) {
      const col = el('div', `wt-tree wt-${t.id}`);
      col.appendChild(el('h3', '', t.name));
      for (const u of t.upgrades) {
        const card = el('button', `mbtn wt-card ${u.state}`, '<span class="wt-tier"></span><span class="wt-name"></span><span class="wt-text"></span><span class="wt-state"></span>');
        card.dataset.id = u.id;
        card.querySelector('.wt-tier').textContent = String(u.tier);
        card.querySelector('.wt-name').textContent = u.name;
        card.querySelector('.wt-text').textContent = u.text;
        card.querySelector('.wt-state').textContent = WT_STATE[u.state];
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          if (u.state === 'buyable') onBuy(u.id);
          else sound('uiBack');
        });
        card.addEventListener('mouseenter', () => sound('uiMove'));
        col.appendChild(card);
      }
      trees.appendChild(col);
    }
    node.appendChild(trees);
    node.appendChild(button('Back', onBack, 'small'));
    show(node);
    if (focus) node.querySelector(`[data-id="${focus}"]`)?.focus({ preventScroll: true });
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
    node.appendChild(el('h3', '', 'Chain takedowns'));
    for (const id of CHAIN_TIPS) node.appendChild(el('p', 'tip', promptText(id, settings.bindings)));
    // Plan 6D restores the stealth clause when predator rooms ship. No costs here: WayneTech's
    // Efficient Chains lowers them, and the chain icons and the cost hint show the live ones.
    node.appendChild(el('p', 'tip', 'Rope-a-Dope ties up to three goons together. Headbanger smashes two heads together. Domino Drop bounces off every head into a dive-bomb.'));
    const gadgets = gadgetHelp();
    if (gadgets.length) {
      node.appendChild(el('h3', '', 'Gadgets'));
      node.appendChild(el('p', 'tip', promptText('gadgetWheel', settings.bindings)));
      for (const g of gadgets) {
        const p = el('p', 'tip', dropLeadingName(g.name, g.html));
        p.prepend(el('b', '', `${g.name}: `));
        node.appendChild(p);
      }
    }
    node.appendChild(el('h3', '', 'Extras'));
    for (const id of ['challenges', 'photo']) node.appendChild(el('p', 'tip', promptText(id, settings.bindings)));
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

  return {
    title, suitSelect, pause, challengesPage, progressPage, wayneTechPage, help, openSettings, credits, hide,
    setGadgetHelp(fn) { gadgetHelp = fn; },
    get open() { return !!current; },
  };
}
