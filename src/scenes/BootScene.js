import Phaser from 'phaser';
import { generateTextures } from '../systems/SpriteGenerator.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    generateTextures(this);
    this.scene.start('Menu');
  }
}
