/**
 * Drawing the v2 tile grid.
 *
 * Phaser-aware but rule-free, same split as `roomArt.ts` (ADR-001). Flat
 * fills, dark outlines, no particles, no realistic shading (SPEC 46).
 * Breakable blocks read distinct from solid brick at a glance, and the gate
 * is the one animated tile in this scene: SPEC 12's two-frame swap, applied
 * here because nothing else in the grid moves yet (S-23 gives it jewels,
 * S-25 gives it guardians).
 */

import Phaser from 'phaser';
import type { AnimationFrame } from '../core/animation.js';
import type { PlatformTile } from '../core/platformGrid.js';
import { PALETTE } from './palette.js';

type G = Phaser.GameObjects.Graphics;

export const PLATFORM_TILE_COLORS: Readonly<Record<PlatformTile, number>> = {
  empty: PALETTE.deepBlue,
  solid: PALETTE.terracotta,
  breakable: PALETTE.gold,
  ladder: PALETTE.sand,
  gate: PALETTE.lapis,
  spikes: PALETTE.hazardRed,
};

function drawSolid(g: G, left: number, top: number, size: number, y: number): void {
  g.fillStyle(PALETTE.terracotta, 1);
  g.fillRect(left, top, size, size);
  g.lineStyle(Math.max(1, size * 0.04), PALETTE.outline, 0.32);
  g.lineBetween(left, top + size / 2, left + size, top + size / 2);
  const offset = y % 2 === 0 ? size * 0.5 : 0;
  g.lineBetween(left + offset, top, left + offset, top + size / 2);
}

/** Cracked, gold-veined brick: distinct from solid by shape, not only colour. */
function drawBreakable(g: G, left: number, top: number, size: number): void {
  g.fillStyle(PALETTE.terracotta, 1);
  g.fillRect(left, top, size, size);
  g.lineStyle(Math.max(1, size * 0.06), PALETTE.gold, 0.8);
  g.lineBetween(left + size * 0.2, top + size * 0.15, left + size * 0.55, top + size * 0.5);
  g.lineBetween(left + size * 0.55, top + size * 0.5, left + size * 0.35, top + size * 0.85);
  g.lineBetween(left + size * 0.55, top + size * 0.5, left + size * 0.85, top + size * 0.65);
}

function drawLadder(g: G, left: number, top: number, size: number): void {
  g.fillStyle(PALETTE.deepBlue, 1);
  g.fillRect(left, top, size, size);
  g.lineStyle(Math.max(1, size * 0.08), PALETTE.sand, 0.9);
  g.lineBetween(left + size * 0.28, top, left + size * 0.28, top + size);
  g.lineBetween(left + size * 0.72, top, left + size * 0.72, top + size);
  for (let i = 0; i < 3; i += 1) {
    const ry = top + size * (0.2 + i * 0.3);
    g.lineBetween(left + size * 0.28, ry, left + size * 0.72, ry);
  }
}

function drawSpikes(g: G, left: number, top: number, size: number): void {
  g.fillStyle(PALETTE.deepBlue, 1);
  g.fillRect(left, top, size, size);
  g.fillStyle(PALETTE.hazardRed, 1);
  for (let i = 0; i < 3; i += 1) {
    const sx = left + size * (0.12 + i * 0.3);
    g.fillTriangle(
      sx, top + size * 0.85,
      sx + size * 0.13, top + size * 0.3,
      sx + size * 0.26, top + size * 0.85,
    );
  }
}

/** The gate: two frames, lit and dim, swapped at 8fps (SPEC 12). */
function drawGate(g: G, left: number, top: number, size: number, frame: AnimationFrame): void {
  g.fillStyle(PALETTE.deepBlue, 1);
  g.fillRect(left, top, size, size);
  const cx = left + size / 2;
  const cy = top + size / 2;
  g.fillStyle(PALETTE.lapis, frame === 0 ? 1 : 0.6);
  g.fillCircle(cx, cy, size * 0.32);
  g.lineStyle(Math.max(1, size * 0.06), PALETTE.gold, frame === 0 ? 1 : 0.7);
  g.strokeCircle(cx, cy, size * 0.32);
}

function drawEmpty(g: G, left: number, top: number, size: number): void {
  g.fillStyle(PALETTE.deepBlue, 1);
  g.fillRect(left, top, size, size);
}

/** Draw one 16x16 tile at its pixel origin, already scaled to `size`. */
export function drawPlatformTile(
  g: G,
  left: number,
  top: number,
  size: number,
  tile: PlatformTile,
  y: number,
  frame: AnimationFrame,
): void {
  switch (tile) {
    case 'solid':
      drawSolid(g, left, top, size, y);
      return;
    case 'breakable':
      drawBreakable(g, left, top, size);
      return;
    case 'ladder':
      drawLadder(g, left, top, size);
      return;
    case 'spikes':
      drawSpikes(g, left, top, size);
      return;
    case 'gate':
      drawGate(g, left, top, size, frame);
      return;
    case 'empty':
      drawEmpty(g, left, top, size);
      return;
  }
}
