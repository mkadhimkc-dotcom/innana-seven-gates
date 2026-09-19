/**
 * The v2 tile grid (SPEC v2 §9, §12).
 *
 * This is deliberately smaller than a full level: no jewels, guardians, axe or
 * gate placement bookkeeping. Those are S-23, S-24 and S-25's state, and the
 * full level shape is F-05's schema. `PlatformGrid` is only the static tile
 * layer every one of those cards draws and walks on top of, so S-20's
 * rendering can exist before F-05 lands. F-05 is expected to grow this module
 * or fold it into the real level schema rather than replace it outright.
 */

import type { Position } from './types.js';

/** Tile kinds a v2 level's grid can contain (SPEC 9). */
export type PlatformTile = 'empty' | 'solid' | 'breakable' | 'ladder' | 'gate' | 'spikes';

/** Single-character codes, so a grid stays readable as ASCII art in source. */
export const PLATFORM_TILE_CODES: Readonly<Record<string, PlatformTile>> = {
  '.': 'empty',
  '#': 'solid',
  b: 'breakable',
  H: 'ladder',
  G: 'gate',
  '^': 'spikes',
};

/** SPEC 9's level budget: the grid may not exceed 32x24 tiles. */
export const MAX_GRID_WIDTH = 32;
export const MAX_GRID_HEIGHT = 24;

export interface PlatformGrid {
  readonly width: number;
  readonly height: number;
  /** Row-major: `tiles[y][x]`. */
  readonly tiles: readonly (readonly PlatformTile[])[];
}

/**
 * Parse rows of single-character codes into a grid. Every row must be the same
 * length, and every character must be a known code — an unrecognised tile
 * fails loudly here rather than silently rendering as something it is not,
 * the same principle `src/core/validator/coverage.ts` enforces for the full
 * level model.
 */
export function createPlatformGrid(rows: readonly string[]): PlatformGrid {
  const height = rows.length;
  const [firstRow] = rows;
  if (firstRow === undefined) throw new Error('a platform grid needs at least one row');
  if (height > MAX_GRID_HEIGHT) {
    throw new Error(`grid is ${height} tiles tall, over the SPEC 9 cap of ${MAX_GRID_HEIGHT}`);
  }

  const width = firstRow.length;
  if (width === 0) throw new Error('a platform grid needs at least one column');
  if (width > MAX_GRID_WIDTH) {
    throw new Error(`grid is ${width} tiles wide, over the SPEC 9 cap of ${MAX_GRID_WIDTH}`);
  }

  const tiles = rows.map((row, y) => {
    if (row.length !== width) {
      throw new Error(`row ${y} is ${row.length} tiles wide, expected ${width}`);
    }
    return row.split('').map((code, x) => {
      const tile = PLATFORM_TILE_CODES[code];
      if (!tile) throw new Error(`unknown tile code ${JSON.stringify(code)} at (${x}, ${y})`);
      return tile;
    });
  });

  return { width, height, tiles };
}

/** The tile at a cell, or `null` outside the grid. */
export function platformTileAt(grid: PlatformGrid, cell: Position): PlatformTile | null {
  if (cell.x < 0 || cell.y < 0 || cell.x >= grid.width || cell.y >= grid.height) return null;
  return grid.tiles[cell.y]?.[cell.x] ?? null;
}
