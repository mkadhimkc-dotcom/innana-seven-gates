/**
 * Touch layout (SPEC 27): left half of the screen moves, right half acts,
 * swipe up opens the inventory. Left-handed mode mirrors the halves.
 *
 * Stub: the layout decision is captured here, gesture handling lands with the
 * HUD card.
 */

import type { InputSource, IntentHandler } from './intents.js';

export interface TouchOptions {
  readonly leftHanded: boolean;
}

export function createTouchInput(_options: TouchOptions = { leftHanded: false }): InputSource {
  return {
    id: 'touch',
    attach(_handler: IntentHandler): void {
      // TODO(card F-xx): pointer zones, swipe-up for inventory, and the
      // no-scroll / no-select guards SPEC 27 requires during play.
    },
    detach(): void {
      // No listeners registered yet.
    },
  };
}
