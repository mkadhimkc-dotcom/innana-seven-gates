/**
 * Reachable state graph (SPEC 18).
 *
 * Nodes are distinct (player position, inventory, block positions, ground
 * items, opened doors) tuples; edges are legal moves. Everything the validator
 * and the deadlock detector claim is derived from this graph.
 */

import { applyMove, candidateMoves, describeMove, encodeState } from '../state.js';
import { isGoal } from '../board.js';
import type { GameState, LevelDefinition, Move } from '../types.js';

export interface StateNode {
  readonly key: string;
  readonly state: GameState;
  /** Index of the node this one was first reached from, or null for the start. */
  readonly parent: number | null;
  /** The move that produced this node from its parent. */
  readonly viaMove: Move | null;
}

export interface StateGraph {
  readonly level: LevelDefinition;
  readonly nodes: readonly StateNode[];
  /** `successors[i]` holds the node indices reachable from node `i`. */
  readonly successors: readonly (readonly number[])[];
  /** `successorMoves[i][n]` is the move producing `successors[i][n]`. */
  readonly successorMoves: readonly (readonly Move[])[];
  readonly goals: readonly number[];
  /** True when a budget stopped exploration before the graph was complete. */
  readonly truncated: boolean;
  readonly truncationReason: string | null;
  readonly elapsedMs: number;
}

export interface GraphOptions {
  /** Explore from here instead of the level's initial state. */
  readonly start?: GameState;
  /** Hard cap on nodes, so a runaway level fails loudly instead of hanging. */
  readonly maxStates?: number;
  /** Wall-clock budget. SPEC 19 requires validation under a minute per level. */
  readonly timeBudgetMs?: number;
}

export const DEFAULT_MAX_STATES = 250_000;
export const DEFAULT_TIME_BUDGET_MS = 55_000;

export function buildStateGraph(
  level: LevelDefinition,
  start: GameState,
  options: GraphOptions = {},
): StateGraph {
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const startedAt = Date.now();

  const nodes: StateNode[] = [];
  const successors: number[][] = [];
  const successorMoves: Move[][] = [];
  const goals: number[] = [];
  const indexByKey = new Map<string, number>();

  const push = (state: GameState, parent: number | null, viaMove: Move | null): number => {
    const key = encodeState(state);
    const existing = indexByKey.get(key);
    if (existing !== undefined) return existing;
    const index = nodes.length;
    nodes.push({ key, state, parent, viaMove });
    successors.push([]);
    successorMoves.push([]);
    indexByKey.set(key, index);
    if (isGoal(level, state)) goals.push(index);
    return index;
  };

  push(start, null, null);

  let truncated = false;
  let truncationReason: string | null = null;

  for (let cursor = 0; cursor < nodes.length; cursor += 1) {
    if (nodes.length > maxStates) {
      truncated = true;
      truncationReason = `state cap of ${maxStates} exceeded`;
      break;
    }
    if (Date.now() - startedAt > timeBudgetMs) {
      truncated = true;
      truncationReason = `time budget of ${timeBudgetMs}ms exceeded`;
      break;
    }

    const node = nodes[cursor];
    if (!node) break;

    for (const move of candidateMoves(node.state)) {
      const next = applyMove(level, node.state, move);
      if (next === null) continue;
      const nextIndex = push(next, cursor, move);
      if (nextIndex === cursor) continue;
      successors[cursor]?.push(nextIndex);
      successorMoves[cursor]?.push(move);
    }
  }

  return {
    level,
    nodes,
    successors,
    successorMoves,
    goals,
    truncated,
    truncationReason,
    elapsedMs: Date.now() - startedAt,
  };
}

/**
 * Reverse breadth-first search from every goal node. `result[i]` is true when
 * node `i` still has a path to the exit — the property SPEC 8 requires of every
 * reachable state.
 */
export function computeCanReachGoal(graph: StateGraph): boolean[] {
  const canReach = new Array<boolean>(graph.nodes.length).fill(false);
  const predecessors: number[][] = graph.nodes.map(() => []);

  graph.successors.forEach((targets, from) => {
    for (const to of targets) {
      predecessors[to]?.push(from);
    }
  });

  const queue: number[] = [];
  for (const goal of graph.goals) {
    if (!canReach[goal]) {
      canReach[goal] = true;
      queue.push(goal);
    }
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor];
    if (node === undefined) continue;
    for (const previous of predecessors[node] ?? []) {
      if (!canReach[previous]) {
        canReach[previous] = true;
        queue.push(previous);
      }
    }
  }

  return canReach;
}

/** The shortest known move sequence from the start node to `index`. */
export function reproPath(graph: StateGraph, index: number): string[] {
  const steps: string[] = [];
  let cursor: number | null = index;
  let guard = 0;

  while (cursor !== null && guard < graph.nodes.length + 1) {
    const node: StateNode | undefined = graph.nodes[cursor];
    if (!node || node.viaMove === null) break;
    steps.push(describeMove(node.viaMove));
    cursor = node.parent;
    guard += 1;
  }

  return steps.reverse();
}

/**
 * A short, stable id for a repro sequence. SPEC 18 asks the report to name a
 * seed the author can replay; feeding this back through `npm run validate --
 * --seed` reproduces the exact state.
 */
export function reproSeed(steps: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const char of steps.join('>')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
