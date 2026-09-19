import { describe, expect, it } from 'vitest';
import { DEMO_PLATFORM_GRID } from '../../src/scenes/demoGrid.js';
import { platformTileAt } from '../../src/core/platformGrid.js';

describe('S-20 demo grid', () => {
  it('parses to the declared size', () => {
    expect(DEMO_PLATFORM_GRID.width).toBe(20);
    expect(DEMO_PLATFORM_GRID.height).toBe(12);
  });

  it('is bordered by solid tiles', () => {
    for (let x = 0; x < DEMO_PLATFORM_GRID.width; x += 1) {
      expect(platformTileAt(DEMO_PLATFORM_GRID, { x, y: 0 })).toBe('solid');
      expect(platformTileAt(DEMO_PLATFORM_GRID, { x, y: DEMO_PLATFORM_GRID.height - 1 })).toBe(
        'solid',
      );
    }
  });

  it('contains one of every v2 tile kind', () => {
    const seen = new Set<string>();
    for (let y = 0; y < DEMO_PLATFORM_GRID.height; y += 1) {
      for (let x = 0; x < DEMO_PLATFORM_GRID.width; x += 1) {
        const tile = platformTileAt(DEMO_PLATFORM_GRID, { x, y });
        if (tile) seen.add(tile);
      }
    }
    expect(seen).toEqual(new Set(['solid', 'empty', 'gate', 'spikes', 'breakable', 'ladder']));
  });
});
