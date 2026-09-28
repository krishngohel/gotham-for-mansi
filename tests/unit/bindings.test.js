import { describe, it, expect } from 'vitest';
import { ACTIONS, DEFAULT_BINDINGS, keyLabel, rebind, bindingLabel } from '../../src/core/bindings.js';

describe('bindings', () => {
  it('binds every action by default', () => {
    for (const a of ACTIONS) expect(DEFAULT_BINDINGS[a.id]?.length, a.id).toBeGreaterThan(0);
  });
  it('never binds one code to two actions by default', () => {
    const seen = new Map();
    for (const [action, codes] of Object.entries(DEFAULT_BINDINGS))
      for (const c of codes) { expect(seen.has(c), `${c} on ${action} and ${seen.get(c)}`).toBe(false); seen.set(c, action); }
  });
  it('labels codes for people', () => {
    expect(keyLabel('Mouse0')).toBe('LMB');
    expect(keyLabel('Mouse2')).toBe('RMB');
    expect(keyLabel('KeyE')).toBe('E');
    expect(keyLabel('ShiftLeft')).toBe('Shift');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('ArrowUp')).toBe('Up');
  });
  it('rebinding moves a code off any other action and replaces the primary key', () => {
    const b = rebind(DEFAULT_BINDINGS, 'kick', 'KeyQ');
    expect(b.kick[0]).toBe('KeyQ');
    expect(b.cape).not.toContain('KeyQ');
    expect(DEFAULT_BINDINGS.cape).toContain('KeyQ');
  });
  it('joins labels for display', () => {
    expect(bindingLabel({ ...DEFAULT_BINDINGS, punch: ['Mouse0'] }, 'punch')).toBe('LMB');
  });
});

describe('rebind conflicts', () => {
  it('swaps keys so the displaced action keeps a key', () => {
    const b = rebind(DEFAULT_BINDINGS, 'punch', 'KeyE');
    expect(b.punch[0]).toBe('KeyE');
    expect(b.kick).toEqual(['Mouse0']);
  });
  it('labels an unbound action instead of printing undefined', () => {
    expect(bindingLabel({ ...DEFAULT_BINDINGS, kick: [] }, 'kick')).toBe('Unbound');
    expect(keyLabel(undefined)).toBe('Unbound');
  });
});

describe('chain takedown bindings', () => {
  it('binds chains 1 to 3 to the number keys in the Fight group', () => {
    expect(DEFAULT_BINDINGS.chain1).toEqual(['Digit1']);
    expect(DEFAULT_BINDINGS.chain2).toEqual(['Digit2']);
    expect(DEFAULT_BINDINGS.chain3).toEqual(['Digit3']);
    for (const id of ['chain1', 'chain2', 'chain3']) {
      const a = ACTIONS.find((x) => x.id === id);
      expect(a.group).toBe('Fight');
      expect(a.label).toMatch(/^Chain takedown [123]: /);
      expect(a.label).not.toContain('—');
    }
  });
});
