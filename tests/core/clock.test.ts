import { describe, expect, it } from 'vitest';
import {
  advance,
  createClock,
  elapsedMs,
  DEFAULT_STEP_MS,
  MAX_STEPS_PER_ADVANCE,
} from '../../src/core/clock.js';

describe('fixed-timestep clock', () => {
  it('releases no step until a whole step of time has passed', () => {
    const clock = createClock(10);
    const result = advance(clock, 9);
    expect(result.steps).toBe(0);
    expect(result.clock.accumulatorMs).toBe(9);
  });

  it('releases whole steps and keeps the remainder', () => {
    const result = advance(createClock(10), 25);
    expect(result.steps).toBe(2);
    expect(result.clock.accumulatorMs).toBe(5);
    expect(result.clock.tick).toBe(2);
  });

  it('gives the same total steps however the time is chopped up', () => {
    const chopped = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3].reduce(
      (acc, dt) => {
        const result = advance(acc.clock, dt);
        return { clock: result.clock, steps: acc.steps + result.steps };
      },
      { clock: createClock(10), steps: 0 },
    );
    const whole = advance(createClock(10), 30);

    expect(chopped.steps).toBe(3);
    expect(whole.steps).toBe(3);
    expect(chopped.clock.tick).toBe(whole.clock.tick);
  });

  it('caps a long stall instead of trying to catch up in one frame', () => {
    const result = advance(createClock(10), 10_000);
    expect(result.steps).toBe(MAX_STEPS_PER_ADVANCE);
    expect(result.clamped).toBe(true);
    // Surplus dropped, so the next frame does not inherit a debt.
    expect(result.clock.accumulatorMs).toBe(0);
  });

  it.each([0, -16, Number.NaN, Number.POSITIVE_INFINITY])(
    'ignores a dt of %s rather than rewinding',
    (dt) => {
      const clock = createClock(10);
      const result = advance(clock, dt);
      expect(result.steps).toBe(0);
      expect(result.clock).toEqual(clock);
    },
  );

  it('derives elapsed time from ticks, not wall time', () => {
    const result = advance(createClock(10), 35);
    expect(elapsedMs(result.clock)).toBe(30);
  });

  it('defaults to 60 steps a second', () => {
    expect(createClock().stepMs).toBeCloseTo(DEFAULT_STEP_MS);
    expect(advance(createClock(), 1000).steps).toBe(MAX_STEPS_PER_ADVANCE);
  });

  it('refuses a non-positive step size', () => {
    expect(() => createClock(0)).toThrow(RangeError);
    expect(() => createClock(-1)).toThrow(RangeError);
  });
});
