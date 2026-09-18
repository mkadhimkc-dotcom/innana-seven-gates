/**
 * Unknown-feature guard.
 *
 * The solvability proof (SPEC 18) is only worth the paper it prints on if the
 * state graph actually tracks everything a level contains. A tile, entity or
 * mechanic the model does not represent is invisible to the proof — the
 * validator will happily report "all clear" over a state space that omits it,
 * and the deadlock-free guarantee in SPEC 8 and SPEC 45 silently becomes a
 * claim again.
 *
 * So: anything in a level that `src/core/state.ts` does not model is a hard
 * validation failure, named explicitly. A feature the proof does not model must
 * never pass silently.
 *
 * Adding a mechanic means adding it here **and** to the state model. The
 * exhaustiveness assertions below make the compiler refuse a new `Tile` or
 * `ItemKind` union member until it has been consciously classified.
 */

import type { ItemKind, Tile } from '../types.js';

/**
 * Tiles `applyMove` reasons about. Every member is handled in
 * `playerCanEnter` or `resolvePush`.
 */
export const MODELED_TILES = ['floor', 'wall', 'water', 'lava', 'spike', 'goal'] as const;

/**
 * Item kinds the state model carries. `treasure` is modeled as an ordinary
 * carryable: SPEC 9 requires treasure never be on the critical path, so it
 * needs no special casing, only tracking.
 */
export const MODELED_ITEM_KINDS = ['key', 'torch', 'treasure'] as const;

/**
 * Top-level level fields the graph reads. A level carrying anything else holds
 * a mechanic the proof cannot see.
 */
export const MODELED_LEVEL_FIELDS = [
  'id',
  'gate',
  'name',
  'tiles',
  'player',
  'blocks',
  'items',
  'doors',
  'timers',
  'routes',
  'criticalPath',
  'seed',
] as const;

/** Tile codes the loader understands, mapped to modeled tiles. */
export const MODELED_TILE_CODES = ['.', '#', '~', 'L', '^', 'G'] as const;

// Compile-time exhaustiveness: adding a Tile or ItemKind without listing it
// above is a type error, not a silent hole in the proof.
const _tilesCovered: Record<Tile, true> = {
  floor: true, wall: true, water: true, lava: true, spike: true, goal: true,
};
const _itemKindsCovered: Record<ItemKind, true> = { key: true, torch: true, treasure: true };
void _tilesCovered;
void _itemKindsCovered;

export interface CoverageFinding {
  /** What kind of thing is unmodeled. */
  readonly kind: 'tile' | 'item' | 'field' | 'entity';
  /** The offending value, named so the report can point at it. */
  readonly name: string;
  /** Where it was found, for the report. */
  readonly where: string;
  readonly message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Inspect the **raw** level JSON, before schema parsing narrows it away.
 *
 * Raw is deliberate: the schema and the state model can drift apart, and when
 * they do it is the model that decides whether the proof is sound. A tile code
 * the schema has learned about but `applyMove` has not is exactly the case this
 * guard exists to catch.
 */
export function checkModelCoverage(raw: unknown): CoverageFinding[] {
  const findings: CoverageFinding[] = [];
  if (!isRecord(raw)) return findings;

  const fields = new Set<string>(MODELED_LEVEL_FIELDS);
  for (const key of Object.keys(raw)) {
    if (!fields.has(key)) {
      findings.push({
        kind: 'field',
        name: key,
        where: `level.${key}`,
        message:
          `level field "${key}" is not tracked by the state model, so the solvability ` +
          `proof cannot see it (SPEC 18). Model it in src/core/state.ts and list it in ` +
          `MODELED_LEVEL_FIELDS, or remove it from the level.`,
      });
    }
  }

  const codes = new Set<string>(MODELED_TILE_CODES);
  const rows = raw['tiles'];
  if (Array.isArray(rows)) {
    const seen = new Set<string>();
    rows.forEach((row, y) => {
      if (typeof row !== 'string') return;
      [...row].forEach((code, x) => {
        if (codes.has(code) || seen.has(code)) return;
        seen.add(code);
        findings.push({
          kind: 'tile',
          name: code,
          where: `tiles[${y}][${x}]`,
          message:
            `tile code "${code}" is not tracked by the state model, so the solvability ` +
            `proof cannot see it (SPEC 18). Model it in src/core/state.ts and list it in ` +
            `MODELED_TILE_CODES, or remove it from the level.`,
        });
      });
    });
  }

  const kinds = new Set<string>(MODELED_ITEM_KINDS);
  const items = raw['items'];
  if (Array.isArray(items)) {
    items.forEach((item, index) => {
      if (!isRecord(item)) return;
      const kind = item['kind'];
      if (typeof kind !== 'string' || kinds.has(kind)) return;
      findings.push({
        kind: 'item',
        name: kind,
        where: `items[${index}].kind`,
        message:
          `item kind "${kind}" is not tracked by the state model, so the solvability ` +
          `proof cannot see it (SPEC 18). Model it in src/core/state.ts and list it in ` +
          `MODELED_ITEM_KINDS, or remove it from the level.`,
      });
    });
  }

  return findings;
}

export class UnmodeledFeatureError extends Error {
  readonly findings: readonly CoverageFinding[];
  constructor(findings: readonly CoverageFinding[]) {
    super(findings.map((f) => `${f.where}: ${f.message}`).join('\n'));
    this.name = 'UnmodeledFeatureError';
    this.findings = findings;
  }
}

/** Throw if the level carries anything the proof cannot model. */
export function assertModelCoverage(raw: unknown): void {
  const findings = checkModelCoverage(raw);
  if (findings.length > 0) throw new UnmodeledFeatureError(findings);
}
