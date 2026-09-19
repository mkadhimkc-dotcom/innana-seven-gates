/**
 * Two-frame animation, swapped at a fixed rate (SPEC 12: "Two-frame animation
 * at 8 fps. Every animated thing is two frames, swapped eight times a second.
 * Nothing has a third frame.").
 *
 * Engine-free, like the rest of `src/core/` (ADR-001). The frame is a pure
 * function of simulated ticks, never of wall-clock time, so it inherits the
 * fixed-timestep clock's determinism (`src/core/clock.ts`): the same tick
 * count always yields the same frame, on any device and at any frame rate.
 */

export const ANIMATION_FPS = 8;
const FRAME_DURATION_MS = 1000 / ANIMATION_FPS;

export type AnimationFrame = 0 | 1;

/**
 * Which of the two frames is showing after `tick` fixed steps of `stepMs`
 * each. Computed from simulated elapsed time (`tick * stepMs`), the same
 * quantity `elapsedMs` in `clock.ts` derives, rather than from wall time —
 * so two runs that reach the same tick always show the same frame, whatever
 * the browser's frame pacing did to get there.
 */
export function animationFrame(tick: number, stepMs: number): AnimationFrame {
  const elapsed = tick * stepMs;
  const cycle = Math.floor(elapsed / FRAME_DURATION_MS);
  return (cycle % 2) as AnimationFrame;
}
