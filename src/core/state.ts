/**
 * The single source of movement truth.
 *
 * `applyMove` is called by the Phaser scenes during play and by the validator
 * while it explores the state graph. Nothing else is allowed to decide whether
 * a move is legal — that is what keeps the deadlock-free proof honest
 * (docs/adr/ADR-001-architecture.md).
 *
 * Documented rule readings, where SPEC leaves room:
 * - Water, lava and spikes are impassable for the player. The player cannot
 *   step into a hazard at all, so there are no death states to recover from;
 *   hazards constrain routing and swallow blocks (SPEC 13).
 * - At most one ground item per tile, and a block may not be pushed onto an
 *   item. Otherwise an item could be buried permanently, which is exactly the
 *   kind of hidden dead state SPEC 8 forbids.
 * - `drop` names the item to drop, rather than always dropping the oldest. The
 *   3-item cap in SPEC 12 still displaces the oldest on an over-full pickup.
 */

import { applyPush, resolvePush } from './blocks.js';
import { blockAt, closedDoorAt, groundItemAt, hasMatchingKey, tileAt } from './board.js';
import { addItem, removeItem } from './inventory.js';
import {
  DIRECTIONS,
  comparePositions,
  translate,
  type GameState,
  type LevelDefinition,
  type Move,
  type Position,
} from './types.js';

/** Every move the rules can express, legal or not, for graph expansion. */
export function candidateMoves(state: GameState): Move[] {
  const moves: Move[] = DIRECTIONS.map((direction) => ({ type: 'move', direction }) as const);
  moves.push({ type: 'pickup' });
  for (const itemId of state.carrying) {
    moves.push({ type: 'drop', itemId });
  }
  return moves;
}

/** True when the player may stand on this tile. */
function playerCanEnter(level: LevelDefinition, pos: Position): boolean {
  const tile = tileAt(level, pos);
  return tile === 'floor' || tile === 'goal';
}

function applyDirectionalMove(
  level: LevelDefinition,
  state: GameState,
  move: Move & { type: 'move' },
): GameState | null {
  const target = translate(state.player, move.direction);
  if (tileAt(level, target) === undefined) return null;

  const door = closedDoorAt(level, state, target);
  if (door) {
    if (!hasMatchingKey(level, state, door)) return null;
    if (blockAt(state, target)) return null;
    if (!playerCanEnter(level, target)) return null;
    return { ...state, player: target, openDoors: [...state.openDoors, door.id].sort() };
  }

  if (blockAt(state, target)) {
    const outcome = resolvePush(level, state, target, move.direction);
    if (outcome.kind === 'blocked') return null;
    if (!playerCanEnter(level, target)) return null;
    return { ...state, player: target, blocks: applyPush(state.blocks, target, outcome) };
  }

  if (!playerCanEnter(level, target)) return null;
  return { ...state, player: target };
}

function applyPickup(state: GameState): GameState | null {
  const itemId = groundItemAt(state, state.player);
  if (itemId === null) return null;

  const { carrying, displaced } = addItem(state.carrying, itemId);
  const ground: Record<string, Position> = { ...state.ground };
  delete ground[itemId];
  // SPEC 12: the displaced item lands at the player's feet, on the tile the
  // picked-up item just vacated.
  if (displaced !== null) ground[displaced] = state.player;

  return { ...state, carrying, ground };
}

function applyDrop(state: GameState, itemId: string): GameState | null {
  if (!state.carrying.includes(itemId)) return null;
  if (groundItemAt(state, state.player) !== null) return null;
  return {
    ...state,
    carrying: removeItem(state.carrying, itemId),
    ground: { ...state.ground, [itemId]: state.player },
  };
}

/** Apply a move, or return null when the rules refuse it. */
export function applyMove(
  level: LevelDefinition,
  state: GameState,
  move: Move,
): GameState | null {
  switch (move.type) {
    case 'move':
      return applyDirectionalMove(level, state, move);
    case 'pickup':
      return applyPickup(state);
    case 'drop':
      return applyDrop(state, move.itemId);
  }
}

/**
 * A stable, compact key. Two states with the same key are interchangeable, so
 * the validator can treat them as one node (SPEC 18).
 */
export function encodeState(state: GameState): string {
  const blocks = [...state.blocks]
    .sort(comparePositions)
    .map((block) => `${block.x},${block.y}`)
    .join(';');
  const ground = Object.entries(state.ground)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([itemId, pos]) => `${itemId}@${pos.x},${pos.y}`)
    .join(';');
  const doors = [...state.openDoors].sort().join(';');
  return `${state.player.x},${state.player.y}|${blocks}|${state.carrying.join(';')}|${ground}|${doors}`;
}

/** Human-readable form of a move, for validator reports and repro steps. */
export function describeMove(move: Move): string {
  switch (move.type) {
    case 'move':
      return move.direction;
    case 'pickup':
      return 'pickup';
    case 'drop':
      return `drop:${move.itemId}`;
  }
}

/**
 * Inverse of `describeMove`. Turns an action token from a level's `routes` or
 * `criticalPath` (SPEC 9, 52 Q25) back into a `Move`, so the loader can replay
 * a level's declared solution through the same `applyMove` the game and the
 * validator use. Throws on a token that isn't one of the forms `describeMove`
 * produces; the JSON schema's `action` pattern is expected to have already
 * ruled out anything else.
 */
export function parseAction(token: string): Move {
  if (token === 'pickup') return { type: 'pickup' };
  if (token.startsWith('drop:')) return { type: 'drop', itemId: token.slice('drop:'.length) };
  if (token === 'up' || token === 'down' || token === 'left' || token === 'right') {
    return { type: 'move', direction: token };
  }
  throw new Error(`unknown action token "${token}"`);
}
