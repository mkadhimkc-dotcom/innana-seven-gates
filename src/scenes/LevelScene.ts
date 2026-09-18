/**
 * Level play. The only place that draws a level.
 *
 * Every rule decision here delegates to `src/core/` — this scene turns intents
 * into `Move`s, asks the core whether the move is legal, and redraws. It never
 * decides legality itself (docs/adr/ADR-001-architecture.md).
 */

import Phaser from 'phaser';
import {
  applyMove,
  groundItemAt,
  initialState,
  isGoal,
  parseLevel,
  type GameState,
  type LevelDefinition,
  type Move,
} from '../core/index.js';
import { isSafeCheckpoint } from '../platform/checkpoint.js';
import { createKeyboardInput } from '../input/keyboard.js';
import type { Intent, InputSource } from '../input/intents.js';
import { PALETTE, TILE_COLORS } from '../ui/palette.js';
import { SceneKey } from './keys.js';

const TILE_SIZE = 40;

export interface LevelSceneData {
  /** Raw level JSON; parsed and checked on the way in. */
  readonly level: unknown;
}

export class LevelScene extends Phaser.Scene {
  private level!: LevelDefinition;
  private state!: GameState;
  private checkpoint!: GameState;
  private board!: Phaser.GameObjects.Graphics;
  private keyboard: InputSource | null = null;

  constructor() {
    super(SceneKey.Level);
  }

  init(data: LevelSceneData): void {
    this.level = parseLevel(data.level);
    this.state = initialState(this.level);
    this.checkpoint = this.state;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.deepBlue);
    this.board = this.add.graphics();

    if (import.meta.env.DEV) {
      // Keyboard is debug-only and never attached in a release build (SPEC 29).
      this.keyboard = createKeyboardInput(window);
      this.keyboard.attach((intent) => this.handleIntent(intent));
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyboard?.detach());
    this.redraw();
  }

  handleIntent(intent: Intent): void {
    switch (intent.type) {
      case 'move':
        this.tryMove({ type: 'move', direction: intent.direction });
        return;
      case 'act':
        this.tryMove({ type: 'pickup' });
        return;
      case 'drop': {
        const oldest = this.state.carrying[0];
        if (oldest !== undefined) this.tryMove({ type: 'drop', itemId: oldest });
        return;
      }
      case 'restartFromCheckpoint':
        this.state = this.checkpoint;
        this.redraw();
        return;
      case 'toggleInventory':
      case 'pause':
        // Owned by the HUD and pause-menu cards.
        return;
    }
  }

  private tryMove(move: Move): void {
    const next = applyMove(this.level, this.state, move);
    if (next === null) return;

    this.state = next;
    this.maybeCheckpoint();
    this.redraw();

    if (isGoal(this.level, this.state)) {
      this.scene.start(SceneKey.Menu);
    }
  }

  /** SPEC 10: only save when the exit is still reachable from here. */
  private maybeCheckpoint(): void {
    if (isSafeCheckpoint(this.level, this.state).safe) {
      this.checkpoint = this.state;
    }
  }

  private redraw(): void {
    const g = this.board;
    g.clear();

    const originX = (this.scale.width - this.level.width * TILE_SIZE) / 2;
    const originY = (this.scale.height - this.level.height * TILE_SIZE) / 2;
    const px = (x: number): number => originX + x * TILE_SIZE;
    const py = (y: number): number => originY + y * TILE_SIZE;

    this.level.tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        g.fillStyle(TILE_COLORS[tile], 1);
        g.fillRect(px(x), py(y), TILE_SIZE, TILE_SIZE);
        g.lineStyle(1, PALETTE.outline, 0.35);
        g.strokeRect(px(x), py(y), TILE_SIZE, TILE_SIZE);
      });
    });

    for (const door of this.level.doors) {
      if (this.state.openDoors.includes(door.id)) continue;
      g.fillStyle(PALETTE.lapis, 1);
      g.fillRect(px(door.at.x) + 4, py(door.at.y) + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }

    for (const [itemId, pos] of Object.entries(this.state.ground)) {
      const item = this.level.items.find((candidate) => candidate.id === itemId);
      g.fillStyle(item?.kind === 'torch' ? PALETTE.lava : PALETTE.gold, 1);
      g.fillCircle(px(pos.x) + TILE_SIZE / 2, py(pos.y) + TILE_SIZE / 2, TILE_SIZE / 5);
    }

    for (const block of this.state.blocks) {
      g.fillStyle(PALETTE.terracotta, 1);
      g.fillRect(px(block.x) + 3, py(block.y) + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      // Single highlight edge marks a block as pushable (SPEC 46).
      g.lineStyle(2, PALETTE.gold, 1);
      g.lineBetween(px(block.x) + 3, py(block.y) + 3, px(block.x) + TILE_SIZE - 3, py(block.y) + 3);
    }

    // Semi-transparent silhouette (SPEC 17).
    g.fillStyle(PALETTE.sand, 0.8);
    g.fillCircle(px(this.state.player.x) + TILE_SIZE / 2, py(this.state.player.y) + TILE_SIZE / 2, TILE_SIZE / 3);

    if (groundItemAt(this.state, this.state.player) !== null) {
      g.lineStyle(2, PALETTE.gold, 1);
      g.strokeRect(px(this.state.player.x), py(this.state.player.y), TILE_SIZE, TILE_SIZE);
    }
  }
}
