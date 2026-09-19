/**
 * Room transitions (SPEC 11).
 *
 * "Moving between rooms preserves inventory. An item picked up in a previous
 * session stays gone from the room it came from."
 *
 * A `Journey` is what survives a room: what the player carries, and which items
 * each room has already given up. Rooms themselves stay immutable data — the
 * journey is the only thing that accumulates, which keeps a room's definition
 * reproducible and keeps the validator proving a room from a stated starting
 * inventory rather than from play history.
 */

import { initialState } from './level.js';
import type { GameState, LevelDefinition } from './types.js';

export interface Journey {
  /** Carried item ids, oldest first — the SPEC 12 order. */
  readonly carrying: readonly string[];
  /** Level id -> ids of items that room has already yielded. */
  readonly taken: Readonly<Record<string, readonly string[]>>;
  /** Rooms cleared so far, in order. */
  readonly cleared: readonly string[];
}

export function createJourney(): Journey {
  return { carrying: [], taken: {}, cleared: [] };
}

/**
 * The state the player enters a room in: the room's own layout, minus items it
 * has already given up, plus whatever they are still carrying.
 */
export function enterRoom(level: LevelDefinition, journey: Journey): GameState {
  const fresh = initialState(level);
  const alreadyTaken = new Set(journey.taken[level.id] ?? []);

  const ground: Record<string, { readonly x: number; readonly y: number }> = {};
  for (const [itemId, pos] of Object.entries(fresh.ground)) {
    // Gone for good, and gone whether it is carried now or was dropped in some
    // other room: this room does not re-spawn it (SPEC 11).
    if (alreadyTaken.has(itemId) || journey.carrying.includes(itemId)) continue;
    ground[itemId] = pos;
  }

  return { ...fresh, carrying: [...journey.carrying], ground };
}

/**
 * Fold the state the player left a room in back into the journey. Anything not
 * lying on that room's floor has been taken from it.
 */
export function leaveRoom(
  level: LevelDefinition,
  state: GameState,
  journey: Journey,
): Journey {
  const stillOnFloor = new Set(Object.keys(state.ground));
  const taken = level.items.map((item) => item.id).filter((id) => !stillOnFloor.has(id));

  const previous = journey.taken[level.id] ?? [];
  const merged = [...new Set([...previous, ...taken])].sort();

  return {
    carrying: [...state.carrying],
    taken: { ...journey.taken, [level.id]: merged },
    cleared: journey.cleared.includes(level.id)
      ? journey.cleared
      : [...journey.cleared, level.id],
  };
}
