/** Read-only queries over a level grid and a game state. */

import { positionsEqual, type DoorDefinition, type GameState, type LevelDefinition, type Position, type Tile } from './types.js';

export function inBounds(level: LevelDefinition, pos: Position): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < level.width && pos.y < level.height;
}

/** The tile at `pos`, or undefined when `pos` is off the grid. */
export function tileAt(level: LevelDefinition, pos: Position): Tile | undefined {
  return level.tiles[pos.y]?.[pos.x];
}

export function blockAt(state: GameState, pos: Position): boolean {
  return state.blocks.some((block) => positionsEqual(block, pos));
}

export function doorAt(level: LevelDefinition, pos: Position): DoorDefinition | undefined {
  return level.doors.find((door) => positionsEqual(door.at, pos));
}

/** A door that is present and still locked. Doors stay open once opened (SPEC 14). */
export function closedDoorAt(
  level: LevelDefinition,
  state: GameState,
  pos: Position,
): DoorDefinition | null {
  const door = doorAt(level, pos);
  if (!door || state.openDoors.includes(door.id)) return null;
  return door;
}

/** The id of the item lying on `pos`, or null. At most one item per tile. */
export function groundItemAt(state: GameState, pos: Position): string | null {
  for (const [itemId, itemPos] of Object.entries(state.ground)) {
    if (positionsEqual(itemPos, pos)) return itemId;
  }
  return null;
}

/** Does the player carry a key matching this door's colour (SPEC 14)? */
export function hasMatchingKey(
  level: LevelDefinition,
  state: GameState,
  door: DoorDefinition,
): boolean {
  return state.carrying.some((itemId) => {
    const item = level.items.find((candidate) => candidate.id === itemId);
    return item?.kind === 'key' && item.color === door.color;
  });
}

/** The player has reached the exit (SPEC 9). */
export function isGoal(level: LevelDefinition, state: GameState): boolean {
  return tileAt(level, state.player) === 'goal';
}
