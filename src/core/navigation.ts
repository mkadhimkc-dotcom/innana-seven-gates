/**
 * Grid navigation helpers.
 *
 * Engine-free, like everything under `src/core/`. A tap on a phone screen has
 * to become a direction, and that decision is a rule about the tile grid — so
 * it lives here, where the validator can see the same code the game runs.
 */

import { DIRECTION_VECTORS, positionsEqual, type Direction, type Position } from './types.js';

/**
 * The single step that moves `from` closer to `to`, or null when they are the
 * same tile.
 *
 * Dominant axis wins, so a tap anywhere in the room yields one predictable
 * step rather than a diagonal the grid cannot express. Ties break horizontally:
 * the room is wider than it is tall at phone size, so a horizontal read matches
 * what the thumb meant more often than a vertical one.
 */
export function directionToward(from: Position, to: Position): Direction | null {
  if (positionsEqual(from, to)) return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

/** Chebyshev distance — how many taps away a tile is, at worst. */
export function tileDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Is `b` orthogonally adjacent to `a`? */
export function isAdjacent(a: Position, b: Position): boolean {
  return Object.values(DIRECTION_VECTORS).some(
    (delta) => a.x + delta.x === b.x && a.y + delta.y === b.y,
  );
}
