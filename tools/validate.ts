#!/usr/bin/env tsx
/**
 * `npm run validate` — the deadlock-free gate (SPEC 18-19).
 *
 * Reads every level in `levels/`, proves that from each reachable state the
 * exit is still reachable, and runs the block deadlock detector on levels that
 * have blocks. Exits non-zero on the first failure, naming the offending state
 * and a seed to reproduce it. This is not advisory: a red validator blocks the
 * merge (SPEC 50).
 *
 * Usage:
 *   npm run validate
 *   npm run validate -- --level gate-01-01
 *   npm run validate -- --json
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyseGraph,
  analyseGraphForDeadlocks,
  buildStateGraph,
  initialState,
  parseLevel,
  DEFAULT_MAX_STATES,
  DEFAULT_TIME_BUDGET_MS,
  type DeadlockReport,
  type LevelDefinition,
  type ReachabilityReport,
} from '../src/core/index.js';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const LEVELS_DIR = join(REPO_ROOT, 'levels');

interface Options {
  readonly levelId: string | null;
  readonly json: boolean;
  readonly maxStates: number;
  readonly timeBudgetMs: number;
}

function parseArgs(argv: readonly string[]): Options {
  const flag = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    if (index < 0) return null;
    return argv[index + 1] ?? null;
  };
  const maxStates = Number(flag('max-states'));
  const timeBudget = Number(flag('time-budget'));
  return {
    levelId: flag('level'),
    json: argv.includes('--json'),
    maxStates: Number.isFinite(maxStates) && maxStates > 0 ? maxStates : DEFAULT_MAX_STATES,
    timeBudgetMs:
      Number.isFinite(timeBudget) && timeBudget > 0 ? timeBudget : DEFAULT_TIME_BUDGET_MS,
  };
}

function findLevelFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries.sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findLevelFiles(full));
    } else if (entry.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

interface LevelResult {
  readonly file: string;
  readonly level: LevelDefinition;
  readonly reachability: ReachabilityReport;
  readonly deadlocks: DeadlockReport;
}

function validateLevel(file: string, options: Options): LevelResult {
  const level = parseLevel(JSON.parse(readFileSync(file, 'utf8')));
  const graph = buildStateGraph(level, initialState(level), {
    maxStates: options.maxStates,
    timeBudgetMs: options.timeBudgetMs,
  });
  return {
    file,
    level,
    reachability: analyseGraph(graph),
    deadlocks: analyseGraphForDeadlocks(graph),
  };
}

function report(result: LevelResult): boolean {
  const { level, reachability, deadlocks } = result;
  const ok = reachability.ok && deadlocks.ok;
  const label = ok ? 'PASS' : 'FAIL';
  const where = relative(REPO_ROOT, result.file);

  console.log(
    `${label}  ${level.id}  (${reachability.statesExplored} states, ${reachability.elapsedMs}ms)  ${where}`,
  );

  if (reachability.goalStatesFound === 0) {
    console.log('      no state reaches the exit: this level cannot be completed at all');
  }
  if (reachability.truncated) {
    console.log(`      search truncated: ${reachability.truncationReason ?? 'unknown reason'}`);
    console.log('      raise --max-states / --time-budget, or simplify the level (SPEC 19)');
  }
  if (reachability.deadStateCount > 0) {
    console.log(`      ${reachability.deadStateCount} dead state(s) reachable (SPEC 8):`);
    for (const dead of reachability.deadStates) {
      console.log(`      - seed ${dead.seed}  player ${dead.player.x},${dead.player.y}`);
      console.log(`        state: ${dead.state}`);
      console.log(`        repro: ${dead.repro.join(' ') || '(start state)'}`);
    }
  }
  for (const finding of deadlocks.findings) {
    console.log(`      - block deadlock (${finding.kind}), seed ${finding.seed}`);
    console.log(`        ${finding.description}`);
    console.log(`        repro: ${finding.repro.join(' ') || '(start state)'}`);
  }
  if (deadlocks.elapsedMs > 60_000) {
    console.log(`      over the 1-minute budget in SPEC 19 (${deadlocks.elapsedMs}ms)`);
  }

  return ok;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const files = findLevelFiles(LEVELS_DIR);

  if (files.length === 0) {
    console.log('No levels found in levels/. Nothing to validate.');
    return;
  }

  const results: LevelResult[] = [];
  for (const file of files) {
    let result: LevelResult;
    try {
      result = validateLevel(file, options);
    } catch (error) {
      // A level the loader refuses cannot be proven, and an unmodeled feature
      // is the most important reason it might be refused: the proof would
      // otherwise pass over a mechanic it cannot see (SPEC 18).
      console.log(`FAIL  ${relative(REPO_ROOT, file)}`);
      console.log(`      ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
    if (options.levelId && result.level.id !== options.levelId) continue;
    results.push(result);
  }

  if (options.levelId && results.length === 0) {
    console.error(`No level with id "${options.levelId}".`);
    process.exit(2);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        results.map((result) => ({
          level: result.level.id,
          reachability: result.reachability,
          deadlocks: result.deadlocks,
        })),
        null,
        2,
      ),
    );
  }

  const failures = options.json
    ? results.filter((result) => !(result.reachability.ok && result.deadlocks.ok)).length
    : results.filter((result) => !report(result)).length;

  console.log(`\n${results.length - failures}/${results.length} level(s) proven deadlock-free.`);
  if (failures > 0) process.exit(1);
}

main();
