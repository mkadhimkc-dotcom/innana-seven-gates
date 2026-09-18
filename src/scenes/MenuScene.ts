/** Main menu (SPEC 34). Placeholder until the menu card lands. */

import Phaser from 'phaser';
import { PALETTE } from '../ui/palette.js';
import { getLevel } from '../level-registry.js';
import { SceneKey } from './keys.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Menu);
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.deepBlue);

    this.add
      .text(width / 2, height / 2 - 40, 'INANNA', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '48px',
        color: '#d8a634',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 16, 'Seven Gates', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#e0c9a6',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(width / 2, height / 2 + 80, 'tap or press space to descend', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#8fa4c9',
      })
      .setOrigin(0.5)
      .setName('menu-prompt');

    // No flashing (SPEC 32): a slow fade, well under the seizure-safety threshold.
    this.tweens.add({ targets: prompt, alpha: 0.35, duration: 1400, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => this.startFirstLevel());
    this.input.keyboard?.once('keydown-SPACE', () => this.startFirstLevel());
  }

  private startFirstLevel(): void {
    this.scene.start(SceneKey.Level, { level: getLevel('gate-01-01') });
  }
}
