import { describe, it, expect } from 'vitest';
import { createObjectives, checkpointFor } from '../../src/game/objectives.js';
import { STEPS } from '../../src/game/story.js';
import { FIGHTS } from '../../src/game/fights.js';
import { SITES } from '../../src/world/mapData.js';
import { BALLOONS } from '../../src/game/balloons.js';
import MANSI from '../../src/mansi.config.js';

const steps = [
  { id: 'a', type: 'cutscene', scene: 'intro' },
  { id: 'b', type: 'reach', site: 'x', checkpoint: 'cp1' },
  { id: 'c', type: 'fight', fight: 'f1' },
  { id: 'd', type: 'collect', item: 'cake', checkpoint: 'cp2' },
  { id: 'e', type: 'boss' },
];

describe('objective runner', () => {
  it('advances only on the matching event', () => {
    const o = createObjectives(steps);
    expect(o.step.id).toBe('a');
    expect(o.handle({ type: 'reached', step: 'b' })).toBe(false);
    expect(o.handle({ type: 'cutsceneDone', scene: 'intro' })).toBe(true);
    expect(o.handle({ type: 'reached', step: 'b' })).toBe(true);
    expect(o.handle({ type: 'fightDone', id: 'nope' })).toBe(false);
    expect(o.handle({ type: 'fightDone', id: 'f1' })).toBe(true);
    expect(o.handle({ type: 'collected', item: 'cake' })).toBe(true);
    expect(o.handle({ type: 'bossDone' })).toBe(true);
    expect(o.done).toBe(true);
  });
  it('starts from a saved index and clamps junk', () => {
    expect(createObjectives(steps, 2).step.id).toBe('c');
    expect(createObjectives(steps, 99).done).toBe(true);
    expect(createObjectives(steps, -3).step.id).toBe('a');
  });
  it('finds the checkpoint for any step', () => {
    expect(checkpointFor(steps, 0)).toBe(null);
    expect(checkpointFor(steps, 1)).toBe('cp1');
    expect(checkpointFor(steps, 2)).toBe('cp1');
    expect(checkpointFor(steps, 4)).toBe('cp2');
  });
});

describe('story data', () => {
  it('every step is well formed and points at real places and fights', () => {
    const ids = new Set();
    for (const s of STEPS) {
      expect(ids.has(s.id), `duplicate ${s.id}`).toBe(false);
      ids.add(s.id);
      if (s.site) expect(SITES[s.site], `site ${s.site}`).toBeDefined();
      if (s.checkpoint) expect(SITES[s.checkpoint], `checkpoint ${s.checkpoint}`).toBeDefined();
      if (s.type === 'fight') expect(FIGHTS[s.fight], `fight ${s.fight}`).toBeDefined();
      if (s.type !== 'cutscene' && s.type !== 'credits') expect(typeof s.text, s.id).toBe('string');
    }
    expect(STEPS.at(-1).type).toBe('credits');
  });
  it('no player-facing text uses em dashes', () => {
    for (const s of STEPS) if (s.text) expect(s.text).not.toMatch(/—/);
  });
  it('stealth fights name their room and an entry site', () => {
    for (const [id, f] of Object.entries(FIGHTS)) {
      if (!f.stealth) continue;
      expect(f.stealth, id).toBe(id);
      expect(SITES[f.entry], id).toBeDefined();
      expect(SITES[f.site], id).toBeDefined();
    }
    expect(Object.values(FIGHTS).filter((f) => f.stealth)).toHaveLength(2);
  });
  it('fights have waves of known enemy types', () => {
    for (const [id, f] of Object.entries(FIGHTS)) {
      expect(f.waves.length, id).toBeGreaterThan(0);
      for (const w of f.waves) for (const e of w) expect(['grunt', 'knife', 'brute', 'rifle']).toContain(e.type);
    }
  });
});

describe('balloons and personal content', () => {
  it('has 12 balloons and 12 non-empty messages', () => {
    expect(BALLOONS).toHaveLength(12);
    expect(MANSI.balloonMessages).toHaveLength(12);
    for (const m of MANSI.balloonMessages) expect(m.trim().length).toBeGreaterThan(0);
    expect(MANSI.finalMessage.trim().length).toBeGreaterThan(0);
  });
  it('personal text avoids em dashes', () => {
    for (const m of [...MANSI.balloonMessages, MANSI.finalMessage]) expect(m).not.toMatch(/—/);
  });
});
