import { describe, expect, it } from 'vitest';
import { computeLayout, pointToTile, tileCenter } from '../../src/ui/boardLayout.js';
import { parseLevel } from '../../src/core/level.js';
import gate0101 from '../../levels/gate-01/gate-01-01.json';

const level = parseLevel(gate0101);

describe('board layout', () => {
  it('fits the whole room inside the viewport', () => {
    const layout = computeLayout(level, { width: 960, height: 540 });
    expect(layout.width).toBeLessThanOrEqual(960);
    expect(layout.height).toBeLessThanOrEqual(540);
    expect(layout.tileSize).toBeGreaterThan(0);
  });

  it('leaves room for the HUD on a short phone viewport', () => {
    const layout = computeLayout(level, { width: 720, height: 360 });
    expect(layout.width).toBeLessThanOrEqual(720);
    expect(layout.height).toBeLessThanOrEqual(360 - 64);
  });

  it('round-trips a tile through its centre', () => {
    const layout = computeLayout(level, { width: 960, height: 540 });
    for (const tile of [
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 8, y: 8 },
    ]) {
      expect(pointToTile(layout, level, tileCenter(layout, tile))).toEqual(tile);
    }
  });

  it('returns null for a point outside the room', () => {
    const layout = computeLayout(level, { width: 960, height: 540 });
    expect(pointToTile(layout, level, { x: 0, y: 0 })).toBeNull();
    expect(pointToTile(layout, level, { x: 959, y: 539 })).toBeNull();
  });
});
