import { describe, expect, it } from 'vitest';
import { directionToward, isAdjacent, tileDistance } from '../../src/core/navigation.js';
import { resolveTapIntent } from '../../src/input/tap.js';

describe('directionToward', () => {
  const origin = { x: 4, y: 4 };

  it.each([
    ['right', { x: 7, y: 4 }],
    ['left', { x: 1, y: 4 }],
    ['down', { x: 4, y: 7 }],
    ['up', { x: 4, y: 1 }],
  ])('steps %s toward a tile on that axis', (expected, target) => {
    expect(directionToward(origin, target)).toBe(expected);
  });

  it('takes the dominant axis for an off-axis tap', () => {
    expect(directionToward(origin, { x: 8, y: 5 })).toBe('right');
    expect(directionToward(origin, { x: 5, y: 8 })).toBe('down');
  });

  it('breaks a diagonal tie horizontally', () => {
    expect(directionToward(origin, { x: 6, y: 6 })).toBe('right');
    expect(directionToward(origin, { x: 2, y: 2 })).toBe('left');
  });

  it('returns null for the tile the player is already on', () => {
    expect(directionToward(origin, origin)).toBeNull();
  });
});

describe('tap intents', () => {
  const player = { x: 4, y: 4 };

  it('reads a tap on the player as an act', () => {
    expect(resolveTapIntent(player, player)).toEqual({ type: 'act' });
  });

  it('reads a tap elsewhere as one step that way', () => {
    expect(resolveTapIntent(player, { x: 6, y: 4 })).toEqual({ type: 'move', direction: 'right' });
  });

  it('ignores a tap off the board', () => {
    expect(resolveTapIntent(player, null)).toBeNull();
  });
});

describe('grid helpers', () => {
  it('measures distance in taps', () => {
    expect(tileDistance({ x: 1, y: 1 }, { x: 4, y: 3 })).toBe(3);
  });

  it('knows orthogonal adjacency', () => {
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe(true);
    expect(isAdjacent({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);
  });
});
