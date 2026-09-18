import { describe, expect, it } from 'vitest';
import { LevelParseError, initialState, parseLevel } from '../../src/core/level.js';
import keyDoor from '../fixtures/solvable-key-door.json';

describe('level parsing', () => {
  it('parses a level into tiles, entities and dimensions', () => {
    const level = parseLevel(keyDoor);
    expect(level.width).toBe(7);
    expect(level.height).toBe(5);
    expect(level.tiles[0]?.[0]).toBe('wall');
    expect(level.tiles[3]?.[5]).toBe('goal');
    expect(level.items).toHaveLength(1);
    expect(level.doors[0]?.color).toBe('gold');
  });

  it('builds a starting state with items on the ground and nothing carried', () => {
    const state = initialState(parseLevel(keyDoor));
    expect(state.carrying).toEqual([]);
    expect(state.openDoors).toEqual([]);
    expect(state.ground['key-gold']).toEqual({ x: 3, y: 1 });
  });

  it.each([
    ['a ragged grid', { ...keyDoor, tiles: ['####', '###'] }],
    ['an unknown tile code', { ...keyDoor, tiles: ['####', '#Z.#', '####'] }],
    ['a level with no goal', { ...keyDoor, tiles: ['#####', '#...#', '#####'] }],
    ['a player outside the grid', { ...keyDoor, player: { x: 99, y: 0 } }],
    ['a gate number out of range', { ...keyDoor, gate: 9 }],
  ])('rejects %s', (_label, broken) => {
    expect(() => parseLevel(broken)).toThrow(LevelParseError);
  });

  it('rejects a door with no key of its colour (SPEC 14)', () => {
    const orphanDoor = {
      ...keyDoor,
      items: [],
      doors: [{ id: 'door-gold', color: 'gold', at: { x: 4, y: 3 } }],
    };
    expect(() => parseLevel(orphanDoor)).toThrow(/no key of that colour/);
  });

  describe('routes, critical path, and seed (SPEC 9, 16, 52 Q25, 38-39)', () => {
    const SAFE_ROUTE = [
      'right', 'right', 'pickup', 'left', 'left', 'down', 'down', 'right', 'right', 'right', 'right',
    ];

    it('parses a schema-valid level carrying routes, a critical path, and a seed', () => {
      const level = parseLevel({
        ...keyDoor,
        routes: { safe: SAFE_ROUTE, standard: SAFE_ROUTE, expert: SAFE_ROUTE },
        criticalPath: SAFE_ROUTE,
        seed: 42,
      });
      expect(level.routes.safe).toEqual(SAFE_ROUTE);
      expect(level.criticalPath).toEqual(SAFE_ROUTE);
      expect(level.seed).toBe(42);
    });

    it.each([
      ['no routes at all', (() => { const { routes: _r, ...rest } = keyDoor; return rest; })()],
      ['no seed', (() => { const { seed: _s, ...rest } = keyDoor; return rest; })()],
      [
        'an action token the schema does not recognise',
        { ...keyDoor, routes: { safe: ['sideways'], standard: [], expert: [] } },
      ],
      [
        'an unknown top-level property',
        { ...keyDoor, notInTheSchema: true },
      ],
    ])('rejects %s', (_label, broken) => {
      expect(() => parseLevel(broken)).toThrow(LevelParseError);
    });

    it('rejects a route that takes an illegal move', () => {
      const broken = {
        ...keyDoor,
        routes: { safe: ['up'], standard: [], expert: [] },
        criticalPath: [],
      };
      expect(() => parseLevel(broken)).toThrow(/routes\.safe\[0\].*not a legal move/);
    });

    it('rejects a route that never reaches the goal', () => {
      const broken = {
        ...keyDoor,
        routes: { safe: ['right'], standard: [], expert: [] },
        criticalPath: [],
      };
      expect(() => parseLevel(broken)).toThrow(/routes\.safe.*do not end on the goal tile/);
    });

    it('accepts an empty route or critical path without replaying it', () => {
      // Fixtures built to exercise one rule (SPEC 19 deadlock fixtures, say)
      // aren't full levels and shouldn't need a hand-solved walkthrough.
      const level = parseLevel(keyDoor);
      expect(level.routes.safe).toEqual([]);
      expect(level.criticalPath).toEqual([]);
    });
  });
});
