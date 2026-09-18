/**
 * Checkpoint safety (SPEC 10). A checkpoint is written only when the exit is
 * still reachable from that state, so a load can never strand the player.
 */

import {
  buildStateGraph,
  computeCanReachGoal,
  type GameState,
  type LevelDefinition,
} from '../core/index.js';

export interface CheckpointDecision {
  readonly safe: boolean;
  readonly reason: string;
  readonly statesExplored: number;
}

/**
 * Cheap runtime check: search forward from the candidate state for any goal.
 * Bounded so a mid-level check never stalls a frame budget; an inconclusive
 * search is treated as unsafe, which costs the player a checkpoint rather than
 * risking a soft-lock.
 */
export function isSafeCheckpoint(
  level: LevelDefinition,
  state: GameState,
  options: { readonly maxStates?: number; readonly timeBudgetMs?: number } = {},
): CheckpointDecision {
  const graph = buildStateGraph(level, state, {
    maxStates: options.maxStates ?? 20_000,
    timeBudgetMs: options.timeBudgetMs ?? 250,
  });

  if (graph.goals.length === 0) {
    return {
      safe: false,
      reason: graph.truncated
        ? 'search budget exhausted before finding the exit'
        : 'no path to the exit from this state',
      statesExplored: graph.nodes.length,
    };
  }

  const canReach = computeCanReachGoal(graph);
  return {
    safe: canReach[0] === true,
    reason: canReach[0] === true ? 'exit reachable' : 'player is trapped',
    statesExplored: graph.nodes.length,
  };
}
