// Rebindable actions. Codes are KeyboardEvent.code values, or Mouse0/1/2 for mouse buttons.
export const ACTIONS = [
  { id: 'forward', label: 'Move forward', group: 'Move' },
  { id: 'back', label: 'Move back (gliding: pull up)', group: 'Move' },
  { id: 'left', label: 'Move left', group: 'Move' },
  { id: 'right', label: 'Move right', group: 'Move' },
  { id: 'jump', label: 'Jump / glide (hold in the air)', group: 'Move' },
  { id: 'sprint', label: 'Sprint (gliding: dive)', group: 'Move' },
  { id: 'dodge', label: 'Dodge roll', group: 'Move' },
  { id: 'grapple', label: 'Grapple', group: 'Move' },
  { id: 'punch', label: 'Punch', group: 'Fight' },
  { id: 'kick', label: 'Kick (in the air: jump-kick)', group: 'Fight' },
  { id: 'block', label: 'Block (hold) / counter (tap on the blue glyph)', group: 'Fight' },
  { id: 'throw', label: 'Grab and throw', group: 'Fight' },
  { id: 'cape', label: 'Cape stun', group: 'Fight' },
  { id: 'batarang', label: 'Use gadget', group: 'Fight' },
  { id: 'gadgetWheel', label: 'Gadget wheel (hold, then pick with the mouse or 1 to 8)', group: 'Fight' },
  { id: 'special', label: 'Special takedown (combo 8+)', group: 'Fight' },
  { id: 'chain1', label: 'Chain takedown 1: Rope-a-Dope (combo 6)', group: 'Fight' },
  { id: 'chain2', label: 'Chain takedown 2: Headbanger (combo 9)', group: 'Fight' },
  { id: 'chain3', label: 'Chain takedown 3: Domino Drop (combo 12)', group: 'Fight' },
  { id: 'chain4', label: 'Chain takedown 4: Bat Swarm (WayneTech)', group: 'Fight' },
  { id: 'detective', label: 'Detective vision', group: 'Other' },
  { id: 'help', label: 'Controls help', group: 'Other' },
  { id: 'photo', label: 'Photo mode', group: 'Other' },
  { id: 'pause', label: 'Pause and settings', group: 'Other' },
];

export const DEFAULT_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft'],
  dodge: ['KeyC'],
  grapple: ['KeyF'],
  punch: ['Mouse0'],
  kick: ['KeyE'],
  block: ['Mouse2'],
  throw: ['KeyG'],
  cape: ['KeyQ'],
  batarang: ['KeyR'],
  gadgetWheel: ['Tab'],
  special: ['KeyX'],
  chain1: ['Digit1'],
  chain2: ['Digit2'],
  chain3: ['Digit3'],
  chain4: ['Digit4'],
  detective: ['KeyV'],
  help: ['KeyH'],
  photo: ['KeyO'],
  pause: ['Escape', 'KeyP'],
};

const NAMED = {
  Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
  Space: 'Space', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
  ShiftLeft: 'Shift', ShiftRight: 'R Shift', ControlLeft: 'Ctrl', ControlRight: 'R Ctrl',
  AltLeft: 'Alt', AltRight: 'R Alt', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: String.fromCharCode(92),
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
};

export function keyLabel(code) {
  if (!code) return 'Unbound';
  if (NAMED[code]) return NAMED[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  if (/^F\d+$/.test(code)) return code;
  return code;
}

// Returns new bindings with `code` as the primary key of `action`. If another action used that
// code, it gets this action's old primary key instead, so nothing is left unbound.
export function rebind(bindings, action, code) {
  const out = {};
  const old = bindings[action]?.[0];
  for (const [a, codes] of Object.entries(bindings)) {
    const had = codes.includes(code) && a !== action;
    out[a] = codes.filter((c) => c !== code);
    if (had && old && old !== code && !out[a].includes(old)) out[a].unshift(old);
  }
  const rest = (bindings[action] ?? []).slice(1);
  out[action] = [code, ...rest.filter((c) => c !== code)];
  return out;
}

export function bindingLabel(bindings, action) {
  const codes = bindings[action] ?? [];
  return codes.length ? keyLabel(codes[0]) : 'Unbound';
}
