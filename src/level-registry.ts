/**
 * Level registry.
 *
 * Levels are data (ADR-001): `levels/<gate>/<id>.json` holds the definition and
 * `levels/<gate>/<id>.md` answers the 52 critical-path questions (SPEC 52).
 * Adding a level means adding two files and one line here — never a change to
 * the rules in `src/core/`.
 */

import gate0101 from '../levels/gate-01/gate-01-01.json';

/** Raw level JSON, keyed by level id. Parsed by `parseLevel` at load time. */
export const LEVEL_SOURCES: Readonly<Record<string, unknown>> = {
  'gate-01-01': gate0101,
};

export const LEVEL_ORDER: readonly string[] = ['gate-01-01'];

export function getLevel(levelId: string): unknown {
  const source = LEVEL_SOURCES[levelId];
  if (source === undefined) throw new Error(`Unknown level "${levelId}"`);
  return source;
}

export function nextLevelId(levelId: string): string | null {
  const index = LEVEL_ORDER.indexOf(levelId);
  if (index < 0 || index + 1 >= LEVEL_ORDER.length) return null;
  return LEVEL_ORDER[index + 1] ?? null;
}
