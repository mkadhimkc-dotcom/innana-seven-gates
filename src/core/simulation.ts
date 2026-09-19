/**
 * The game loop, as a pure function of its inputs.
 *
 * Moves are queued, not applied on arrival, and each fixed step consumes at
 * most one. That is what makes "the same inputs always produce the same state"
 * true: the result depends on the sequence of moves and the number of steps,
 * never on how the host chopped up real time.
 *
 * Rules still live in `applyMove`. This module decides only *when* a move is
 * offered to the rules, never whether it is legal.
 */

import { advance, createClock, elapsedMs, type SimClock } from './clock.js';
import { initialState } from './level.js';
import { applyMove } from './state.js';
import { isGoal } from './board.js';
import type { GameState, LevelDefinition, Move } from './types.js';

export interface Simulation {
  readonly level: LevelDefinition;
  readonly state: GameState;
  readonly clock: SimClock;
  /** Moves waiting for a step, oldest first. */
  readonly pending: readonly Move[];
  /** Moves the rules refused, counted so the UI can react to a bounced input. */
  readonly refused: number;
  readonly finished: boolean;
}

export interface StepOutcome {
  readonly simulation: Simulation;
  /** Moves the rules accepted during this advance. */
  readonly applied: readonly Move[];
  /** Moves the rules refused during this advance. */
  readonly rejected: readonly Move[];
  /** True when this advance landed the player on the goal. */
  readonly reachedGoal: boolean;
}

export function createSimulation(
  level: LevelDefinition,
  options: { readonly state?: GameState; readonly stepMs?: number } = {},
): Simulation {
  const state = options.state ?? initialState(level);
  return {
    level,
    state,
    clock: options.stepMs === undefined ? createClock() : createClock(options.stepMs),
    pending: [],
    refused: 0,
    finished: isGoal(level, state),
  };
}

/** Queue a move. It is offered to the rules on the next fixed step. */
export function queueMove(simulation: Simulation, move: Move): Simulation {
  if (simulation.finished) return simulation;
  return { ...simulation, pending: [...simulation.pending, move] };
}

/**
 * Advance by real elapsed time. Each released step takes one queued move, so a
 * burst of taps drains at a fixed rate instead of resolving in a single frame.
 */
export function advanceSimulation(simulation: Simulation, dtMs: number): StepOutcome {
  const result = advance(simulation.clock, dtMs);

  let state = simulation.state;
  let pending = [...simulation.pending];
  let refused = simulation.refused;
  let finished = simulation.finished;

  const applied: Move[] = [];
  const rejected: Move[] = [];

  for (let step = 0; step < result.steps; step += 1) {
    if (finished) break;
    const move = pending.shift();
    if (move === undefined) break;

    const next = applyMove(simulation.level, state, move);
    if (next === null) {
      rejected.push(move);
      refused += 1;
      continue;
    }

    state = next;
    applied.push(move);
    if (isGoal(simulation.level, state)) finished = true;
  }

  return {
    simulation: { ...simulation, state, clock: result.clock, pending, refused, finished },
    applied,
    rejected,
    reachedGoal: finished && !simulation.finished,
  };
}

/** Simulated time since the run started — tick-derived, never wall time. */
export function simulationElapsedMs(simulation: Simulation): number {
  return elapsedMs(simulation.clock);
}
