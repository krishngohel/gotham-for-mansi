// The equipped gadget, bottom left beside the health ring: an inked comic panel with its icon,
// charge pips or a cooldown sweep, and the fire key. The gadget system calls set() only when what
// it shows has changed.
import { GADGET_ICONS } from './gadgetIcons.js';

export function createGadgetHud(root) {
  const el = document.createElement('div');
  el.className = 'ghud';
  el.innerHTML = '<div class="gh-panel"><svg class="g-ico" viewBox="0 0 48 48"></svg><div class="gh-cd"></div><div class="gh-pips"></div><b class="gh-key"></b></div><div class="gh-name"></div>';
  root.appendChild(el);
  const panel = el.querySelector('.gh-panel'), icon = el.querySelector('.gh-panel svg'), cd = el.querySelector('.gh-cd');
  const pips = el.querySelector('.gh-pips'), key = el.querySelector('.gh-key'), name = el.querySelector('.gh-name');
  let shownId = '', shownMax = -1, shownKey = '';
  return {
    set(s, keyLabel) {
      if (s.id !== shownId) {
        icon.innerHTML = GADGET_ICONS[s.id];
        name.textContent = s.name;
        shownId = s.id;
        panel.classList.remove('pop');
        void panel.offsetWidth;
        panel.classList.add('pop');
      }
      if (s.max !== shownMax) { pips.innerHTML = '<i></i>'.repeat(s.max); shownMax = s.max; }
      for (let i = 0; i < pips.children.length; i++) pips.children[i].classList.toggle('on', i < s.charges);
      cd.style.setProperty('--cd', s.ready && s.kind !== 'charges' ? '0' : s.frac.toFixed(3));
      panel.classList.toggle('cooling', !s.ready);
      if (keyLabel !== shownKey) { key.textContent = keyLabel; shownKey = keyLabel; }
    },
    setVisible(v) { el.style.display = v ? '' : 'none'; },
  };
}
