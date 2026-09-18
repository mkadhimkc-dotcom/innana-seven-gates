/**
 * Block-specific deadlock detection (SPEC 19), for levels with blocks
 * (Gates III+).
 *
 * The reachability proof already answers "is any reachable state dead?". This
 * pass answers the follow-up a level author actually needs: *which push* made
 * it dead. It walks every edge that moves a block, flags the ones that are
 * irreversible — the block sank in water or lava, or it came to rest where no
 * push can ever move it again — and checks whether the exit is still reachable
 * afterwards.
 */

import { isBlockStuck } from '../blocks.js';
import { initialState } from '../level.js';
import { positionsEqual, type GameState, type LevelDefinition, type Position } from '../types.js';
import {
  buildStateGraph,
  computeCanReachGoal,
  reproPath,
  reproSeed,
  type GraphOptions,
  type StateGraph,
} from './graph.js';

export type IrreversibleKind = 'lost' | 'cornered';

export interface DeadlockFinding {
  readonly kind: IrreversibleKind;
  /** Where the block stood before the push. */
  readonly from: Position;
  /** Where it ended up, or null when it sank (SPEC 13). */
  readonly to: Position | null;
  readonly description: string;
  readonly repro: readonly string[];
  readonly seed: string;
}

export interface DeadlockReport {
  readonly levelId: string;
  readonly ok: boolean;
  readonly blockCount: number;
  readonly irreversiblePushes: number;
  readonly findings: readonly DeadlockFinding[];
  readonly statesExplored: number;
  readonly truncated: boolean;
  readonly elapsedMs: number;
}

export interface DeadlockOptions extends GraphOptions {
  readonly maxReported?: number;
}

function blockDelta(
  before: readonly Position[],
  after: readonly Position[],
): { from: Position; to: Position | null } | null {
  const vanished = before.filter((block) => !after.some((other) => positionsEqual(block, other)));
  const appeared = after.filter((block) => !before.some((other) => positionsEqual(block, other)));
  const from = vanished[0];
  if (vanished.length !== 1 || from === undefined) return null;
  if (appeared.length === 0) return { from, to: null };
  const to = appeared[0];
  if (appeared.length !== 1 || to === undefined) return null;
  return { from, to };
}

/** Run the detector against a prebuilt graph, reusing its exploration work. */
export function analyseGraphForDeadlocks(
  graph: StateGraph,
  options: { readonly maxReported?: number } = {},
): DeadlockReport {
  const maxReported = options.maxReported ?? 5;
  const level = graph.level;
  const canReach = computeCanReachGoal(graph);

  const findings: DeadlockFinding[] = [];
  let irreversiblePushes = 0;

  graph.successors.forEach((targets, from) => {
    const source = graph.nodes[from];
    if (!source) return;

    targets.forEach((to) => {
      const target = graph.nodes[to];
      if (!target) return;

      const delta = blockDelta(source.state.blocks, target.state.blocks);
      if (delta === null) return;

      let kind: IrreversibleKind | null = null;
      if (delta.to === null) {
        kind = 'lost';
      } else if (isBlockStuck(level, target.state, delta.to)) {
        kind = 'cornered';
      }
      if (kind === null) return;

      irreversiblePushes += 1;
      if (canReach[to]) return;
      if (findings.length >= maxReported) return;

      const repro = reproPath(graph, to);
      const where =
        delta.to === null
          ? `into a hazard at ${delta.from.x},${delta.from.y}`
          : `into ${delta.to.x},${delta.to.y} where it can no longer be pushed`;
      findings.push({
        kind,
        from: delta.from,
        to: delta.to,
        description: `Block pushed ${where}; the exit is unreachable afterwards.`,
        repro,
        seed: reproSeed(repro),
      });
    });
  });

  return {
    levelId: level.id,
    ok: findings.length === 0 && !graph.truncated,
    blockCount: level.blocks.length,
    irreversiblePushes,
    findings,
    statesExplored: graph.nodes.length,
    truncated: graph.truncated,
    elapsedMs: graph.elapsedMs,
  };
}

/** Build the graph and run the block deadlock detector over it. */
export function detectBlockDeadlocks(
  level: LevelDefinition,
  options: DeadlockOptions = {},
): DeadlockReport {
  const start: GameState = options.start ?? initialState(level);
  const graph = buildStateGraph(level, start, options);
  return analyseGraphForDeadlocks(graph, { maxReported: options.maxReported ?? 5 });
}
