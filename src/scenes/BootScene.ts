/**
 * Boot: no external art to load (SPEC 38 — everything is code-drawn), so this
 * scene only sizes the viewport and hands off to the menu.
 */

import Phaser from 'phaser';
import { SceneKey } from './keys.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Boot);
  }

  create(): void {
    this.scale.refresh();
    this.scene.start(SceneKey.Menu);
  }
}
