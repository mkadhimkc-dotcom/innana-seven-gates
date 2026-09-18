/**
 * Core domain types for Inanna: Seven Gates.
 *
 * This module — and everything else under `src/core/` — must stay free of
 * Phaser and DOM references. The solvability validator (SPEC 18-19) runs these
 * same rules headlessly in Node, and the deadlock-free guarantee only holds if
 * the game and the validator share one implementation. See
 * docs/adr/ADR-001-architecture.md.
 */

/** Tile kinds a level grid can contain (SPEC 9). */
export type Tile = 'floor' | 'wall' | 'water' | 'lava' | 'spike' | 'goal';

/** Single-character codes used in level JSON, so levels stay human-readable. */
export const TILE_CODES: Readonly<Record<string, Tile>> = {
  '.': 'floor',
  '#': 'wall',
  '~': 'water',
  L: 'lava',
  '^': 'spike',
  G: 'goal',
};

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];

export const DIRECTION_VECTORS: Readonly<Record<Direction, Position>> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** Item kinds (SPEC 14, 15, 9). Treasure is always optional, never required. */
export type ItemKind = 'key' | 'torch' | 'treasure';

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface ItemDefinition {
  readonly id: string;
  readonly kind: ItemKind;
  /** Keys and the doors they open share a colour (SPEC 14). */
  readonly color?: string;
  readonly at: Position;
}

export interface DoorDefinition {
  readonly id: string;
  readonly color: string;
  readonly at: Position;
}

/**
 * A level is data, not code (ADR-001). `levels/<gate>/<level>.json` parses into
 * this shape, and the matching `.md` answers the 52 critical-path questions
 * (SPEC 52).
 */
export interface LevelDefinition {
  readonly id: string;
  readonly gate: number;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Row-major: `tiles[y][x]`. */
  readonly tiles: readonly (readonly Tile[])[];
  readonly player: Position;
  readonly blocks: readonly Position[];
  readonly items: readonly ItemDefinition[];
  readonly doors: readonly DoorDefinition[];
  /** Route timers in seconds (SPEC 16). Safe route has no timer. */
  readonly timers: {
    readonly standard: number;
    readonly expert: number;
  };
}

/**
 * Everything that can change during play. Two states with equal fields are
 * interchangeable, which is what lets the validator collapse the state graph.
 */
export interface GameState {
  readonly player: Position;
  /** Sorted by (y, x) so equal block sets encode identically. */
  readonly blocks: readonly Position[];
  /** Carried item ids, oldest first (SPEC 12). */
  readonly carrying: readonly string[];
  /** Item id -> position, for items still on the floor. */
  readonly ground: Readonly<Record<string, Position>>;
  /** Doors stay open once unlocked (SPEC 14). */
  readonly openDoors: readonly string[];
}

export type Move =
  | { readonly type: 'move'; readonly direction: Direction }
  | { readonly type: 'pickup' }
  | { readonly type: 'drop'; readonly itemId: string };

export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function translate(from: Position, direction: Direction): Position {
  const delta = DIRECTION_VECTORS[direction];
  return { x: from.x + delta.x, y: from.y + delta.y };
}

/** Deterministic ordering so block sets encode to a stable key. */
export function comparePositions(a: Position, b: Position): number {
  return a.y === b.y ? a.x - b.x : a.y - b.y;
}
