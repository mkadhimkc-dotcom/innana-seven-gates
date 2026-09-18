import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../../src/core/level.js';
import { detectBlockDeadlocks } from '../../../src/core/validator/deadlock.js';
import deadlockFixture from '../../fixtures/deadlock-block-on-goal.json';
import safeBlocks from '../../fixtures/deadlock-free-blocks.json';
import keyDoor from '../../fixtures/solvable-key-door.json';

describe('block deadlock detection (SPEC 19)', () => {
  it('names the push that killed the level', () => {
    const report = detectBlockDeadlocks(parseLevel(deadlockFixture));
    expect(report.ok).toBe(false);
    expect(report.findings.length).toBeGreaterThan(0);

    const finding = report.findings[0];
    expect(finding?.kind).toBe('cornered');
    expect(finding?.to).toEqual({ x: 5, y: 2 });
    expect(finding?.repro.length).toBeGreaterThan(0);
    expect(finding?.seed).toMatch(/^[0-9a-f]{8}$/);
  });

  it('passes a block level with no irreversible, fatal push', () => {
    const report = detectBlockDeadlocks(parseLevel(safeBlocks));
    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it('is a no-op on levels without blocks', () => {
    const report = detectBlockDeadlocks(parseLevel(keyDoor));
    expect(report.ok).toBe(true);
    expect(report.blockCount).toBe(0);
    expect(report.irreversiblePushes).toBe(0);
  });

  it('completes in under a minute (SPEC 19)', () => {
    const report = detectBlockDeadlocks(parseLevel(deadlockFixture));
    expect(report.elapsedMs).toBeLessThan(60_000);
  });
});
