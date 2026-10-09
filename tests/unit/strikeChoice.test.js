// tests/unit/strikeChoice.test.js
import { describe, it, expect } from 'vitest';
import { createStrikeChooser, PUNCH_FINISHERS, KICK_FINISHERS, KICKS, CLOSE } from '../../src/combat/strikeChoice.js';

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
// A small seeded generator: varied enough to visit every option.
const lcg = (seed = 7) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

describe('createStrikeChooser', () => {
  it('never plays the same punch twice running', () => {
    const c = createStrikeChooser({ random: seq([0, 0.5, 0.99, 0.2, 0.7]) });
    let prev = '';
    for (let i = 0; i < 60; i++) { const p = c.punch((i % 3) + 1, 2); expect(p).not.toBe(prev); prev = p; }
  });
  it('uses uppercuts, hooks and elbows across a long fight, not just jabs and crosses', () => {
    const c = createStrikeChooser({ random: lcg() });
    const seen = new Set();
    for (let i = 0; i < 90; i++) seen.add(c.punch((i % 3) + 1, i % 2 ? 1 : 2));
    for (const clip of ['Punch_Jab', 'Punch_Cross', 'Punch_Hook_L', 'Punch_Uppercut', 'Elbow_Strike', 'Punch_BodyJab', 'Punch_ShortHook', 'Punch_BodyHook', 'Punch_LeadUppercut', 'Elbow_Head']) expect(seen).toContain(clip);
  });
  it('throws an elbow instead of a cross up close', () => {
    const c = createStrikeChooser({ random: () => 0 }); // first option: Punch_Cross in tier 2
    expect(c.punch(2, CLOSE - 0.1)).toBe('Elbow_Strike');
    expect(createStrikeChooser({ random: () => 0 }).punch(2, CLOSE + 1)).toBe('Punch_Cross');
  });
  it('rotates the punch and kick finishers', () => {
    const c = createStrikeChooser();
    expect([c.punchFinisher(), c.punchFinisher(), c.punchFinisher(), c.punchFinisher()]).toEqual([...PUNCH_FINISHERS, PUNCH_FINISHERS[0]]);
    expect(Array.from({ length: KICK_FINISHERS.length + 1 }, () => c.kickFinisher())).toEqual([...KICK_FINISHERS, KICK_FINISHERS[0]]);
  });
  it('cycles every kick at range, and a knee or a front kick at point-blank', () => {
    const c = createStrikeChooser();
    expect(Array.from({ length: KICKS.length }, () => c.kick(3))).toEqual(KICKS);
    const close = [c.kick(0.8), c.kick(0.8)];
    expect(close).toContain('Knee_Strike');
    expect(close).toContain('Kick_Front');
  });
  it('skips clips the build does not have', () => {
    const c = createStrikeChooser({ has: (n) => !['Punch_Backfist', 'Kick_Side', 'Punch_Uppercut'].includes(n), random: () => 0 });
    expect(c.punchFinisher()).toBe('Melee_Hook');
    expect(c.punchFinisher()).toBe('Punch_Hammer');
    expect([c.kick(3), c.kick(3), c.kick(3), c.kick(3)]).toEqual(['Kick_Front', 'Kick_Push', 'Kick_Round', 'Kick_Low']);
    for (let i = 0; i < 10; i++) expect(c.punch(3, 2)).not.toBe('Punch_Uppercut');
  });
});
