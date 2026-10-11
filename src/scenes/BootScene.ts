import Phaser from 'phaser';
import { KENNEY, registerArt } from '../art/registry';

/** Loads the Kenney sprites and paints every procedural texture before the world starts. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    for (const k of KENNEY) this.load.image(`k_${k}`, `assets/kenney/${k}.png`);
  }

  create() {
    registerArt(this);
    this.scene.start('world');
    this.game.events.emit('artReady');
  }
}
