/**
 * Integer-scale letterboxing for the v2 render target (SPEC 12, 30):
 * "Integer scaling only. The render target scales by a whole number to fit
 * the viewport, letterboxed. No fractional scaling, no filtering."
 *
 * Pure arithmetic, like `boardLayout.ts` — so the scale a level will render at
 * can be asserted without a browser.
 */

export const TILE_SIZE_PX = 16;

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface IntegerScaleLayout {
  /** Whole-number zoom applied to the render target. Never less than 1. */
  readonly scale: number;
  /** Scaled render target size, in device pixels. */
  readonly width: number;
  readonly height: number;
  /** Letterbox offset from the viewport's top-left, in device pixels. */
  readonly offsetX: number;
  readonly offsetY: number;
}

/**
 * Fit `content` inside `viewport` at the largest whole-number scale that still
 * fits, then centre it. A viewport smaller than the content still gets scale
 * 1 — the content is allowed to overflow rather than blur under a fractional
 * scale, because SPEC 12 forbids fractional scaling outright.
 */
export function computeIntegerScale(content: Size, viewport: Size): IntegerScaleLayout {
  const scaleX = Math.floor(viewport.width / content.width);
  const scaleY = Math.floor(viewport.height / content.height);
  const scale = Math.max(1, Math.min(scaleX, scaleY));

  const width = content.width * scale;
  const height = content.height * scale;

  return {
    scale,
    width,
    height,
    offsetX: Math.floor((viewport.width - width) / 2),
    offsetY: Math.floor((viewport.height - height) / 2),
  };
}

/** A grid's render target size in device pixels, before scaling. */
export function gridPixelSize(grid: { readonly width: number; readonly height: number }): Size {
  return { width: grid.width * TILE_SIZE_PX, height: grid.height * TILE_SIZE_PX };
}
