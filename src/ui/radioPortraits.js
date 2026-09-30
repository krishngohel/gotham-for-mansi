// Code-drawn portraits for the radio panel: small inked faces, no image assets. Each is a plain
// SVG string sized to fill a 72x72 box. Unknown ids fall back to a plain static-and-bolt icon.
const INK = '#0b0b12';
const PAPER = '#efe6cf';

const wrap = (fill, inner) => `<svg viewBox="0 0 72 72"><rect x="1.5" y="1.5" width="69" height="69" rx="6" fill="${fill}" stroke="${INK}" stroke-width="4.5"/>${inner}</svg>`;

const PORTRAITS = {
  gordon: wrap('#5b6474', `
    <path d="M14 46 Q36 20 58 46 L58 56 Q36 46 14 56 Z" fill="#2c3340" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="36" cy="42" rx="15" ry="17" fill="#d9b48f" stroke="${INK}" stroke-width="2.5"/>
    <path d="M20 38 Q36 28 52 38" fill="none" stroke="#c9c3b6" stroke-width="4" stroke-linecap="round"/>
    <path d="M27 50 Q36 55 45 50" fill="none" stroke="#c9c3b6" stroke-width="5" stroke-linecap="round"/>
    <circle cx="29" cy="41" r="2.2" fill="${INK}"/><circle cx="43" cy="41" r="2.2" fill="${INK}"/>`),

  joker: wrap('#3f9e34', `
    <path d="M12 40 Q14 16 36 18 Q58 16 60 40 L52 34 L44 42 L36 32 L28 42 L20 34 Z" fill="#3f9e34" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="36" cy="44" rx="17" ry="18" fill="#f4f1e8" stroke="${INK}" stroke-width="2.5"/>
    <path d="M22 38 Q28 32 34 38" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M38 38 Q44 32 50 38" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M21 50 Q36 62 51 50 Q36 56 21 50 Z" fill="#c8323c" stroke="${INK}" stroke-width="2.5"/>`),

  alfred: wrap('#c9c3b6', `
    <ellipse cx="36" cy="42" rx="15" ry="17" fill="#e3bd9a" stroke="${INK}" stroke-width="2.5"/>
    <path d="M18 36 Q36 18 54 36 L54 30 Q36 22 18 30 Z" fill="#c9c3b6" stroke="${INK}" stroke-width="2.5"/>
    <rect x="29" y="56" width="14" height="8" rx="2" fill="${INK}"/>
    <circle cx="29" cy="41" r="2" fill="${INK}"/><circle cx="43" cy="41" r="2" fill="${INK}"/>
    <path d="M26 50 Q36 52 46 50" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`),

  harley: wrap('#2b6fb8', `
    <ellipse cx="36" cy="42" rx="15" ry="16" fill="#f4f1e8" stroke="${INK}" stroke-width="2.5"/>
    <path d="M20 34 Q10 16 6 32 Q16 30 22 38 Z" fill="#c8323c" stroke="${INK}" stroke-width="2.5"/>
    <path d="M52 34 Q62 16 66 32 Q56 30 50 38 Z" fill="#2b6fb8" stroke="${INK}" stroke-width="2.5"/>
    <path d="M24 40 L48 40" stroke="${INK}" stroke-width="2" stroke-dasharray="2 3"/>
    <circle cx="29" cy="40" r="2.4" fill="#c8323c"/><circle cx="43" cy="40" r="2.4" fill="#2b6fb8"/>
    <path d="M23 52 Q36 60 49 52 Q36 55 23 52 Z" fill="#c8323c" stroke="${INK}" stroke-width="2"/>`),

  crasher: wrap('#2a1a3a', `
    <ellipse cx="36" cy="42" rx="16" ry="17" fill="#3a2350" stroke="${INK}" stroke-width="2.5"/>
    <path d="M18 38 Q36 30 54 38 L52 46 Q36 40 20 46 Z" fill="${INK}"/>
    <circle cx="29" cy="40" r="2.4" fill="${PAPER}"/><circle cx="43" cy="40" r="2.4" fill="${PAPER}"/>
    <path d="M24 54 Q36 50 48 54" fill="none" stroke="${PAPER}" stroke-width="2" stroke-linecap="round"/>`),

  nightwing: wrap('#17181e', `
    <ellipse cx="36" cy="42" rx="16" ry="17" fill="${INK}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M18 38 Q36 30 54 38 L51 46 Q36 40 21 46 Z" fill="#0b0b12" stroke="#49b4ff" stroke-width="1.5"/>
    <path d="M36 46 L30 56 L36 52 L42 56 Z" fill="#49b4ff" stroke="${INK}" stroke-width="1.5"/>
    <circle cx="29" cy="40" r="2.4" fill="#49b4ff"/><circle cx="43" cy="40" r="2.4" fill="#49b4ff"/>`),

  oracle: wrap('#4b586e', `
    <ellipse cx="36" cy="42" rx="15" ry="16" fill="#d9b48f" stroke="${INK}" stroke-width="2.5"/>
    <path d="M18 36 Q36 22 54 36" fill="none" stroke="${INK}" stroke-width="3"/>
    <path d="M16 34 Q16 46 22 48" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="16" cy="48" r="3" fill="#c8323c" stroke="${INK}" stroke-width="1.5"/>
    <circle cx="29" cy="41" r="2" fill="${INK}"/><circle cx="43" cy="41" r="2" fill="${INK}"/>`),

  mansi: wrap('#f2d24b', `
    <ellipse cx="36" cy="42" rx="16" ry="17" fill="#17181e" stroke="${INK}" stroke-width="2.5"/>
    <path d="M20 46 Q36 26 52 46 L52 40 Q36 30 20 40 Z" fill="#17181e"/>
    <path d="M14 36 Q10 24 22 22 Q26 30 20 38 Z" fill="#17181e" stroke="${INK}" stroke-width="2"/>
    <path d="M58 36 Q62 24 50 22 Q46 30 52 38 Z" fill="#17181e" stroke="${INK}" stroke-width="2"/>
    <circle cx="29" cy="41" r="2.4" fill="#f2d24b"/><circle cx="43" cy="41" r="2.4" fill="#f2d24b"/>`),

  radio: wrap('#8c877d', `
    <rect x="16" y="24" width="40" height="30" rx="4" fill="#c9c3b6" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="26" cy="39" r="6" fill="${INK}"/><circle cx="46" cy="39" r="6" fill="${INK}"/>
    <path d="M36 24 L36 14" stroke="${INK}" stroke-width="3"/><circle cx="36" cy="12" r="3" fill="#c8323c"/>`),
};

export function portraitSvg(id) { return PORTRAITS[id] ?? PORTRAITS.radio; }
export const PORTRAIT_IDS = Object.keys(PORTRAITS);
