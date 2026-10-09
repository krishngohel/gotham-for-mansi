// tests/unit/moveSelect.test.js
import { describe, it, expect } from 'vitest';
import { classifyDir, selectMove, MOVE_TABLE } from '../../src/combat/moveSelect.js';

const v = (x, z) => ({ x, z });
const all = () => true;
const sel = (o) => selectMove({ action: 'kick', dir: 'none', sprint: false, air: false, airFromSprint: false, targetDown: false, has: all, ...o });

describe('classifyDir', () => {
  it('no input is none', () => expect(classifyDir(v(0.05, 0.05), v(0, 1))).toBe('none'));
  it('splits toward, away and the sides (target straight ahead, +z)', () => {
    expect(classifyDir(v(0.2, 1), v(0, 1))).toBe('toward');
    expect(classifyDir(v(0, -1), v(0, 1))).toBe('away');
    expect(classifyDir(v(-1, 0), v(0, 1))).toBe('right'); // facing +z, right is -x
    expect(classifyDir(v(1, 0), v(0, 1))).toBe('left');
  });
  it('edges: 45 degrees is toward, 140 is away, 90 is a side', () => {
    expect(classifyDir(v(1, 1), v(0, 1))).toBe('toward');
    expect(classifyDir(v(Math.sin(2.44), Math.cos(2.44)), v(0, 1))).toBe('away');
    expect(classifyDir(v(1, 0.01), v(0, 1))).toBe('left');
  });
});

describe('selectMove', () => {
  it('plain presses fall through to the rotation', () => {
    expect(sel({ action: 'punch' })).toBeNull();
    expect(sel({ dir: 'toward' })).toBeNull();
  });
  it('every table row is reachable', () => {
    expect(sel({ targetDown: true }).id).toBe('stomp');
    expect(sel({ air: true, airFromSprint: true }).id).toBe('hurricane');
    expect(sel({ action: 'punch', air: true, airFromSprint: true }).id).toBe('leapSmash');
    expect(sel({ air: true, dir: 'away' }).id).toBe('backflipKick');
    expect(sel({ air: true }).id).toBe('airAxe');
    expect(sel({ action: 'punch', air: true })).toBeNull(); // the hammer drop stays
    expect(sel({ sprint: true }).id).toBe('flyingKnee');
    expect(sel({ action: 'punch', sprint: true }).id).toBe('runUppercut');
    expect(sel({ dir: 'away' }).id).toBe('spinBackKick');
    expect(sel({ action: 'punch', dir: 'away' }).id).toBe('spinBackfist');
    expect(sel({ dir: 'left' }).clip).toBe('Kick_SideRound_L');
    expect(sel({ dir: 'right' }).clip).toBe('Kick_SideRound');
    expect(sel({ action: 'punch', dir: 'left' }).clip).toBe('Punch_SideHook_L');
    expect(sel({ action: 'punch', dir: 'right' }).clip).toBe('Punch_SideHook');
  });
  it('a downed goon wins over everything; punching him keeps the hammer', () => {
    expect(sel({ targetDown: true, sprint: true, dir: 'away' }).id).toBe('stomp');
    expect(sel({ action: 'punch', targetDown: true })).toBeNull();
  });
  it('a move whose clip the build lacks falls through', () => {
    expect(sel({ dir: 'away', has: (c) => c !== 'Kick_SpinBack' })).toBeNull();
  });
  it('air moves are flagged, ground moves are not', () => {
    expect(sel({ air: true }).air).toBe(true);
    expect(sel({ sprint: true }).air).toBe(false);
  });
  it('every row has a name and input text without dashes', () => {
    const dash = new RegExp(String.fromCharCode(0x2014) + '|' + String.fromCharCode(0x2013));
    for (const m of MOVE_TABLE) { expect(m.name).toBeTruthy(); expect(m.input).toBeTruthy(); expect(dash.test(m.name + m.input)).toBe(false); }
  });
});
