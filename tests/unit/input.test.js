import { describe, it, expect } from 'vitest';
import { padActions } from '../../src/core/input.js';

const pad = (...down) => (i) => down.includes(i);
const acts = (...down) => [...padActions(pad(...down))].sort();
const actsWith = (latch, ...down) => [...padActions(pad(...down), new Set(), latch)].sort();

describe('padActions', () => {
  it('maps plain buttons as before', () => {
    expect(acts(2)).toEqual(['punch']);
    expect(acts(15)).toEqual(['throw']);
    expect(acts(12)).toEqual(['photo']);
    expect(acts(14)).toEqual([]);
  });
  it('photo on D-pad up never fires while block is held (block + up is chain 2)', () => {
    expect(acts(3, 12)).toEqual(['block', 'chain2']);
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

  it('keeps a chorded D-pad button suppressed after block releases, until the button itself releases', () => {
    const latch = new Set();
    // Frame 1: block + D-pad right held together, chain3 fires, not throw.
    expect(actsWith(latch, 3, 15)).toEqual(['block', 'chain3']);
    // Frame 2: block let go first, D-pad right still held: throw must stay suppressed.
    expect(actsWith(latch, 15)).toEqual([]);
    // Frame 3: D-pad right also released: nothing fires, and the latch clears.
    expect(actsWith(latch, 3)).toEqual(['block']);
  });

  it('fires the plain action again once the chorded button has been fully released and re-pressed', () => {
    const latch = new Set();
    expect(actsWith(latch, 3, 15)).toEqual(['block', 'chain3']);
    expect(actsWith(latch, 15)).toEqual([]);
    expect(actsWith(latch)).toEqual([]); // fully released: latch clears
    expect(actsWith(latch, 15)).toEqual(['throw']); // pressed again without block: fires normally
  });
});
