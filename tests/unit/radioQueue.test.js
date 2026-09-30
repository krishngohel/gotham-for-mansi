import { describe, it, expect, vi } from 'vitest';
import { createRadioQueue, typeDuration, holdDuration } from '../../src/ui/radioQueue.js';

const line = (text, speaker = 'gordon') => ({ speaker, text, portrait: speaker });

describe('radio queue', () => {
  it('starts empty and idle', () => {
    const q = createRadioQueue();
    expect(q.active).toBe(false);
    expect(q.current).toBe(null);
    expect(q.revealed).toBe('');
    expect(q.typing).toBe(false);
  });

  it('types a line out one character at a time as it ticks', () => {
    const q = createRadioQueue();
    q.say([line('Hello there')]);
    expect(q.current.text).toBe('Hello there');
    expect(q.typing).toBe(true);
    q.tick(0.1);
    expect(q.revealed.length).toBeGreaterThan(0);
    expect(q.revealed).toBe('Hello there'.slice(0, q.revealed.length));
    q.tick(typeDuration('Hello there'));
    expect(q.revealed).toBe('Hello there');
    expect(q.typing).toBe(false);
  });

  it('holds a finished line before auto-advancing to the next', () => {
    const q = createRadioQueue();
    q.say([line('One'), line('Two')]);
    q.tick(typeDuration('One') + 0.001);
    expect(q.revealed).toBe('One');
    expect(q.current.text).toBe('One'); // still holding
    q.tick(holdDuration('One'));
    expect(q.current.text).toBe('Two');
  });

  it('resolves its promise once the whole beat has played out', async () => {
    const q = createRadioQueue();
    const done = vi.fn();
    q.say([line('Hi')]).then(done);
    q.tick(typeDuration('Hi') + holdDuration('Hi') + 0.01);
    await Promise.resolve();
    expect(done).toHaveBeenCalled();
    expect(q.active).toBe(false);
  });

  it('advance() finishes the typewriter early, then moves on next call', () => {
    const q = createRadioQueue();
    q.say([line('A longer line of dialogue'), line('Second')]);
    q.advance();
    expect(q.revealed).toBe('A longer line of dialogue');
    expect(q.typing).toBe(false);
    q.advance();
    expect(q.current.text).toBe('Second');
  });

  it('advancing past the last line resolves the promise', async () => {
    const q = createRadioQueue();
    const done = vi.fn();
    q.say([line('Only one')]).then(done);
    q.advance(); // finish typing
    q.advance(); // move past it
    await Promise.resolve();
    expect(done).toHaveBeenCalled();
    expect(q.active).toBe(false);
  });

  it('a second say() while one is playing extends the same beat', async () => {
    const q = createRadioQueue();
    const done = vi.fn();
    q.say([line('First')]).then(done);
    q.say([line('Second')]);
    q.advance(); q.advance(); // finish and pass "First"
    expect(done).not.toHaveBeenCalled();
    expect(q.current.text).toBe('Second');
    q.advance(); q.advance();
    await Promise.resolve();
    expect(done).toHaveBeenCalled();
  });

  it('skipAll() drops everything queued and still resolves', async () => {
    const q = createRadioQueue();
    const done = vi.fn();
    q.say([line('a'), line('b'), line('c')]).then(done);
    q.skipAll();
    await Promise.resolve();
    expect(done).toHaveBeenCalled();
    expect(q.active).toBe(false);
    expect(q.pending).toBe(0);
  });

  it('tick() on an empty queue is a harmless no-op', () => {
    const q = createRadioQueue();
    expect(() => q.tick(1)).not.toThrow();
    expect(q.active).toBe(false);
  });
});
