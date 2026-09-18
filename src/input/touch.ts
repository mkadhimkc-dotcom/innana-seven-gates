/**
 * Touch input (SPEC 27, partial).
 *
 * This slice reads a tap on a tile: the tile you stand on means "act", any
 * other tile means "one step that way". The decision itself lives in
 * `./tap.ts` and `src/core/navigation.ts`, so this module is only plumbing —
 * it holds no rule of its own.
 *
 * Not built here, and still P-02's job: the split left-moves / right-acts
 * layout, swipe-up for inventory, pinch zoom, and the size, opacity and
 * left-handed options. The page-level no-scroll / no-select guards SPEC 27
 * asks for are in `index.html`.
 */

import type { Position } from '../core/index.js';
import type { Intent, IntentHandler, InputSource } from './intents.js';
import { resolveTapIntent } from './tap.js';

export interface BoardTapOptions {
  /** Screen point -> tile, or null when the tap missed the room. */
  readonly resolveTile: (x: number, y: number) => Position | null;
  /** Where the player is right now. */
  readonly playerPosition: () => Position;
}

export interface BoardTapInput extends InputSource {
  /** Feed a pointer position in. The caller owns the pointer plumbing. */
  handlePointer(x: number, y: number): void;
}

export function createBoardTapInput(options: BoardTapOptions): BoardTapInput {
  let handler: IntentHandler | null = null;

  return {
    id: 'touch',
    attach(next: IntentHandler): void {
      handler = next;
    },
    detach(): void {
      handler = null;
    },
    handlePointer(x: number, y: number): void {
      if (!handler) return;
      const intent: Intent | null = resolveTapIntent(options.playerPosition(), options.resolveTile(x, y));
      if (intent) handler(intent);
    },
  };
}
