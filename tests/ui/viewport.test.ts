import { describe, expect, it } from 'vitest';
import { computeIntegerScale, gridPixelSize, TILE_SIZE_PX } from '../../src/ui/viewport.js';

describe('integer-scale letterboxing (SPEC 12, 30)', () => {
  it('scales by the largest whole number that still fits', () => {
    // 320x192 content (20x12 tiles) in a 968x550 viewport: floor(968/320)=3,
    // floor(550/192)=2 -> the smaller wins.
    const layout = computeIntegerScale({ width: 320, height: 192 }, { width: 968, height: 550 });
    expect(layout.scale).toBe(2);
    expect(layout.width).toBe(640);
    expect(layout.height).toBe(384);
  });

  it('never scales fractionally, even when nothing fits exactly', () => {
    const layout = computeIntegerScale({ width: 100, height: 100 }, { width: 149, height: 999 });
    expect(Number.isInteger(layout.scale)).toBe(true);
    expect(layout.scale).toBe(1);
  });

  it('floors to scale 1 rather than shrink below it', () => {
    // Viewport smaller than the content on one axis.
    const layout = computeIntegerScale({ width: 320, height: 192 }, { width: 200, height: 999 });
    expect(layout.scale).toBe(1);
  });

  it('letterboxes by centering the scaled content in the viewport', () => {
    const layout = computeIntegerScale({ width: 320, height: 192 }, { width: 968, height: 550 });
    expect(layout.offsetX).toBe(Math.floor((968 - layout.width) / 2));
    expect(layout.offsetY).toBe(Math.floor((550 - layout.height) / 2));
    expect(layout.offsetX).toBeGreaterThanOrEqual(0);
    expect(layout.offsetY).toBeGreaterThanOrEqual(0);
  });

  it('derives a grid pixel size from 16x16 tiles', () => {
    expect(gridPixelSize({ width: 20, height: 12 })).toEqual({
      width: 20 * TILE_SIZE_PX,
      height: 12 * TILE_SIZE_PX,
    });
  });
});
