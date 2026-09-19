/**
 * Placeholder-only demo grid for the v2 scene (S-20), split out from
 * `PlatformScene.ts` so it stays engine-free and importable from Node (the
 * e2e tests compute expected values from it, and importing `PlatformScene.ts`
 * itself pulls in Phaser, which crashes outside a browser). Not level data —
 * L-00 builds the first real one, from SPEC and F-05's schema, not from this.
 */

import { createPlatformGrid, type PlatformGrid } from '../core/platformGrid.js';

const DEMO_GRID_WIDTH = 20;

/** A bordered row, `.` by default, with specific columns overridden. */
function demoRow(overrides: Readonly<Record<number, string>> = {}): string {
  const cells = new Array<string>(DEMO_GRID_WIDTH).fill('.');
  cells[0] = '#';
  cells[DEMO_GRID_WIDTH - 1] = '#';
  for (const [x, code] of Object.entries(overrides)) cells[Number(x)] = code;
  return cells.join('');
}

/**
 * A hand-drawn room with one of every tile kind, built from row overrides
 * rather than typed-out ASCII art so every row is the fixed width
 * `createPlatformGrid` requires by construction.
 */
export const DEMO_PLATFORM_GRID: PlatformGrid = createPlatformGrid([
  '#'.repeat(DEMO_GRID_WIDTH),
  demoRow(),
  demoRow({ 3: 'G', 11: '^', 12: '^' }),
  demoRow({ 3: '#', 4: '#', 5: '#', 6: '#', 7: '#' }),
  demoRow({ 15: 'H' }),
  demoRow({ 5: 'b', 6: 'b', 7: 'b', 15: 'H' }),
  demoRow({ 5: '#', 6: '#', 7: '#', 15: 'H' }),
  demoRow({ 15: 'H' }),
  demoRow({ 15: 'H' }),
  demoRow({ 15: 'H' }),
  demoRow({ 15: 'H' }),
  '#'.repeat(DEMO_GRID_WIDTH),
]);
