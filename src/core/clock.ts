/**
 * Fixed-timestep clock.
 *
 * Engine-free. The game must advance in steps of a fixed size regardless of
 * how the browser paces frames, so that the same inputs always produce the same
 * state — on a 60Hz phone, a 120Hz phone, or a CI runner dropping frames under
 * load. Variable-dt simulation would make the timers in SPEC 16 drift with
 * frame rate and make a replay un-reproducible.
 */

/** 60 steps a second, the rate SPEC 31 targets on mid-range phones. */
export const DEFAULT_STEP_MS = 1000 / 60;

/**
 * Cap on steps consumed per advance. Without it, a long stall (a backgrounded
 * tab, a slow first paint) hands back a huge dt and the simulation tries to
 * catch up in one frame, stalling further — the classic spiral of death. Past
 * the cap the surplus is dropped: the clock falls behind wall time rather than
 * freezing the game.
 */
export const MAX_STEPS_PER_ADVANCE = 5;

export interface SimClock {
  readonly stepMs: number;
  /** Unconsumed real time, always less than one step after an advance. */
  readonly accumulatorMs: number;
  /** Steps taken since the clock was created. The simulation's own time base. */
  readonly tick: number;
}

export interface AdvanceResult {
  readonly clock: SimClock;
  /** How many fixed steps this advance releases. */
  readonly steps: number;
  /** True when the cap discarded surplus time. */
  readonly clamped: boolean;
}

export function createClock(stepMs: number = DEFAULT_STEP_MS): SimClock {
  if (!(stepMs > 0)) throw new RangeError('stepMs must be greater than zero');
  return { stepMs, accumulatorMs: 0, tick: 0 };
}

/**
 * Feed real elapsed time in; get back whole fixed steps. A negative or
 * non-finite dt is ignored rather than rewinding the clock — a backwards
 * timestamp is a platform bug, not a gameplay event.
 */
export function advance(clock: SimClock, dtMs: number): AdvanceResult {
  if (!Number.isFinite(dtMs) || dtMs <= 0) {
    return { clock, steps: 0, clamped: false };
  }

  const pooled = clock.accumulatorMs + dtMs;
  const available = Math.floor(pooled / clock.stepMs);
  const steps = Math.min(available, MAX_STEPS_PER_ADVANCE);
  const clamped = available > steps;

  return {
    clock: {
      stepMs: clock.stepMs,
      // On a clamp the surplus is dropped, so the accumulator never carries a
      // debt the next frame would have to repay all at once.
      accumulatorMs: clamped ? 0 : pooled - steps * clock.stepMs,
      tick: clock.tick + steps,
    },
    steps,
    clamped,
  };
}

/** Simulated time elapsed, derived from ticks rather than from wall time. */
export function elapsedMs(clock: SimClock): number {
  return clock.tick * clock.stepMs;
}
