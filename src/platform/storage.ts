/**
 * Local save storage (SPEC 33): checkpoints and best times live on the device.
 * No cloud sync, no telemetry (SPEC 37).
 */

import type { GameState } from '../core/index.js';

const SAVE_KEY = 'inanna.save.v1';

export interface RouteTimes {
  readonly safe?: number;
  readonly standard?: number;
  readonly expert?: number;
}

export interface LevelSave {
  /** Last checkpoint, only ever written for a state proven safe (SPEC 10). */
  readonly checkpoint: GameState | null;
  readonly bestTimes: RouteTimes;
}

export interface SaveFile {
  readonly version: 1;
  readonly levels: Record<string, LevelSave>;
  /** New Game+ progress is kept separate (SPEC 26, 33). */
  readonly newGamePlus: Record<string, LevelSave>;
}

export const EMPTY_SAVE: SaveFile = { version: 1, levels: {}, newGamePlus: {} };

/** Storage is absent in Node (tests, validator) and in private browsing. */
function backing(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSave(): SaveFile {
  const store = backing();
  if (!store) return EMPTY_SAVE;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return EMPTY_SAVE;
    const parsed = JSON.parse(raw) as Partial<SaveFile>;
    if (parsed.version !== 1) return EMPTY_SAVE;
    return { version: 1, levels: parsed.levels ?? {}, newGamePlus: parsed.newGamePlus ?? {} };
  } catch {
    return EMPTY_SAVE;
  }
}

export function writeSave(save: SaveFile): void {
  const store = backing();
  if (!store) return;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Quota or private mode: play continues, progress just is not persisted.
  }
}
