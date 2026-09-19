/**
 * A v2 level (SPEC v2 §9), and the loader that refuses a bad one.
 *
 * Engine-free, like everything under `src/core/`: the game and the validator
 * import this same model, so a level the validator proved is literally the
 * level the game runs.
 *
 * The loader enforces SPEC 9's level budget and SPEC 16's guardian period. Both
 * exist so §18's state graph stays finite in a useful sense rather than only a
 * theoretical one, which makes them correctness rules, not style guidance — a
 * level over budget is a load failure here, before the validator ever sees it.
 */

import {
  createPlatformGrid,
  platformTileAt,
  type PlatformGrid,
  type PlatformTile,
} from './platformGrid.js';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';

import levelSchema from './platformLevel.schema.json' with { type: 'json' };
import { checkPlatformCoverage } from './validator/platformCoverage.js';
import type { Position } from './types.js';

/** SPEC 9 level budget. Over any of these is a load failure. */
export const MAX_JEWELS = 8;
export const MAX_BREAKABLE = 10;
export const MAX_GUARDIANS = 4;
export const MAX_AXE_USES = 4;
/** SPEC 16: the declared level period, which every guardian cycle divides. */
export const MAX_PERIOD_FRAMES = 256;

export interface JewelDefinition {
  readonly id: string;
  readonly at: Position;
}

/**
 * A guardian is a route and a speed, nothing else.
 *
 * Its position is `route[floor((phase % cycle) / stepFrames)]` — a pure
 * function of the phase, with no reference to the player anywhere. SPEC 16
 * requires that, and D-007 explains why storing a position instead would be
 * S-08's failure one layer down.
 */
export interface GuardianDefinition {
  readonly id: string;
  /** Cells visited in order, then repeated. At least two. */
  readonly route: readonly Position[];
  /** Frames spent on each cell. At least one. */
  readonly stepFrames: number;
}

export interface AxeDefinition {
  readonly id: string;
  readonly at: Position;
  /** Uses this pickup grants. One use breaks a block or kills a guardian. */
  readonly uses: number;
}

export interface PlatformLevel {
  readonly id: string;
  readonly gate: number;
  readonly name: string;
  readonly grid: PlatformGrid;
  readonly start: Position;
  readonly gateCell: Position;
  readonly jewels: readonly JewelDefinition[];
  readonly guardians: readonly GuardianDefinition[];
  readonly axes: readonly AxeDefinition[];
  /** SPEC 16. Every guardian cycle divides this. */
  readonly periodFrames: number;
}

export class PlatformLevelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformLevelError';
  }
}

function fail(message: string): never {
  throw new PlatformLevelError(message);
}

const ajv = new Ajv2020({ allErrors: true });
const validateSchema = ajv.compile(levelSchema);

function describeSchemaError(error: ErrorObject): string {
  const where = error.instancePath === '' ? 'level' : error.instancePath.slice(1).replace(/\//g, '.');
  return `${where}: ${error.message ?? 'does not match the level schema'}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asCell(value: unknown, where: string): Position {
  if (!isRecord(value)) fail(`${where}: expected {x, y}`);
  const { x, y } = value;
  if (!Number.isInteger(x) || !Number.isInteger(y)) fail(`${where}: x and y must be integers`);
  return { x: x as number, y: y as number };
}

function cellKey(cell: Position): string {
  return `${cell.x},${cell.y}`;
}

/** Cells a walker or an item may occupy. Solid brick and breakable are not. */
function isOpen(tile: PlatformTile | null): boolean {
  return tile === 'empty' || tile === 'ladder' || tile === 'gate' || tile === 'spikes';
}

/** The guardian's cycle length in frames. */
export function guardianCycleFrames(guardian: GuardianDefinition): number {
  return guardian.route.length * guardian.stepFrames;
}

/**
 * Where a guardian is at a phase. Pure in `(guardian, phase)` — no player, no
 * clock, no history. This is the function §18's state graph derives positions
 * with, so the game must never compute a guardian's position any other way.
 */
export function guardianPositionAt(guardian: GuardianDefinition, phase: number): Position {
  const cycle = guardianCycleFrames(guardian);
  const wrapped = ((phase % cycle) + cycle) % cycle;
  const index = Math.floor(wrapped / guardian.stepFrames);
  const cell = guardian.route[index];
  if (cell === undefined) fail(`guardian "${guardian.id}": route index ${index} out of range`);
  return cell;
}

function parseJewels(value: unknown, grid: PlatformGrid, seen: Set<string>): JewelDefinition[] {
  if (!Array.isArray(value)) fail('jewels: expected an array');
  if (value.length === 0) fail('jewels: a level needs at least one jewel (SPEC 7)');
  if (value.length > MAX_JEWELS) {
    fail(`jewels: ${value.length} is over the SPEC 9 cap of ${MAX_JEWELS}`);
  }
  return value.map((entry, index) => {
    const where = `jewels[${index}]`;
    if (!isRecord(entry)) fail(`${where}: expected an object`);
    if (typeof entry['id'] !== 'string') fail(`${where}.id: expected a string`);
    const at = asCell(entry['at'], `${where}.at`);
    if (!isOpen(platformTileAt(grid, at))) {
      fail(`${where}: jewel "${entry['id']}" sits at ${cellKey(at)}, which is not an open tile`);
    }
    if (seen.has(cellKey(at))) fail(`${where}: two things occupy ${cellKey(at)}`);
    seen.add(cellKey(at));
    return { id: entry['id'], at };
  });
}

function parseGuardians(
  value: unknown,
  grid: PlatformGrid,
  periodFrames: number,
): GuardianDefinition[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('guardians: expected an array');
  if (value.length > MAX_GUARDIANS) {
    fail(`guardians: ${value.length} is over the SPEC 9 cap of ${MAX_GUARDIANS}`);
  }

  return value.map((entry, index) => {
    const where = `guardians[${index}]`;
    if (!isRecord(entry)) fail(`${where}: expected an object`);
    if (typeof entry['id'] !== 'string') fail(`${where}.id: expected a string`);

    const stepFrames = entry['stepFrames'];
    if (!Number.isInteger(stepFrames) || (stepFrames as number) < 1) {
      fail(`${where}.stepFrames: expected an integer of at least 1`);
    }

    const rawRoute = entry['route'];
    if (!Array.isArray(rawRoute) || rawRoute.length < 2) {
      fail(`${where}.route: expected at least two cells`);
    }
    const route = rawRoute.map((cell, i) => {
      const at = asCell(cell, `${where}.route[${i}]`);
      if (!isOpen(platformTileAt(grid, at))) {
        fail(`${where}.route[${i}]: ${cellKey(at)} is not an open tile`);
      }
      return at;
    });

    const guardian: GuardianDefinition = {
      id: entry['id'],
      route,
      stepFrames: stepFrames as number,
    };

    // SPEC 16. Without this the combined phase is the LCM of the cycles, and
    // four coprime cycles put the state graph out of reach of the §19 budget.
    const cycle = guardianCycleFrames(guardian);
    if (periodFrames % cycle !== 0) {
      fail(
        `${where}: cycle of ${cycle} frames (${route.length} cells x ${stepFrames as number}) ` +
          `does not divide the level period of ${periodFrames} (SPEC 16)`,
      );
    }
    return guardian;
  });
}

function parseAxes(value: unknown, grid: PlatformGrid, seen: Set<string>): AxeDefinition[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('axes: expected an array');

  const axes = value.map((entry, index) => {
    const where = `axes[${index}]`;
    if (!isRecord(entry)) fail(`${where}: expected an object`);
    if (typeof entry['id'] !== 'string') fail(`${where}.id: expected a string`);
    const uses = entry['uses'];
    if (!Number.isInteger(uses) || (uses as number) < 1) {
      fail(`${where}.uses: expected an integer of at least 1`);
    }
    const at = asCell(entry['at'], `${where}.at`);
    if (!isOpen(platformTileAt(grid, at))) {
      fail(`${where}: axe "${entry['id']}" sits at ${cellKey(at)}, which is not an open tile`);
    }
    if (seen.has(cellKey(at))) fail(`${where}: two things occupy ${cellKey(at)}`);
    seen.add(cellKey(at));
    return { id: entry['id'], at, uses: uses as number };
  });

  const total = axes.reduce((sum, axe) => sum + axe.uses, 0);
  if (total > MAX_AXE_USES) {
    fail(`axes: ${total} total uses is over the SPEC 9 cap of ${MAX_AXE_USES}`);
  }
  return axes;
}

/** Parse untrusted level JSON. Every failure names what is wrong and where. */
export function parsePlatformLevel(input: unknown): PlatformLevel {
  if (!isRecord(input)) fail('level: expected an object');

  // Before anything else: refuse a level carrying a feature the state model
  // does not track, so the proof can never pass over a mechanic it cannot see.
  const unmodeled = checkPlatformCoverage(input);
  if (unmodeled.length > 0) {
    fail(unmodeled.map((finding) => `${finding.where}: ${finding.message}`).join('\n  '));
  }

  // Shape first, from the schema; then the cross-field rules a schema cannot
  // express - the budget, the guardian period, one gate tile, open cells.
  if (!validateSchema(input)) {
    const [firstError] = validateSchema.errors ?? [];
    fail(firstError ? describeSchemaError(firstError) : 'level: does not match the level schema');
  }

  if (typeof input['id'] !== 'string' || input['id'].length === 0) {
    fail('id: expected a non-empty string');
  }
  const gate = input['gate'];
  if (!Number.isInteger(gate) || (gate as number) < 1 || (gate as number) > 7) {
    fail('gate: expected an integer between 1 and 7 (SPEC 6)');
  }
  if (typeof input['name'] !== 'string') fail('name: expected a string');

  const rows = input['grid'];
  if (!Array.isArray(rows) || rows.some((row) => typeof row !== 'string')) {
    fail('grid: expected an array of row strings');
  }
  let grid: PlatformGrid;
  try {
    grid = createPlatformGrid(rows as string[]);
  } catch (error) {
    fail(`grid: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Exactly one gate, so "enter the gate" is unambiguous (SPEC 7).
  const gateCells: Position[] = [];
  let breakable = 0;
  grid.tiles.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile === 'gate') gateCells.push({ x, y });
      if (tile === 'breakable') breakable += 1;
    });
  });
  if (gateCells.length !== 1) fail(`grid: expected exactly one gate tile, found ${gateCells.length}`);
  if (breakable > MAX_BREAKABLE) {
    fail(`grid: ${breakable} breakable blocks is over the SPEC 9 cap of ${MAX_BREAKABLE}`);
  }
  const gateCell = gateCells[0] as Position;

  const periodFrames = input['periodFrames'];
  if (!Number.isInteger(periodFrames) || (periodFrames as number) < 1) {
    fail('periodFrames: expected an integer of at least 1');
  }
  if ((periodFrames as number) > MAX_PERIOD_FRAMES) {
    fail(`periodFrames: ${periodFrames as number} is over the SPEC 16 cap of ${MAX_PERIOD_FRAMES}`);
  }

  const start = asCell(input['start'], 'start');
  if (!isOpen(platformTileAt(grid, start))) {
    fail(`start: ${cellKey(start)} is not an open tile`);
  }
  if (platformTileAt(grid, start) === 'spikes') fail('start: the player may not start on spikes');

  const occupied = new Set<string>();
  const jewels = parseJewels(input['jewels'], grid, occupied);
  const axes = parseAxes(input['axes'], grid, occupied);
  const guardians = parseGuardians(input['guardians'], grid, periodFrames as number);

  const ids = new Set<string>();
  for (const entity of [...jewels, ...axes, ...guardians]) {
    if (ids.has(entity.id)) fail(`duplicate entity id "${entity.id}"`);
    ids.add(entity.id);
  }

  return {
    id: input['id'],
    gate: gate as number,
    name: input['name'],
    grid,
    start,
    gateCell,
    jewels,
    guardians,
    axes,
    periodFrames: periodFrames as number,
  };
}
