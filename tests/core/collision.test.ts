import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/core/level.js';
import { applyMove } from '../../src/core/state.js';
import { blockAt, tileAt } from '../../src/core/board.js';
import type { Direction, GameState, Move, Position } from '../../src/core/types.js';
import collisionRoom from '../fixtures/collision-room.json';

/**
 * Collision edge cases (S-01).
 *
 * Every case is asserted against the rules in `src/core/`, which is the same
 * code the validator proves levels with — so a regression here would surface as
 * both a gameplay bug and a false proof.
 *
 * The fixture room lays the cases out side by side:
 *
 *   row 2   blocks at x = 2, 4, 6, 8
 *   row 3   water   lava   spike   wall   (directly below each block)
 *   row 4   blocks and an item and a locked door, for horizontal pushes
 */
const level = parseLevel(collisionRoom);

const step = (direction: Direction): Move => ({ type: 'move', direction });

/** Put the player somewhere without walking there, to isolate one case. */
function at(player: Position, overrides: Partial<GameState> = {}): GameState {
  return {
    player,
    blocks: [...level.blocks],
    carrying: [],
    ground: Object.fromEntries(level.items.map((item) => [item.id, item.at])),
    openDoors: [],
    ...overrides,
  };
}

describe('player collision', () => {
  it('refuses to walk into a wall', () => {
    expect(applyMove(level, at({ x: 1, y: 1 }), step('up'))).toBeNull();
    expect(applyMove(level, at({ x: 1, y: 1 }), step('left'))).toBeNull();
  });

  it('refuses to walk off the grid', () => {
    // The border is wall, so leaving the grid is refused before bounds even
    // matter — assert the tile lookup agrees rather than trusting the wall.
    expect(tileAt(level, { x: -1, y: 1 })).toBeUndefined();
    expect(tileAt(level, { x: 12, y: 1 })).toBeUndefined();
    expect(applyMove(level, at({ x: 10, y: 1 }), step('right'))).toBeNull();
  });

  it.each([
    ['water', { x: 2, y: 3 }],
    ['lava', { x: 4, y: 3 }],
    ['spike', { x: 6, y: 3 }],
  ])('refuses to step into %s (D-001: hazards are impassable)', (_kind, hazard) => {
    const above = { x: hazard.x, y: hazard.y - 1 };
    // Clear the block sitting above the hazard so the refusal is the tile's.
    const state = at(above, { blocks: level.blocks.filter((b) => !(b.x === above.x && b.y === above.y)) });
    expect(applyMove(level, state, step('down'))).toBeNull();
  });

  it('walks onto floor and onto the goal', () => {
    expect(applyMove(level, at({ x: 1, y: 5 }), step('down'))?.player).toEqual({ x: 1, y: 6 });
    expect(applyMove(level, at({ x: 9, y: 6 }), step('right'))?.player).toEqual({ x: 10, y: 6 });
  });
});

describe('block collision (SPEC 13)', () => {
  it.each([
    ['water', { x: 2, y: 1 }, { x: 2, y: 2 }],
    ['lava', { x: 4, y: 1 }, { x: 4, y: 2 }],
  ])('sinks a block pushed into %s, one-way', (_kind, from, block) => {
    const next = applyMove(level, at(from), step('down'));
    expect(next).not.toBeNull();
    expect(next?.blocks).toHaveLength(level.blocks.length - 1);
    expect(blockAt(next as GameState, block)).toBe(false);
    expect(next?.player).toEqual(block);
  });

  it('stops a block before a spike rather than consuming it', () => {
    expect(applyMove(level, at({ x: 6, y: 1 }), step('down'))).toBeNull();
  });

  it('stops a block at a wall', () => {
    expect(applyMove(level, at({ x: 8, y: 1 }), step('down'))).toBeNull();
  });

  it('refuses to push a block into another block', () => {
    expect(applyMove(level, at({ x: 2, y: 4 }), step('right'))).toBeNull();
  });

  it('refuses to push a block onto an item (D-002)', () => {
    expect(applyMove(level, at({ x: 5, y: 4 }), step('right'))).toBeNull();
  });

  it('refuses to push a block into a locked door', () => {
    expect(applyMove(level, at({ x: 7, y: 4 }), step('right'))).toBeNull();
  });

  it('refuses to push a block off the grid', () => {
    const state = at({ x: 9, y: 2 }, { blocks: [{ x: 10, y: 2 }] });
    expect(applyMove(level, state, step('right'))).toBeNull();
  });

  it('never pulls a block', () => {
    const pushed = applyMove(level, at({ x: 2, y: 1 }), step('down')) as GameState;
    const backedOff = applyMove(level, pushed, step('up'));
    expect(backedOff?.player).toEqual({ x: 2, y: 1 });
    expect(backedOff?.blocks).toEqual(pushed.blocks);
  });
});

describe('door collision (SPEC 14)', () => {
  const door = { x: 9, y: 4 };

  it('refuses a locked door without the matching key', () => {
    const state = at({ x: 8, y: 4 }, { blocks: [] });
    expect(applyMove(level, state, step('right'))).toBeNull();
  });

  it('opens a locked door with the matching key, and it stays open', () => {
    const state = at({ x: 8, y: 4 }, { blocks: [], carrying: ['key-gold'], ground: {} });
    const opened = applyMove(level, state, step('right'));
    expect(opened?.player).toEqual(door);
    expect(opened?.openDoors).toEqual(['door-gold']);

    const away = applyMove(level, opened as GameState, step('left')) as GameState;
    const dropped = { ...away, carrying: [] };
    expect(applyMove(level, dropped, step('right'))?.player).toEqual(door);
  });

  it('refuses a door tile occupied by a block, key or not', () => {
    const state = at({ x: 8, y: 4 }, { blocks: [door], carrying: ['key-gold'], ground: {} });
    expect(applyMove(level, state, step('right'))).toBeNull();
  });
});

describe('item collision (SPEC 12, 14)', () => {
  it('refuses a pickup on a tile holding nothing', () => {
    expect(applyMove(level, at({ x: 1, y: 1 }), { type: 'pickup' })).toBeNull();
  });

  it('picks up the item underfoot', () => {
    const state = at({ x: 7, y: 4 });
    const held = applyMove(level, state, { type: 'pickup' });
    expect(held?.carrying).toEqual(['key-gold']);
    expect(held?.ground['key-gold']).toBeUndefined();
  });

  it('refuses to drop an item the player is not carrying', () => {
    expect(applyMove(level, at({ x: 1, y: 1 }), { type: 'drop', itemId: 'key-gold' })).toBeNull();
  });

  it('refuses to drop onto a tile that already holds an item', () => {
    const state = at({ x: 7, y: 4 }, { carrying: ['key-gold'] });
    expect(applyMove(level, state, { type: 'drop', itemId: 'key-gold' })).toBeNull();
  });
});
