/**
 * Unknown-feature guard for v2 levels.
 *
 * Same principle as the v1 guard it replaces: the solvability proof is only
 * sound over what the state model represents. A tile or entity the model does
 * not track is invisible to §18 — the validator explores a state space with the
 * feature missing and reports "all clear", and the deadlock-free guarantee goes
 * back to being a claim. That failure is silent, which makes it the worst kind.
 *
 * Checked on the raw JSON, before the loader narrows it away, because the
 * schema and the state model can drift apart and it is the model that decides
 * whether the proof holds.
 */

import { PLATFORM_TILE_CODES } from '../platformGrid.js';

/** Top-level level fields the v2 state model reads. */
export const MODELED_LEVEL_FIELDS = [
  'id',
  'gate',
  'name',
  'grid',
  'start',
  'jewels',
  'guardians',
  'axes',
  'periodFrames',
] as const;

/** Per-entity fields, by collection. */
export const MODELED_ENTITY_FIELDS: Readonly<Record<string, readonly string[]>> = {
  jewels: ['id', 'at'],
  guardians: ['id', 'route', 'stepFrames'],
  axes: ['id', 'at', 'uses'],
};

export interface CoverageFinding {
  readonly kind: 'tile' | 'field' | 'entity-field';
  readonly name: string;
  readonly where: string;
  readonly message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unmodeled(kind: CoverageFinding['kind'], name: string, where: string, what: string): CoverageFinding {
  return {
    kind,
    name,
    where,
    message:
      `${what} "${name}" is not tracked by the v2 state model, so the solvability ` +
      `proof cannot see it (SPEC 18). Model it in src/core/ and list it in ` +
      `src/core/validator/platformCoverage.ts, or remove it from the level.`,
  };
}

export function checkPlatformCoverage(raw: unknown): CoverageFinding[] {
  const findings: CoverageFinding[] = [];
  if (!isRecord(raw)) return findings;

  const fields = new Set<string>(MODELED_LEVEL_FIELDS);
  for (const key of Object.keys(raw)) {
    if (!fields.has(key)) findings.push(unmodeled('field', key, `level.${key}`, 'level field'));
  }

  const codes = new Set(Object.keys(PLATFORM_TILE_CODES));
  const rows = raw['grid'];
  if (Array.isArray(rows)) {
    const seen = new Set<string>();
    rows.forEach((row, y) => {
      if (typeof row !== 'string') return;
      [...row].forEach((code, x) => {
        if (codes.has(code) || seen.has(code)) return;
        seen.add(code);
        findings.push(unmodeled('tile', code, `grid[${y}][${x}]`, 'tile code'));
      });
    });
  }

  for (const [collection, allowed] of Object.entries(MODELED_ENTITY_FIELDS)) {
    const entries = raw[collection];
    if (!Array.isArray(entries)) continue;
    const allowedSet = new Set(allowed);
    entries.forEach((entry, index) => {
      if (!isRecord(entry)) return;
      for (const key of Object.keys(entry)) {
        if (allowedSet.has(key)) continue;
        findings.push(
          unmodeled('entity-field', key, `${collection}[${index}].${key}`, `${collection} field`),
        );
      }
    });
  }

  return findings;
}
