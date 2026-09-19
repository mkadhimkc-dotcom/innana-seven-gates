import { describe, expect, it } from 'vitest';
import {
  guardianCycleFrames,
  guardianPositionAt,
  parsePlatformLevel,
  PlatformLevelError,
  MAX_PERIOD_FRAMES,
} from '../../src/core/platformLevel.js';
import { checkPlatformCoverage } from '../../src/core/validator/platformCoverage.js';
import good from '../fixtures/platform-level.json';

/** Clone the good fixture with one thing changed. */
function withField(overrides: Record<string, unknown>): unknown {
  return { ...structuredClone(good), ...overrides };
}

describe('v2 level loader', () => {
  it('parses a well-formed level', () => {
    const level = parsePlatformLevel(good);
    expect(level.id).toBe('fixture-platform');
    expect(level.grid.width).toBe(20);
    expect(level.gateCell).toEqual({ x: 3, y: 2 });
    expect(level.jewels).toHaveLength(2);
    expect(level.guardians).toHaveLength(1);
    expect(level.axes[0]?.uses).toBe(2);
    expect(level.periodFrames).toBe(120);
  });

  it.each([
    ['a missing id', withField({ id: '' }), /id/],
    ['a gate number out of range', withField({ gate: 9 }), /gate: must be <= 7/],
    ['a ragged grid', withField({ grid: ['####', '###'] }), /expected 4/],
    ['a start on solid brick', withField({ start: { x: 0, y: 0 } }), /not an open tile/],
    ['a start on spikes', withField({ start: { x: 12, y: 5 } }), /may not start on spikes/],
    ['no jewels at all', withField({ jewels: [] }), /jewels: must NOT have fewer than 1/],
    ['a jewel inside a wall', withField({ jewels: [{ id: 'j', at: { x: 0, y: 0 } }] }), /not an open tile/],
    ['a period over the cap', withField({ periodFrames: MAX_PERIOD_FRAMES + 1 }), /periodFrames: must be <= 256/],
  ])('rejects %s, naming the problem', (_label, broken, pattern) => {
    expect(() => parsePlatformLevel(broken)).toThrow(PlatformLevelError);
    expect(() => parsePlatformLevel(broken)).toThrow(pattern);
  });

  it('rejects a grid without exactly one gate', () => {
    const noGate = withField({ grid: (good.grid as string[]).map((r) => r.replace('G', '.')) });
    expect(() => parsePlatformLevel(noGate)).toThrow(/exactly one gate tile, found 0/);
  });

  it('rejects two entities on the same cell', () => {
    const stacked = withField({
      jewels: [
        { id: 'jewel-1', at: { x: 8, y: 1 } },
        { id: 'jewel-2', at: { x: 8, y: 1 } },
      ],
    });
    expect(() => parsePlatformLevel(stacked)).toThrow(/two things occupy 8,1/);
  });

  it('rejects duplicate entity ids', () => {
    const dupe = withField({ axes: [{ id: 'jewel-1', at: { x: 2, y: 1 }, uses: 1 }] });
    expect(() => parsePlatformLevel(dupe)).toThrow(/duplicate entity id/);
  });
});

describe('SPEC 9 level budget', () => {
  it.each([
    ['too many jewels', 'jewels', 9, /jewels: must NOT have more than 8 items/],
    ['too many guardians', 'guardians', 5, /guardians: must NOT have more than 4 items/],
  ])('rejects %s', (_label, key, count, pattern) => {
    const entries =
      key === 'jewels'
        ? Array.from({ length: count }, (_, i) => ({ id: `j${i}`, at: { x: 5 + i, y: 1 } }))
        : Array.from({ length: count }, (_, i) => ({
            id: `g${i}`,
            route: [
              { x: 7, y: 4 },
              { x: 8, y: 4 },
            ],
            stepFrames: 10,
          }));
    expect(() => parsePlatformLevel(withField({ [key]: entries }))).toThrow(pattern);
  });

  it('rejects more total axe uses than the cap', () => {
    const greedy = withField({ axes: [{ id: 'axe-1', at: { x: 2, y: 1 }, uses: 5 }] });
    expect(() => parsePlatformLevel(greedy)).toThrow(/axes\.0\.uses: must be <= 4/);
  });

  it('enforces the total-axe-uses cap across several pickups, which the schema cannot see', () => {
    // Each pickup is within the per-pickup maximum; the sum is not.
    const spread = withField({
      axes: [
        { id: 'axe-1', at: { x: 2, y: 1 }, uses: 3 },
        { id: 'axe-2', at: { x: 5, y: 1 }, uses: 3 },
      ],
    });
    expect(() => parsePlatformLevel(spread)).toThrow(/total uses is over the SPEC 9 cap of 4/);
  });

  it('rejects more breakable blocks than the cap', () => {
    const rows = structuredClone(good.grid as string[]);
    rows[1] = '#' + 'b'.repeat(18) + '#';
    expect(() => parsePlatformLevel(withField({ grid: rows }))).toThrow(/over the SPEC 9 cap of 10/);
  });
});

describe('SPEC 16 guardian period', () => {
  it('accepts a cycle that divides the declared period', () => {
    // 4 cells x 10 frames = 40, and 120 % 40 === 0.
    const level = parsePlatformLevel(good);
    expect(guardianCycleFrames(level.guardians[0]!)).toBe(40);
  });

  it('rejects a cycle that does not divide the period', () => {
    const odd = withField({
      guardians: [
        {
          id: 'guard-1',
          route: [
            { x: 7, y: 4 },
            { x: 8, y: 4 },
            { x: 9, y: 4 },
          ],
          stepFrames: 7,
        },
      ],
    });
    // 3 x 7 = 21, and 120 % 21 !== 0.
    expect(() => parsePlatformLevel(odd)).toThrow(/does not divide the level period of 120/);
  });

  it('rejects a route shorter than two cells', () => {
    const stuck = withField({
      guardians: [{ id: 'g', route: [{ x: 7, y: 4 }], stepFrames: 10 }],
    });
    expect(() => parsePlatformLevel(stuck)).toThrow(/route: must NOT have fewer than 2 items/);
  });

  it('rejects a route through solid brick', () => {
    const inWall = withField({
      guardians: [
        { id: 'g', route: [{ x: 0, y: 0 }, { x: 8, y: 4 }], stepFrames: 10 },
      ],
    });
    expect(() => parsePlatformLevel(inWall)).toThrow(/not an open tile/);
  });
});

describe('guardian position is a pure function of phase (SPEC 16, D-007)', () => {
  const level = parsePlatformLevel(good);
  const guard = level.guardians[0]!;

  it('walks its route one cell per stepFrames', () => {
    expect(guardianPositionAt(guard, 0)).toEqual({ x: 7, y: 4 });
    expect(guardianPositionAt(guard, 9)).toEqual({ x: 7, y: 4 });
    expect(guardianPositionAt(guard, 10)).toEqual({ x: 8, y: 4 });
    expect(guardianPositionAt(guard, 30)).toEqual({ x: 8, y: 4 });
  });

  it('repeats exactly once per cycle, forever', () => {
    const cycle = guardianCycleFrames(guard);
    for (const phase of [0, 3, 17, 29, 39]) {
      expect(guardianPositionAt(guard, phase + cycle)).toEqual(guardianPositionAt(guard, phase));
      expect(guardianPositionAt(guard, phase + cycle * 100)).toEqual(
        guardianPositionAt(guard, phase),
      );
    }
  });

  it('depends on nothing but the guardian and the phase', () => {
    // Called a hundred times in a scrambled order, every answer identical.
    const first = Array.from({ length: 40 }, (_, p) => guardianPositionAt(guard, p));
    const shuffled = [...first.keys()].sort((a, b) => ((a * 7) % 40) - ((b * 7) % 40));
    for (const p of shuffled) expect(guardianPositionAt(guard, p)).toEqual(first[p]);
  });
});

describe('unknown-feature guard', () => {
  it('passes a level built only from modeled features', () => {
    expect(checkPlatformCoverage(good)).toEqual([]);
  });

  it('names an unmodeled tile code', () => {
    const rows = structuredClone(good.grid as string[]);
    rows[1] = rows[1]!.replace('.', 'W');
    const findings = checkPlatformCoverage(withField({ grid: rows }));
    expect(findings[0]?.kind).toBe('tile');
    expect(findings[0]?.name).toBe('W');
  });

  it('names an unmodeled level field', () => {
    const findings = checkPlatformCoverage(withField({ conveyors: [] }));
    expect(findings.map((f) => f.name)).toContain('conveyors');
  });

  it('names an unmodeled entity field', () => {
    const findings = checkPlatformCoverage(
      withField({ guardians: [{ id: 'g', route: [], stepFrames: 1, seeksPlayer: true }] }),
    );
    expect(findings.map((f) => f.name)).toContain('seeksPlayer');
  });

  it('fails the load, not just the report', () => {
    expect(() => parsePlatformLevel(withField({ conveyors: [] }))).toThrow(PlatformLevelError);
    expect(() => parsePlatformLevel(withField({ conveyors: [] }))).toThrow(/not tracked by the v2 state model/);
  });
});
