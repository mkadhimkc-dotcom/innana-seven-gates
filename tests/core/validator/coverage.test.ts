import { describe, expect, it } from 'vitest';
import {
  checkModelCoverage,
  MODELED_ITEM_KINDS,
  MODELED_TILE_CODES,
} from '../../../src/core/validator/coverage.js';
import { LevelParseError, parseLevel } from '../../../src/core/level.js';
import keyDoor from '../../fixtures/solvable-key-door.json';
import pressurePlate from '../../fixtures/unmodeled-pressure-plate.json';

/**
 * A feature the proof does not model must never pass silently (SPEC 18). These
 * tests are the guard on that guard: if someone adds a mechanic to the schema
 * or the level format without teaching the state model about it, validation has
 * to fail and name the thing.
 */
describe('unknown-feature guard', () => {
  it('passes a level built only from modeled features', () => {
    expect(checkModelCoverage(keyDoor)).toEqual([]);
  });

  it('names an unmodeled tile code', () => {
    const findings = checkModelCoverage(pressurePlate);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('tile');
    expect(findings[0]?.name).toBe('P');
    expect(findings[0]?.where).toBe('tiles[1][2]');
    expect(findings[0]?.message).toMatch(/not tracked by the state model/);
  });

  it('fails validation for a level using an unmodeled feature', () => {
    // The whole point: npm run validate must refuse this level, not prove it.
    expect(() => parseLevel(pressurePlate)).toThrow(LevelParseError);
    expect(() => parseLevel(pressurePlate)).toThrow(/tile code "P"/);
  });

  it('names an unmodeled item kind', () => {
    const withLantern = {
      ...keyDoor,
      items: [{ id: 'lantern-1', kind: 'lantern', at: { x: 1, y: 1 } }],
    };
    const findings = checkModelCoverage(withLantern);
    expect(findings.map((f) => f.kind)).toContain('item');
    expect(findings.find((f) => f.kind === 'item')?.name).toBe('lantern');
  });

  it('names an unmodeled top-level field', () => {
    const withSwitches = { ...keyDoor, switches: [{ id: 'sw-1', at: { x: 2, y: 1 } }] };
    const findings = checkModelCoverage(withSwitches);
    expect(findings.map((f) => f.kind)).toContain('field');
    expect(findings.find((f) => f.kind === 'field')?.name).toBe('switches');
  });

  it('reports every unmodeled feature at once, not just the first', () => {
    const messy = {
      ...keyDoor,
      switches: [],
      items: [{ id: 'x', kind: 'lantern', at: { x: 1, y: 1 } }],
    };
    expect(checkModelCoverage(messy).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the modeled registries in step with the loader', () => {
    expect([...MODELED_TILE_CODES].sort()).toEqual(['#', '.', '^', 'G', 'L', '~'].sort());
    expect([...MODELED_ITEM_KINDS].sort()).toEqual(['key', 'torch', 'treasure']);
  });
});
