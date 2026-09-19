/**
 * Where the room sits on screen.
 *
 * Pure arithmetic — no Phaser, no rules. It exists so the scene never invents
 * its own coordinate maths and so tapping can be tested without a browser.
 */

import type { LevelDefinition, Position } from '../core/index.js';

export interface BoardLayout {
  readonly tileSize: number;
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/** Title bar above the room, HUD below it, margin around it. */
const MARGIN = 16;
const TITLE_HEIGHT = 46;
const HUD_HEIGHT = 64;

/**
 * Fit the whole room in the viewport and centre it. The camera is fixed per
 * room (SPEC 30), so "fit" is the whole camera story for a single-room level.
 */
export function computeLayout(level: LevelDefinition, viewport: ViewportSize): BoardLayout {
  const usableWidth = Math.max(1, viewport.width - MARGIN * 2);
  const usableHeight = Math.max(1, viewport.height - MARGIN * 2 - TITLE_HEIGHT - HUD_HEIGHT);

  const tileSize = Math.max(
    1,
    Math.floor(Math.min(usableWidth / level.width, usableHeight / level.height)),
  );

  const width = tileSize * level.width;
  const height = tileSize * level.height;

  return {
    tileSize,
    originX: Math.round((viewport.width - width) / 2),
    originY: TITLE_HEIGHT + Math.round((viewport.height - TITLE_HEIGHT - HUD_HEIGHT - height) / 2),
    width,
    height,
  };
}

/** Top-left pixel of a tile. */
export function tileOrigin(layout: BoardLayout, tile: Position): Position {
  return {
    x: layout.originX + tile.x * layout.tileSize,
    y: layout.originY + tile.y * layout.tileSize,
  };
}

/** Centre pixel of a tile. */
export function tileCenter(layout: BoardLayout, tile: Position): Position {
  const half = layout.tileSize / 2;
  const origin = tileOrigin(layout, tile);
  return { x: origin.x + half, y: origin.y + half };
}

/** The tile under a screen point, or null when the point misses the room. */
export function pointToTile(
  layout: BoardLayout,
  level: LevelDefinition,
  point: { readonly x: number; readonly y: number },
): Position | null {
  const x = Math.floor((point.x - layout.originX) / layout.tileSize);
  const y = Math.floor((point.y - layout.originY) / layout.tileSize);
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return null;
  return { x, y };
}
