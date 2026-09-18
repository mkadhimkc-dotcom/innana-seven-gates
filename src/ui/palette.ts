/** Mesopotamian palette (SPEC 17) and the flat fills art direction (SPEC 46). */

import type { Tile } from '../core/index.js';

export const PALETTE = {
  terracotta: 0xb4623a,
  sand: 0xe0c9a6,
  gold: 0xd8a634,
  deepBlue: 0x1c2b4a,
  lapis: 0x2a4d8f,
  hazardRed: 0xc0392b,
  water: 0x39a0c4,
  lava: 0xe2761b,
  outline: 0x2b1d12,
} as const;

export const TILE_COLORS: Readonly<Record<Tile, number>> = {
  floor: PALETTE.sand,
  wall: PALETTE.terracotta,
  water: PALETTE.water,
  lava: PALETTE.lava,
  spike: PALETTE.hazardRed,
  goal: PALETTE.gold,
};
