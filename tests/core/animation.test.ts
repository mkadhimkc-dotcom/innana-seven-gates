import { describe, expect, it } from 'vitest';
import { animationFrame } from '../../src/core/animation.js';
import { advance, createClock, DEFAULT_STEP_MS } from '../../src/core/clock.js';

describe('two-frame animation (SPEC 12)', () => {
  it('starts on frame 0', () => {
    expect(animationFrame(0, 10)).toBe(0);
  });

  it('swaps frames every 125ms of simulated time', () => {
    // stepMs 10: 125ms is tick 12.5, so the flip lands on tick 13.
    expect(animationFrame(12, 10)).toBe(0);
    expect(animationFrame(13, 10)).toBe(1);
    expect(animationFrame(24, 10)).toBe(1);
    expect(animationFrame(25, 10)).toBe(0);
  });

  it('never shows a third frame', () => {
    for (let tick = 0; tick < 500; tick += 1) {
      expect([0, 1]).toContain(animationFrame(tick, 10));
    }
  });

  it('is a pure function of tick and step size, not of wall time', () => {
    expect(animationFrame(37, 10)).toBe(animationFrame(37, 10));
    expect(animationFrame(37, DEFAULT_STEP_MS)).toBe(animationFrame(37, DEFAULT_STEP_MS));
  });

  it('gives the same frame however the same simulated time was chopped up', () => {
    // Mirrors tests/core/clock.test.ts: different dt slicing, same tick count.
    const chopped = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3].reduce(
      (clock, dt) => advance(clock, dt).clock,
      createClock(10),
    );
    const whole = advance(createClock(10), 30).clock;

    expect(chopped.tick).toBe(whole.tick);
    expect(animationFrame(chopped.tick, chopped.stepMs)).toBe(animationFrame(whole.tick, whole.stepMs));
  });
});
