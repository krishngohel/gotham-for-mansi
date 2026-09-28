import { describe, it, expect } from 'vitest';
import { padActions } from '../../src/core/input.js';

const pad = (...down) => (i) => down.includes(i);
const acts = (...down) => [...padActions(pad(...down))].sort();

describe('padActions', () => {
  it('maps plain buttons as before', () => {
    expect(acts(2)).toEqual(['punch']);
    expect(acts(15)).toEqual(['throw']);
    expect(acts(12)).toEqual([]);
    expect(acts(14)).toEqual([]);
  });
  it('with block held, the D-pad fires the chains instead', () => {
    expect(acts(3, 14)).toEqual(['block', 'chain1']);
    expect(acts(3, 12)).toEqual(['block', 'chain2']);
    expect(acts(3, 15)).toEqual(['block', 'chain3']);
  });
  it('help on D-pad down still works while blocking', () => {
    expect(acts(3, 13)).toEqual(['block', 'help']);
  });
  it('reuses the output set', () => {
    const out = new Set(['stale']);
    expect(padActions(pad(0), out)).toBe(out);
    expect([...out]).toEqual(['jump']);
  });
});
