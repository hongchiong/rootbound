import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import CombatScene from './scenes/CombatScene.js';
import ShopScene from './scenes/ShopScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import VictoryScene from './scenes/VictoryScene.js';
import audioManager from './systems/AudioManager.js';

const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  parent: document.body,
  pixelArt: true,
  backgroundColor: '#0a0a0a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, CombatScene, ShopScene, GameOverScene, VictoryScene],
};

const game = new Phaser.Game(config);
game.registry.set('audio', audioManager);
