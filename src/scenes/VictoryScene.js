import Phaser from 'phaser';
import { generateVictorySeedlingTexture } from '../systems/SpriteGenerator.js';
import { CATEGORY_COLORS } from '../data/traits.js';
import { intToHexColor } from '../systems/utils.js';

export default class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory');
  }

  init(data) {
    this.graftedTraits = data.traits || [];
    this.visualSeed = data.visualSeed || 0;
    this.killCount = data.killCount || 0;
    this.wavesCompleted = data.wavesCompleted || 6;
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    this.audio = this.registry.get('audio');
    this.audio.stopMusic(true);

    // Start fully black, gradually lighten
    this.cameras.main.setBackgroundColor(0x050A05);

    // Background warm-up overlay
    const bgOverlay = this.add.rectangle(cx, height / 2, width, height, 0x1A3A1A, 0).setDepth(0);
    this.tweens.add({ targets: bgOverlay, alpha: 0.4, duration: 3000 });

    // Dramatic pause before content
    this.cameras.main.fadeIn(1500);

    // Mute toggle
    this.audio.createMuteButton(this);

    // Victory title — delayed
    this.time.delayedCall(800, () => {
      this.audio.play('victoryFanfare');
      // Title shadow
      this.add.text(cx + 2, 32, 'THE BLIGHT IS VANQUISHED', {
        fontFamily: 'monospace', fontSize: '22px', color: '#000000', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.4);

      const title = this.add.text(cx, 30, 'THE BLIGHT IS VANQUISHED', {
        fontFamily: 'monospace', fontSize: '22px', color: '#55FF55', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({ targets: title, alpha: 1, duration: 1000 });
      this.tweens.add({ targets: title, alpha: 0.7, duration: 1500, yoyo: true, repeat: -1, delay: 1000 });
    });

    // Stats — delayed
    this.time.delayedCall(1500, () => {
      const stats = this.add.text(cx, 60, `Enemies slain: ${this.killCount}  |  Traits grafted: ${this.graftedTraits.length}`, {
        fontFamily: 'monospace', fontSize: '12px', color: '#88CC88',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: stats, alpha: 1, duration: 800 });
    });

    // Generate victory seedling at high resolution
    const seedlingY = height * 0.34;
    if (this.graftedTraits.length > 0) {
      generateVictorySeedlingTexture(this, this.graftedTraits, 'seedling_victory_tex', this.visualSeed);
    }

    // Dramatic seedling reveal — starts small and fades in
    this.time.delayedCall(500, () => {
      // Light ring expanding outward
      const lightRing = this.add.circle(cx, seedlingY, 20, 0xFFFFFF, 0.3).setDepth(2);
      this.tweens.add({
        targets: lightRing, scale: 5, alpha: 0, duration: 1500, ease: 'Cubic.easeOut',
        onComplete: () => lightRing.destroy(),
      });

      const texKey = this.graftedTraits.length > 0 ? 'seedling_victory_tex' : 'seedling_base';
      const seedImg = this.add.image(cx, seedlingY, texKey)
        .setScale(this.graftedTraits.length > 0 ? 0.5 : 1)
        .setAlpha(0).setDepth(3);

      const finalScale = this.graftedTraits.length > 0 ? 1.8 : 2.4;

      this.tweens.add({
        targets: seedImg,
        alpha: 1,
        scaleX: finalScale,
        scaleY: finalScale,
        duration: 2000,
        ease: 'Cubic.easeOut',
      });

      // Triumphant bounce after reveal
      this.time.delayedCall(2000, () => {
        this.tweens.add({
          targets: seedImg, y: seedlingY - 8, duration: 700,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      });

      // Orbiting trait-colored orbs
      if (this.graftedTraits.length > 0) {
        const orbs = [];
        const categories = [...new Set(this.graftedTraits.map(t => t.category))];
        for (let i = 0; i < categories.length; i++) {
          const color = CATEGORY_COLORS[categories[i]];
          const orb = this.add.circle(cx, seedlingY, 4, color, 0).setDepth(4);
          orbs.push({ obj: orb, angle: (i / categories.length) * Math.PI * 2, speed: 0.8 + i * 0.1 });
          this.tweens.add({ targets: orb, alpha: 0.7, duration: 2000, delay: 1000 });
        }

        this.time.addEvent({
          delay: 30,
          repeat: -1,
          callback: () => {
            for (const orb of orbs) {
              orb.angle += 0.02 * orb.speed;
              orb.obj.setPosition(
                cx + Math.cos(orb.angle) * 55,
                seedlingY + Math.sin(orb.angle) * 35,
              );
            }
          },
        });
      }

      // Celebration particles
      this.time.addEvent({
        delay: 250,
        repeat: -1,
        callback: () => {
          const angle = Math.random() * Math.PI * 2;
          const dist = 40 + Math.random() * 40;
          const px = cx + Math.cos(angle) * dist;
          const py = seedlingY + Math.sin(angle) * dist;
          const colors = [0x55FF55, 0xFFFF44, 0xFF69B4, 0x44CCFF, 0xFFAA22];
          const p = this.add.circle(px, py, 1.5, Phaser.Utils.Array.GetRandom(colors), 0.7).setDepth(4);
          this.tweens.add({
            targets: p, y: py - 30, alpha: 0, duration: 800,
            onComplete: () => p.destroy(),
          });
        },
      });
    });

    // "Your Creation" section — delayed
    this.time.delayedCall(2500, () => {
      // Decorative lines
      const lineY = height * 0.56;
      const lineG = this.add.graphics().setDepth(5);
      lineG.lineStyle(1, 0x446644, 0.4);
      lineG.lineBetween(cx - 80, lineY - 4, cx + 80, lineY - 4);
      lineG.lineBetween(cx - 80, lineY + 18, cx + 80, lineY + 18);
      // Small leaf shapes at ends
      lineG.fillStyle(0x446644, 0.4);
      lineG.fillTriangle(cx - 82, lineY - 4, cx - 88, lineY - 1, cx - 82, lineY + 2);
      lineG.fillTriangle(cx + 82, lineY - 4, cx + 88, lineY - 1, cx + 82, lineY + 2);
      lineG.setAlpha(0);
      this.tweens.add({ targets: lineG, alpha: 1, duration: 800 });

      const label = this.add.text(cx, lineY + 7, '— Your Creation —', {
        fontFamily: 'monospace', fontSize: '14px', color: '#AADDAA', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0).setDepth(5);
      this.tweens.add({ targets: label, alpha: 1, duration: 800 });
    });

    // Naming prompt — delayed
    this.time.delayedCall(3000, () => {
      this.seedlingNameText = this.add.text(cx, height * 0.62, 'Click to name your seedling', {
        fontFamily: 'monospace', fontSize: '12px', color: '#88AA88',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0).setDepth(5);
      this.tweens.add({ targets: this.seedlingNameText, alpha: 1, duration: 600 });

      this.seedlingNameText.on('pointerdown', () => {
        const name = prompt('Name your creation:');
        if (name && name.trim()) {
          this.seedlingNameText.setText(`"${name.trim()}"`);
          this.seedlingNameText.setColor('#FFDD44');
          this.seedlingNameText.setFontSize('16px');
          this.seedlingNameText.disableInteractive();
        }
      });
    });

    // Trait list as icon grid — delayed
    this.time.delayedCall(3200, () => {
      if (this.graftedTraits.length > 0) {
        const iconSize = 22;
        const iconGap = 5;
        const cols = Math.min(this.graftedTraits.length, 8);
        const gridWidth = cols * (iconSize + iconGap) - iconGap;
        const gridStartX = cx - gridWidth / 2;
        const gridStartY = height * 0.67;

        // Tooltip text (shown on hover)
        const tooltip = this.add.text(cx, gridStartY - 16, '', {
          fontFamily: 'monospace', fontSize: '11px', color: '#CCCCCC',
        }).setOrigin(0.5).setDepth(6).setAlpha(0);

        for (let i = 0; i < this.graftedTraits.length; i++) {
          const t = this.graftedTraits[i];
          const catColor = CATEGORY_COLORS[t.category];
          const col = Math.floor(i % cols);
          const row = Math.floor(i / cols);
          const tx = gridStartX + col * (iconSize + iconGap);
          const ty = gridStartY + row * (iconSize + iconGap);

          const bg = this.add.rectangle(tx + iconSize / 2, ty + iconSize / 2, iconSize, iconSize, 0x111111, 0.5)
            .setStrokeStyle(1, catColor, 0.4).setDepth(5).setAlpha(0)
            .setInteractive({ useHandCursor: true });
          const icon = this.add.image(tx + iconSize / 2, ty + iconSize / 2, `icon_${t.category}`)
            .setDepth(5).setAlpha(0);

          bg.on('pointerover', () => {
            tooltip.setText(t.name);
            tooltip.setColor(intToHexColor(catColor));
            this.tweens.add({ targets: tooltip, alpha: 1, duration: 100 });
          });
          bg.on('pointerout', () => {
            this.tweens.add({ targets: tooltip, alpha: 0, duration: 100 });
          });

          this.tweens.add({ targets: [bg, icon], alpha: 1, duration: 400, delay: i * 60 });
        }
      }
    });

    // Buttons — delayed
    this.time.delayedCall(3500, () => {
      const btnY = height * 0.92;

      // New Run button
      const playBg = this.add.rectangle(cx - 100, btnY, 160, 38, 0x226622, 0.8)
        .setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0x338833).setAlpha(0).setDepth(5);
      const playTxt = this.add.text(cx - 100, btnY, 'NEW RUN', {
        fontFamily: 'monospace', fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0).setDepth(5);

      playBg.on('pointerover', () => { playBg.setFillStyle(0x338833, 1); this.tweens.add({ targets: playBg, scaleX: 1.05, scaleY: 1.05, duration: 80 }); this.audio.play('cardHover'); });
      playBg.on('pointerout', () => { playBg.setFillStyle(0x226622, 0.8); this.tweens.add({ targets: playBg, scaleX: 1, scaleY: 1, duration: 80 }); });
      playBg.on('pointerdown', () => {
        this.audio.play('uiClick');
        this.tweens.add({ targets: playBg, scaleX: 0.95, scaleY: 0.95, duration: 50, yoyo: true });
        this.cameras.main.fadeOut(400);
        this.time.delayedCall(400, () => this.scene.start('Menu'));
      });

      // Screenshot button
      const shareBg = this.add.rectangle(cx + 100, btnY, 160, 38, 0x224466, 0.8)
        .setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0x336688).setAlpha(0).setDepth(5);
      const shareTxt = this.add.text(cx + 100, btnY, 'SCREENSHOT', {
        fontFamily: 'monospace', fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0).setDepth(5);

      shareBg.on('pointerover', () => { shareBg.setFillStyle(0x336688, 1); this.tweens.add({ targets: shareBg, scaleX: 1.05, scaleY: 1.05, duration: 80 }); });
      shareBg.on('pointerout', () => { shareBg.setFillStyle(0x224466, 0.8); this.tweens.add({ targets: shareBg, scaleX: 1, scaleY: 1, duration: 80 }); });
      shareBg.on('pointerdown', () => {
        this.game.renderer.snapshot((image) => {
          const link = document.createElement('a');
          link.href = image.src;
          link.download = 'rootbound-seedling.png';
          link.click();
        });
      });

      this.tweens.add({ targets: [playBg, playTxt, shareBg, shareTxt], alpha: 1, duration: 600 });
    });
  }
}
