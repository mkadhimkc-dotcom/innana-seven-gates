import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../../src/core/level.js';
import { proveSolvable } from '../../../src/core/validator/reachability.js';
import keyDoor from '../../fixtures/solvable-key-door.json';
import deadlockFixture from '../../fixtures/deadlock-block-on-goal.json';
import safeBlocks from '../../fixtures/deadlock-free-blocks.json';

describe('solvability proof (SPEC 18)', () => {
  it('passes a level where every reachable state can still reach the exit', () => {
    const report = proveSolvable(parseLevel(keyDoor));
    expect(report.ok).toBe(true);
    expect(report.deadStateCount).toBe(0);
    expect(report.goalStatesFound).toBeGreaterThan(0);
    expect(report.truncated).toBe(false);
  });

  it('passes a block level where the block cannot ruin the route', () => {
    const report = proveSolvable(parseLevel(safeBlocks));
    expect(report.ok).toBe(true);
    expect(report.deadStateCount).toBe(0);
  });

  it('fails a level with a reachable dead state, and says how to reproduce it', () => {
    const report = proveSolvable(parseLevel(deadlockFixture));
    expect(report.ok).toBe(false);
    expect(report.deadStateCount).toBeGreaterThan(0);

    const dead = report.deadStates[0];
    expect(dead).toBeDefined();
    expect(dead?.seed).toMatch(/^[0-9a-f]{8}$/);
    // The dead state is reached by shoving the block down the only corridor.
    expect(dead?.repro).toContain('right');
  });

  it('treats a truncated search as a failure rather than a pass', () => {
    const report = proveSolvable(parseLevel(keyDoor), { maxStates: 5 });
    expect(report.truncated).toBe(true);
    expect(report.ok).toBe(false);
  });

  it('stays well inside the one-minute-per-level budget (SPEC 19)', () => {
    const report = proveSolvable(parseLevel(deadlockFixture));
    expect(report.elapsedMs).toBeLessThan(60_000);
  });
});
