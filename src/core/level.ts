/**
 * Level loading: turns level JSON into a `LevelDefinition` and builds the
 * initial `GameState`. Rejects malformed levels loudly — a level the validator
 * cannot read is a level that cannot be proven deadlock-free.
 */

import {
  TILE_CODES,
  comparePositions,
  type GameState,
  type ItemDefinition,
  type DoorDefinition,
  type LevelDefinition,
  type Position,
  type Tile,
} from './types.js';

export class LevelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LevelParseError';
  }
}

interface RawPosition {
  x: number;
  y: number;
}

interface RawLevel {
  id?: unknown;
  gate?: unknown;
  name?: unknown;
  tiles?: unknown;
  player?: unknown;
  blocks?: unknown;
  items?: unknown;
  doors?: unknown;
  timers?: unknown;
}

function fail(message: string): never {
  throw new LevelParseError(message);
}

function asPosition(value: unknown, where: string): Position {
  if (typeof value !== 'object' || value === null) fail(`${where}: expected {x, y}`);
  const raw = value as Partial<RawPosition>;
  if (!Number.isInteger(raw.x) || !Number.isInteger(raw.y)) {
    fail(`${where}: x and y must be integers`);
  }
  return { x: raw.x as number, y: raw.y as number };
}

function parseTiles(value: unknown): Tile[][] {
  if (!Array.isArray(value) || value.length === 0) {
    fail('tiles: expected a non-empty array of row strings');
  }
  const width = typeof value[0] === 'string' ? value[0].length : -1;
  if (width <= 0) fail('tiles: rows must be non-empty strings');

  return value.map((row, y) => {
    if (typeof row !== 'string') fail(`tiles[${y}]: expected a string`);
    if (row.length !== width) {
      fail(`tiles[${y}]: ragged grid, expected width ${width} but got ${row.length}`);
    }
    return [...row].map((code, x) => {
      const tile = TILE_CODES[code];
      if (!tile) fail(`tiles[${y}][${x}]: unknown tile code "${code}"`);
      return tile;
    });
  });
}

function parseItems(value: unknown): ItemDefinition[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('items: expected an array');
  return value.map((entry, index) => {
    const where = `items[${index}]`;
    if (typeof entry !== 'object' || entry === null) fail(`${where}: expected an object`);
    const raw = entry as Record<string, unknown>;
    if (typeof raw['id'] !== 'string') fail(`${where}.id: expected a string`);
    const kind = raw['kind'];
    if (kind !== 'key' && kind !== 'torch' && kind !== 'treasure') {
      fail(`${where}.kind: expected "key", "torch" or "treasure"`);
    }
    const color = raw['color'];
    if (kind === 'key' && typeof color !== 'string') {
      fail(`${where}.color: keys must declare a colour (SPEC 14)`);
    }
    const item: ItemDefinition = {
      id: raw['id'],
      kind,
      at: asPosition(raw['at'], `${where}.at`),
      ...(typeof color === 'string' ? { color } : {}),
    };
    return item;
  });
}

function parseDoors(value: unknown): DoorDefinition[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('doors: expected an array');
  return value.map((entry, index) => {
    const where = `doors[${index}]`;
    if (typeof entry !== 'object' || entry === null) fail(`${where}: expected an object`);
    const raw = entry as Record<string, unknown>;
    if (typeof raw['id'] !== 'string') fail(`${where}.id: expected a string`);
    if (typeof raw['color'] !== 'string') fail(`${where}.color: expected a string`);
    return { id: raw['id'], color: raw['color'], at: asPosition(raw['at'], `${where}.at`) };
  });
}

/** Parse untrusted JSON (a file, a fixture, an editor export) into a level. */
export function parseLevel(input: unknown): LevelDefinition {
  if (typeof input !== 'object' || input === null) fail('level: expected an object');
  const raw = input as RawLevel;

  if (typeof raw.id !== 'string' || raw.id.length === 0) fail('id: expected a non-empty string');
  if (!Number.isInteger(raw.gate) || (raw.gate as number) < 1 || (raw.gate as number) > 7) {
    fail('gate: expected an integer between 1 and 7 (SPEC 6)');
  }
  if (typeof raw.name !== 'string') fail('name: expected a string');

  const tiles = parseTiles(raw.tiles);
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;

  const inBounds = (p: Position): boolean =>
    p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;

  const player = asPosition(raw.player, 'player');
  if (!inBounds(player)) fail('player: start position is outside the grid');

  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : []).map((entry, index) =>
    asPosition(entry, `blocks[${index}]`),
  );
  for (const block of blocks) {
    if (!inBounds(block)) fail(`blocks: ${block.x},${block.y} is outside the grid`);
  }

  const items = parseItems(raw.items);
  const doors = parseDoors(raw.doors);

  const seenIds = new Set<string>();
  for (const entity of [...items, ...doors]) {
    if (seenIds.has(entity.id)) fail(`duplicate entity id "${entity.id}"`);
    seenIds.add(entity.id);
    if (!inBounds(entity.at)) fail(`entity "${entity.id}" is outside the grid`);
  }

  const doorColors = new Set(doors.map((door) => door.color));
  for (const door of doors) {
    const hasKey = items.some((item) => item.kind === 'key' && item.color === door.color);
    if (!hasKey) fail(`door "${door.id}" has colour "${door.color}" but no key of that colour exists`);
  }
  for (const item of items) {
    if (item.kind === 'key' && item.color !== undefined && !doorColors.has(item.color)) {
      fail(`key "${item.id}" has colour "${item.color}" but no door of that colour exists`);
    }
  }

  const hasGoal = tiles.some((row) => row.includes('goal'));
  if (!hasGoal) fail('tiles: level has no goal tile (SPEC 9)');

  const timers = (raw.timers ?? {}) as Record<string, unknown>;
  const standard = typeof timers['standard'] === 'number' ? timers['standard'] : 60;
  const expert = typeof timers['expert'] === 'number' ? timers['expert'] : 30;

  return {
    id: raw.id,
    gate: raw.gate as number,
    name: raw.name,
    width,
    height,
    tiles,
    player,
    blocks: [...blocks].sort(comparePositions),
    items,
    doors,
    timers: { standard, expert },
  };
}

/** The state the player starts a level in, before any move. */
export function initialState(level: LevelDefinition): GameState {
  const ground: Record<string, Position> = {};
  for (const item of level.items) {
    ground[item.id] = item.at;
  }
  return {
    player: level.player,
    blocks: [...level.blocks].sort(comparePositions),
    carrying: [],
    ground,
    openDoors: [],
  };
}
