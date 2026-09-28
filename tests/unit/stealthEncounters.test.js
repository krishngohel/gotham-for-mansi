import { describe, it, expect, vi } from 'vitest';
import { createEncounters } from '../../src/game/encounters.js';
import { createEvents } from '../../src/core/events.js';
import { stealthFight } from '../../src/stealth/stealthRooms.js';
import { SITES } from '../../src/world/mapData.js';

function setup() {
  const events = createEvents();
  const spawned = [];
  const spawn = (type, p) => {
    const e = { type, pos: { ...p }, alive: true, aware: false, woke: 0, wake() { this.woke += 1; this.aware = true; } };
    spawned.push(e);
    return e;
  };
  const stealth = { begin: vi.fn(), end: vi.fn() };
  // groundBelow(x, from) = from - 3: every spawn lands where its wave entry says.
  const collision = { groundBelow: (x, y) => y - 3 };
  const enc = createEncounters({ spawn, despawn: () => {}, combat: { setEnemies() {} }, events, collision, stealth });
  return { enc, events, spawned, stealth };
}
const heroAt = (p) => ({ pos: { x: p.x, y: p.y, z: p.z } });

describe('stealth encounters', () => {
  it('spawn the squad at each route start height and hand it to the stealth runtime', () => {
    const { enc, spawned, stealth } = setup();
    const def = stealthFight('aceCatwalks');
    enc.begin('aceCatwalks', def);
    expect(spawned.map((e) => e.type)).toEqual(['rifle', 'rifle', 'rifle', 'rifle']);
    [7, 7, 0.15, 0.15].forEach((y, i) => expect(spawned[i].pos.y).toBeCloseTo(y, 6));
    expect(stealth.begin).toHaveBeenCalledWith(def, spawned);
  });
  it('entering the room starts the fight but wakes nobody', () => {
    const { enc, events, spawned } = setup();
    enc.begin('aceCatwalks', stealthFight('aceCatwalks'));
    const seen = [];
    events.on('fightStart', (d) => seen.push(d.id));
    enc.update(0.016, heroAt(SITES.aceCatwalks));
    expect(seen).toEqual(['aceCatwalks']);
    expect(spawned.every((e) => e.woke === 0)).toBe(true);
  });
  it('winning or ending the room ends the stealth runtime', () => {
    const { enc, events, spawned, stealth } = setup();
    enc.begin('monarchBalcony', stealthFight('monarchBalcony'));
    enc.update(0.016, heroAt(SITES.monarchBalcony));
    stealth.end.mockClear();
    const done = [];
    events.on('fightDone', (d) => done.push(d.id));
    for (const e of spawned) e.alive = false;
    enc.update(0.016, heroAt(SITES.monarchBalcony));
    expect(done).toEqual(['monarchBalcony']);
    expect(stealth.end).toHaveBeenCalled();
    enc.begin('monarchBalcony', stealthFight('monarchBalcony'));
    stealth.end.mockClear();
    enc.end();
    expect(stealth.end).toHaveBeenCalled();
  });
  it('a room goon taken down from outside the trigger radius still starts it, so the room can finish', () => {
    const { enc, events, spawned } = setup();
    enc.begin('monarchBalcony', stealthFight('monarchBalcony'));
    const done = [];
    events.on('fightDone', (d) => done.push(d.id));
    const far = { x: SITES.monarchBalcony.x, y: SITES.monarchBalcony.y + 10, z: SITES.monarchBalcony.z };
    spawned[0].alive = false;
    enc.update(0.016, heroAt(far));
    expect(enc.active).toBe(true);
    for (const e of spawned) e.alive = false;
    enc.update(0.016, heroAt(far));
    expect(done).toEqual(['monarchBalcony']);
  });
  it('story fights still wake everyone and never touch the stealth runtime', () => {
    const { enc, spawned, stealth } = setup();
    enc.begin('docksRoof');
    enc.update(0.016, heroAt(SITES.wh3Roof));
    expect(spawned.every((e) => e.woke === 1)).toBe(true);
    expect(stealth.begin).not.toHaveBeenCalled();
  });
});
