import Phaser from 'phaser';
import { generateSeedlingTexture } from '../systems/SpriteGenerator.js';
import { CATEGORY_COLORS } from '../data/traits.js';
import { intToHexColor } from '../systems/utils.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.graftedTraits = data.traits || [];
    this.waveReached = data.waveReached || 1;
    this.killCount = data.killCount || 0;
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    this.audio = this.registry.get('audio');
    this.audio.stopMusic(true);
    this.cameras.main.setBackgroundColor(0x0A0505);

    // Falling ash particles
    this.time.addEvent({
      delay: 400,
      repeat: -1,
      callback: () => {
        const ax = Phaser.Math.Between(20, width - 20);
        const colors = [0x666666, 0x884444, 0x555555];
        const ash = this.add.circle(ax, -5, 1, Phaser.Utils.Array.GetRandom(colors), 0.3);
        this.tweens.add({
          targets: ash,
          y: height + 10,
          x: ax + Phaser.Math.Between(-30, 30),
          alpha: 0,
          duration: 4000 + Math.random() * 2000,
          onComplete: () => ash.destroy(),
        });
      },
    });

    // Dramatic pause — title after 1s
    this.time.delayedCall(1000, () => {
      this.audio.play('gameOver');
      // Title shadow
      this.add.text(cx + 1, 42, 'YOUR SEEDLING FELL', {
        fontFamily: 'monospace', fontSize: '26px', color: '#000000', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.3);

      const title = this.add.text(cx, 40, 'YOUR SEEDLING FELL', {
        fontFamily: 'monospace', fontSize: '26px', color: '#CC4444', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({ targets: title, alpha: 1, duration: 1500 });
    });

    // Stats after 2s
    this.time.delayedCall(2500, () => {
      const stats = this.add.text(cx, 78, `Wave reached: ${this.waveReached}  |  Enemies slain: ${this.killCount}`, {
        fontFamily: 'monospace', fontSize: '12px', color: '#886666',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: stats, alpha: 1, duration: 800 });
    });

    // Seedling — sinking, fading, wilting
    const seedlingY = height * 0.38;
    if (this.graftedTraits.length > 0) {
      generateSeedlingTexture(this, this.graftedTraits, 'seedling_memorial');
      this.showFallenSeedling(cx, seedlingY, 'seedling_memorial', 1.8);
    } else {
      this.showFallenSeedling(cx, seedlingY, 'seedling_base', 2);
    }

    // Trait list after 2.5s — compact icon grid
    this.time.delayedCall(2800, () => {
      if (this.graftedTraits.length > 0) {
        const headerY = height * 0.6;
        const header = this.add.text(cx, headerY, 'Grafted Traits:', {
          fontFamily: 'monospace', fontSize: '13px', color: '#777777',
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: header, alpha: 1, duration: 600 });

        const iconSize = 20;
        const iconGap = 4;
        const cols = Math.min(this.graftedTraits.length, 8);
        const gridWidth = cols * (iconSize + iconGap) - iconGap;
        const gridStartX = cx - gridWidth / 2;
        const gridStartY = headerY + 22;

        // Tooltip text (shown on hover)
        const tooltip = this.add.text(cx, gridStartY - 14, '', {
          fontFamily: 'monospace', fontSize: '10px', color: '#CCCCCC',
        }).setOrigin(0.5).setDepth(6).setAlpha(0);

        for (let i = 0; i < this.graftedTraits.length; i++) {
          const t = this.graftedTraits[i];
          const col = Math.floor(i % cols);
          const row = Math.floor(i / cols);
          const tx = gridStartX + col * (iconSize + iconGap);
          const ty = gridStartY + row * (iconSize + iconGap);

          const bg = this.add.rectangle(tx + iconSize / 2, ty + iconSize / 2, iconSize, iconSize, 0x111111, 0.6)
            .setStrokeStyle(1, CATEGORY_COLORS[t.category], 0.6).setDepth(5).setAlpha(0)
            .setInteractive({ useHandCursor: true });
          const icon = this.add.image(tx + iconSize / 2, ty + iconSize / 2, `icon_${t.category}`)
            .setDepth(5).setAlpha(0);

          bg.on('pointerover', () => {
            tooltip.setText(t.name);
            tooltip.setColor(intToHexColor(CATEGORY_COLORS[t.category]));
            this.tweens.add({ targets: tooltip, alpha: 1, duration: 100 });
          });
          bg.on('pointerout', () => {
            this.tweens.add({ targets: tooltip, alpha: 0, duration: 100 });
          });

          this.tweens.add({ targets: [bg, icon], alpha: 0.8, duration: 300, delay: i * 50 });
        }
      }
    });

    // Retry button after 3s
    this.time.delayedCall(3200, () => {
      const retryY = height * 0.88;
      const retryBg = this.add.rectangle(cx, retryY, 180, 42, 0x662222, 0.8)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(2, 0x883333)
        .setAlpha(0);
      const retryTxt = this.add.text(cx, retryY, 'TRY AGAIN', {
        fontFamily: 'monospace', fontSize: '17px', color: '#FFFFFF', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({ targets: [retryBg, retryTxt], alpha: 1, duration: 600 });

      retryBg.on('pointerover', () => {
        retryBg.setFillStyle(0x883333, 1);
        this.tweens.add({ targets: retryBg, scaleX: 1.05, scaleY: 1.05, duration: 80 });
        this.audio.play('cardHover');
      });
      retryBg.on('pointerout', () => {
        retryBg.setFillStyle(0x662222, 0.8);
        this.tweens.add({ targets: retryBg, scaleX: 1, scaleY: 1, duration: 80 });
      });
      retryBg.on('pointerdown', () => {
        this.audio.play('uiClick');
        this.tweens.add({ targets: retryBg, scaleX: 0.95, scaleY: 0.95, duration: 40, yoyo: true });
        this.cameras.main.fadeOut(400);
        this.time.delayedCall(400, () => this.scene.start('Menu'));
      });
    });

    this.cameras.main.fadeIn(800);

    // Mute toggle
    this.audio.createMuteButton(this);
  }

  showFallenSeedling(cx, startY, texKey, scale) {
    const img = this.add.image(cx, startY, texKey).setScale(scale).setAlpha(0.8);

    // Slowly sink and fade
    this.tweens.add({
      targets: img,
      y: startY + 30,
      alpha: 0.3,
      angle: -15,
      duration: 4000,
      ease: 'Sine.easeIn',
    });

    // Wilting leaves falling off
    this.time.delayedCall(500, () => {
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 600, () => {
          const leafX = cx + Phaser.Math.Between(-15, 15);
          const leafY = startY - 10;
          const leaf = this.add.circle(leafX, leafY, 2, 0x558855, 0.6);

          this.tweens.add({
            targets: leaf,
            y: leafY + 60 + Math.random() * 30,
            x: leafX + Phaser.Math.Between(-25, 25),
            alpha: 0,
            angle: Phaser.Math.Between(-180, 180),
            duration: 2000 + Math.random() * 1000,
            ease: 'Sine.easeIn',
            onComplete: () => leaf.destroy(),
          });
        });
      }
    });
  }
}
