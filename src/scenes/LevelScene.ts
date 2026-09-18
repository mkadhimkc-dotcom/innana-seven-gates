/**
 * Level play.
 *
 * The only place that draws a level, and the only place that touches Phaser.
 * It turns pointers into intents, intents into `Move`s, and asks `src/core/`
 * whether each one is legal. It decides nothing itself — that is what lets the
 * validator prove the same rules the game plays by (ADR-001).
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
import { createBoardTapInput, type BoardTapInput } from '../input/touch.js';
import type { Intent, InputSource } from '../input/intents.js';
import { PALETTE } from '../ui/palette.js';
import { computeLayout, pointToTile, type BoardLayout } from '../ui/boardLayout.js';
import {
  drawBlock,
  drawDoor,
  drawItem,
  drawPlayer,
  drawStandingMarker,
  drawTile,
} from '../ui/roomArt.js';
import { SceneKey } from './keys.js';

export interface LevelSceneData {
  /** Raw level JSON; parsed and checked on the way in. */
  readonly level: unknown;
}

export class LevelScene extends Phaser.Scene {
  private level!: LevelDefinition;
  private state!: GameState;
  private checkpoint!: GameState;
  private layout!: BoardLayout;

  private board!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private won = false;
  /** Kept so a restart can re-parse the same level data. */
  private levelSource: unknown;

  private keyboard: InputSource | null = null;
  private tap: BoardTapInput | null = null;

  constructor() {
    super(SceneKey.Level);
  }

  init(data: LevelSceneData): void {
    this.levelSource = data.level;
    this.level = parseLevel(data.level);
    this.state = initialState(this.level);
    this.checkpoint = this.state;
    this.won = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.deepBlue);
    this.layout = computeLayout(this.level, { width: this.scale.width, height: this.scale.height });
    this.board = this.add.graphics();

    const font = { fontFamily: 'system-ui, -apple-system, sans-serif' };

    this.titleText = this.add
      .text(this.scale.width / 2, 26, `Gate I · ${this.level.name}`, {
        ...font,
        fontSize: '20px',
        color: '#d8a634',
      })
      .setOrigin(0.5, 0.5);

    this.hudText = this.add
      .text(20, this.scale.height - 40, '', { ...font, fontSize: '18px', color: '#e0c9a6' })
      .setOrigin(0, 0.5);

    this.hintText = this.add
      .text(this.scale.width - 20, this.scale.height - 40, '', {
        ...font,
        fontSize: '15px',
        color: '#8fa4c9',
        align: 'right',
      })
      .setOrigin(1, 0.5);

    this.tap = createBoardTapInput({
      resolveTile: (x, y) => pointToTile(this.layout, this.level, { x, y }),
      playerPosition: () => this.state.player,
    });
    this.tap.attach((intent) => this.handleIntent(intent));
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.won) {
        this.scene.restart({ level: this.levelSource });
        return;
      }
      this.tap?.handlePointer(pointer.worldX, pointer.worldY);
    });

    if (import.meta.env.DEV) {
      // Keyboard is debug-only and never attached in a release build (SPEC 29).
      this.keyboard = createKeyboardInput(window);
      this.keyboard.attach((intent) => this.handleIntent(intent));
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.keyboard?.detach();
      this.tap?.detach();
    });

    this.redraw();
  }

  handleIntent(intent: Intent): void {
    if (this.won) return;

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
    if (next === null) {
      this.nudge();
      return;
    }

    this.state = next;
    this.maybeCheckpoint();
    this.redraw();

    if (isGoal(this.level, this.state)) this.win();
  }

  /** A refused move should feel refused, not ignored. */
  private nudge(): void {
    this.cameras.main.shake(90, 0.004);
  }

  /** SPEC 10: only save when the exit is still reachable from here. */
  private maybeCheckpoint(): void {
    if (isSafeCheckpoint(this.level, this.state).safe) this.checkpoint = this.state;
  }

  private win(): void {
    this.won = true;
    this.publishStatus();
    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.deepBlue, 0.82);
    panel.fillRect(0, this.scale.height / 2 - 70, this.scale.width, 140);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 18, 'The first gate opens', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '30px',
        color: '#d8a634',
      })
      .setOrigin(0.5);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 26, 'tap anywhere to descend again', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: '#e0c9a6',
      })
      .setOrigin(0.5);
  }

  private redraw(): void {
    const g = this.board;
    g.clear();

    this.level.tiles.forEach((row, y) => {
      row.forEach((tile, x) => drawTile(g, this.layout, { x, y }, tile));
    });

    for (const door of this.level.doors) {
      drawDoor(g, this.layout, door, this.state.openDoors.includes(door.id));
    }

    for (const [itemId, pos] of Object.entries(this.state.ground)) {
      const item = this.level.items.find((candidate) => candidate.id === itemId);
      if (item) drawItem(g, this.layout, item, pos);
    }

    for (const block of this.state.blocks) drawBlock(g, this.layout, block);

    drawStandingMarker(g, this.layout, this.state.player);
    drawPlayer(g, this.layout, this.state.player);

    this.updateHud();
    this.publishStatus();
  }

  /**
   * Mirror the player's tile and the run's status onto the host element.
   *
   * The board is a canvas, so nothing inside it is readable from outside. These
   * two attributes are the only handle the end-to-end smoke test has on whether
   * a tap actually moved anyone. Presentation metadata, not state: `src/core/`
   * remains the only place state lives.
   */
  private publishStatus(): void {
    const host = this.game.canvas?.parentElement;
    if (!host) return;
    host.dataset['player'] = `${this.state.player.x},${this.state.player.y}`;
    host.dataset['carrying'] = this.state.carrying.join(',');
    host.dataset['status'] = this.won ? 'won' : 'playing';
  }

  private updateHud(): void {
    const carried = this.state.carrying
      .map((id) => this.level.items.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
      .map((item) => (item.kind === 'key' ? `${item.color ?? ''} key` : item.kind));

    this.hudText.setText(carried.length > 0 ? `Carrying: ${carried.join(', ')}` : 'Carrying: nothing');

    const onItem = groundItemAt(this.state, this.state.player) !== null;
    this.hintText.setText(
      onItem ? 'tap yourself to pick it up' : 'tap a tile to step · tap yourself to pick up',
    );
    this.titleText.setX(this.scale.width / 2);
  }
}
