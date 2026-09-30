import { describe, it, expect } from 'vitest';
import { whatsNewItems, whatsNewHeadline } from '../../src/ui/whatsNew.js';
import { DEFAULT_BINDINGS, bindingLabel, rebind } from '../../src/core/bindings.js';

const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe("the title screen's What's new page", () => {
  it('has no em or en dashes anywhere', () => {
    expect(whatsNewHeadline()).not.toMatch(DASH);
    for (const line of whatsNewItems(DEFAULT_BINDINGS)) expect(line).not.toMatch(DASH);
  });
  it('lists at least a handful of real, warm lines addressed to Mansi', () => {
    const items = whatsNewItems(DEFAULT_BINDINGS);
    expect(items.length).toBeGreaterThanOrEqual(6);
    for (const line of items) expect(line.trim().length).toBeGreaterThan(0);
    expect(whatsNewHeadline()).toContain('Mansi');
  });
  it('uses the live binding labels for the Batmobile and the Batwing, not a hardcoded key', () => {
    const batmobileLine = (bindings) => whatsNewItems(bindings).find((l) => l.includes('Batmobile'));
    const batwingLine = (bindings) => whatsNewItems(bindings).find((l) => l.includes('Batwing'));
    expect(batmobileLine(DEFAULT_BINDINGS)).toContain(bindingLabel(DEFAULT_BINDINGS, 'vehicle'));
    expect(batwingLine(DEFAULT_BINDINGS)).toContain(bindingLabel(DEFAULT_BINDINGS, 'batwing'));
    // Rebind both away from their defaults: the page's text must follow, proving it reads the
    // live binding rather than a copy of the default key name.
    const rebound = rebind(rebind(DEFAULT_BINDINGS, 'vehicle', 'KeyU'), 'batwing', 'KeyI');
    expect(batmobileLine(rebound)).toContain('U');
    expect(batwingLine(rebound)).toContain('I');
    expect(batmobileLine(rebound)).not.toContain(bindingLabel(DEFAULT_BINDINGS, 'vehicle'));
  });
  it('mentions the new parts the birthday night story added', () => {
    const text = whatsNewItems(DEFAULT_BINDINGS).join(' ').toLowerCase();
    for (const word of ['batmobile', 'batwing', 'nightwing', 'harley', 'funhouse', 'cinematic', 'party', 'grand prix', 'wing walk', 'impact']) {
      expect(text, word).toContain(word);
    }
  });
});
