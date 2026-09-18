/**
 * Block push rules (SPEC 13). Blocks are 1x1, pushed only (never pulled), stop
 * at walls, sink irreversibly in water and lava, and refuse to enter spikes.
 */

import {
  DIRECTIONS,
  comparePositions,
  translate,
  positionsEqual,
  type Direction,
  type GameState,
  type LevelDefinition,
  type Position,
} from './types.js';
import { tileAt, blockAt, closedDoorAt, groundItemAt } from './board.js';

export type PushOutcome =
  /** The push is illegal; the whole move is refused. */
  | { readonly kind: 'blocked'; readonly reason: string }
  /** The block slides one tile. */
  | { readonly kind: 'moved'; readonly to: Position }
  /** The block sinks into water or lava and is gone for good (SPEC 13). */
  | { readonly kind: 'consumed'; readonly at: Position };

/** Resolve what happens when the player pushes the block at `blockPos`. */
export function resolvePush(
  level: LevelDefinition,
  state: GameState,
  blockPos: Position,
  direction: Direction,
): PushOutcome {
  const destination = translate(blockPos, direction);
  const tile = tileAt(level, destination);

  if (tile === undefined) return { kind: 'blocked', reason: 'block would leave the grid' };
  if (tile === 'wall') return { kind: 'blocked', reason: 'block stops at a wall' };
  if (tile === 'spike') return { kind: 'blocked', reason: 'blocks stop before spikes' };
  if (blockAt(state, destination)) return { kind: 'blocked', reason: 'another block is in the way' };
  if (closedDoorAt(level, state, destination)) {
    return { kind: 'blocked', reason: 'a locked door is in the way' };
  }
  if (groundItemAt(state, destination) !== null) {
    return { kind: 'blocked', reason: 'a block may not be pushed on top of an item' };
  }
  if (tile === 'water' || tile === 'lava') {
    return { kind: 'consumed', at: destination };
  }
  return { kind: 'moved', to: destination };
}

/** Apply a resolved push to the block set, keeping it sorted. */
export function applyPush(
  blocks: readonly Position[],
  from: Position,
  outcome: PushOutcome,
): readonly Position[] {
  const remaining = blocks.filter((block) => !positionsEqual(block, from));
  if (outcome.kind === 'moved') {
    return [...remaining, outcome.to].sort(comparePositions);
  }
  return remaining;
}

/**
 * Could the player ever stand on `pos` in order to push from it? A locked door
 * counts as standable: the player may be holding the key. Deliberately local —
 * it asks whether the tile is stand-on-able at all, not whether the player can
 * currently walk there.
 */
function couldStandOn(level: LevelDefinition, state: GameState, pos: Position): boolean {
  const tile = tileAt(level, pos);
  if (tile !== 'floor' && tile !== 'goal') return closedDoorAt(level, state, pos) !== null;
  return !blockAt(state, pos);
}

/**
 * True when the block at `blockPos` can never be pushed again: every direction
 * is either refused outright or has no tile the player could push from. This is
 * the "cornered" half of SPEC 19's irreversible-push check.
 *
 * Deliberately conservative and local. The authority on solvability is the
 * reachability proof (SPEC 18); this exists to name *which* push killed a
 * level, not to decide whether it died.
 */
export function isBlockStuck(
  level: LevelDefinition,
  state: GameState,
  blockPos: Position,
): boolean {
  return DIRECTIONS.every((direction) => {
    if (resolvePush(level, state, blockPos, direction).kind === 'blocked') return true;
    const pushFrom = translate(blockPos, opposite(direction));
    return !couldStandOn(level, state, pushFrom);
  });
}

function opposite(direction: Direction): Direction {
  switch (direction) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}
