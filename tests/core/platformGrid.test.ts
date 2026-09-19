import { describe, expect, it } from 'vitest';
import {
  MAX_GRID_HEIGHT,
  MAX_GRID_WIDTH,
  createPlatformGrid,
  platformTileAt,
} from '../../src/core/platformGrid.js';

describe('v2 platform grid (SPEC 9)', () => {
  it('parses every known tile code', () => {
    const grid = createPlatformGrid(['#.bH', 'G^..']);
    expect(platformTileAt(grid, { x: 0, y: 0 })).toBe('solid');
    expect(platformTileAt(grid, { x: 1, y: 0 })).toBe('empty');
    expect(platformTileAt(grid, { x: 2, y: 0 })).toBe('breakable');
    expect(platformTileAt(grid, { x: 3, y: 0 })).toBe('ladder');
    expect(platformTileAt(grid, { x: 0, y: 1 })).toBe('gate');
    expect(platformTileAt(grid, { x: 1, y: 1 })).toBe('spikes');
  });

  it('records width and height from the rows', () => {
    const grid = createPlatformGrid(['###', '...']);
    expect(grid.width).toBe(3);
    expect(grid.height).toBe(2);
  });

  it('returns null outside the grid', () => {
    const grid = createPlatformGrid(['..', '..']);
    expect(platformTileAt(grid, { x: -1, y: 0 })).toBeNull();
    expect(platformTileAt(grid, { x: 0, y: -1 })).toBeNull();
    expect(platformTileAt(grid, { x: 2, y: 0 })).toBeNull();
    expect(platformTileAt(grid, { x: 0, y: 2 })).toBeNull();
  });

  it('refuses an unknown tile code', () => {
    expect(() => createPlatformGrid(['.X.'])).toThrow(/unknown tile code/);
  });

  it('refuses rows of unequal width', () => {
    expect(() => createPlatformGrid(['...', '..'])).toThrow(/expected 3/);
  });

  it('refuses an empty grid', () => {
    expect(() => createPlatformGrid([])).toThrow(/at least one row/);
  });

  it('enforces the SPEC 9 grid cap', () => {
    const tooWide = ['.'.repeat(MAX_GRID_WIDTH + 1)];
    expect(() => createPlatformGrid(tooWide)).toThrow(/32/);

    const tooTall = new Array(MAX_GRID_HEIGHT + 1).fill('.');
    expect(() => createPlatformGrid(tooTall)).toThrow(/24/);
  });

  it('accepts a grid right at the cap', () => {
    const row = '.'.repeat(MAX_GRID_WIDTH);
    const atCap = new Array(MAX_GRID_HEIGHT).fill(row);
    const grid = createPlatformGrid(atCap);
    expect(grid.width).toBe(MAX_GRID_WIDTH);
    expect(grid.height).toBe(MAX_GRID_HEIGHT);
  });
});
