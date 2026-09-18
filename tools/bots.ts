#!/usr/bin/env tsx
/**
 * `npm run bots` — adversarial playtest (SPEC 48).
 *
 * Bots take seeded random walks through each level and, at every step, ask
 * whether the exit is still reachable. The validator already proves no dead
 * state exists; this is the independent check that the runtime rules agree with
 * the proof. A bot that finds a softlock means the two have drifted apart.
 *
 * Usage:
 *   npm run bots
 *   npm run bots -- --runs 200 --steps 300 --seed 7
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyMove,
  buildStateGraph,
  candidateMoves,
  describeMove,
  encodeState,
  initialState,
  isGoal,
  parseLevel,
  type GameState,
  type LevelDefinition,
  type Move,
} from '../src/core/index.js';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const LEVELS_DIR = join(REPO_ROOT, 'levels');

/** Mulberry32: small, fast, and reproducible from a seed. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Softlock {
  readonly seed: number;
  readonly step: number;
  readonly state: string;
  readonly history: readonly string[];
}

/**
 * Bots revisit the same states constantly, and each check is a fresh search, so
 * the answers are cached per level for the whole session.
 */
function createExitOracle(level: LevelDefinition): (state: GameState) => boolean {
  const cache = new Map<string, boolean>();
  return (state: GameState): boolean => {
    const key = encodeState(state);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const graph = buildStateGraph(level, state, { maxStates: 50_000, timeBudgetMs: 2_000 });
    const reachable = graph.goals.length > 0;
    cache.set(key, reachable);
    return reachable;
  };
}

function runBot(
  level: LevelDefinition,
  seed: number,
  steps: number,
  exitReachable: (state: GameState) => boolean,
): Softlock | null {
  const random = createRandom(seed);
  let state = initialState(level);
  const history: string[] = [];

  for (let step = 0; step < steps; step += 1) {
    if (isGoal(level, state)) return null;

    const legal: Move[] = candidateMoves(state).filter(
      (move) => applyMove(level, state, move) !== null,
    );
    if (legal.length === 0) {
      return { seed, step, state: encodeState(state), history: [...history] };
    }

    const move = legal[Math.floor(random() * legal.length)];
    if (!move) break;
    const next = applyMove(level, state, move);
    if (next === null) break;

    state = next;
    history.push(describeMove(move));

    if (!exitReachable(state)) {
      return { seed, step, state: encodeState(state), history: [...history] };
    }
  }

  return null;
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
    if (statSync(full).isDirectory()) files.push(...findLevelFiles(full));
    else if (entry.endsWith('.json')) files.push(full);
  }
  return files;
}

function numberFlag(argv: readonly string[], name: string, fallback: number): number {
  const index = argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function main(): void {
  const argv = process.argv.slice(2);
  const runs = numberFlag(argv, 'runs', 120);
  const steps = numberFlag(argv, 'steps', 240);
  const baseSeed = numberFlag(argv, 'seed', 1);

  const files = findLevelFiles(LEVELS_DIR);
  if (files.length === 0) {
    console.log('No levels found in levels/. Nothing for the bots to break.');
    return;
  }

  let softlocks = 0;

  for (const file of files) {
    const level = parseLevel(JSON.parse(readFileSync(file, 'utf8')));
    const found: Softlock[] = [];

    const exitReachable = createExitOracle(level);
    for (let run = 0; run < runs; run += 1) {
      const result = runBot(level, baseSeed + run, steps, exitReachable);
      if (result) found.push(result);
    }

    const label = found.length === 0 ? 'PASS' : 'FAIL';
    console.log(`${label}  ${level.id}  ${runs} bot run(s) x ${steps} step(s)`);
    for (const softlock of found.slice(0, 3)) {
      console.log(`      - softlock at step ${softlock.step}, bot seed ${softlock.seed}`);
      console.log(`        state: ${softlock.state}`);
      console.log(`        repro: ${softlock.history.join(' ')}`);
    }
    softlocks += found.length;
  }

  console.log(`\n${softlocks} softlock(s) found.`);
  if (softlocks > 0) process.exit(1);
}

main();
