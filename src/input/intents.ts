/**
 * Input is translated into intents, never straight into state changes. Touch,
 * controller and keyboard (SPEC 27-29) all produce the same small vocabulary,
 * so the rules in `src/core/` stay the only thing that decides what is legal.
 */

import type { Direction } from '../core/index.js';

export type Intent =
  | { readonly type: 'move'; readonly direction: Direction }
  /** Context action: push a block, or pick up the item underfoot. */
  | { readonly type: 'act' }
  | { readonly type: 'drop' }
  | { readonly type: 'toggleInventory' }
  | { readonly type: 'restartFromCheckpoint' }
  | { readonly type: 'pause' };

export type IntentHandler = (intent: Intent) => void;

export interface InputSource {
  readonly id: 'touch' | 'gamepad' | 'keyboard';
  attach(handler: IntentHandler): void;
  detach(): void;
}
