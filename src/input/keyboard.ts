/** Keyboard bindings (SPEC 29). Debug only — excluded from release builds. */

import type { Intent, InputSource, IntentHandler } from './intents.js';

const BINDINGS: Readonly<Record<string, Intent>> = {
  ArrowUp: { type: 'move', direction: 'up' },
  ArrowDown: { type: 'move', direction: 'down' },
  ArrowLeft: { type: 'move', direction: 'left' },
  ArrowRight: { type: 'move', direction: 'right' },
  Space: { type: 'act' },
  KeyD: { type: 'drop' },
  KeyI: { type: 'toggleInventory' },
  KeyR: { type: 'restartFromCheckpoint' },
  Escape: { type: 'pause' },
};

export function createKeyboardInput(target: EventTarget): InputSource {
  let listener: ((event: Event) => void) | null = null;

  return {
    id: 'keyboard',
    attach(handler: IntentHandler): void {
      listener = (event: Event): void => {
        const intent = BINDINGS[(event as KeyboardEvent).code];
        if (!intent) return;
        event.preventDefault();
        handler(intent);
      };
      target.addEventListener('keydown', listener);
    },
    detach(): void {
      if (listener) target.removeEventListener('keydown', listener);
      listener = null;
    },
  };
}
