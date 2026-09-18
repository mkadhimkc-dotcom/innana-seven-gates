/**
 * Bluetooth Xbox / PlayStation controller mapping (SPEC 28).
 *
 * Stub: the button map is the contract, polling is wired up in a later card.
 */

import type { Intent, InputSource, IntentHandler } from './intents.js';

/** Standard Gamepad API button indices -> intents (SPEC 28). */
export const BUTTON_MAP: Readonly<Record<number, Intent>> = {
  0: { type: 'act' }, // A / Cross
  2: { type: 'drop' }, // X / Square
  3: { type: 'toggleInventory' }, // Y / Triangle
  9: { type: 'pause' }, // Start / Options
  12: { type: 'move', direction: 'up' },
  13: { type: 'move', direction: 'down' },
  14: { type: 'move', direction: 'left' },
  15: { type: 'move', direction: 'right' },
};

export function createGamepadInput(): InputSource {
  return {
    id: 'gamepad',
    attach(_handler: IntentHandler): void {
      // TODO(card F-xx): poll navigator.getGamepads() each frame and debounce
      // held buttons into one intent per press.
    },
    detach(): void {
      // No listeners registered yet.
    },
  };
}
