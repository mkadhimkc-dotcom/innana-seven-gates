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
  advanceSimulation,
  createJourney,
  createSimulation,
  enterRoom,
  groundItemAt,
  leaveRoom,
  parseLevel,
  queueMove,
  type GameState,
  type Journey,
  type LevelDefinition,
  type Move,
  type Simulation,
} from '../core/index.js';
import { getLevel, nextLevelId } from '../level-registry.js';
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
  /** What the player carries in from the previous room (SPEC 11). */
  readonly journey?: Journey;
}

export class LevelScene extends Phaser.Scene {
  private level!: LevelDefinition;
  private simulation!: Simulation;
  private journey!: Journey;
  private checkpoint!: GameState;
  private layout!: BoardLayout;
  private transitioning = false;

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
    this.journey = data.journey ?? createJourney();
    this.simulation = createSimulation(this.level, { state: enterRoom(this.level, this.journey) });
    this.checkpoint = this.simulation.state;
    this.won = false;
    this.transitioning = false;
  }

  /** Current world state. Everything reads through here, nothing mutates it. */
  private get state(): GameState {
    return this.simulation.state;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.deepBlue);
    this.cameras.main.fadeIn(180, 0, 0, 0);
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
        this.enqueue({ type: 'move', direction: intent.direction });
        return;
      case 'act':
        this.enqueue({ type: 'pickup' });
        return;
      case 'drop': {
        const oldest = this.state.carrying[0];
        if (oldest !== undefined) this.enqueue({ type: 'drop', itemId: oldest });
        return;
      }
      case 'restartFromCheckpoint':
        this.simulation = createSimulation(this.level, { state: this.checkpoint });
        this.redraw();
        return;
      case 'toggleInventory':
      case 'pause':
        // Owned by the HUD and pause-menu cards.
        return;
    }
  }

  /**
   * Queue a move for the next fixed step. Nothing is applied here — the loop
   * owns that, so input timing cannot change the outcome.
   */
  private enqueue(move: Move): void {
    if (this.won || this.transitioning) return;
    this.simulation = queueMove(this.simulation, move);
  }

  /**
   * The game loop. Phaser hands us real elapsed time; the simulation converts
   * it into whole fixed steps and applies at most one queued move per step.
   * Same inputs, same state, whatever the frame rate does.
   */
  override update(_time: number, delta: number): void {
    if (this.won || this.transitioning) return;

    const outcome = advanceSimulation(this.simulation, delta);
    this.simulation = outcome.simulation;

    if (outcome.rejected.length > 0) this.nudge();

    if (outcome.applied.length > 0 || outcome.rejected.length > 0) {
      this.maybeCheckpoint();
      this.redraw();
    }

    if (outcome.reachedGoal) this.leaveThisRoom();
  }

  /** A refused move should feel refused, not ignored. */
  private nudge(): void {
    this.cameras.main.shake(90, 0.004);
  }

  /** SPEC 10: only save when the exit is still reachable from here. */
  private maybeCheckpoint(): void {
    if (isSafeCheckpoint(this.level, this.state).safe) this.checkpoint = this.state;
  }

  /**
   * The goal is reached. Fold this room into the journey, then either walk on
   * to the next room or end the run (SPEC 11).
   */
  private leaveThisRoom(): void {
    this.journey = leaveRoom(this.level, this.state, this.journey);

    const next = nextLevelId(this.level.id);
    if (next === null) {
      this.win();
      return;
    }

    // Fade out, swap rooms, fade in. The camera re-fits to the new room in
    // create(), because each room is a fixed camera of its own (SPEC 30).
    this.transitioning = true;
    this.publishStatus();
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ level: getLevel(next), journey: this.journey });
    });
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
    host.dataset['status'] = this.won ? 'won' : this.transitioning ? 'leaving' : 'playing';
    host.dataset['room'] = this.level.id;
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
