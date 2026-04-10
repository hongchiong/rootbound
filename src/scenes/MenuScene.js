import Phaser from 'phaser';
import { buildBiomeSequence } from '../data/biomes.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    this.audio = this.registry.get('audio');
    this.audio.startMusic('menu');

    this.cameras.main.setBackgroundColor(0x0A120A);

    // ── Layered background particles (varied colors, depths) ──
    const particleColors = [0x55AA55, 0x44BB44, 0x77CC77, 0x338833, 0x66AA44];
    for (let i = 0; i < 30; i++) {
      const px = Phaser.Math.Between(10, width - 10);
      const py = Phaser.Math.Between(10, height - 10);
      const size = 0.5 + Math.random() * 1.5;
      const alpha = 0.08 + Math.random() * 0.22;
      const color = particleColors[i % particleColors.length];
      const p = this.add.circle(px, py, size, color, 0).setDepth(0);

      this.tweens.add({
        targets: p,
        alpha: { from: 0, to: alpha },
        y: py - Phaser.Math.Between(30, 140),
        duration: 4000 + Math.random() * 5000,
        repeat: -1,
        yoyo: true,
        delay: Math.random() * 4000,
      });
    }

    // ── Ambient light shaft behind seedling ──
    const shaft = this.add.graphics().setDepth(0);
    shaft.fillStyle(0x55CC55, 0.02);
    shaft.fillTriangle(cx - 30, height * 0.2, cx + 30, height * 0.2, cx - 60, height * 0.65);
    shaft.fillTriangle(cx - 30, height * 0.2, cx + 30, height * 0.2, cx + 60, height * 0.65);
    this.tweens.add({
      targets: shaft, alpha: { from: 0.4, to: 1 },
      duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Title — staggered entrance ──
    // Glow behind title (larger, blurred feel)
    const titleGlow = this.add.text(cx, height * 0.18, 'ROOTBOUND', {
      fontFamily: 'monospace', fontSize: '52px', color: '#33AA33', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    const title = this.add.text(cx, height * 0.18, 'ROOTBOUND', {
      fontFamily: 'monospace', fontSize: '48px', color: '#55CC55', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    // Title drops in from above
    title.setPosition(cx, height * 0.12);
    titleGlow.setPosition(cx, height * 0.12);
    this.tweens.add({
      targets: [title, titleGlow],
      y: height * 0.18,
      duration: 800,
      ease: 'Back.easeOut',
      delay: 200,
      onStart: () => this.audio.play('menuEntrance'),
    });
    this.tweens.add({
      targets: titleGlow, alpha: 0.15, duration: 800, delay: 200,
    });
    this.tweens.add({
      targets: title, alpha: 1, duration: 600, delay: 200,
    });

    // Title pulse (after entrance)
    this.time.delayedCall(1000, () => {
      this.tweens.add({
        targets: title, alpha: 0.85, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    });

    // Subtitle — fades in after title lands
    const subtitle = this.add.text(cx, height * 0.18 + 48, 'Grow. Graft. Survive.', {
      fontFamily: 'monospace', fontSize: '15px', color: '#77AA77',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: subtitle, alpha: 1, duration: 600, delay: 700,
    });

    // ── Ground vines — decorative tendrils flanking the mound ──
    const vines = this.add.graphics().setDepth(0);
    vines.lineStyle(2, 0x2A4A2A, 0.4);
    // Left vine
    const lx = cx - 50;
    vines.beginPath();
    vines.moveTo(lx, height * 0.56);
    vines.lineTo(lx - 15, height * 0.53);
    vines.lineTo(lx - 28, height * 0.55);
    vines.lineTo(lx - 40, height * 0.51);
    vines.strokePath();
    // Left vine leaves
    vines.fillStyle(0x2A5A2A, 0.3);
    vines.fillTriangle(lx - 15, height * 0.53, lx - 22, height * 0.49, lx - 18, height * 0.52);
    vines.fillTriangle(lx - 35, height * 0.52, lx - 44, height * 0.48, lx - 38, height * 0.50);
    // Right vine
    const rx = cx + 50;
    vines.lineStyle(2, 0x2A4A2A, 0.4);
    vines.beginPath();
    vines.moveTo(rx, height * 0.56);
    vines.lineTo(rx + 18, height * 0.54);
    vines.lineTo(rx + 30, height * 0.56);
    vines.lineTo(rx + 44, height * 0.52);
    vines.strokePath();
    // Right vine leaves
    vines.fillStyle(0x2A5A2A, 0.3);
    vines.fillTriangle(rx + 18, height * 0.54, rx + 25, height * 0.50, rx + 21, height * 0.53);
    vines.fillTriangle(rx + 38, height * 0.53, rx + 48, height * 0.49, rx + 42, height * 0.51);

    // ── Ground mound — slightly richer ──
    const ground = this.add.graphics().setDepth(1);
    ground.fillStyle(0x1A2A1A, 0.5);
    ground.fillEllipse(cx, height * 0.56, 120, 20);
    ground.fillStyle(0x142014, 0.4);
    ground.fillEllipse(cx, height * 0.56 + 3, 100, 14);
    // Subtle grass tufts on mound
    ground.fillStyle(0x338833, 0.25);
    ground.fillTriangle(cx - 30, height * 0.55, cx - 28, height * 0.53, cx - 26, height * 0.55);
    ground.fillTriangle(cx + 20, height * 0.555, cx + 23, height * 0.535, cx + 26, height * 0.555);
    ground.fillTriangle(cx - 5, height * 0.55, cx - 3, height * 0.535, cx - 1, height * 0.55);

    // Seedling ambient glow
    const seedGlow = this.add.circle(cx, height * 0.48, 30, 0x44CC44, 0).setDepth(1);
    this.tweens.add({
      targets: seedGlow, alpha: { from: 0.03, to: 0.08 },
      duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Seedling shadow
    this.add.ellipse(cx, height * 0.55, 28, 10, 0x000000, 0.2).setDepth(1);

    // ── Seedling — entrance from below ──
    const seedTargetY = height * 0.46;
    const seedling = this.add.image(cx, seedTargetY + 40, 'seedling_base').setScale(2.4).setAlpha(0).setDepth(2);
    this.tweens.add({
      targets: seedling,
      y: seedTargetY,
      alpha: 1,
      duration: 600,
      delay: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Bob after entrance
        this.tweens.add({
          targets: seedling, y: seedTargetY - 6, duration: 1000,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      },
    });

    // ── Start button — fades in after seedling ──
    const btnY = height * 0.7;
    const btnBg = this.add.rectangle(cx, btnY, 200, 48, 0x228B22, 0)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x33AA33).setDepth(3);

    // Button inner highlight
    const btnHighlight = this.add.rectangle(cx, btnY - 18, 196, 3, 0x44CC44, 0).setDepth(3);

    const btnText = this.add.text(cx, btnY, 'BEGIN RUN', {
      fontFamily: 'monospace', fontSize: '20px', color: '#FFFFFF', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0).setDepth(3);

    // Button pulse glow (subtle)
    const btnGlow = this.add.rectangle(cx, btnY, 210, 56, 0x33AA33, 0).setDepth(2);
    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets: btnGlow, alpha: { from: 0, to: 0.06 },
        duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    });

    // Button entrance
    this.tweens.add({
      targets: btnBg, alpha: { from: 0, to: 0.85 }, duration: 400, delay: 900,
    });
    this.tweens.add({
      targets: btnHighlight, alpha: { from: 0, to: 0.2 }, duration: 400, delay: 900,
    });
    this.tweens.add({
      targets: btnText, alpha: 1, duration: 400, delay: 900,
    });

    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x33AA33, 1);
      this.tweens.add({ targets: [btnBg, btnText], scaleX: 1.05, scaleY: 1.05, duration: 80 });
      this.audio.play('cardHover');
    });
    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x228B22, 0.85);
      this.tweens.add({ targets: [btnBg, btnText], scaleX: 1, scaleY: 1, duration: 80 });
    });
    btnBg.on('pointerdown', () => {
      this.audio.init();
      this.audio.play('uiClick');
      this.tweens.add({ targets: [btnBg, btnText], scaleX: 0.95, scaleY: 0.95, duration: 40, yoyo: true });
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(400, () => {
        const visualSeed = Date.now() ^ (Math.random() * 0xFFFFFFFF >>> 0);
        this.scene.start('Shop', {
          biomeSequence: buildBiomeSequence(),
          biomeIndex: 0,
          waveInBiome: 0,
          traits: [],
          visualSeed,
        });
      });
    });

    // ── Instructions — fade in last ──
    const instructions = this.add.text(cx, height * 0.84, 'Graft traits onto your seedling.\nSurvive 5 waves. Defeat the Blight.', {
      fontFamily: 'monospace', fontSize: '11px', color: '#556655', align: 'center',
    }).setOrigin(0.5).setAlpha(0).setDepth(3);
    this.tweens.add({
      targets: instructions, alpha: 1, duration: 500, delay: 1200,
    });

    this.cameras.main.fadeIn(600);

    // Mute toggle
    this.audio.createMuteButton(this);
  }
}
