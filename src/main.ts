/**
 * Browser entry point. Boots Phaser and nothing else — every rule decision
 * lives in `src/core/` (docs/adr/ADR-001-architecture.md).
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelScene } from './scenes/LevelScene.js';
import { mountPlatformGame } from './scenes/PlatformScene.js';
import { PALETTE } from './ui/palette.js';

/** 16:9 viewport, scaled to phone and TV (SPEC 30). */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: PALETTE.deepBlue,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // No physics: movement is tile-stepped and decided by src/core/state.ts.
    scene: [BootScene, MenuScene, LevelScene],
    render: { pixelArt: false, antialias: true },
  };
}

export function startGame(parent = 'game'): Phaser.Game {
  return new Phaser.Game(createGameConfig(parent));
}

// Guarded so importing this module in Node (tests, tools) never touches the DOM.
if (typeof document !== 'undefined') {
  startGame();

  /**
   * The v2 platform scene (S-20) has no menu entry yet — F-05's schema and
   * S-21's movement haven't landed, so there is nothing to play. Exposed for
   * `e2e/platform.spec.ts` to mount on demand, the same way `LevelScene`
   * publishes dataset attributes for its own smoke test: an observation hook
   * for tests, not a gameplay control (SPEC 29 is about the latter).
   */
  (window as unknown as { __mountPlatformGame__: typeof mountPlatformGame }).__mountPlatformGame__ =
    mountPlatformGame;
}
