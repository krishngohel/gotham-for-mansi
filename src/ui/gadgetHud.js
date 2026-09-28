// The equipped gadget, bottom left beside the health ring: an inked comic panel with its icon,
// charge pips or a cooldown sweep, and the fire key. The gadget system calls set() only when what
// it shows has changed.
import { GADGET_ICONS, SWARM_ICON } from './gadgetIcons.js';

export function createGadgetHud(root) {
  const el = document.createElement('div');
  el.className = 'ghud';
  el.innerHTML = '<div class="gh-panel"><svg class="g-ico" viewBox="0 0 48 48"></svg><div class="gh-cd"></div><div class="gh-pips"></div><b class="gh-key"></b></div><div class="gh-name"></div>';
  root.appendChild(el);
  const swarm = document.createElement('div');
  swarm.className = 'gh-swarm hidden';
  swarm.innerHTML = `<svg class="g-ico" viewBox="0 0 48 48">${SWARM_ICON}</svg><b></b>`;
  root.appendChild(swarm);
  let lastSwarm = null, lastSwarmKey = '';
  const panel = el.querySelector('.gh-panel'), icon = el.querySelector('.gh-panel svg'), cd = el.querySelector('.gh-cd');
  const pips = el.querySelector('.gh-pips'), key = el.querySelector('.gh-key'), name = el.querySelector('.gh-name');
  let shownId = '', shownMax = -1, shownKey = '';
  // Cached last-written values so set() only touches the DOM when something actually changed.
  let shownCharges = -1, shownCdStep = NaN, shownCooling = null;
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
      if (s.max !== shownMax) {
        pips.innerHTML = '<i></i>'.repeat(s.max);
        shownMax = s.max;
        shownCharges = -1; // force the pip classes below to be re-applied to the fresh elements
      }
      if (s.charges !== shownCharges) {
        for (let i = 0; i < pips.children.length; i++) pips.children[i].classList.toggle('on', i < s.charges);
        shownCharges = s.charges;
      }
      // Quantised to 60 steps per full sweep: plenty smooth, and cheap to gate on.
      const cdStep = Math.round((s.ready && s.kind !== 'charges' ? 0 : s.frac) * 60);
      if (cdStep !== shownCdStep) {
        cd.style.setProperty('--cd', (cdStep / 60).toFixed(3));
        shownCdStep = cdStep;
      }
      if (!s.ready !== shownCooling) {
        shownCooling = !s.ready;
        panel.classList.toggle('cooling', shownCooling);
      }
      if (keyLabel !== shownKey) { key.textContent = keyLabel; shownKey = keyLabel; }
    },
    // The Bat Swarm icon beside Plan 4E's chain icons: shown once owned and the combo is up, lit
    // when affordable. combat.swarm is a new object only when it was refreshed.
    setSwarm(s, keyLabel) {
      if (s === lastSwarm && keyLabel === lastSwarmKey) return;
      lastSwarm = s;
      lastSwarmKey = keyLabel;
      swarm.classList.toggle('hidden', !s.show);
      swarm.classList.toggle('lit', s.affordable);
      swarm.querySelector('b').textContent = keyLabel;
    },
    setVisible(v) { el.style.display = v ? '' : 'none'; },
  };
}
