import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseLevel } from '../src/core/level.js';
import { detectBlockDeadlocks } from '../src/core/validator/deadlock.js';
import { proveSolvable } from '../src/core/validator/reachability.js';

const LEVELS_DIR = resolve(import.meta.dirname, '../levels');

function levelFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return levelFiles(full);
    return entry.endsWith('.json') ? [full] : [];
  });
}

const files = levelFiles(LEVELS_DIR);

/**
 * The deadlock-free guarantee (SPEC 8, 45) is the product, so it is also a unit
 * test. `npm run validate` runs the same checks as the merge gate; this keeps
 * `npm test` alone from ever going green on a broken level.
 */
describe('shipped levels', () => {
  it('there is at least one level to validate', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s parses, has a critical-path doc, and is deadlock-free', (file) => {
    const level = parseLevel(JSON.parse(readFileSync(file, 'utf8')));

    // SPEC 52: the critical-path doc sits beside the level and shares its name.
    const doc = file.replace(/\.json$/, '.md');
    expect(statSync(doc).isFile(), `missing critical-path doc for ${basename(file)}`).toBe(true);

    const reachability = proveSolvable(level);
    expect(reachability.deadStates, `dead states in ${level.id}`).toEqual([]);
    expect(reachability.ok).toBe(true);

    const deadlocks = detectBlockDeadlocks(level);
    expect(deadlocks.findings, `block deadlocks in ${level.id}`).toEqual([]);
    expect(deadlocks.elapsedMs).toBeLessThan(60_000);
  });
});
