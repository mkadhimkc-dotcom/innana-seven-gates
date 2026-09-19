/**
 * The v2 side-view scene (SPEC v2 §12, S-20).
 *
 * A standalone Phaser game, not (yet) part of the app's boot flow in
 * `main.ts` — F-05 has not landed the real level schema, and S-21/S-23 have
 * not landed movement or jewels, so there is nothing to play. What this scene
 * proves is the rendering foundation every later v2 card builds on:
 *
 *   - a render target sized to a whole number of 16x16 tiles, scaled by a
 *     whole number and letterboxed (SPEC 12, 30) — never fractional scaling;
 *   - one fixed screen, no scrolling and no camera movement of any kind;
 *   - two-frame animation at 8fps, driven by the fixed-timestep clock rather
 *     than wall time, so it stays in step with the simulation;
 *   - the same tick sequence always produces the same frame (determinism).
 *
 * `mountPlatformGame` is exposed on `window` for the e2e smoke test
 * (`e2e/platform.spec.ts`) the same way `LevelScene` publishes dataset
 * attributes for its own smoke test — an observation hook, not a gameplay
 * control, so it ships in the release build like the rest of ADR-001's
 * "state lives in `src/core/`, everything else just reads it" split.
 */

import Phaser from 'phaser';
import { advance, createClock, type SimClock } from '../core/clock.js';
import { animationFrame } from '../core/animation.js';
import { platformTileAt, type PlatformGrid } from '../core/platformGrid.js';
import { computeIntegerScale, gridPixelSize, TILE_SIZE_PX } from '../ui/viewport.js';
import { drawPlatformTile } from '../ui/platformArt.js';
import { PALETTE } from '../ui/palette.js';
import { SceneKey } from './keys.js';
import { DEMO_PLATFORM_GRID } from './demoGrid.js';

export interface PlatformSceneData {
  readonly grid?: PlatformGrid;
}

export class PlatformScene extends Phaser.Scene {
  private grid!: PlatformGrid;
  private board!: Phaser.GameObjects.Graphics;
  private clock: SimClock = createClock();
  private frame: 0 | 1 = 0;
  private resize = (): void => this.applyScale();

  constructor() {
    super(SceneKey.Platform);
  }

  init(data: PlatformSceneData): void {
    this.grid = data.grid ?? DEMO_PLATFORM_GRID;
    this.clock = createClock();
    this.frame = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.deepBlue);
    this.board = this.add.graphics();

    // Fixed camera: set once, never scrolled, panned or made to follow
    // anything (SPEC 12 — "no scrolling, no camera movement of any kind").
    this.cameras.main.setScroll(0, 0);

    window.addEventListener('resize', this.resize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('resize', this.resize);
    });

    this.applyScale();
    this.redraw();
  }

  /**
   * Whole-number zoom to fit the current viewport, letterboxed (SPEC 12, 30).
   * Runs at create and on resize; never on a per-frame basis, since nothing
   * about it depends on simulated time.
   */
  private applyScale(): void {
    const content = gridPixelSize(this.grid);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const layout = computeIntegerScale(content, viewport);
    this.scale.setZoom(layout.scale);
    this.publishStatus(layout.scale);
  }

  override update(_time: number, delta: number): void {
    const before = this.frame;
    const result = advance(this.clock, delta);
    this.clock = result.clock;
    this.frame = animationFrame(this.clock.tick, this.clock.stepMs);
    if (this.frame !== before) this.redraw();
  }

  private redraw(): void {
    const g = this.board;
    g.clear();
    for (let y = 0; y < this.grid.height; y += 1) {
      for (let x = 0; x < this.grid.width; x += 1) {
        const tile = platformTileAt(this.grid, { x, y });
        if (!tile) continue;
        drawPlatformTile(g, x * TILE_SIZE_PX, y * TILE_SIZE_PX, TILE_SIZE_PX, tile, y, this.frame);
      }
    }
    this.publishStatus(this.scale.zoom);
  }

  /** Mirrors `LevelScene.publishStatus`: the e2e test's only handle on state. */
  private publishStatus(scale: number): void {
    const host = this.game.canvas?.parentElement;
    if (!host) return;
    host.dataset['platformScale'] = String(scale);
    host.dataset['platformGrid'] = `${this.grid.width}x${this.grid.height}`;
    host.dataset['platformFrame'] = String(this.frame);
  }
}

/** 16:9-ish letterbox frame; the canvas inside it is sized per grid, not fixed. */
export function createPlatformGameConfig(
  parent: string,
  grid: PlatformGrid = DEMO_PLATFORM_GRID,
): Phaser.Types.Core.GameConfig {
  const content = gridPixelSize(grid);
  return {
    type: Phaser.AUTO,
    parent,
    width: content.width,
    height: content.height,
    backgroundColor: PALETTE.deepBlue,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Flat Graphics fills only, no textures — nothing here is ever filtered,
    // and pixelArt/roundPixels keep it that way once sprites arrive.
    render: { pixelArt: true, antialias: false, roundPixels: true },
    scene: [PlatformScene],
  };
}

/** Test/dev hook: boot the v2 scene into its own DOM element, on demand. */
export function mountPlatformGame(parent = 'platform-game', grid?: PlatformGrid): Phaser.Game {
  return new Phaser.Game(createPlatformGameConfig(parent, grid));
}
