/**
 * Solvability proof (SPEC 18): from every reachable state there exists a path
 * to the exit. A level that cannot prove this does not ship.
 */

import { initialState } from '../level.js';
import { encodeState } from '../state.js';
import {
  buildStateGraph,
  computeCanReachGoal,
  reproPath,
  reproSeed,
  type GraphOptions,
  type StateGraph,
} from './graph.js';
import type { GameState, LevelDefinition } from '../types.js';

export interface DeadState {
  /** The encoded state, as `encodeState` produces it. */
  readonly state: string;
  readonly player: { readonly x: number; readonly y: number };
  readonly carrying: readonly string[];
  /** Moves from the level start that reproduce this state. */
  readonly repro: readonly string[];
  readonly seed: string;
}

export interface ReachabilityReport {
  readonly levelId: string;
  readonly ok: boolean;
  readonly statesExplored: number;
  readonly goalStatesFound: number;
  readonly deadStates: readonly DeadState[];
  readonly deadStateCount: number;
  readonly truncated: boolean;
  readonly truncationReason: string | null;
  readonly elapsedMs: number;
}

export interface ReachabilityOptions extends GraphOptions {
  /** How many dead states to include in the report. */
  readonly maxReported?: number;
}

/** Run the proof against a prebuilt graph, so callers can share the work. */
export function analyseGraph(
  graph: StateGraph,
  options: { readonly maxReported?: number } = {},
): ReachabilityReport {
  const maxReported = options.maxReported ?? 5;
  const canReach = computeCanReachGoal(graph);

  const dead: DeadState[] = [];
  let deadStateCount = 0;

  graph.nodes.forEach((node, index) => {
    if (canReach[index]) return;
    deadStateCount += 1;
    if (dead.length >= maxReported) return;
    const repro = reproPath(graph, index);
    dead.push({
      state: node.key,
      player: node.state.player,
      carrying: node.state.carrying,
      repro,
      seed: reproSeed(repro),
    });
  });

  return {
    levelId: graph.level.id,
    ok: deadStateCount === 0 && graph.goals.length > 0 && !graph.truncated,
    statesExplored: graph.nodes.length,
    goalStatesFound: graph.goals.length,
    deadStates: dead,
    deadStateCount,
    truncated: graph.truncated,
    truncationReason: graph.truncationReason,
    elapsedMs: graph.elapsedMs,
  };
}

/** Build the graph and prove the level solvable from every reachable state. */
export function proveSolvable(
  level: LevelDefinition,
  options: ReachabilityOptions = {},
): ReachabilityReport {
  const start: GameState = options.start ?? initialState(level);
  const graph = buildStateGraph(level, start, options);
  return analyseGraph(graph, { maxReported: options.maxReported ?? 5 });
}

/** Convenience for reports and logs. */
export function describeState(state: GameState): string {
  return encodeState(state);
}
