// Code-drawn ink icons for the gadgets: inner SVG for a 48 by 48 viewBox. Strokes and fills come
// from CSS (.g-ico), so the HUD panel and the wheel draw them the same way.
import { batSvgPath } from '../config/batShape.js';

export const GADGET_ICONS = {
  batarang: `<path class="fill" d="${batSvgPath(0.42, 24, 25)}"/>`,
  remote: `<path class="dash" d="M5 42 C12 34 8 26 18 22"/><path class="fill" d="${batSvgPath(0.3, 31, 16)}"/>`,
  gel: '<rect class="fill" x="6" y="18" width="12" height="24" rx="3"/><path d="M12 18 V11 H19"/>'
    + '<path class="fill gel" d="M25 31 C27 23 35 23 37 29 C45 29 45 39 37 39 C35 45 25 45 25 39 C19 37 21 31 25 31 Z"/>',
  smoke: '<circle class="fill" cx="13" cy="36" r="6"/>'
    + '<path class="fill smoke" d="M21 28 C19 19 27 13 33 17 C37 9 47 15 43 23 C48 27 44 35 37 33 C35 39 25 38 24 32 Z"/>',
  launcher: '<rect class="fill" x="4" y="19" width="14" height="11" rx="2"/><path d="M18 24.5 H40"/><path class="fill" d="M36 18 L45 24.5 L36 31 Z"/>',
  claw: '<path d="M5 42 L21 26"/><path class="fill" d="M21 26 L27 11 L30 13 L25 26 L37 17 L39 20 L27 29 L41 30 L40 33 L24 32 Z"/>',
  freeze: '<path d="M24 5 V43 M7.5 14.5 L40.5 33.5 M7.5 33.5 L40.5 14.5"/><path d="M19 8 L24 13 L29 8 M19 40 L24 35 L29 40"/>',
  popper: '<path class="fill" d="M7 43 L17 17 L31 31 Z"/><path d="M24 13 L26 6 M33 19 L42 15 M35 28 L44 30"/>'
    + '<circle class="fill pop" cx="39" cy="7" r="2.6"/><circle class="fill pop" cx="30" cy="4" r="1.8"/>',
};

export const LOCK_ICON = '<rect class="fill" x="12" y="22" width="24" height="18" rx="3"/><path d="M17 22 V16 C17 9 31 9 31 16 V22"/>';
