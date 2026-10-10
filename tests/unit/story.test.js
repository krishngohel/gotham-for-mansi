import { describe, it, expect } from 'vitest';
import { createObjectives, checkpointFor } from '../../src/game/objectives.js';
import { STEPS } from '../../src/game/story.js';
import { PROMPT_IDS } from '../../src/ui/prompts.js';
import { FIGHTS } from '../../src/game/fights.js';
import { SITES } from '../../src/world/mapData.js';
import { BALLOONS } from '../../src/game/balloons.js';
import MANSI from '../../src/mansi.config.js';

const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const ASYNC_TYPES = ['radio', 'chase', 'battle', 'armada', 'crasher', 'ally', 'board'];

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
  it('radio, crasher, ally and board only complete their own id; chase, battle and armada have none to check', () => {
    for (const type of ['radio', 'crasher', 'ally', 'board']) {
      const o = createObjectives([{ id: 'this-one', type }]);
      expect(o.handle({ type: `${type}Done`, id: 'some-other-step', ok: true }), type).toBe(false);
      expect(o.handle({ type: `${type}Done`, id: 'this-one', ok: true }), type).toBe(true);
    }
    for (const type of ['chase', 'battle', 'armada']) {
      const o = createObjectives([{ id: 'this-one', type }]);
      expect(o.handle({ type: `${type}Done`, ok: true }), type).toBe(true);
    }
  });
  it('an interior step completes like a plain reach step', () => {
    const o = createObjectives([{ id: 'door', type: 'interior', room: 'funhouse' }]);
    expect(o.handle({ type: 'reached', step: 'door' })).toBe(true);
  });
});

describe('story data', () => {
  it('every step is well formed and points at real places, fights and rooms', () => {
    const ids = new Set();
    for (const s of STEPS) {
      expect(ids.has(s.id), `duplicate ${s.id}`).toBe(false);
      ids.add(s.id);
      if (s.site) expect(SITES[s.site], `site ${s.id}`).toBeDefined();
      if (s.checkpoint) expect(SITES[s.checkpoint], `checkpoint ${s.id}`).toBeDefined();
      if (s.at) expect(SITES[s.at], `at ${s.id}`).toBeDefined();
      if (s.to) expect(SITES[s.to], `to ${s.id}`).toBeDefined();
      if (s.type === 'fight') expect(FIGHTS[s.fight], `fight ${s.id}`).toBeDefined();
      if (s.type === 'interior') expect(SITES[s.room], `room ${s.id}`).toBeDefined();
      if (s.type !== 'cutscene' && s.type !== 'credits') expect(typeof s.text, s.id).toBe('string');
    }
    expect(STEPS.at(-1).type).toBe('credits');
  });
  it('the balloon run is gone and its Batwing tip moved to the plaza walk', () => {
    expect(STEPS.some((s) => s.id === 'armadaRun')).toBe(false);
    expect(STEPS.find((s) => s.id === 'toPlaza').tutorial).toContain('callBatwing');
  });
  it('no player-facing text uses em or en dashes', () => {
    for (const s of STEPS) {
      if (s.text) expect(s.text, s.id).not.toMatch(DASH);
      for (const l of s.lines ?? []) expect(l.text, `${s.id} line`).not.toMatch(DASH);
    }
  });
  it('every radio and mission line has a real speaker and some text', () => {
    for (const s of STEPS) {
      for (const l of s.lines ?? []) {
        expect(typeof l.speaker, s.id).toBe('string');
        expect(l.speaker.length, s.id).toBeGreaterThan(0);
        expect(l.text.trim().length, `${s.id} (${l.speaker})`).toBeGreaterThan(0);
      }
    }
  });
  // 'armada' (the Batwing balloon run) left the story on 2026-10-10; the type itself still works.
  it('every new Part S mission type appears at least once', () => {
    const types = new Set(STEPS.map((s) => s.type));
    for (const t of [...ASYNC_TYPES, 'interior'].filter((t) => t !== 'armada')) expect(types, t).toContain(t);
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
  it('every tutorial prompt in the story exists', () => {
    for (const s of STEPS) for (const id of s.tutorial ?? []) expect(PROMPT_IDS, `${s.id} ${id}`).toContain(id);
    expect(STEPS.find((s) => s.id === 'monarchBalcony').tutorial).toEqual(['crouch', 'silent', 'perch', 'perchDrop']);
    expect(STEPS.find((s) => s.id === 'aceCatwalks').tutorial).toEqual(['distract', 'vent', 'ledgeStealth']);
  });
  it('fights have waves of known enemy types', () => {
    for (const [id, f] of Object.entries(FIGHTS)) {
      expect(f.waves.length, id).toBeGreaterThan(0);
      for (const w of f.waves) for (const e of w) expect(['grunt', 'knife', 'brute', 'rifle', 'harley']).toContain(e.type);
    }
  });
  it('the gadget-unlock and chapter step ids the rest of the game keys off still exist', () => {
    for (const id of ['intro', 'toDocks', 'toYard', 'toNeon', 'toStreet', 'toMonarch', 'toAce', 'toVat', 'toTower', 'boss', 'credits']) {
      expect(STEPS.some((s) => s.id === id), id).toBe(true);
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
    for (const m of [...MANSI.balloonMessages, MANSI.finalMessage]) expect(m).not.toMatch(DASH);
  });
});
