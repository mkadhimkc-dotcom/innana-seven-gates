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
});
