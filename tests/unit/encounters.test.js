import { describe, it, expect } from 'vitest';
import { createEvents } from '../../src/core/events.js';
import { createEncounters } from '../../src/game/encounters.js';

function setup() {
  const events = createEvents();
  const made = [];
  const spawn = (type, p) => { const e = { type, pos: { ...p }, alive: true, aware: false, wake() { this.aware = true; } }; made.push(e); return e; };
  const combat = { list: [], setEnemies(l) { this.list = l; } };
  const enc = createEncounters({ spawn, despawn: () => {}, combat, events, collision: { groundBelow: () => 0 } });
  return { events, made, enc };
}
const def = { site: { x: 10, y: 0, z: 10 }, radius: 8, waves: [[{ type: 'grunt', dx: 1, dz: 0 }], [{ type: 'knife', dx: 0, dz: 1 }]] };

describe('encounters with inline fights', () => {
  it('places an inline fight at its site object and runs its waves', () => {
    const { events, made, enc } = setup();
    const seen = [];
    events.on('fightStart', ({ id }) => seen.push(['start', id]));
    events.on('fightDone', ({ id }) => seen.push(['done', id, enc.id]));
    enc.begin('crime:1', def);
    expect(made[0].pos).toEqual({ x: 11, y: 0, z: 10 });
    enc.update(0.1, { pos: { x: 100, y: 0, z: 100 } });
    expect(enc.active).toBe(false);
    enc.update(0.1, { pos: { x: 10, y: 0, z: 12 } });
    expect(seen).toEqual([['start', 'crime:1']]);
    made[0].alive = false;
    enc.update(1.5, { pos: { x: 10, y: 0, z: 12 } });
    enc.update(0.1, { pos: { x: 10, y: 0, z: 12 } });
    expect(made).toHaveLength(2);
    made[1].alive = false;
    enc.update(0.1, { pos: { x: 10, y: 0, z: 12 } });
    enc.update(0.1, { pos: { x: 10, y: 0, z: 12 } });
    expect(seen[1]).toEqual(['done', 'crime:1', null]);
    expect(enc.id).toBe(null);
  });
  it('restarts an inline fight with the same definition', () => {
    const { made, enc } = setup();
    enc.begin('challenge:bash', def);
    enc.restart();
    expect(made.map((e) => e.pos)).toEqual([{ x: 11, y: 0, z: 10 }, { x: 11, y: 0, z: 10 }]);
  });
  it('still runs story fights by id', () => {
    const { made, enc } = setup();
    enc.begin('docksRoof');
    expect(made[0].pos).toEqual({ x: -64, y: 0, z: 175 });
    expect(enc.id).toBe('docksRoof');
  });
});
