/**
 * What a tap on the board means.
 *
 * Kept as a pure function so it can be tested without a browser, and so the
 * scene never decides anything: it converts a pixel to a tile, asks here what
 * the tap meant, and forwards the resulting intent.
 *
 * SPEC 27 describes a split-screen layout (left moves, right acts). This slice
 * uses direct tile tapping instead, which suits a tile puzzle better on a small
 * screen: you touch the thing you mean. The split layout, its size and opacity
 * options, and the left-handed mirror belong to card P-02 and are not built
 * here.
 */

import { directionToward } from '../core/navigation.js';
import type { Position } from '../core/types.js';
import type { Intent } from './intents.js';

/**
 * - Tapping the tile the player stands on means "act" — pick up what is here.
 * - Tapping any other tile means "take one step that way".
 * - Tapping outside the board means nothing.
 */
export function resolveTapIntent(player: Position, tapped: Position | null): Intent | null {
  if (tapped === null) return null;

  const direction = directionToward(player, tapped);
  if (direction === null) return { type: 'act' };
  return { type: 'move', direction };
}
