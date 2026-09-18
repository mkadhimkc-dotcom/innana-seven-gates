/**
 * Drawing the room.
 *
 * Phaser-aware but rule-free: every function here takes what to draw and where,
 * and decides nothing about what is legal. Flat fills, dark outlines, no
 * particles, no realistic shading (SPEC 46); Mesopotamian palette (SPEC 17).
 */

import Phaser from 'phaser';
import type { DoorDefinition, ItemDefinition, Position, Tile } from '../core/index.js';
import { PALETTE } from './palette.js';
import { tileOrigin, type BoardLayout } from './boardLayout.js';

type G = Phaser.GameObjects.Graphics;

/** Deterministic 0..1 from a tile, so decoration never shimmers between frames. */
function jitter(x: number, y: number, salt: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function drawFloor(g: G, left: number, top: number, size: number, x: number, y: number): void {
  g.fillStyle(PALETTE.sand, 1);
  g.fillRect(left, top, size, size);

  // Cuneiform wedges, faint, so the floor reads as carved rather than blank.
  const wedges = jitter(x, y, 1) > 0.55 ? 2 : 1;
  g.fillStyle(PALETTE.outline, 0.13);
  for (let i = 0; i < wedges; i += 1) {
    const wx = left + size * (0.22 + jitter(x, y, i + 2) * 0.5);
    const wy = top + size * (0.25 + jitter(x, y, i + 5) * 0.45);
    const w = size * 0.16;
    g.fillTriangle(wx, wy, wx + w, wy + w * 0.35, wx, wy + w * 0.7);
  }
}

function drawWall(g: G, left: number, top: number, size: number, y: number): void {
  g.fillStyle(PALETTE.terracotta, 1);
  g.fillRect(left, top, size, size);

  // Two courses of brick, offset on alternate rows.
  g.lineStyle(Math.max(1, size * 0.04), PALETTE.outline, 0.32);
  g.lineBetween(left, top + size / 2, left + size, top + size / 2);
  const offset = y % 2 === 0 ? size * 0.5 : 0;
  g.lineBetween(left + offset, top, left + offset, top + size / 2);
  const lower = y % 2 === 0 ? 0 : size * 0.5;
  g.lineBetween(left + lower, top + size / 2, left + lower, top + size);
}

function drawGoal(g: G, left: number, top: number, size: number): void {
  g.fillStyle(PALETTE.sand, 1);
  g.fillRect(left, top, size, size);

  const cx = left + size / 2;
  const cy = top + size / 2;

  // Sun disc: the way out, and the brightest thing in the room.
  g.fillStyle(PALETTE.gold, 1);
  g.fillCircle(cx, cy, size * 0.3);
  g.lineStyle(Math.max(1, size * 0.05), PALETTE.outline, 0.55);
  g.strokeCircle(cx, cy, size * 0.3);

  g.lineStyle(Math.max(1, size * 0.045), PALETTE.gold, 0.9);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    g.lineBetween(
      cx + Math.cos(a) * size * 0.36,
      cy + Math.sin(a) * size * 0.36,
      cx + Math.cos(a) * size * 0.46,
      cy + Math.sin(a) * size * 0.46,
    );
  }
}

function drawHazard(g: G, left: number, top: number, size: number, tile: Tile): void {
  const fill = tile === 'water' ? PALETTE.water : tile === 'lava' ? PALETTE.lava : PALETTE.sand;
  g.fillStyle(fill, 1);
  g.fillRect(left, top, size, size);

  if (tile === 'spike') {
    g.fillStyle(PALETTE.hazardRed, 1);
    for (let i = 0; i < 3; i += 1) {
      const sx = left + size * (0.18 + i * 0.27);
      g.fillTriangle(sx, top + size * 0.78, sx + size * 0.11, top + size * 0.24, sx + size * 0.22, top + size * 0.78);
    }
  } else {
    // Two ripple lines read as liquid without animating anything.
    g.lineStyle(Math.max(1, size * 0.05), PALETTE.outline, 0.22);
    g.lineBetween(left + size * 0.15, top + size * 0.38, left + size * 0.85, top + size * 0.38);
    g.lineBetween(left + size * 0.15, top + size * 0.66, left + size * 0.85, top + size * 0.66);
  }
}

export function drawTile(g: G, layout: BoardLayout, pos: Position, tile: Tile): void {
  const { x: left, y: top } = tileOrigin(layout, pos);
  const size = layout.tileSize;

  switch (tile) {
    case 'wall':
      drawWall(g, left, top, size, pos.y);
      break;
    case 'goal':
      drawGoal(g, left, top, size);
      break;
    case 'water':
    case 'lava':
    case 'spike':
      drawHazard(g, left, top, size, tile);
      break;
    case 'floor':
      drawFloor(g, left, top, size, pos.x, pos.y);
      break;
  }

  if (tile !== 'wall') {
    g.lineStyle(1, PALETTE.outline, 0.12);
    g.strokeRect(left, top, size, size);
  }
}

/** A pushable block: cube with a lit top edge, the SPEC 46 pushability cue. */
export function drawBlock(g: G, layout: BoardLayout, pos: Position): void {
  const { x: left, y: top } = tileOrigin(layout, pos);
  const size = layout.tileSize;
  const inset = size * 0.1;
  const x = left + inset;
  const y = top + inset;
  const w = size - inset * 2;

  g.fillStyle(PALETTE.terracotta, 1);
  g.fillRect(x, y, w, w);
  g.fillStyle(PALETTE.outline, 0.18);
  g.fillRect(x + w * 0.62, y, w * 0.38, w);
  g.lineStyle(Math.max(2, size * 0.07), PALETTE.gold, 1);
  g.lineBetween(x, y, x + w, y);
  g.lineStyle(Math.max(1, size * 0.04), PALETTE.outline, 0.7);
  g.strokeRect(x, y, w, w);
}

export function drawDoor(
  g: G,
  layout: BoardLayout,
  door: DoorDefinition,
  open: boolean,
): void {
  const { x: left, y: top } = tileOrigin(layout, door.at);
  const size = layout.tileSize;
  const inset = size * 0.08;

  if (open) {
    // Open: a dark doorway with its frame still standing, so the route reads
    // as passable at a glance.
    g.fillStyle(PALETTE.deepBlue, 0.55);
    g.fillRect(left + inset, top + inset, size - inset * 2, size - inset * 2);
    g.lineStyle(Math.max(2, size * 0.08), PALETTE.lapis, 1);
    g.strokeRect(left + inset, top + inset, size - inset * 2, size - inset * 2);
    return;
  }

  g.fillStyle(PALETTE.lapis, 1);
  g.fillRect(left + inset, top + inset, size - inset * 2, size - inset * 2);
  g.lineStyle(Math.max(1, size * 0.05), PALETTE.outline, 0.6);
  g.strokeRect(left + inset, top + inset, size - inset * 2, size - inset * 2);

  // Gold studs and a keyhole: locked, and locked by a key.
  g.fillStyle(PALETTE.gold, 1);
  for (const [dx, dy] of [
    [0.26, 0.26],
    [0.74, 0.26],
    [0.26, 0.74],
    [0.74, 0.74],
  ] as const) {
    g.fillCircle(left + size * dx, top + size * dy, size * 0.045);
  }
  g.fillCircle(left + size * 0.5, top + size * 0.46, size * 0.09);
  g.fillTriangle(
    left + size * 0.45, top + size * 0.52,
    left + size * 0.55, top + size * 0.52,
    left + size * 0.5, top + size * 0.68,
  );
}

export function drawItem(g: G, layout: BoardLayout, item: ItemDefinition, pos: Position): void {
  const { x: left, y: top } = tileOrigin(layout, pos);
  const size = layout.tileSize;
  const cx = left + size / 2;
  const cy = top + size / 2;

  if (item.kind === 'key') {
    // Bow, shaft and two teeth — unmistakably a key even at phone size.
    g.fillStyle(PALETTE.gold, 1);
    g.fillCircle(cx - size * 0.16, cy, size * 0.13);
    g.fillStyle(PALETTE.sand, 1);
    g.fillCircle(cx - size * 0.16, cy, size * 0.055);
    g.fillStyle(PALETTE.gold, 1);
    g.fillRect(cx - size * 0.06, cy - size * 0.045, size * 0.3, size * 0.09);
    g.fillRect(cx + size * 0.14, cy, size * 0.05, size * 0.13);
    g.fillRect(cx + size * 0.22, cy, size * 0.05, size * 0.1);
    g.lineStyle(Math.max(1, size * 0.03), PALETTE.outline, 0.5);
    g.strokeCircle(cx - size * 0.16, cy, size * 0.13);
    return;
  }

  if (item.kind === 'torch') {
    g.fillStyle(PALETTE.outline, 0.85);
    g.fillRect(cx - size * 0.035, cy - size * 0.02, size * 0.07, size * 0.28);
    g.fillStyle(PALETTE.lava, 1);
    g.fillTriangle(cx - size * 0.11, cy - size * 0.02, cx + size * 0.11, cy - size * 0.02, cx, cy - size * 0.28);
    return;
  }

  g.fillStyle(PALETTE.gold, 1);
  g.fillTriangle(cx, cy - size * 0.18, cx + size * 0.18, cy + size * 0.12, cx - size * 0.18, cy + size * 0.12);
  g.lineStyle(Math.max(1, size * 0.03), PALETTE.outline, 0.5);
  g.strokeCircle(cx, cy, size * 0.02);
}

/** Inanna: a semi-transparent silhouette in goddess form (SPEC 17). */
export function drawPlayer(g: G, layout: BoardLayout, pos: Position): void {
  const { x: left, y: top } = tileOrigin(layout, pos);
  const size = layout.tileSize;
  const cx = left + size / 2;

  g.fillStyle(PALETTE.outline, 0.22);
  g.fillEllipse(cx, top + size * 0.86, size * 0.46, size * 0.13);

  // Deep blue against a sand floor. SPEC 17 asks for a semi-transparent
  // silhouette, and a sand-coloured one on sand is invisible — the alpha is
  // what makes her spectral, the contrast is what makes her findable.
  g.fillStyle(PALETTE.deepBlue, 0.88);
  g.fillTriangle(
    cx, top + size * 0.34,
    cx + size * 0.26, top + size * 0.84,
    cx - size * 0.26, top + size * 0.84,
  );
  g.fillCircle(cx, top + size * 0.28, size * 0.14);

  // Horned crown: her regalia, removed gate by gate (SPEC 21).
  g.lineStyle(Math.max(2, size * 0.055), PALETTE.gold, 1);
  g.lineBetween(cx - size * 0.15, top + size * 0.17, cx - size * 0.07, top + size * 0.08);
  g.lineBetween(cx + size * 0.15, top + size * 0.17, cx + size * 0.07, top + size * 0.08);
  g.lineStyle(Math.max(1, size * 0.035), PALETTE.gold, 0.55);
  g.strokeCircle(cx, top + size * 0.28, size * 0.14);
}

/** A soft ring marking the tile the player is standing on. */
export function drawStandingMarker(g: G, layout: BoardLayout, pos: Position): void {
  const { x: left, y: top } = tileOrigin(layout, pos);
  const size = layout.tileSize;
  g.lineStyle(Math.max(2, size * 0.05), PALETTE.gold, 0.5);
  g.strokeRect(left + size * 0.04, top + size * 0.04, size * 0.92, size * 0.92);
}
