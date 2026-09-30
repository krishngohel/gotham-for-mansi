// The radio panel: a comic speech bubble with a code-drawn portrait, low on one side of the
// screen. Never covers the objective card (top right) or the centre of the screen where a fight's
// action camera frames a blow. Advances on click or the confirm keys; Esc skips the whole beat.
// Play never stops for it: createFlow.update() ticks it every frame alongside the HUD prompts.
import { createRadioQueue } from './radioQueue.js';
import { portraitSvg } from './radioPortraits.js';

const ADVANCE_KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'KeyE']);

export function createRadio(root, { onSound = () => {} } = {}) {
  const queue = createRadioQueue();
  const el = document.createElement('div');
  // 'dlg-' (dialogue), not 'radio-': src/ui/sideHud.js already owns the unrelated crime-dispatch
  // radio toast under class "radio" / "radio-title" / "radio-text" (top-left, over the combo
  // counter). Different names keep the two panels' CSS from colliding.
  el.className = 'dlg-panel';
  el.innerHTML = '<div class="dlg-portrait"></div><div class="dlg-body"><div class="dlg-name"></div><div class="dlg-text"></div></div>';
  root.appendChild(el);
  const portraitEl = el.querySelector('.dlg-portrait');
  const nameEl = el.querySelector('.dlg-name');
  const textEl = el.querySelector('.dlg-text');
  let shownSpeaker = null;
  let lastLine = null;

  function render() {
    const line = queue.current;
    if (!line) { el.classList.remove('show'); shownSpeaker = null; lastLine = null; return; }
    el.classList.add('show');
    if (line !== lastLine) {
      lastLine = line;
      if (line.speaker !== shownSpeaker) {
        shownSpeaker = line.speaker;
        portraitEl.innerHTML = portraitSvg(line.portrait ?? line.speaker);
        nameEl.textContent = line.speaker ?? '';
      }
      onSound('radioCrackle');
    }
    textEl.textContent = queue.revealed;
  }

  function advance() { queue.advance(); render(); }
  function skip() { queue.skipAll(); render(); }

  el.addEventListener('mousedown', (e) => { e.stopPropagation(); if (e.button === 0) advance(); });
  const onKey = (e) => {
    if (!queue.active) return;
    if (e.code === 'Escape') { skip(); return; }
    if (ADVANCE_KEYS.has(e.code)) advance();
  };
  window.addEventListener('keydown', onKey, true);

  return {
    get playing() { return queue.active; },
    get queue() { return queue; }, // tests reach in here; game code should not need to
    say(lines) {
      const p = queue.say(lines);
      render();
      return p;
    },
    advance,
    skip,
    update(dt) { queue.tick(dt); render(); },
    dispose() { window.removeEventListener('keydown', onKey, true); el.remove(); },
  };
}
