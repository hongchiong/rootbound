import Phaser from 'phaser';
import { ENEMY_TYPES, BIOME_BOSSES } from '../data/enemies.js';
import { BIOMES, getBiomeWave, getDifficultyScale, getBossDifficultyScale } from '../data/biomes.js';
import { CATEGORY_COLORS } from '../data/traits.js';
import { computeStats, calculateDamage, getDamageTypeColor, computeActiveSynergies, DAMAGE_TYPES } from '../systems/Combat.js';
import { SET_BONUSES } from '../data/setBonuses.js';
import { SYNERGY_DEFS } from '../data/synergies.js';
import { generateSeedlingTexture } from '../systems/SpriteGenerator.js';

const BASE_SEEDLING_STATS = {
  maxHp: 120,
  hp: 120,
  attack: 18,
  attackSpeed: 800,
  attackRange: 160,
  hpRegen: 2,
  armor: 0,
  critChance: 0.05,
  accuracy: 1.0,
  speed: 0,
  thornDamage: 0,
};

export default class CombatScene extends Phaser.Scene {
  constructor() {
    super('Combat');
  }

  init(data) {
    this.audio = this.registry.get('audio');
    this.graftedTraits = data.traits || [];
    this.seedlingName = data.seedlingName || null;
    // Biome state
    this.biomeSequence = data.biomeSequence || ['garden'];
    this.biomeIndex = data.biomeIndex || 0;
    this.waveInBiome = data.waveInBiome || 0;
    // HP persistence from previous wave
    this.incomingSeedlingHp = data.seedlingHp;
    this.incomingSeedlingMaxHp = data.seedlingMaxHp;
    // Current biome data
    this.currentBiomeId = this.biomeSequence[this.biomeIndex];
    this.currentBiome = BIOMES[this.currentBiomeId] || BIOMES.garden;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(this.currentBiome.bgColor);

    // Game state
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.spawnQueue = [];
    this.waveComplete = false;
    this.isPaused = false;
    this.killCount = 0;
    this.trailParticles = [];

    // Arena bounds
    this.arenaBounds = new Phaser.Geom.Rectangle(20, 60, width - 40, height - 80);

    // Draw biome environment
    this.drawArenaEnvironment();

    // Create seedling
    this.createSeedling();

    // UI
    this.createUI();

    // Vignette overlay
    this.drawVignette();

    // Ambient particles
    this.ambientParticles = [];
    this.time.addEvent({
      delay: 600,
      repeat: -1,
      callback: () => this.spawnAmbientParticle(),
    });

    // Start biome music
    this.audio.startMusic(this.currentBiomeId);

    // Start wave
    this.startWave();

    // Timers
    this.lastAttackTime = 0;
    this.lastSporeTime = 0;
    this.lastRegenTime = 0;
    this.lastTrailTime = 0;

    this.cameras.main.fadeIn(400);
  }

  // ── Environment Drawing ─────────────────────────────────────────

  drawArenaEnvironment() {
    const style = this.currentBiome.environmentStyle;
    switch (style) {
      case 'forest': this.drawForestEnvironment(); break;
      case 'underroot': this.drawUndrrootEnvironment(); break;
      case 'rot': this.drawRotEnvironment(); break;
      case 'canopy': this.drawCanopyEnvironment(); break;
      case 'emergent': this.drawEmergentEnvironment(); break;
      default: this.drawGardenEnvironment(); break;
    }
  }

  drawGardenEnvironment() {
    const { width, height } = this.scale;
    const env = this.add.graphics().setDepth(0);
    const arena = this.arenaBounds;
    const [dark, light] = this.currentBiome.tileColors;

    const tileSize = 16;
    for (let x = arena.x; x < arena.right; x += tileSize) {
      for (let y = arena.y; y < arena.bottom; y += tileSize) {
        const isDark = ((x + y) / tileSize) % 2 === 0;
        env.fillStyle(isDark ? dark : light, 1);
        env.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Grass tufts
    env.lineStyle(1, 0x2A4A2A, 0.6);
    for (let i = 0; i < 25; i++) {
      const gx = arena.x + 10 + ((i * 97 + 31) % (arena.width - 20));
      const gy = arena.y + 10 + ((i * 73 + 17) % (arena.height - 20));
      if (Math.abs(gx - width / 2) < 80 && Math.abs(gy - height / 2) < 60) continue;
      env.lineBetween(gx, gy, gx - 2, gy - 5);
      env.lineBetween(gx + 2, gy, gx + 1, gy - 6);
      env.lineBetween(gx + 4, gy, gx + 5, gy - 4);
    }

    // Rocks
    env.fillStyle(0x3A3A3A, 0.4);
    const rocks = [
      [arena.x + 15, arena.y + 20], [arena.right - 25, arena.y + 30],
      [arena.x + 30, arena.bottom - 20], [arena.right - 40, arena.bottom - 15],
      [arena.x + 80, arena.y + 15], [arena.right - 80, arena.bottom - 25],
    ];
    for (const [rx, ry] of rocks) {
      env.fillEllipse(rx, ry, 6, 4);
    }

    this.drawArenaBorder(env, 0x1A3318, 0x2A4A28);
  }

  drawForestEnvironment() {
    const { width, height } = this.scale;
    const env = this.add.graphics().setDepth(0);
    const arena = this.arenaBounds;
    const [dark, light] = this.currentBiome.tileColors;

    // Dark forest floor
    const tileSize = 20;
    for (let x = arena.x; x < arena.right; x += tileSize) {
      for (let y = arena.y; y < arena.bottom; y += tileSize) {
        const isDark = ((x + y) / tileSize) % 2 === 0;
        env.fillStyle(isDark ? dark : light, 1);
        env.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Tree roots
    env.lineStyle(3, 0x1A2E0A, 0.5);
    const rootSeeds = [
      [arena.x + 20, arena.y + 30], [arena.right - 30, arena.y + 50],
      [arena.x + 40, arena.bottom - 30], [arena.right - 20, arena.bottom - 40],
      [arena.x + 100, arena.y + 20], [arena.right - 100, arena.bottom - 20],
    ];
    for (const [rx, ry] of rootSeeds) {
      const dx = (width / 2 - rx) * 0.3;
      const dy = (height / 2 - ry) * 0.3;
      env.lineBetween(rx, ry, rx + dx, ry + dy);
      env.lineBetween(rx, ry, rx + dx * 0.5 + 10, ry + dy * 0.5);
    }

    // Mossy patches
    env.fillStyle(0x2A4A1A, 0.3);
    for (let i = 0; i < 8; i++) {
      const mx = arena.x + 20 + ((i * 113 + 41) % (arena.width - 40));
      const my = arena.y + 20 + ((i * 79 + 23) % (arena.height - 40));
      if (Math.abs(mx - width / 2) < 70 && Math.abs(my - height / 2) < 50) continue;
      env.fillEllipse(mx, my, 30, 12);
    }

    // Tree trunks at corners
    env.fillStyle(0x1A2E0A, 0.6);
    const trunks = [
      [arena.x + 8, arena.y + 8], [arena.right - 8, arena.y + 8],
      [arena.x + 8, arena.bottom - 8], [arena.right - 8, arena.bottom - 8],
    ];
    for (const [tx, ty] of trunks) {
      env.fillRect(tx - 5, ty - 5, 10, 40);
      env.fillStyle(0x2A4A1A, 0.4);
      env.fillCircle(tx, ty - 10, 18);
      env.fillStyle(0x1A2E0A, 0.6);
    }

    this.drawArenaBorder(env, 0x1E3A18, 0x2A5020);
  }

  drawUndrrootEnvironment() {
    const { width, height } = this.scale;
    const env = this.add.graphics().setDepth(0);
    const arena = this.arenaBounds;
    const [dark, light] = this.currentBiome.tileColors;

    // Stone floor
    const tileSize = 18;
    for (let x = arena.x; x < arena.right; x += tileSize) {
      for (let y = arena.y; y < arena.bottom; y += tileSize) {
        const isDark = ((x + y) / tileSize) % 2 === 0;
        env.fillStyle(isDark ? dark : light, 1);
        env.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Cracks in the floor
    env.lineStyle(1, 0x0A0800, 0.5);
    const cracks = [
      [arena.x + 40, arena.y + 40, arena.x + 80, arena.y + 70],
      [arena.right - 60, arena.y + 30, arena.right - 90, arena.y + 65],
      [arena.x + 30, arena.bottom - 50, arena.x + 70, arena.bottom - 30],
      [arena.right - 40, arena.bottom - 60, arena.right - 75, arena.bottom - 35],
    ];
    for (const [x1, y1, x2, y2] of cracks) {
      env.lineBetween(x1, y1, x2, y2);
    }

    // Bioluminescent mushrooms
    const mushColors = [0xAA8822, 0x886611, 0xCC9933];
    for (let i = 0; i < 12; i++) {
      const mx = arena.x + 15 + ((i * 89 + 17) % (arena.width - 30));
      const my = arena.y + 15 + ((i * 67 + 31) % (arena.height - 30));
      if (Math.abs(mx - width / 2) < 75 && Math.abs(my - height / 2) < 55) continue;
      const col = mushColors[i % 3];
      env.fillStyle(col, 0.5);
      env.fillEllipse(mx, my, 10, 6);
      env.fillStyle(col, 0.25);
      env.fillRect(mx - 2, my, 4, 6);
      // Glow halo
      env.fillStyle(col, 0.1);
      env.fillCircle(mx, my, 10);
    }

    this.drawArenaBorder(env, 0x2A1A06, 0x3A2A0A);
  }

  drawRotEnvironment() {
    const { width, height } = this.scale;
    const env = this.add.graphics().setDepth(0);
    const arena = this.arenaBounds;
    const [dark, light] = this.currentBiome.tileColors;

    // Decayed tiles with irregular edges
    const tileSize = 16;
    for (let x = arena.x; x < arena.right; x += tileSize) {
      for (let y = arena.y; y < arena.bottom; y += tileSize) {
        const isDark = ((x + y) / tileSize) % 2 === 0;
        env.fillStyle(isDark ? dark : light, 1);
        env.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Rot puddles
    env.fillStyle(0x5A0A3A, 0.2);
    const puddles = [
      [arena.x + 30, arena.y + 40, 35, 14], [arena.right - 50, arena.y + 30, 28, 10],
      [arena.x + 50, arena.bottom - 45, 32, 12], [arena.right - 35, arena.bottom - 35, 26, 10],
      [arena.x + 130, arena.y + 60, 22, 9], [arena.right - 130, arena.bottom - 55, 20, 8],
    ];
    for (const [px, py, pw, ph] of puddles) {
      env.fillEllipse(px, py, pw, ph);
    }

    // Dead vines creeping from edges
    env.lineStyle(2, 0x3A0A2A, 0.4);
    for (let i = 0; i < 6; i++) {
      const sx = arena.x + 10 + i * (arena.width / 6);
      env.lineBetween(sx, arena.y + 5, sx + (i % 2 ? 20 : -20), arena.y + 30);
    }

    this.drawArenaBorder(env, 0x3A0A2A, 0x4A0A3A);
  }

  drawCanopyEnvironment() {
    const { width, height } = this.scale;
    const env = this.add.graphics().setDepth(0);
    const arena = this.arenaBounds;
    const [dark, light] = this.currentBiome.tileColors;

    // Sky-blue planks / branches
    const tileSize = 22;
    for (let x = arena.x; x < arena.right; x += tileSize) {
      for (let y = arena.y; y < arena.bottom; y += tileSize) {
        const isDark = ((x + y) / tileSize) % 2 === 0;
        env.fillStyle(isDark ? dark : light, 1);
        env.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Leaf clusters at edges
    env.fillStyle(0x1A3A1A, 0.5);
    for (let i = 0; i < 8; i++) {
      const lx = arena.x + i * (arena.width / 7);
      const ly = arena.y + 8;
      env.fillEllipse(lx, ly, 28, 16);
    }
    for (let i = 0; i < 6; i++) {
      const lx = arena.x + 20 + i * (arena.width / 5);
      const ly = arena.bottom - 8;
      env.fillEllipse(lx, ly, 22, 12);
    }

    // Wind trails
    env.lineStyle(1, 0x3A5A7A, 0.25);
    for (let i = 0; i < 5; i++) {
      const wy = arena.y + 30 + i * 25;
      env.lineBetween(arena.x + 10, wy, arena.x + 80, wy + (i % 2 ? 5 : -5));
      env.lineBetween(arena.right - 10, wy, arena.right - 80, wy + (i % 2 ? -5 : 5));
    }

    // Light shafts from above
    env.fillStyle(0x4488CC, 0.04);
    for (let i = 0; i < 4; i++) {
      const sx = arena.x + 60 + i * 220;
      env.fillTriangle(sx - 20, arena.y, sx + 20, arena.y, sx, arena.bottom);
    }

    this.drawArenaBorder(env, 0x1A3A5A, 0x2A4A6A);
  }

  drawEmergentEnvironment() {
    const { width, height } = this.scale;
    const env = this.add.graphics().setDepth(0);
    const arena = this.arenaBounds;
    const [dark, light] = this.currentBiome.tileColors;

    // Crystalline floor
    const tileSize = 14;
    for (let x = arena.x; x < arena.right; x += tileSize) {
      for (let y = arena.y; y < arena.bottom; y += tileSize) {
        const isDark = ((x + y) / tileSize) % 2 === 0;
        env.fillStyle(isDark ? dark : light, 1);
        env.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Crystal shards bursting from ground
    env.fillStyle(0x3355AA, 0.4);
    const shards = [
      [arena.x + 25, arena.y + 30], [arena.right - 30, arena.y + 45],
      [arena.x + 45, arena.bottom - 25], [arena.right - 45, arena.bottom - 35],
      [arena.x + 110, arena.y + 20], [arena.right - 110, arena.bottom - 20],
      [arena.x + 15, arena.bottom - 50], [arena.right - 20, arena.y + 60],
    ];
    for (const [sx, sy] of shards) {
      if (Math.abs(sx - width / 2) < 80 && Math.abs(sy - height / 2) < 60) continue;
      const h = 15 + Math.random() * 20;
      env.fillTriangle(sx, sy - h, sx - 5, sy + 5, sx + 5, sy + 5);
      env.fillStyle(0x5577CC, 0.2);
      env.fillCircle(sx, sy - h / 2, 6);
      env.fillStyle(0x3355AA, 0.4);
    }

    // Energy lines
    env.lineStyle(1, 0x4466AA, 0.2);
    for (let i = 0; i < 6; i++) {
      const x1 = arena.x + i * 150;
      env.lineBetween(x1, arena.y, x1 + 60, arena.bottom);
    }

    this.drawArenaBorder(env, 0x3344AA, 0x4455BB);
  }

  drawArenaBorder(env, outerColor, innerColor) {
    const arena = this.arenaBounds;
    const { width, height } = this.scale;

    env.lineStyle(2, outerColor, 0.7);
    env.strokeRect(arena.x - 2, arena.y - 2, arena.width + 4, arena.height + 4);
    env.lineStyle(1, innerColor, 0.5);
    env.strokeRect(arena.x, arena.y, arena.width, arena.height);

    // Corner decorations
    const corners = [
      [arena.x, arena.y], [arena.right, arena.y],
      [arena.x, arena.bottom], [arena.right, arena.bottom],
    ];
    env.fillStyle(innerColor, 0.5);
    for (const [cornX, cornY] of corners) {
      const dx = cornX < width / 2 ? 1 : -1;
      const dy = cornY < height / 2 ? 1 : -1;
      env.fillTriangle(cornX, cornY, cornX + dx * 8, cornY, cornX, cornY + dy * 8);
    }
  }

  drawVignette() {
    const { width, height } = this.scale;
    const vig = this.add.graphics().setDepth(50);
    const steps = 6;
    const edgeWidth = 40;

    for (let i = 0; i < steps; i++) {
      const alpha = 0.25 * (1 - i / steps);
      const offset = (i / steps) * edgeWidth;
      vig.fillStyle(0x000000, alpha);
      vig.fillRect(0, offset, width, edgeWidth / steps);
      vig.fillRect(0, height - offset - edgeWidth / steps, width, edgeWidth / steps);
      vig.fillRect(offset, 0, edgeWidth / steps, height);
      vig.fillRect(width - offset - edgeWidth / steps, 0, edgeWidth / steps, height);
    }
  }

  spawnAmbientParticle() {
    if (this.ambientParticles.length >= 10) return;
    const { width, height } = this.scale;
    const x = Phaser.Math.Between(40, width - 40);
    const y = height - 20;
    const p = this.add.image(x, y, 'particle_ambient')
      .setAlpha(0).setDepth(1)
      .setTint(this.currentBiome.ambientColor);

    this.tweens.add({
      targets: p,
      y: y - Phaser.Math.Between(60, 150),
      alpha: { from: 0, to: 0.35 },
      duration: 3000 + Math.random() * 2000,
      onComplete: () => {
        p.destroy();
        this.ambientParticles = this.ambientParticles.filter(ap => ap !== p);
      },
    });
    this.ambientParticles.push(p);
  }

  // ── Seedling Setup ──────────────────────────────────────────────

  createSeedling() {
    const { width, height } = this.scale;

    const activeSynergies = computeActiveSynergies(this.graftedTraits, SYNERGY_DEFS);
    this.seedlingStats = computeStats({ ...BASE_SEEDLING_STATS }, this.graftedTraits, SET_BONUSES, activeSynergies);
    // Use persisted HP if available; add any maxHp gain from new trait picks
    if (this.incomingSeedlingHp != null && this.incomingSeedlingMaxHp != null) {
      const maxHpGain = this.seedlingStats.maxHp - this.incomingSeedlingMaxHp;
      this.seedlingStats.hp = Math.min(
        this.seedlingStats.maxHp,
        this.incomingSeedlingHp + Math.max(0, maxHpGain)
      );
    } else {
      this.seedlingStats.hp = this.seedlingStats.maxHp;
    }

    // Track runtime combat state for synergies/legendary effects
    this.combatState = {
      hitCount: 0,
      hitTimestamps: [],
      soulReaverStacks: 0,
      prismaticIndex: 0,
      secondWindUsed: false,
      phoenixUsed: false,
      nuclearBloomTimer: 0,
      overgrowthTimer: 0,
      overgrowthActive: false,
      drainAuraTimer: 0,
      overgrowthWaveTimer: 0,
      sporeGroundZones: [],
    };

    // Player debuff state
    this.playerDebuffs = {
      venom: { timer: 0, dps: 0 },
      wither: { timer: 0, regenReduce: 0 },
      corrode: { timer: 0, armorReduce: 0 },
      entangle: { timer: 0, rangeReduce: 0 },
      attackSlow: { timer: 0, speedReduce: 0 },
    };
    this.playerStatusIcons = [];

    if (this.graftedTraits.length > 0) {
      generateSeedlingTexture(this, this.graftedTraits, 'seedling_current');
      this.seedling = this.add.image(width / 2, height / 2 + 20, 'seedling_current').setScale(1.3).setDepth(5);
    } else {
      this.seedling = this.add.image(width / 2, height / 2 + 20, 'seedling_base').setScale(1.4).setDepth(5);
    }

    this.seedlingShadow = this.add.ellipse(width / 2, height / 2 + 45, 30, 10, 0x000000, 0.2).setDepth(4);

    this.tweens.add({
      targets: this.seedling,
      y: this.seedling.y - 4,
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const barW = 60;
    const barH = 8;
    this.seedlingHpBorder = this.add.rectangle(this.seedling.x, this.seedling.y - 44, barW + 4, barH + 4, 0x111111).setOrigin(0.5).setDepth(10);
    this.seedlingHpBg = this.add.rectangle(this.seedling.x, this.seedling.y - 44, barW, barH, 0x2A2A2A).setOrigin(0.5).setDepth(10);
    this.seedlingHpBar = this.add.rectangle(this.seedling.x - barW / 2, this.seedling.y - 44, barW, barH, 0x44CC44).setOrigin(0, 0.5).setDepth(10);
    this.seedlingHpHighlight = this.add.rectangle(this.seedling.x - barW / 2, this.seedling.y - 47, barW, 2, 0x66EE66, 0.4).setOrigin(0, 0.5).setDepth(10);
    this.seedlingHpIcon = this.add.image(this.seedling.x - barW / 2 - 10, this.seedling.y - 44, 'icon_heart').setScale(0.8).setDepth(10);
    this.hpBarWidth = barW;

    // Cooldown arc ring (shows attack readiness)
    this.cooldownArc = this.add.graphics().setDepth(6);
    this.cooldownArcRadius = 26;

    // Range circle (subtle indicator of attack range)
    this.rangeCircle = this.add.graphics().setDepth(1);
    this.rangeCircleVisible = true;
  }

  // ── UI ──────────────────────────────────────────────────────────

  createUI() {
    const { width } = this.scale;
    const biome = this.currentBiome;
    const isBossWave = this.waveInBiome === 3;
    const bossData = isBossWave ? this.getBossData() : null;
    const bossName = bossData ? bossData.name : null;

    // Wave label: "GARDEN · Wave 2 / 4" or "ANCIENT FOREST · BOSS"
    const biomeLabel = biome.name.toUpperCase();
    const waveLabel = isBossWave
      ? `${biomeLabel} · BOSS: ${bossName}`
      : `${biomeLabel} · Wave ${this.waveInBiome + 1} / 4`;

    this.add.text(width / 2 + 1, 16, waveLabel, {
      fontFamily: 'monospace', fontSize: '16px', color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10).setAlpha(0.3);

    this.waveLabel = this.add.text(width / 2, 15, waveLabel, {
      fontFamily: 'monospace', fontSize: isBossWave ? '17px' : '16px',
      color: isBossWave ? '#FF4444' : '#AADDAA', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    // Pulse the boss wave label to draw attention
    if (isBossWave) {
      this.tweens.add({
        targets: this.waveLabel, alpha: 0.5,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // Biome + wave progress indicator
    const wavesPerBiome = 4;
    const totalBiomes = this.biomeSequence.length;
    const biomeGroupSpacing = 28;
    const waveDotSpacing = 7;
    const totalWidth = (totalBiomes - 1) * biomeGroupSpacing;
    const startGroupX = width / 2 - totalWidth / 2;

    for (let b = 0; b < totalBiomes; b++) {
      const groupX = startGroupX + b * biomeGroupSpacing;
      const isDone = b < this.biomeIndex;
      const isActive = b === this.biomeIndex;

      // Wave sub-dots for each biome
      const subStartX = groupX - ((wavesPerBiome - 1) * waveDotSpacing) / 2;
      for (let w = 0; w < wavesPerBiome; w++) {
        const wx = subStartX + w * waveDotSpacing;
        const isBossDot = w === 3;
        let col;
        if (isDone) {
          col = 0x55FF55;
        } else if (isActive) {
          col = w < this.waveInBiome ? 0x55FF55 : w === this.waveInBiome ? 0xFFAA22 : 0x333333;
        } else {
          col = 0x333333;
        }

        if (isBossDot) {
          // Boss wave dot: diamond shape (rotated square) + larger
          const bossCol = isDone ? 0x55FF55
            : (isActive && w === this.waveInBiome) ? 0xFF4444
            : (isActive && w < this.waveInBiome) ? 0x55FF55
            : 0x552222;
          const diamond = this.add.rectangle(wx, 34, 6, 6, bossCol).setDepth(10).setAngle(45);
          // Pulse the boss dot if it's the current wave
          if (isActive && w === this.waveInBiome) {
            this.tweens.add({
              targets: diamond, scaleX: 1.4, scaleY: 1.4,
              duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
          }
        } else {
          this.add.circle(wx, 34, 2.5, col).setDepth(10);
        }
      }
    }

    // HP text
    this.hpText = this.add.text(width / 2, 44, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#88CC88',
    }).setOrigin(0.5).setDepth(10);

    // Enemies remaining
    this.enemyCountText = this.add.text(width - 20, 15, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#CC9988',
    }).setOrigin(1, 0).setDepth(10);

    this.drawTraitIcons();

    this.statsText = this.add.text(10, 48, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#667766',
    }).setDepth(10);

    // Mute toggle
    this.audio.createMuteButton(this);
  }

  drawTraitIcons() {
    const startX = 10;
    const startY = 10;
    for (let i = 0; i < this.graftedTraits.length; i++) {
      const t = this.graftedTraits[i];
      this.add.rectangle(startX + i * 20, startY, 16, 16, 0x111111, 0.6)
        .setOrigin(0, 0).setDepth(10).setStrokeStyle(1, CATEGORY_COLORS[t.category], 0.5);
      this.add.image(startX + i * 20 + 8, startY + 8, `icon_${t.category}`).setDepth(10);
    }
  }

  // ── Wave Management ─────────────────────────────────────────────

  getBossData() {
    const bossKey = this.currentBiome.bossKey;
    return BIOME_BOSSES[bossKey] || null;
  }

  startWave() {
    const waveData = getBiomeWave(this.currentBiomeId, this.waveInBiome);
    this.totalEnemies = 0;
    this.spawnQueue = [];

    for (const spawn of waveData.spawns) {
      for (let i = 0; i < spawn.count; i++) {
        this.spawnQueue.push({
          type: spawn.type,
          delay: spawn.delay * (i + 1) + Math.random() * 300,
        });
        this.totalEnemies++;
      }
    }

    this.remainingEnemies = this.totalEnemies;

    this.spawnQueuePending = [...this.spawnQueue];
    this.spawnQueuePending.sort((a, b) => a.delay - b.delay);
    this.maxAliveEnemies = 15;
    this.spawnTimer = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        if (this.waveComplete || this.spawnQueuePending.length === 0) {
          if (this.spawnTimer) this.spawnTimer.remove();
          return;
        }
        const now = this.time.now - this.waveStartTime;
        while (this.spawnQueuePending.length > 0 && this.enemies.length < this.maxAliveEnemies) {
          const next = this.spawnQueuePending[0];
          if (next.delay <= now) {
            this.spawnQueuePending.shift();
            this.spawnEnemy(next.type);
          } else {
            break;
          }
        }
      },
    });
    this.waveStartTime = this.time.now;
    this.waveEscalationCount = 0;
    this.waveEscalationStartTime = 0; // set when first enemy engages

    // Wave start banner
    const { width: bw, height: bh } = this.scale;
    const isBossWave = this.waveInBiome === 3;
    const biome = this.currentBiome;
    const waveLabel = isBossWave
      ? `⚠ BOSS INCOMING ⚠`
      : `Wave ${this.waveInBiome + 1}`;
    const labelColor = isBossWave ? '#FF6644' : '#AADDFF';

    const waveBanner = this.add.text(bw / 2, bh / 2 - 60, waveLabel, {
      fontFamily: 'monospace', fontSize: isBossWave ? '26px' : '18px',
      color: labelColor, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: isBossWave ? 5 : 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(25).setScale(0.5);

    // Boss name subtitle
    let bossSubtitle = null;
    if (isBossWave) {
      const bossData = this.getBossData();
      if (bossData) {
        bossSubtitle = this.add.text(bw / 2, bh / 2 - 32, bossData.name, {
          fontFamily: 'monospace', fontSize: '16px',
          color: '#FFAA88', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setAlpha(0).setDepth(25).setScale(0.5);
      }
    }

    this.audio.play(isBossWave ? 'bossIncoming' : 'waveStart');

    const bannerTargets = bossSubtitle ? [waveBanner, bossSubtitle] : [waveBanner];
    this.tweens.add({
      targets: bannerTargets, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: bannerTargets, alpha: 0, y: '-=30',
          duration: 500, delay: isBossWave ? 1000 : 600,
          onComplete: () => bannerTargets.forEach(t => t.destroy()),
        });
      },
    });

    // Boss wave: red vignette pulse + heavier shake
    if (isBossWave) {
      const vignette = this.add.rectangle(bw / 2, bh / 2, bw, bh, 0xFF0000, 0.15).setDepth(24);
      this.tweens.add({
        targets: vignette, alpha: 0, duration: 400, yoyo: true, repeat: 1,
        onComplete: () => vignette.destroy(),
      });
      this.shakeCamera(5, 300);
    }
  }

  spawnEnemy(type) {
    const { width, height } = this.scale;
    const isBoss = BIOME_BOSSES[type] !== undefined;
    let data;
    if (isBoss) {
      data = { ...BIOME_BOSSES[type] };
    } else {
      data = { ...ENEMY_TYPES[type] };
    }

    // Position-normalized difficulty: scales stats so every biome hits the
    // same target difficulty for its position, regardless of randomized order.
    const scaleMult = isBoss
      ? getBossDifficultyScale(this.currentBiomeId, this.biomeIndex)
      : getDifficultyScale(this.currentBiomeId, this.biomeIndex);
    data.hp = Math.round(data.hp * scaleMult);
    data.attack = Math.round(data.attack * scaleMult);
    if (data.armor) data.armor = Math.round(data.armor * scaleMult);
    if (data.magicResist) data.magicResist = Math.round(data.magicResist * scaleMult);
    if (data.regen) data.regen = Math.round(data.regen * Math.sqrt(scaleMult));

    // Apply wave escalation buff to enemies spawned mid-wave
    if (this.waveEscalationCount > 0) {
      const escMult = Math.pow(1.06, Math.min(this.waveEscalationCount, 15));
      data.hp = Math.round(data.hp * escMult);
      data.attack = Math.round(data.attack * escMult);
      data.speed = Math.round(data.speed * escMult * 10) / 10;
      if (data.armor) data.armor = Math.round(data.armor * escMult);
      if (data.magicResist) data.magicResist = Math.round(data.magicResist * escMult);
      if (data.regen) data.regen = Math.round(data.regen * escMult * 10) / 10;
    }

    const side = Phaser.Math.Between(0, 3);
    let x, y;
    switch (side) {
      case 0: x = Phaser.Math.Between(30, width - 30); y = 65; break;
      case 1: x = Phaser.Math.Between(30, width - 30); y = height - 25; break;
      case 2: x = 25; y = Phaser.Math.Between(65, height - 25); break;
      case 3: x = width - 25; y = Phaser.Math.Between(65, height - 25); break;
    }

    // Resolve texture key
    let texKey;
    if (isBoss) {
      texKey = `enemy_${type}`;
    } else {
      texKey = `enemy_${type}`;
    }
    // Fallback to a known texture if the key doesn't exist
    if (!this.textures.exists(texKey)) {
      texKey = 'enemy_weed';
    }

    const sprite = this.add.image(x, y, texKey).setScale(isBoss ? 1.3 : 1.0).setDepth(4);

    // Spawn animation
    sprite.setAlpha(0).setScale(isBoss ? 0.5 : 0.3);
    this.tweens.add({
      targets: sprite,
      alpha: 1,
      scaleX: isBoss ? 1.3 : 1.0,
      scaleY: isBoss ? 1.3 : 1.0,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // HP bar
    const barWidth = isBoss ? 80 : 32;
    const barHeight = isBoss ? 6 : 4;
    const barYOff = (data.size || 16) + 6;

    const hpBorder = this.add.rectangle(x, y - barYOff, barWidth + 2, barHeight + 2, 0x111111).setOrigin(0.5).setDepth(8);
    const hpBg = this.add.rectangle(x, y - barYOff, barWidth, barHeight, 0x2A1111).setOrigin(0.5).setDepth(8);
    const hpBar = this.add.rectangle(x - barWidth / 2, y - barYOff, barWidth, barHeight, 0xCC4444).setOrigin(0, 0.5).setDepth(8);

    // Regen bar (shown for regenerating enemies)
    let regenIndicator = null;
    if (data.regen) {
      regenIndicator = this.add.rectangle(x, y - barYOff - (barHeight + 2), barWidth / 4, 2, 0x55FF55, 0.7)
        .setOrigin(0.5).setDepth(8);
    }

    const enemy = {
      sprite, hpBorder, hpBg, hpBar, regenIndicator,
      barWidth, barHeight, barYOff,
      data, hp: data.hp, maxHp: data.hp, speed: data.speed,
      lastAttackTime: 0, type, isBoss,
      poisonTimer: 0, poisonDps: 0,
      slowFactor: 1, slowTimer: 0, rootTimer: 0, currentPhase: 0,
      // Trait-based enemy properties
      armor: data.armor || 0,
      magicResist: data.magicResist || 0,
      dodgeRate: data.dodgeRate || 0,
      resistances: data.resistances || {},
      immunities: data.immunities || [],
      regen: data.regen || 0,
      explosive: data.explosive || null,
      flying: data.flying || false,
      poisonImmune: (data.immunities || []).includes('poison'),
      voidRegenSuppressTimer: 0,
      bleedTimer: 0, bleedDps: 0,
      // New status effects
      burnTimer: 0, burnDps: 0,
      frozenStacks: 0, frozenTimer: 0,
      chainImmunity: 0,
      confuseTimer: 0,
      sporeArmorDebuff: 0, sporeArmorDebuffTimer: 0,
      statusDots: [],
      // Behavior state
      behavior: data.behavior || 'melee',
      retreating: false,
      retreatTimer: 0,
      lastSummonTime: 0,
      summonedMinions: [],
      // Boss ability state
      abilityCooldowns: {},
      abilityTelegraphs: [],
      buffTimers: {},
      baseArmor: data.armor || 0,
    };

    this.enemies.push(enemy);
  }

  spawnMinions(type, count, sourceX, sourceY) {
    const maxSummonedEnemies = 25; // hard cap on total alive enemies including summons
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 200, () => {
        if (!this.waveComplete && this.enemies.length < maxSummonedEnemies) {
          // Spawn around source position
          const angle = (i / count) * Math.PI * 2;
          const dist = 40 + Math.random() * 30;
          const mx = sourceX + Math.cos(angle) * dist;
          const my = sourceY + Math.sin(angle) * dist;

          const clampedX = Phaser.Math.Clamp(mx, this.arenaBounds.x + 10, this.arenaBounds.right - 10);
          const clampedY = Phaser.Math.Clamp(my, this.arenaBounds.y + 10, this.arenaBounds.bottom - 10);

          this.spawnEnemyAtPosition(type, clampedX, clampedY, true);
          this.remainingEnemies++;
          this.totalEnemies++;
        }
      });
    }
  }

  spawnEnemyAtPosition(type, x, y, isSummoned = false) {
    const isBoss = BIOME_BOSSES[type] !== undefined;
    const data = isBoss ? { ...BIOME_BOSSES[type] } : { ...ENEMY_TYPES[type] };

    // Apply difficulty scaling to summoned enemies (same as normal spawns)
    const scaleMult = isBoss
      ? getBossDifficultyScale(this.currentBiomeId, this.biomeIndex)
      : getDifficultyScale(this.currentBiomeId, this.biomeIndex);
    data.hp = Math.round(data.hp * scaleMult);
    data.attack = Math.round(data.attack * scaleMult);
    if (data.armor) data.armor = Math.round(data.armor * scaleMult);
    if (data.magicResist) data.magicResist = Math.round(data.magicResist * scaleMult);
    if (data.regen) data.regen = Math.round(data.regen * Math.sqrt(scaleMult));

    let texKey = `enemy_${type}`;
    if (!this.textures.exists(texKey)) texKey = 'enemy_weed';

    const sprite = this.add.image(x, y, texKey).setScale(0.3).setDepth(4);
    this.tweens.add({
      targets: sprite, alpha: 1, scaleX: 1.0, scaleY: 1.0, duration: 200, ease: 'Back.easeOut',
    });

    const barWidth = 28;
    const barHeight = 3;
    const barYOff = (data.size || 14) + 5;

    const hpBorder = this.add.rectangle(x, y - barYOff, barWidth + 2, barHeight + 2, 0x111111).setOrigin(0.5).setDepth(8);
    const hpBg = this.add.rectangle(x, y - barYOff, barWidth, barHeight, 0x2A1111).setOrigin(0.5).setDepth(8);
    const hpBar = this.add.rectangle(x - barWidth / 2, y - barYOff, barWidth, barHeight, 0xCC4444).setOrigin(0, 0.5).setDepth(8);

    // Summoned enemies cannot summon more (prevents recursive chain explosion)
    const behavior = isSummoned && data.behavior === 'summoner' ? 'melee' : (data.behavior || 'melee');

    this.enemies.push({
      sprite, hpBorder, hpBg, hpBar, regenIndicator: null,
      barWidth, barHeight, barYOff,
      data, hp: data.hp, maxHp: data.hp, speed: data.speed,
      lastAttackTime: 0, type, isBoss: false,
      poisonTimer: 0, poisonDps: 0,
      slowFactor: 1, slowTimer: 0, rootTimer: 0, currentPhase: 0,
      armor: data.armor || 0, magicResist: data.magicResist || 0,
      dodgeRate: data.dodgeRate || 0, resistances: data.resistances || {},
      immunities: data.immunities || [],
      regen: data.regen || 0,
      explosive: data.explosive || null,
      flying: data.flying || false,
      poisonImmune: (data.immunities || []).includes('poison'),
      voidRegenSuppressTimer: 0,
      bleedTimer: 0, bleedDps: 0,
      burnTimer: 0, burnDps: 0,
      frozenStacks: 0, frozenTimer: 0,
      chainImmunity: 0,
      confuseTimer: 0,
      sporeArmorDebuff: 0, sporeArmorDebuffTimer: 0,
      statusDots: [],
      // Behavior state — summoned units downgraded from summoner to melee
      behavior,
      retreating: false,
      retreatTimer: 0,
      lastSummonTime: 0,
      summonedMinions: [],
      abilityCooldowns: {},
      abilityTelegraphs: [],
      buffTimers: {},
      baseArmor: data.armor || 0,
    });
  }

  // ── Game Loop ────────────────────────────────────────────────────

  update(time, delta) {
    if (this.isPaused || this.waveComplete) return;

    const dt = delta / 1000;

    // HP bar
    const hpPercent = Math.max(0, this.seedlingStats.hp / this.seedlingStats.maxHp);
    const barW = this.hpBarWidth;
    this.seedlingHpBar.width = barW * hpPercent;
    this.seedlingHpHighlight.width = barW * hpPercent;
    const hpColor = hpPercent > 0.5 ? 0x44CC44 : hpPercent > 0.25 ? 0xCCAA22 : 0xCC2222;
    this.seedlingHpBar.setFillStyle(hpColor);

    const barY = this.seedling.y - 44;
    this.seedlingHpBorder.setPosition(this.seedling.x, barY);
    this.seedlingHpBg.setPosition(this.seedling.x, barY);
    this.seedlingHpBar.setPosition(this.seedling.x - barW / 2, barY);
    this.seedlingHpHighlight.setPosition(this.seedling.x - barW / 2, barY - 3);
    this.seedlingHpIcon.setPosition(this.seedling.x - barW / 2 - 10, barY);
    this.seedlingShadow.setPosition(this.seedling.x, this.seedling.y + 25);

    // Cooldown arc — fills clockwise as attack recharges
    if (this.cooldownArc) {
      this.cooldownArc.clear();
      let effSpeed = this.seedlingStats.effectiveAttackSpeed;
      if (this.playerDebuffs.attackSlow.timer > 0) {
        effSpeed *= (1 + this.playerDebuffs.attackSlow.speedReduce);
      }
      const elapsed = time - this.lastAttackTime;
      const progress = Math.min(1, elapsed / effSpeed);
      const cx = this.seedling.x;
      const cy = this.seedling.y;
      const r = this.cooldownArcRadius;

      if (progress < 1) {
        this._attackWasReady = false;
        // Background ring (dim)
        this.cooldownArc.lineStyle(2, 0xFFFFFF, 0.08);
        this.cooldownArc.strokeCircle(cx, cy, r);
        // Progress arc
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + progress * Math.PI * 2;
        this.cooldownArc.lineStyle(2, 0x88DDFF, 0.35);
        this.cooldownArc.beginPath();
        this.cooldownArc.arc(cx, cy, r, startAngle, endAngle, false);
        this.cooldownArc.strokePath();
      } else {
        // Ready — pulse on first frame becoming ready
        if (!this._attackWasReady) {
          this._attackWasReady = true;
          const pulse = this.add.circle(cx, cy, r, 0x88DDFF, 0.3).setDepth(6);
          this.tweens.add({ targets: pulse, scale: 1.8, alpha: 0, duration: 300, onComplete: () => pulse.destroy() });
        }
        // Steady subtle ring
        this.cooldownArc.lineStyle(2, 0x88DDFF, 0.2);
        this.cooldownArc.strokeCircle(cx, cy, r);
      }
    }

    // Range circle
    if (this.rangeCircle) {
      this.rangeCircle.clear();
      let range = this.seedlingStats.effectiveRange;
      if (this.playerDebuffs.entangle.timer > 0) {
        range *= (1 - this.playerDebuffs.entangle.rangeReduce);
      }
      this.rangeCircle.lineStyle(1, 0x88CC88, 0.12);
      this.rangeCircle.strokeCircle(this.seedling.x, this.seedling.y, range);
    }

    this.hpText.setText(`HP: ${Math.ceil(this.seedlingStats.hp)} / ${this.seedlingStats.maxHp}`);
    const dmgTypeName = this.seedlingStats.damageType ? this.seedlingStats.damageType.toUpperCase() : 'NORMAL';
    this.statsText.setText(`ATK:${this.seedlingStats.attack}  ARM:${this.seedlingStats.armor}  RNG:${Math.round(this.seedlingStats.effectiveRange)}  DMG:${dmgTypeName}`);

    // HP Regen
    if (time - this.lastRegenTime > 1000) {
      // Diminishing returns on regen: effective = base * (20 / (20 + base))
      const baseRegen = this.seedlingStats.hpRegen;
      let regen = baseRegen * (20 / (20 + baseRegen));
      // Living Fortress synergy: double regen while above HP threshold
      const lf = this.seedlingStats.activeSynergies?.living_fortress;
      if (lf && this.seedlingStats.hp / this.seedlingStats.maxHp >= (lf.livingFortressThreshold || 0.75)) {
        regen *= 2;
      }
      // Wither debuff reduces regen
      if (this.playerDebuffs.wither.timer > 0) {
        regen *= (1 - this.playerDebuffs.wither.regenReduce);
      }
      this.seedlingStats.hp = Math.min(this.seedlingStats.maxHp, this.seedlingStats.hp + regen);
      this.lastRegenTime = time;
    }

    // Spore damage
    if (this.seedlingStats.sporeDamage && time - this.lastSporeTime > (this.seedlingStats.sporeInterval || 2000)) {
      this.doSporeDamage();
      this.lastSporeTime = time;
    }

    // Update spore ground zones
    for (let i = this.combatState.sporeGroundZones.length - 1; i >= 0; i--) {
      const zone = this.combatState.sporeGroundZones[i];
      zone.remainingMs -= delta;
      if (zone.remainingMs <= 0) {
        if (zone.visual) zone.visual.destroy();
        this.combatState.sporeGroundZones.splice(i, 1);
        continue;
      }
      // Pulse visual alpha to show the zone is active
      if (zone.visual) zone.visual.setAlpha(0.1 + 0.05 * Math.sin(time * 0.003));
      // Apply effects every second
      zone.tickTimer += delta;
      if (zone.tickTimer >= 1000) {
        zone.tickTimer = 0;
        for (const enemy of this.enemies) {
          const d = Phaser.Math.Distance.Between(zone.x, zone.y, enemy.sprite.x, enemy.sprite.y);
          if (d <= zone.radius) {
            if (zone.dps) {
              enemy.hp -= zone.dps;
              this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 15, zone.dps, '#CC66FF', '10px');
            }
            if (zone.slow) {
              const newSlow = 1 - zone.slow;
              if (newSlow < enemy.slowFactor) {
                enemy.slowFactor = newSlow;
                enemy.slowTimer = 1500;
              }
            }
            if (zone.poisonDps && !enemy.poisonImmune) {
              enemy.poisonDps = Math.max(enemy.poisonDps, zone.poisonDps);
              enemy.poisonTimer = 4000;
            }
          }
        }
      }
    }

    // Auto-attack (attackSlow debuff increases cooldown)
    let effectiveAttackSpeed = this.seedlingStats.effectiveAttackSpeed;
    if (this.playerDebuffs.attackSlow.timer > 0) {
      effectiveAttackSpeed *= (1 + this.playerDebuffs.attackSlow.speedReduce);
    }
    if (time - this.lastAttackTime > effectiveAttackSpeed) {
      this.seedlingAttack(time);
      this.lastAttackTime = time;
    }

    // Update player debuffs
    this.updatePlayerDebuffs(dt);
    this.updatePlayerStatusUI();

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      this.updateEnemy(enemy, time, dt);
      this.updateEnemyStatusDots(enemy);
      if (enemy.hp <= 0) this.onEnemyDeath(enemy, i);
    }

    // Update projectiles
    this.updateProjectiles(time, dt);
    this.updateEnemyProjectiles(time, dt);

    // Enemy count
    this.enemyCountText.setText(`Enemies: ${this.remainingEnemies}`);

    // Wave escalation: buff all living enemies every 10s to prevent stalemates
    // Only starts once the first enemy enters attack range (so travel time doesn't count)
    if (!this.waveEscalationStartTime) {
      for (const enemy of this.enemies) {
        const d = Phaser.Math.Distance.Between(
          this.seedling.x, this.seedling.y, enemy.sprite.x, enemy.sprite.y
        );
        if (d <= enemy.data.attackRange) {
          this.waveEscalationStartTime = time;
          break;
        }
      }
    }
    const escalationInterval = 10000;
    const expectedEscalations = this.waveEscalationStartTime
      ? Math.floor((time - this.waveEscalationStartTime) / escalationInterval)
      : 0;
    const MAX_ESCALATIONS = 15; // Cap at ~2.4x multiplier to prevent extreme stat spikes
    if (expectedEscalations > this.waveEscalationCount && this.waveEscalationCount < MAX_ESCALATIONS) {
      this.waveEscalationCount = Math.min(expectedEscalations, MAX_ESCALATIONS);
      const buffMult = 1.06;
      for (const enemy of this.enemies) {
        enemy.data.attack = Math.round(enemy.data.attack * buffMult);
        enemy.speed = Math.round(enemy.speed * buffMult * 10) / 10;
        enemy.armor = Math.round(enemy.armor * buffMult);
        enemy.magicResist = Math.round(enemy.magicResist * buffMult);
        if (enemy.regen) enemy.regen = Math.round(enemy.regen * buffMult * 10) / 10;
        // Boost max HP and heal the difference so existing enemies get tougher
        const oldMax = enemy.maxHp;
        enemy.maxHp = Math.round(enemy.maxHp * buffMult);
        enemy.hp = Math.min(enemy.hp + (enemy.maxHp - oldMax), enemy.maxHp);
      }
      // Visual warning
      const { width: ew, height: eh } = this.scale;
      const escText = this.add.text(ew / 2, eh / 2 - 30, 'ENEMIES ENRAGED!', {
        fontFamily: 'monospace', fontSize: '14px', color: '#FF6644',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0).setDepth(25);
      this.tweens.add({
        targets: escText, alpha: 1, duration: 200,
        onComplete: () => {
          this.tweens.add({
            targets: escText, alpha: 0, y: escText.y - 20,
            duration: 400, delay: 500, onComplete: () => escText.destroy(),
          });
        },
      });
      // Red flash
      const escFlash = this.add.rectangle(ew / 2, eh / 2, ew, eh, 0xFF2200, 0.08).setDepth(24);
      this.tweens.add({ targets: escFlash, alpha: 0, duration: 500, onComplete: () => escFlash.destroy() });
    }

    // Check wave complete
    if (this.remainingEnemies <= 0 && this.enemies.length === 0) {
      this.onWaveComplete();
    }

    // ── Legendary / Synergy Timers ──

    // Second Wind: heal 30% max HP once at 25% HP threshold
    if (this.seedlingStats.secondWindHeal && !this.combatState.secondWindUsed) {
      const threshold = this.seedlingStats.secondWindThreshold || 0.25;
      if (this.seedlingStats.hp / this.seedlingStats.maxHp <= threshold) {
        const healAmt = Math.floor(this.seedlingStats.maxHp * this.seedlingStats.secondWindHeal);
        this.seedlingStats.hp = Math.min(this.seedlingStats.maxHp, this.seedlingStats.hp + healAmt);
        this.combatState.secondWindUsed = true;
        this.showDamageNumber(this.seedling.x, this.seedling.y - 55, `+${healAmt} SECOND WIND`, '#44FF88', '14px');
        this.spawnParticle(this.seedling.x, this.seedling.y, 'particle_heal', 0x44FF88, 8);
        const swRing = this.add.circle(this.seedling.x, this.seedling.y, 10, 0x44FF88, 0.4).setDepth(6);
        this.tweens.add({ targets: swRing, scale: 5, alpha: 0, duration: 500, onComplete: () => swRing.destroy() });
      }
    }

    // Nuclear Bloom: every N seconds, AoE explosion + stun at densest enemy cluster
    if (this.seedlingStats.nuclearBloomDamage) {
      this.combatState.nuclearBloomTimer += delta;
      const interval = this.seedlingStats.nuclearBloomInterval || 10000;
      if (this.combatState.nuclearBloomTimer >= interval && this.enemies.length > 0) {
        this.combatState.nuclearBloomTimer = 0;
        const nbDmg = this.seedlingStats.nuclearBloomDamage;
        const nbStun = this.seedlingStats.nuclearBloomStun || 1000;
        const nbRadius = this.seedlingStats.effectiveSporeStrikeRadius || 60;
        // Find densest enemy cluster
        let bestEnemy = this.enemies[0];
        let bestCount = 0;
        for (const e of this.enemies) {
          let count = 0;
          for (const o of this.enemies) {
            if (o !== e && Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, o.sprite.x, o.sprite.y) <= 120) {
              count++;
            }
          }
          if (count > bestCount) {
            bestCount = count;
            bestEnemy = e;
          }
        }
        const cx = bestEnemy.sprite.x;
        const cy = bestEnemy.sprite.y;
        const nbRing = this.add.circle(cx, cy, 10, 0xFFFF00, 0.6).setDepth(7);
        this.tweens.add({ targets: nbRing, scale: nbRadius / 10, alpha: 0, duration: 500, onComplete: () => nbRing.destroy() });
        this.shakeCamera(6, 200);
        for (const enemy of this.enemies) {
          const d = Phaser.Math.Distance.Between(cx, cy, enemy.sprite.x, enemy.sprite.y);
          if (d <= nbRadius) {
            enemy.hp -= nbDmg;
            enemy.frozenTimer = Math.max(enemy.frozenTimer, nbStun);
            enemy.slowFactor = 0;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 20, nbDmg, '#FFFF00', '14px');
          }
        }
      }
    }

    // Parasitic Garden: drain aura (continuous AoE drain + self heal)
    if (this.seedlingStats.drainAuraDps) {
      this.combatState.drainAuraTimer += delta;
      if (this.combatState.drainAuraTimer >= 500) {
        this.combatState.drainAuraTimer = 0;
        const drainRange = 100;
        let totalDrain = 0;
        for (const enemy of this.enemies) {
          const d = Phaser.Math.Distance.Between(this.seedling.x, this.seedling.y, enemy.sprite.x, enemy.sprite.y);
          if (d <= drainRange) {
            const drain = this.seedlingStats.drainAuraDps;
            enemy.hp -= drain;
            totalDrain += drain;
            if (Math.random() < 0.2) {
              this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_poison', 0x882266, 1);
            }
          }
        }
        if (totalDrain > 0) {
          const healAmt = Math.floor(totalDrain * (this.seedlingStats.drainAuraHealPercent || 0.5));
          this.seedlingStats.hp = Math.min(this.seedlingStats.maxHp, this.seedlingStats.hp + healAmt);
        }
      }
    }

    // Overgrowth wave: every N seconds, all enemies take % attack damage
    if (this.seedlingStats.overgrowthWaveInterval) {
      this.combatState.overgrowthWaveTimer += delta;
      if (this.combatState.overgrowthWaveTimer >= this.seedlingStats.overgrowthWaveInterval) {
        this.combatState.overgrowthWaveTimer = 0;
        const waveDmg = Math.floor(this.seedlingStats.attack * (this.seedlingStats.overgrowthWaveDamageMult || 0.5));
        for (const enemy of this.enemies) {
          enemy.hp -= waveDmg;
          this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 15, waveDmg, '#22CC22', '12px');
          this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_hit', 0x22CC22, 2);
        }
        // Visual: green wave ripple
        const waveRing = this.add.circle(this.seedling.x, this.seedling.y, 10, 0x22CC22, 0.3).setDepth(6);
        this.tweens.add({ targets: waveRing, scale: 30, alpha: 0, duration: 800, onComplete: () => waveRing.destroy() });
      }
    }

    // Rapid Devastation synergy: every Nth hit within window triggers AoE explosion
    if (this.seedlingStats.activeSynergies?.rapid_devastation) {
      const rd = this.seedlingStats.activeSynergies.rapid_devastation;
      // Purge old timestamps outside window
      const now = time;
      this.combatState.hitTimestamps = this.combatState.hitTimestamps.filter(t => now - t < rd.rapidDevastationWindow);
      // Check threshold
      if (this.combatState.hitTimestamps.length >= rd.rapidDevastationThreshold) {
        this.combatState.hitTimestamps = [];
        const rdRadius = 120;
        const rdDmg = Math.floor(this.seedlingStats.attack * 1.5);
        const rdRing = this.add.circle(this.seedling.x, this.seedling.y, 10, 0xFF4444, 0.5).setDepth(7);
        this.tweens.add({ targets: rdRing, scale: rdRadius / 10, alpha: 0, duration: 400, onComplete: () => rdRing.destroy() });
        this.shakeCamera(4, 100);
        for (const enemy of this.enemies) {
          const d = Phaser.Math.Distance.Between(this.seedling.x, this.seedling.y, enemy.sprite.x, enemy.sprite.y);
          if (d <= rdRadius) {
            enemy.hp -= rdDmg;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 20, `${rdDmg} DEVASTATE`, '#FF6644', '13px');
          }
        }
      }
    }

    // Player death (with Phoenix Petal revive check)
    if (this.seedlingStats.hp <= 0) {
      if (this.seedlingStats.phoenixRevive && !this.combatState.phoenixUsed) {
        this.combatState.phoenixUsed = true;
        this.seedlingStats.hp = Math.floor(this.seedlingStats.maxHp * this.seedlingStats.phoenixRevive);
        this.showDamageNumber(this.seedling.x, this.seedling.y - 55, 'PHOENIX REVIVE!', '#FFDD44', '16px');
        const phRing = this.add.circle(this.seedling.x, this.seedling.y, 10, 0xFFDD44, 0.6).setDepth(7);
        this.tweens.add({ targets: phRing, scale: 8, alpha: 0, duration: 600, onComplete: () => phRing.destroy() });
        this.shakeCamera(5, 200);
        this.spawnParticle(this.seedling.x, this.seedling.y, 'particle_heal', 0xFFDD44, 10);
      } else {
        this.onPlayerDeath();
      }
    }
  }

  // ── Enemy Update ────────────────────────────────────────────────

  updateEnemy(enemy, time, dt) {
    const sx = this.seedling.x;
    const sy = this.seedling.y;
    const dx = sx - enemy.sprite.x;
    const dy = sy - enemy.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Poison tick (skip if immune)
    if (enemy.poisonTimer > 0 && !enemy.poisonImmune) {
      enemy.poisonTimer -= dt * 1000;
      enemy.hp -= enemy.poisonDps * dt;
      if (Math.random() < 0.1) {
        this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_poison', 0x88FF44, 2);
      }
    }

    // Bleed tick
    if (enemy.bleedTimer > 0) {
      enemy.bleedTimer -= dt * 1000;
      enemy.hp -= enemy.bleedDps * dt;
      if (Math.random() < 0.08) {
        this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_hit', 0xFF4444, 1);
      }
    }

    // Burn tick
    if (enemy.burnTimer > 0) {
      enemy.burnTimer -= dt * 1000;
      enemy.hp -= enemy.burnDps * dt;
      if (Math.random() < 0.1) {
        this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_hit', 0xFF6622, 2);
      }
      // Fire and Ice synergy: frozen + burning = shatter
      if (enemy.frozenTimer > 0 && this.seedlingStats.activeSynergies?.fire_and_ice) {
        const shatterPercent = this.seedlingStats.activeSynergies.fire_and_ice.fireAndIceShatterPercent || 0.15;
        const shatterDmg = Math.max(40, Math.floor(enemy.maxHp * shatterPercent));
        enemy.hp -= shatterDmg;
        enemy.frozenTimer = 0;
        enemy.frozenStacks = 0;
        enemy.burnTimer = 0;
        this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 25, `${shatterDmg} SHATTER`, '#AADDFF', '16px');
        const ring = this.add.circle(enemy.sprite.x, enemy.sprite.y, 10, 0xAADDFF, 0.5).setDepth(6);
        this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
      }
    }

    // Frozen stun
    if (enemy.frozenTimer > 0) {
      enemy.frozenTimer -= dt * 1000;
      enemy.slowFactor = 0; // completely stopped
      if (enemy.frozenTimer <= 0) {
        enemy.slowFactor = 1;
        enemy.frozenStacks = 0;
      }
      // Skip movement — handled below by slowFactor=0
    }

    // Boss freeze immunity decay
    if (enemy.freezeImmunityTimer > 0) {
      enemy.freezeImmunityTimer -= dt * 1000;
    }

    // Slow decay
    if (enemy.slowTimer > 0) {
      enemy.slowTimer -= dt * 1000;
      if (enemy.slowTimer <= 0 && enemy.frozenTimer <= 0) enemy.slowFactor = 1;
    }

    // Confuse decay (spore confusion — enemies wander erratically)
    if (enemy.confuseTimer > 0) {
      enemy.confuseTimer -= dt * 1000;
      if (enemy.confuseTimer <= 0 && enemy.isBoss) {
        enemy.confuseImmunityTimer = 4000; // Bosses can't be re-confused for 4s
      }
    }

    // Chain immunity decay
    if (enemy.chainImmunity > 0) {
      enemy.chainImmunity -= dt * 1000;
    }

    // Spore armor debuff decay
    if (enemy.sporeArmorDebuffTimer > 0) {
      enemy.sporeArmorDebuffTimer -= dt * 1000;
      if (enemy.sporeArmorDebuffTimer <= 0) enemy.sporeArmorDebuff = 0;
    }

    // Void regen suppression
    if (enemy.voidRegenSuppressTimer > 0) {
      enemy.voidRegenSuppressTimer -= dt * 1000;
    }

    // Enemy regen (blocked by void suppression)
    if (enemy.regen > 0 && enemy.voidRegenSuppressTimer <= 0) {
      const regenAmount = enemy.regen * dt;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + regenAmount);
      if (Math.random() < 0.05) {
        this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_heal', 0x55FF55, 1);
      }
    }

    // Boss phase transitions
    if (enemy.isBoss) {
      const bossData = BIOME_BOSSES[enemy.type];
      const phases = bossData?.phases;
      if (phases) {
        const hpPct = enemy.hp / enemy.maxHp;
        for (let p = phases.length - 1; p >= 0; p--) {
          if (hpPct <= phases[p].hpPercent && enemy.currentPhase < p) {
            enemy.currentPhase = p;
            enemy.speed = bossData.speed * phases[p].speedMult;
            enemy.data.attack = bossData.attack * phases[p].attackMult;
            // Phase effects
            this.tweens.add({ targets: enemy.sprite, alpha: 0.3, duration: 80, yoyo: true, repeat: 4 });
            this.shakeCamera(5, 150);
            const ring = this.add.circle(enemy.sprite.x, enemy.sprite.y, 10, 0xFF0044, 0.4).setDepth(6);
            this.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
            // Phase minion spawns
            if (phases[p].spawnMinion) {
              const { type: mType, count: mCount } = phases[p].spawnMinion;
              this.spawnMinions(mType, mCount, enemy.sprite.x, enemy.sprite.y);
            }
            break;
          }
        }
      }
    }

    // Root timer decay
    if (enemy.rootTimer > 0) {
      enemy.rootTimer -= dt;
    }

    // Behavior-based movement & attack
    if (enemy.rootTimer > 0) {
      // Rooted — skip movement, but can still melee if in range
      if (dist <= enemy.data.attackRange) {
        this.performEnemyMeleeAttack(enemy, time, dist);
      }
    } else {
      // Update retreat timer
      if (enemy.retreatTimer > 0) enemy.retreatTimer -= dt * 1000;

      // Boss ability updates
      if (enemy.isBoss) {
        this.updateBossAbilities(enemy, time, dt, dist);
      }

      // Buff timer updates
      for (const stat in enemy.buffTimers) {
        if (enemy.buffTimers[stat] > 0) {
          enemy.buffTimers[stat] -= dt * 1000;
          if (enemy.buffTimers[stat] <= 0) {
            // Restore base stat
            if (stat === 'armor') enemy.armor = enemy.baseArmor;
          }
        }
      }

      // Spore confusion: enemy wanders erratically
      if (enemy.confuseImmunityTimer > 0) {
        enemy.confuseImmunityTimer -= dt * 1000;
      }
      if (enemy.confuseTimer > 0) {
        this.moveEnemyConfused(enemy, dx, dy, dist, dt);
        if (Math.random() < 0.05) {
          this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'spore_particle', 0xCC66FF, 1);
        }
      } else {
        const behavior = enemy.behavior || 'melee';
        switch (behavior) {
          case 'ranged':
            this.updateRangedBehavior(enemy, time, dt, dx, dy, dist);
            break;
          case 'diver':
            this.updateDiverBehavior(enemy, time, dt, dx, dy, dist);
            break;
          case 'debuffer':
            this.updateDebufferBehavior(enemy, time, dt, dx, dy, dist);
            break;
          case 'summoner':
            this.updateSummonerBehavior(enemy, time, dt, dx, dy, dist);
            break;
          default:
            this.updateMeleeBehavior(enemy, time, dt, dx, dy, dist);
            break;
        }
      }
    }

    // Knockback mechanic (flying enemies immune) — push enemies away to keep them in damage zones longer
    if (!enemy.flying && this.seedlingStats.knockbackStrength && dist < this.seedlingStats.effectiveRange * 1.5) {
      const resistFactor = enemy.isBoss ? 0.25 : 1.0; // Bosses resist 75% of continuous knockback
      const push = this.seedlingStats.knockbackStrength * dt * resistFactor;
      enemy.sprite.x -= (dx / dist) * push;
      enemy.sprite.y -= (dy / dist) * push;
    }

    // Update HP bar
    const barY = enemy.sprite.y - enemy.barYOff;
    enemy.hpBorder.setPosition(enemy.sprite.x, barY);
    enemy.hpBg.setPosition(enemy.sprite.x, barY);
    enemy.hpBar.setPosition(enemy.sprite.x - enemy.barWidth / 2, barY);
    enemy.hpBar.width = enemy.barWidth * Math.max(0, enemy.hp / enemy.maxHp);

    if (enemy.regenIndicator) {
      enemy.regenIndicator.setPosition(enemy.sprite.x, barY - (enemy.barHeight + 2));
    }
  }

  // ── Enemy Behavior Handlers ──────────────────────────────────────

  moveEnemyToward(enemy, dx, dy, dist, dt, speedMult = 1) {
    // Bosses get a speed boost when far from the player (up to 2x at 300+ px away)
    let distBoost = 1;
    if (enemy.isBoss && dist > 120) {
      distBoost = 1 + Math.min((dist - 120) / 300, 1.0);
    }
    const speed = enemy.speed * enemy.slowFactor * speedMult * distBoost;
    let moveX = (dx / dist) * speed * dt;
    let moveY = (dy / dist) * speed * dt;
    if (enemy.flying) {
      const drift = Math.sin(Date.now() * 0.003 + enemy.sprite.x) * 0.3 * speed * dt;
      moveX += -dy / dist * drift;
      moveY += dx / dist * drift;
    }
    enemy.sprite.x += moveX;
    enemy.sprite.y += moveY;
    this.clampEnemyPosition(enemy);
  }

  moveEnemyAway(enemy, dx, dy, dist, dt, speedMult = 0.7) {
    const speed = enemy.speed * enemy.slowFactor * speedMult;
    let moveX = -(dx / dist) * speed * dt;
    let moveY = -(dy / dist) * speed * dt;
    if (enemy.flying) {
      const drift = Math.sin(Date.now() * 0.004 + enemy.sprite.y) * 0.4 * speed * dt;
      moveX += -dy / dist * drift;
      moveY += dx / dist * drift;
    }
    enemy.sprite.x += moveX;
    enemy.sprite.y += moveY;
    this.clampEnemyPosition(enemy);
  }

  moveEnemyConfused(enemy, _dx, _dy, _dist, dt) {
    // Confused enemies wander erratically at reduced speed instead of fleeing
    const speedMult = enemy.isBoss ? 0.6 : 0.4;
    const speed = enemy.speed * enemy.slowFactor * speedMult;
    // Randomize direction each frame using time-based noise for smooth wandering
    const t = Date.now() * 0.002 + enemy.sprite.x * 0.1;
    const wanderAngle = Math.sin(t) * Math.PI + Math.cos(t * 0.7 + enemy.sprite.y * 0.1) * Math.PI * 0.5;
    const moveX = Math.cos(wanderAngle) * speed * dt;
    const moveY = Math.sin(wanderAngle) * speed * dt;
    enemy.sprite.x += moveX;
    enemy.sprite.y += moveY;
    this.clampEnemyPosition(enemy);
  }

  clampEnemyPosition(enemy) {
    enemy.sprite.x = Phaser.Math.Clamp(enemy.sprite.x, this.arenaBounds.x + 10, this.arenaBounds.right - 10);
    enemy.sprite.y = Phaser.Math.Clamp(enemy.sprite.y, this.arenaBounds.y + 10, this.arenaBounds.bottom - 10);
  }

  updateMeleeBehavior(enemy, time, dt, dx, dy, dist) {
    if (dist > enemy.data.attackRange) {
      this.moveEnemyToward(enemy, dx, dy, dist, dt);
    } else {
      this.performEnemyMeleeAttack(enemy, time, dist);
    }
  }

  updateRangedBehavior(enemy, time, dt, dx, dy, dist) {
    const preferred = enemy.data.preferredRange || 100;
    const tooClose = preferred * 0.5;

    if (dist < tooClose) {
      // Too close — retreat
      this.moveEnemyAway(enemy, dx, dy, dist, dt);
    } else if (dist > preferred * 1.2) {
      // Too far — approach
      this.moveEnemyToward(enemy, dx, dy, dist, dt, 0.8);
    }
    // else: in sweet spot, stand and shoot

    // Fire projectile on cooldown
    if (time - enemy.lastAttackTime > enemy.data.attackSpeed) {
      this.fireEnemyProjectile(enemy);
      enemy.lastAttackTime = time;
      // Attack animation
      this.tweens.add({ targets: enemy.sprite, scaleX: enemy.isBoss ? 1.4 : 1.1, scaleY: enemy.isBoss ? 1.2 : 0.9, duration: 80, yoyo: true });
    }

    // Melee fallback if very close
    if (dist <= enemy.data.attackRange * 0.3) {
      this.performEnemyMeleeAttack(enemy, time, dist);
    }
  }

  updateDiverBehavior(enemy, time, dt, dx, dy, dist) {
    // State machine: orbiting -> winding_up -> diving -> recovering -> orbiting
    if (!enemy.diverState) {
      enemy.diverState = 'orbiting';
      enemy.diverTimer = 0;
      enemy.diveTargetX = 0;
      enemy.diveTargetY = 0;
      enemy.orbitAngle = Math.atan2(-dy, -dx); // angle from player to enemy
      enemy.diverFired = false;
      enemy.nextOrbitDuration = 1500 + Math.random() * 1000;
    }

    enemy.diverTimer += dt * 1000;
    const orbitRange = enemy.data.preferredRange || 180;
    const recoverRange = 100;
    const diveSpeed = enemy.speed * 2.5;

    switch (enemy.diverState) {
      case 'orbiting': {
        // Circle outside player range
        enemy.orbitAngle += enemy.speed * 0.003 * dt * enemy.slowFactor;
        const targetX = this.seedling.x + Math.cos(enemy.orbitAngle) * orbitRange;
        const targetY = this.seedling.y + Math.sin(enemy.orbitAngle) * orbitRange;
        const toX = targetX - enemy.sprite.x;
        const toY = targetY - enemy.sprite.y;
        const tDist = Math.sqrt(toX * toX + toY * toY) || 1;
        const speed = enemy.speed * enemy.slowFactor * dt;
        enemy.sprite.x += (toX / tDist) * speed;
        enemy.sprite.y += (toY / tDist) * speed;
        this.clampEnemyPosition(enemy);

        if (enemy.diverTimer > enemy.nextOrbitDuration) {
          enemy.diverState = 'winding_up';
          enemy.diverTimer = 0;
        }
        break;
      }
      case 'winding_up': {
        // Telegraph: pulse alpha, slow orbit
        const windUpDuration = 400;
        enemy.sprite.setAlpha(0.5 + 0.5 * Math.sin(enemy.diverTimer * 0.02));
        enemy.orbitAngle += enemy.speed * 0.001 * dt * enemy.slowFactor;
        const tx = this.seedling.x + Math.cos(enemy.orbitAngle) * orbitRange;
        const ty = this.seedling.y + Math.sin(enemy.orbitAngle) * orbitRange;
        const tox = tx - enemy.sprite.x;
        const toy = ty - enemy.sprite.y;
        const td = Math.sqrt(tox * tox + toy * toy) || 1;
        const sp = enemy.speed * enemy.slowFactor * 0.3 * dt;
        enemy.sprite.x += (tox / td) * sp;
        enemy.sprite.y += (toy / td) * sp;
        this.clampEnemyPosition(enemy);

        if (enemy.diverTimer > windUpDuration) {
          // Pick dive target near player with slight offset
          const offset = (Math.random() - 0.5) * 60;
          enemy.diveTargetX = this.seedling.x + offset;
          enemy.diveTargetY = this.seedling.y + offset;
          enemy.diverState = 'diving';
          enemy.diverTimer = 0;
          enemy.diverFired = false;
          enemy.sprite.setAlpha(1);
        }
        break;
      }
      case 'diving': {
        // Fast dash toward dive target
        const ddx = enemy.diveTargetX - enemy.sprite.x;
        const ddy = enemy.diveTargetY - enemy.sprite.y;
        const dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        const sp = diveSpeed * enemy.slowFactor * dt;
        enemy.sprite.x += (ddx / dd) * sp;
        enemy.sprite.y += (ddy / dd) * sp;
        this.clampEnemyPosition(enemy);

        // Fire projectile when passing through player range
        if (!enemy.diverFired && dist < 130) {
          this.fireEnemyProjectile(enemy);
          enemy.lastAttackTime = time;
          enemy.diverFired = true;
          this.tweens.add({ targets: enemy.sprite, alpha: 0.6, duration: 60, yoyo: true });
        }

        // Reached dive target or timeout -> recover
        if (dd < 20 || enemy.diverTimer > 2000) {
          enemy.diverState = 'recovering';
          enemy.diverTimer = 0;
          enemy.orbitAngle = Math.atan2(
            enemy.sprite.y - this.seedling.y,
            enemy.sprite.x - this.seedling.x
          );
        }
        break;
      }
      case 'recovering': {
        // Linger at close range (within player range) — vulnerability window
        const recoverDuration = 1200;
        enemy.orbitAngle += enemy.speed * 0.002 * dt * enemy.slowFactor;
        const tx = this.seedling.x + Math.cos(enemy.orbitAngle) * recoverRange;
        const ty = this.seedling.y + Math.sin(enemy.orbitAngle) * recoverRange;
        const tox = tx - enemy.sprite.x;
        const toy = ty - enemy.sprite.y;
        const td = Math.sqrt(tox * tox + toy * toy) || 1;
        const sp = enemy.speed * enemy.slowFactor * 0.5 * dt;
        enemy.sprite.x += (tox / td) * sp;
        enemy.sprite.y += (toy / td) * sp;
        this.clampEnemyPosition(enemy);

        if (enemy.diverTimer > recoverDuration) {
          enemy.diverState = 'orbiting';
          enemy.diverTimer = 0;
          enemy.nextOrbitDuration = 1500 + Math.random() * 1000;
        }
        break;
      }
    }
  }

  updateDebufferBehavior(enemy, time, dt, dx, dy, dist) {
    const preferred = enemy.data.preferredRange || 60;

    if (enemy.retreating && enemy.retreatTimer > 0) {
      // Retreating after applying debuff
      this.moveEnemyAway(enemy, dx, dy, dist, dt, 0.8);
    } else {
      enemy.retreating = false;
      if (dist > enemy.data.attackRange) {
        // Approach to melee range
        this.moveEnemyToward(enemy, dx, dy, dist, dt);
      } else {
        // In range — attack (applies debuff), then retreat
        if (time - enemy.lastAttackTime > enemy.data.attackSpeed) {
          this.performEnemyMeleeAttack(enemy, time, dist);
          enemy.retreating = true;
          enemy.retreatTimer = 1500; // retreat for 1.5s after hitting
        }
      }
    }
  }

  updateSummonerBehavior(enemy, time, dt, dx, dy, dist) {
    const preferred = enemy.data.preferredRange || 100;
    const summonData = enemy.data.summon;

    // Maintain distance
    if (dist < preferred * 0.6) {
      this.moveEnemyAway(enemy, dx, dy, dist, dt);
    } else if (dist > preferred * 1.3) {
      this.moveEnemyToward(enemy, dx, dy, dist, dt, 0.6);
    }

    // Summon on cooldown
    const maxSummonedEnemies = 25;
    if (summonData && time - enemy.lastSummonTime > summonData.cooldown) {
      // Count active summoned minions
      enemy.summonedMinions = enemy.summonedMinions.filter(m => m.hp > 0 && this.enemies.includes(m));
      if (enemy.summonedMinions.length < summonData.maxActive && this.enemies.length < maxSummonedEnemies) {
        const count = Math.min(summonData.count, summonData.maxActive - enemy.summonedMinions.length);
        for (let i = 0; i < count; i++) {
          this.time.delayedCall(i * 200, () => {
            if (!this.waveComplete && enemy.hp > 0 && this.enemies.length < maxSummonedEnemies) {
              const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
              const spawnDist = 40 + Math.random() * 20;
              const mx = Phaser.Math.Clamp(enemy.sprite.x + Math.cos(angle) * spawnDist, this.arenaBounds.x + 10, this.arenaBounds.right - 10);
              const my = Phaser.Math.Clamp(enemy.sprite.y + Math.sin(angle) * spawnDist, this.arenaBounds.y + 10, this.arenaBounds.bottom - 10);
              this.spawnEnemyAtPosition(summonData.type, mx, my, true);
              this.remainingEnemies++;
              this.totalEnemies++;
              // Track the summoned minion
              const newMinion = this.enemies[this.enemies.length - 1];
              enemy.summonedMinions.push(newMinion);
            }
          });
        }
        enemy.lastSummonTime = time;
        // Summon visual
        const ring = this.add.circle(enemy.sprite.x, enemy.sprite.y, 10, enemy.data.color || 0x557744, 0.5).setDepth(6);
        this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
      }
    }

    // Weak melee fallback
    if (dist <= enemy.data.attackRange) {
      this.performEnemyMeleeAttack(enemy, time, dist);
    }
  }

  performEnemyMeleeAttack(enemy, time, dist) {
    if (time - enemy.lastAttackTime <= enemy.data.attackSpeed) return;
    if (dist > enemy.data.attackRange) return;

    const damageType = enemy.data.damageType || 'normal';

    // Build effective defender stats
    let effectiveArmor = this.seedlingStats.armor || 0;
    if (this.playerDebuffs.corrode.timer > 0) {
      effectiveArmor = Math.max(0, effectiveArmor * (1 - this.playerDebuffs.corrode.armorReduce));
    }
    if (this.seedlingStats.emergencyArmor) {
      const threshold = this.seedlingStats.emergencyThreshold || 0.30;
      if (this.seedlingStats.hp / this.seedlingStats.maxHp <= threshold) {
        effectiveArmor += this.seedlingStats.emergencyArmor;
      }
    }

    const defenderStats = {
      armor: effectiveArmor,
      magicResist: this.seedlingStats.magicResist || 0,
      damageReduction: this.seedlingStats.damageReduction || 0,
    };

    let enemyAttackStats = { ...enemy.data };
    if (this.seedlingStats.enemyAttackReduce) {
      enemyAttackStats.attack = Math.max(1, enemy.data.attack - this.seedlingStats.enemyAttackReduce);
    }

    const { damage } = calculateDamage(enemyAttackStats, defenderStats, damageType);

    let finalDamage = damage;
    if (this.seedlingStats.enemyDamageReduce) {
      finalDamage = Math.max(1, finalDamage - this.seedlingStats.enemyDamageReduce);
    }

    this.seedlingStats.hp -= finalDamage;
    enemy.lastAttackTime = time;
    this.audio.play('playerHit');

    this.applyPlayerDebuff(enemy);

    this.tweens.add({ targets: this.seedling, alpha: 0.4, duration: 60, yoyo: true });
    this.showDamageNumber(this.seedling.x, this.seedling.y - 50, finalDamage, '#FF4444');
    if (enemy.isBoss) this.shakeCamera(3, 80);

    const ringColor = damageType === 'pierce' ? 0x88DDFF : 0xFF4444;
    const impactRing = this.add.circle(this.seedling.x, this.seedling.y, 5, ringColor, 0.3).setDepth(6);
    this.tweens.add({ targets: impactRing, scale: 3, alpha: 0, duration: 200, onComplete: () => impactRing.destroy() });

    // Thorn reflection
    if (this.seedlingStats.thornDamage > 0) {
      let thornDmg = this.seedlingStats.thornDamage;
      if (this.seedlingStats.activeSynergies?.thorny_roots) {
        thornDmg += Math.floor(effectiveArmor * this.seedlingStats.activeSynergies.thorny_roots.thornArmorScaling);
      }
      enemy.hp -= thornDmg;
      this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 20, thornDmg, '#CC8844');
      this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_hit', 0xCC8844, 2);
    }

    // Reflect mitigated damage
    if (this.seedlingStats.reflectMitigated) {
      const mitigated = Math.max(0, damage - finalDamage + effectiveArmor);
      const reflectDmg = Math.floor(mitigated * this.seedlingStats.reflectMitigated);
      if (reflectDmg > 0) {
        enemy.hp -= reflectDmg;
        this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 30, reflectDmg, '#CC88FF', '11px');
      }
    }

    // On-hit heal chance
    if (this.seedlingStats.onHitHealChance && Math.random() < this.seedlingStats.onHitHealChance) {
      const healAmt = this.seedlingStats.onHitHealAmount || 5;
      this.seedlingStats.hp = Math.min(this.seedlingStats.maxHp, this.seedlingStats.hp + healAmt);
      this.spawnParticle(this.seedling.x, this.seedling.y, 'particle_heal', 0x44FF44, 2);
    }
  }

  // ── Enemy Projectile System ─────────────────────────────────────

  fireEnemyProjectile(enemy, damageOverride, damageTypeOverride, fromX, fromY, speedOverride, colorOverride) {
    const projData = enemy.data.projectile || {};
    const damageType = damageTypeOverride || projData.damageType || 'normal';
    const damageMult = projData.damageMult || 0.7;
    const projSpeed = speedOverride || projData.speed || 250;
    const projColor = colorOverride || projData.color || 0xFF4444;

    const tintMap = {
      normal: 0xFFFF88, blunt: 0xCCAA66, slash: 0xFF6644, fire: 0xFF6622,
      poison: 0x88FF44, lightning: 0xFFFF44, nature: 0x44CC44,
      pierce: 0x88DDFF, frost: 0xAADDFF, void: 0xCC88FF,
    };
    const tint = tintMap[damageType] || projColor;

    const sx = fromX || enemy.sprite.x;
    const sy = fromY || enemy.sprite.y;
    const tx = this.seedling.x;
    const ty = this.seedling.y;

    const proj = this.add.image(sx, sy, 'projectile')
      .setScale(1.0).setDepth(7).setTint(tint);

    const dx = tx - sx;
    const dy = ty - sy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;

    this.enemyProjectiles.push({
      sprite: proj,
      vx: (dx / d) * projSpeed,
      vy: (dy / d) * projSpeed,
      damage: damageOverride || Math.floor(enemy.data.attack * damageMult),
      damageType,
      enemy,
      lifetime: 0,
      lastTrailTime: 0,
      healPercent: 0,
    });
  }

  updateEnemyProjectiles(time, dt) {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];

      proj.sprite.x += proj.vx * dt;
      proj.sprite.y += proj.vy * dt;
      proj.lifetime += dt * 1000;
      proj.sprite.angle += 300 * dt;

      // Trail particles
      if (time - proj.lastTrailTime > 80) {
        proj.lastTrailTime = time;
        const trail = this.add.image(proj.sprite.x, proj.sprite.y, 'particle_hit')
          .setScale(0.5).setDepth(6).setTint(proj.sprite.tintTopLeft).setAlpha(0.6);
        this.tweens.add({ targets: trail, alpha: 0, scale: 0, duration: 200, onComplete: () => trail.destroy() });
      }

      // Check hit against seedling
      const pdx = this.seedling.x - proj.sprite.x;
      const pdy = this.seedling.y - proj.sprite.y;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

      if (pdist < 15) {
        // Hit the player
        this.applyEnemyProjectileDamage(proj);
        proj.sprite.destroy();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Remove if out of bounds or expired
      if (proj.lifetime > 5000 ||
          proj.sprite.x < this.arenaBounds.x - 20 || proj.sprite.x > this.arenaBounds.right + 20 ||
          proj.sprite.y < this.arenaBounds.y - 20 || proj.sprite.y > this.arenaBounds.bottom + 20) {
        proj.sprite.destroy();
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  applyEnemyProjectileDamage(proj) {
    let effectiveArmor = this.seedlingStats.armor || 0;
    if (this.playerDebuffs.corrode.timer > 0) {
      effectiveArmor = Math.max(0, effectiveArmor * (1 - this.playerDebuffs.corrode.armorReduce));
    }
    if (this.seedlingStats.emergencyArmor) {
      const threshold = this.seedlingStats.emergencyThreshold || 0.30;
      if (this.seedlingStats.hp / this.seedlingStats.maxHp <= threshold) {
        effectiveArmor += this.seedlingStats.emergencyArmor;
      }
    }

    const defenderStats = {
      armor: effectiveArmor,
      magicResist: this.seedlingStats.magicResist || 0,
      damageReduction: this.seedlingStats.damageReduction || 0,
    };

    const attackerStats = { attack: proj.damage };
    const { damage } = calculateDamage(attackerStats, defenderStats, proj.damageType);

    let finalDamage = damage;
    if (this.seedlingStats.enemyDamageReduce) {
      finalDamage = Math.max(1, finalDamage - this.seedlingStats.enemyDamageReduce);
    }

    this.seedlingStats.hp -= finalDamage;
    this.audio.play('playerHit');

    // Apply debuff from source enemy if alive
    if (proj.enemy && proj.enemy.hp > 0) {
      this.applyPlayerDebuff(proj.enemy);
    }

    // Heal boss if life drain
    if (proj.healPercent > 0 && proj.enemy && proj.enemy.hp > 0) {
      const healAmt = Math.floor(finalDamage * proj.healPercent);
      proj.enemy.hp = Math.min(proj.enemy.maxHp, proj.enemy.hp + healAmt);
      this.showDamageNumber(proj.enemy.sprite.x, proj.enemy.sprite.y - 25, `+${healAmt}`, '#44CC44', '11px');
    }

    this.tweens.add({ targets: this.seedling, alpha: 0.4, duration: 60, yoyo: true });
    this.showDamageNumber(this.seedling.x, this.seedling.y - 50, finalDamage, '#FF4444');

    const impactRing = this.add.circle(this.seedling.x, this.seedling.y, 5, 0xFF4444, 0.3).setDepth(6);
    this.tweens.add({ targets: impactRing, scale: 3, alpha: 0, duration: 200, onComplete: () => impactRing.destroy() });

    // On-hit heal chance
    if (this.seedlingStats.onHitHealChance && Math.random() < this.seedlingStats.onHitHealChance) {
      const healAmt = this.seedlingStats.onHitHealAmount || 5;
      this.seedlingStats.hp = Math.min(this.seedlingStats.maxHp, this.seedlingStats.hp + healAmt);
      this.spawnParticle(this.seedling.x, this.seedling.y, 'particle_heal', 0x44FF44, 2);
    }
  }

  // ── Boss Ability System ─────────────────────────────────────────

  updateBossAbilities(enemy, time, dt, dist) {
    const bossData = BIOME_BOSSES[enemy.type];
    if (!bossData?.abilities) return;

    for (const ability of bossData.abilities) {
      if (enemy.currentPhase < ability.phaseUnlock) continue;

      const cdKey = ability.id;
      if (!enemy.abilityCooldowns[cdKey]) enemy.abilityCooldowns[cdKey] = 0;

      if (time - enemy.abilityCooldowns[cdKey] < ability.cooldown) continue;

      // Start telegraph
      enemy.abilityCooldowns[cdKey] = time;

      if (ability.telegraph > 0) {
        this.showBossTelegraph(enemy, ability, time);
        this.time.delayedCall(ability.telegraph, () => {
          if (enemy.hp > 0) this.executeBossAbility(enemy, ability, time);
        });
      } else {
        this.executeBossAbility(enemy, ability, time);
      }
    }
  }

  showBossTelegraph(enemy, ability, time) {
    const color = ability.telegraphColor || 0xFF0044;

    if (ability.type === 'aoe' || ability.type === 'debuff_aoe') {
      const radius = ability.radius || 80;
      // Show warning ring at boss position (or around seedling for large radius)
      const cx = ability.radius >= 200 ? this.seedling.x : enemy.sprite.x;
      const cy = ability.radius >= 200 ? this.seedling.y : enemy.sprite.y;
      const warning = this.add.circle(cx, cy, radius, color, 0.15).setDepth(3);
      const border = this.add.circle(cx, cy, radius, color, 0).setDepth(3);
      border.setStrokeStyle(2, color, 0.6);
      // Pulse the warning
      this.tweens.add({
        targets: [warning, border],
        alpha: { from: 0.15, to: 0.3 },
        duration: ability.telegraph / 2,
        yoyo: true,
        onComplete: () => { warning.destroy(); border.destroy(); },
      });
    } else if (ability.type === 'projectile_burst') {
      // Flash the boss
      this.tweens.add({
        targets: enemy.sprite,
        alpha: 0.4, duration: 100, yoyo: true, repeat: Math.floor(ability.telegraph / 200) - 1,
      });
    } else if (ability.type === 'summon') {
      // Rising ring effect
      const ring = this.add.circle(enemy.sprite.x, enemy.sprite.y, 15, color, 0.4).setDepth(6);
      this.tweens.add({
        targets: ring,
        scale: 3, alpha: 0, duration: ability.telegraph,
        onComplete: () => ring.destroy(),
      });
    } else if (ability.type === 'lightning_storm') {
      // Flash warning
      this.tweens.add({
        targets: enemy.sprite,
        alpha: 0.3, duration: 80, yoyo: true, repeat: 3,
      });
    } else if (ability.type === 'buff_self') {
      const ring = this.add.circle(enemy.sprite.x, enemy.sprite.y, 20, color, 0.3).setDepth(6);
      this.tweens.add({
        targets: ring, scaleX: 0.5, scaleY: 1.5, alpha: 0, duration: ability.telegraph,
        onComplete: () => ring.destroy(),
      });
    }
  }

  executeBossAbility(enemy, ability, time) {
    const sx = this.seedling.x;
    const sy = this.seedling.y;
    const dx = sx - enemy.sprite.x;
    const dy = sy - enemy.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    switch (ability.type) {
      case 'aoe': {
        const radius = ability.radius || 80;
        const center = ability.radius >= 200 ? { x: sx, y: sy } : { x: enemy.sprite.x, y: enemy.sprite.y };
        const playerDist = Math.sqrt(
          (sx - center.x) ** 2 + (sy - center.y) ** 2
        );

        if (playerDist <= radius) {
          const abilityDamage = ability.damage * (enemy.data.phases?.[enemy.currentPhase]?.attackMult || 1);
          this.applyBossAbilityDamage(abilityDamage, ability.damageType || 'normal');
        }

        // Heal boss if applicable
        if (ability.healPercent && ability.healPercent > 0) {
          const healAmt = Math.floor(enemy.maxHp * ability.healPercent);
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + healAmt);
          this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 25, `+${healAmt}`, '#44CC44', '12px');
          this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_heal', 0x44CC44, 4);
        }

        // Visual: shockwave
        const ring = this.add.circle(center.x, center.y, 10, ability.telegraphColor || 0xFF4444, 0.5).setDepth(6);
        this.tweens.add({ targets: ring, scale: radius / 10, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
        this.shakeCamera(4, 120);
        break;
      }

      case 'projectile_burst': {
        const count = ability.count || 4;
        const pattern = ability.pattern || 'radial';
        const projSpeed = ability.speed || 250;
        const color = ability.color || 0xFF4444;

        for (let i = 0; i < count; i++) {
          this.time.delayedCall(pattern === 'aimed' ? i * 150 : 0, () => {
            if (enemy.hp <= 0) return;

            let damageType = ability.damageType || 'normal';
            let projColor = color;
            if (damageType === 'random' && ability.randomTypes) {
              damageType = ability.randomTypes[Math.floor(Math.random() * ability.randomTypes.length)];
              const tintMap = {
                fire: 0xFF6622, frost: 0xAADDFF, lightning: 0xFFFF44, void: 0xCC88FF,
                nature: 0x44CC44, poison: 0x88FF44, pierce: 0x88DDFF, blunt: 0xCCAA66,
              };
              projColor = tintMap[damageType] || color;
            }

            let vx, vy;
            if (pattern === 'radial') {
              const angle = (i / count) * Math.PI * 2;
              vx = Math.cos(angle) * projSpeed;
              vy = Math.sin(angle) * projSpeed;
            } else {
              // aimed
              const adx = this.seedling.x - enemy.sprite.x;
              const ady = this.seedling.y - enemy.sprite.y;
              const ad = Math.sqrt(adx * adx + ady * ady) || 1;
              vx = (adx / ad) * projSpeed;
              vy = (ady / ad) * projSpeed;
            }

            const projDamage = ability.damage || Math.floor(enemy.data.attack * (ability.damageMult || 0.7));
            const proj = this.add.image(enemy.sprite.x, enemy.sprite.y, 'projectile')
              .setScale(enemy.isBoss ? 1.4 : 1.0).setDepth(7).setTint(projColor);

            const projObj = {
              sprite: proj, vx, vy,
              damage: projDamage,
              damageType,
              enemy,
              lifetime: 0,
              lastTrailTime: 0,
              healPercent: ability.healPercent || 0,
            };
            this.enemyProjectiles.push(projObj);
          });
        }
        break;
      }

      case 'summon': {
        const summonType = ability.summonType;
        const summonCount = ability.summonCount || 2;
        this.spawnMinions(summonType, summonCount, enemy.sprite.x, enemy.sprite.y);

        if (ability.extraSummon) {
          this.time.delayedCall(300, () => {
            if (enemy.hp > 0) {
              this.spawnMinions(ability.extraSummon.type, ability.extraSummon.count, enemy.sprite.x, enemy.sprite.y);
            }
          });
        }

        // Apply self-buff if defined
        if (ability.buffStat && ability.buffAmount) {
          if (ability.buffStat === 'regen') {
            const origRegen = enemy.regen;
            enemy.regen += ability.buffAmount;
            enemy.buffTimers.regen = ability.buffDuration || 3000;
            this.time.delayedCall(ability.buffDuration || 3000, () => {
              if (enemy.hp > 0) enemy.regen = origRegen;
            });
          }
          this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 30, 'EMPOWERED', '#44FF88', '11px');
        }

        this.shakeCamera(3, 100);
        break;
      }

      case 'buff_self': {
        const stat = ability.buffStat;
        const amount = ability.buffAmount;
        const duration = ability.buffDuration || 3000;

        if (stat === 'armor') {
          enemy.armor = enemy.baseArmor + amount;
          enemy.buffTimers.armor = duration;
        }

        this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 30, 'SHIELD', '#886644', '12px');
        const ring = this.add.circle(enemy.sprite.x, enemy.sprite.y, 15, ability.telegraphColor, 0.4).setDepth(6);
        this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
        break;
      }

      case 'debuff_aoe': {
        const radius = ability.radius || 100;
        const playerDist = Math.sqrt((sx - enemy.sprite.x) ** 2 + (sy - enemy.sprite.y) ** 2);

        if (playerDist <= radius && ability.debuff) {
          const debuff = ability.debuff;
          const pd = this.playerDebuffs[debuff.type];
          if (pd && Math.random() < (debuff.chance || 1.0)) {
            const dur = debuff.duration * (1 - (this.seedlingStats.debuffResist || 0));
            if (dur > 0) {
              pd.timer = Math.max(pd.timer, dur);
              if (debuff.dps != null) pd.dps = Math.max(pd.dps, debuff.dps);
              if (debuff.regenReduce != null) pd.regenReduce = Math.max(pd.regenReduce, debuff.regenReduce);
              if (debuff.armorReduce != null) pd.armorReduce = Math.max(pd.armorReduce, debuff.armorReduce);
              if (debuff.rangeReduce != null) pd.rangeReduce = Math.max(pd.rangeReduce, debuff.rangeReduce);
              if (debuff.speedReduce != null) pd.speedReduce = Math.max(pd.speedReduce, debuff.speedReduce);
              this.showDamageNumber(this.seedling.x, this.seedling.y - 60, debuff.type.toUpperCase(), '#FFAA44', '11px');
            }
          }
        }

        // Visual ring
        const ring = this.add.circle(enemy.sprite.x, enemy.sprite.y, 10, ability.telegraphColor || 0xFF8844, 0.3).setDepth(6);
        this.tweens.add({ targets: ring, scale: radius / 10, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
        break;
      }

      case 'lightning_storm': {
        const count = ability.count || 4;
        const radius = ability.radius || 40;
        const bounds = this.arenaBounds;

        for (let i = 0; i < count; i++) {
          const strikeX = Phaser.Math.Between(bounds.x + 30, bounds.right - 30);
          const strikeY = Phaser.Math.Between(bounds.y + 30, bounds.bottom - 30);

          // Warning indicator at strike zone
          const warning = this.add.circle(strikeX, strikeY, radius, 0xFFFF44, 0.2).setDepth(3);
          this.tweens.add({
            targets: warning, alpha: 0.5, duration: 400, yoyo: true,
            onComplete: () => warning.destroy(),
          });

          // Strike after delay
          this.time.delayedCall(800 + i * 200, () => {
            if (enemy.hp <= 0) return;

            // Lightning bolt visual
            const bolt = this.add.rectangle(strikeX, strikeY - 40, 4, 80, 0xFFFF44, 0.9).setDepth(7);
            this.tweens.add({ targets: bolt, alpha: 0, duration: 200, onComplete: () => bolt.destroy() });
            const flash = this.add.circle(strikeX, strikeY, 8, 0xFFFF44, 0.8).setDepth(7);
            this.tweens.add({ targets: flash, scale: radius / 8, alpha: 0, duration: 300, onComplete: () => flash.destroy() });

            // Check if player is in radius
            const pdist = Math.sqrt((this.seedling.x - strikeX) ** 2 + (this.seedling.y - strikeY) ** 2);
            if (pdist <= radius) {
              this.applyBossAbilityDamage(ability.damage, 'lightning');
            }

            this.shakeCamera(3, 80);
          });
        }
        break;
      }
    }
  }

  applyBossAbilityDamage(damage, damageType) {
    let effectiveArmor = this.seedlingStats.armor || 0;
    if (this.playerDebuffs.corrode.timer > 0) {
      effectiveArmor = Math.max(0, effectiveArmor * (1 - this.playerDebuffs.corrode.armorReduce));
    }
    if (this.seedlingStats.emergencyArmor) {
      const threshold = this.seedlingStats.emergencyThreshold || 0.30;
      if (this.seedlingStats.hp / this.seedlingStats.maxHp <= threshold) {
        effectiveArmor += this.seedlingStats.emergencyArmor;
      }
    }

    const defenderStats = {
      armor: effectiveArmor,
      magicResist: this.seedlingStats.magicResist || 0,
      damageReduction: this.seedlingStats.damageReduction || 0,
    };

    const { damage: calcDamage } = calculateDamage({ attack: damage }, defenderStats, damageType);
    let finalDamage = calcDamage;
    if (this.seedlingStats.enemyDamageReduce) {
      finalDamage = Math.max(1, finalDamage - this.seedlingStats.enemyDamageReduce);
    }

    this.seedlingStats.hp -= finalDamage;
    this.tweens.add({ targets: this.seedling, alpha: 0.4, duration: 60, yoyo: true });
    this.showDamageNumber(this.seedling.x, this.seedling.y - 50, finalDamage, '#FF4444');
    this.shakeCamera(4, 100);
  }

  // ── Combat ──────────────────────────────────────────────────────

  seedlingAttack(time) {
    if (this.enemies.length === 0) return;

    const sx = this.seedling.x;
    const sy = this.seedling.y;
    let range = this.seedlingStats.effectiveRange;
    // Entangle debuff reduces range
    if (this.playerDebuffs.entangle.timer > 0) {
      range *= (1 - this.playerDebuffs.entangle.rangeReduce);
    }

    const inRange = this.enemies
      .map(e => ({ enemy: e, dist: Phaser.Math.Distance.Between(sx, sy, e.sprite.x, e.sprite.y) }))
      .filter(e => e.dist <= range)
      .sort((a, b) => a.dist - b.dist);

    if (inRange.length === 0) return;

    const targets = 1 + (this.seedlingStats.extraTargets || 0);
    for (let i = 0; i < Math.min(targets, inRange.length); i++) {
      this.fireProjectile(sx, sy, inRange[i]);
    }

    this.tweens.add({
      targets: this.seedling,
      scaleX: this.seedling.scaleX * 1.15,
      scaleY: this.seedling.scaleY * 0.9,
      duration: 60, yoyo: true,
    });
  }

  fireProjectile(fromX, fromY, targetInfo) {
    const damageType = this.seedlingStats.primaryDamageType || this.seedlingStats.damageType || 'normal';
    this.audio.play('fireProjectile', { damageType });
    // Tint projectile based on damage type
    const tintMap = {
      normal: 0xFFFF88,
      blunt: 0xCCAA66,
      slash: 0xFF6644,
      fire: 0xFF6622,
      poison: 0x88FF44,
      lightning: 0xFFFF44,
      nature: 0x44CC44,
      pierce: 0x88DDFF,
      frost: 0xAADDFF,
      void: 0xCC88FF,
    };
    const proj = this.add.image(fromX, fromY, 'projectile')
      .setScale(1.2).setDepth(7).setTint(tintMap[damageType] || 0xFFFF88);

    this.projectiles.push({
      sprite: proj,
      target: targetInfo.enemy,
      speed: 500,
      lastTrailTime: 0,
    });
  }

  updateProjectiles(time, dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const target = proj.target;

      if (!target || !target.sprite || !target.sprite.active) {
        proj.sprite.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }

      const dx = target.sprite.x - proj.sprite.x;
      const dy = target.sprite.y - proj.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 10) {
        const primaryType = this.seedlingStats.primaryDamageType || this.seedlingStats.damageType || 'normal';
        const secondaryType = this.seedlingStats.secondaryDamageType;

        // Build effective defender stats (including debuffs)
        const defenderStats = {
          armor: Math.max(0, (target.armor || 0) - (target.sporeArmorDebuff || 0)),
          magicResist: target.magicResist || 0,
          dodgeRate: target.dodgeRate || 0,
          resistances: target.resistances || {},
          immunities: target.immunities || [],
        };

        // Spore Snare synergy: slowed enemies take +25% from all sources
        let synergyDmgMult = 1;
        if (this.seedlingStats.activeSynergies?.spore_snare && target.slowTimer > 0) {
          synergyDmgMult += this.seedlingStats.activeSynergies.spore_snare.sporeSnareBonus;
        }
        // Frozen Grasp synergy: slowed enemies take +50% frost damage
        if (this.seedlingStats.activeSynergies?.frozen_grasp && target.slowTimer > 0 && primaryType === 'frost') {
          synergyDmgMult += this.seedlingStats.activeSynergies.frozen_grasp.frozenGraspBonus;
        }

        // Primary damage
        const result = calculateDamage(this.seedlingStats, defenderStats, primaryType);
        let totalDamage = Math.floor(result.damage * synergyDmgMult);

        if (!result.evaded && !result.immune) {
          target.hp -= totalDamage;
          this.applyDamageTypeEffect(primaryType, target, totalDamage);

          // Secondary damage (30% bonus hit)
          if (secondaryType) {
            const secResult = calculateDamage(this.seedlingStats, defenderStats, secondaryType);
            if (!secResult.evaded && !secResult.immune) {
              const secDmg = Math.floor(secResult.damage * 0.3 * synergyDmgMult);
              target.hp -= secDmg;
              this.applyDamageTypeEffect(secondaryType, target, secDmg);
            }
          }

          // Apply poison (not if immune)
          if (this.seedlingStats.poisonDamage && !target.poisonImmune) {
            target.poisonDps = this.seedlingStats.poisonDamage;
            target.poisonTimer = this.seedlingStats.poisonDuration || 3000;
          }

          // Vampiric healing
          if (this.seedlingStats.vampiricPercent) {
            const healAmt = Math.floor(totalDamage * this.seedlingStats.vampiricPercent);
            this.seedlingStats.hp = Math.min(this.seedlingStats.maxHp, this.seedlingStats.hp + healAmt);
          }

          // Nature lifesteal
          if (this.seedlingStats.lifeSteal && primaryType === 'nature') {
            const healAmt = Math.floor(totalDamage * this.seedlingStats.lifeSteal);
            this.seedlingStats.hp = Math.min(this.seedlingStats.maxHp, this.seedlingStats.hp + healAmt);
          }

          // Soul Reaver stacking
          if (this.seedlingStats.soulReaverStacking && target.hp <= 0) {
            if (this.combatState.soulReaverStacks < (this.seedlingStats.soulReaverMax || 30)) {
              this.combatState.soulReaverStacks += this.seedlingStats.soulReaverStacking;
              this.seedlingStats.attack += this.seedlingStats.soulReaverStacking;
            }
          }

          // Double strike
          if (this.seedlingStats.doubleStrikeChance && Math.random() < this.seedlingStats.doubleStrikeChance) {
            const ds = calculateDamage(this.seedlingStats, defenderStats, primaryType);
            if (!ds.evaded && !ds.immune) {
              target.hp -= ds.damage;
              this.showDamageNumber(target.sprite.x + 8, target.sprite.y - 25, ds.damage, '#FFDDAA', '12px');
            }
          }

          // Track hits for Rapid Devastation synergy
          this.combatState.hitCount++;
          this.combatState.hitTimestamps.push(time);

          // Root on hit: freeze enemy in place briefly
          if (this.seedlingStats.rootOnHitDuration && !target.rootTimer) {
            target.rootTimer = this.seedlingStats.rootOnHitDuration / 1000;
          }

          // Knockback every N hits: push farthest enemy back
          if (this.seedlingStats.knockbackEveryN && this.combatState.hitCount % this.seedlingStats.knockbackEveryN === 0) {
            let farthest = null;
            let farthestDist = 0;
            for (const e of this.enemies) {
              if (e.hp <= 0 || e.flying) continue;
              const edx = e.sprite.x - this.seedling.x;
              const edy = e.sprite.y - this.seedling.y;
              const ed = Math.sqrt(edx * edx + edy * edy);
              if (ed > farthestDist) { farthestDist = ed; farthest = e; }
            }
            if (farthest) {
              const fdx = farthest.sprite.x - this.seedling.x;
              const fdy = farthest.sprite.y - this.seedling.y;
              const fd = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
              const pushDist = farthest.isBoss ? 20 : 60; // Bosses pushed less
              farthest.sprite.x += (fdx / fd) * pushDist;
              farthest.sprite.y += (fdy / fd) * pushDist;
              this.spawnParticle(farthest.sprite.x, farthest.sprite.y, 'particle_hit', 0xCC88FF, 8);
            }
          }
        }

        // Hit effects
        if (!result.evaded && !result.immune && !result.isCrit) this.audio.play('projectileHit');
        const dmgColor = result.evaded ? '#888888' : result.immune ? '#666666' : result.isCrit ? '#FFFF00' : getDamageTypeColor(primaryType);
        const dmgText = result.evaded ? 'DODGE' : result.immune ? 'IMMUNE' : result.isCrit ? `${Math.round(totalDamage)}!` : Math.round(totalDamage).toString();
        const dmgSize = result.isCrit ? '18px' : '14px';
        this.showDamageNumber(target.sprite.x, target.sprite.y - 20, dmgText, dmgColor, dmgSize, result.isCrit);
        this.spawnParticle(target.sprite.x, target.sprite.y, 'particle_hit', 0xFFFFFF, 5);

        const impactColor = result.isCrit ? 0xFFFF44 : (this.getProjectileTint(primaryType));
        const ringScale = result.isCrit ? 4 : 2.5;
        const ring = this.add.circle(target.sprite.x, target.sprite.y, 5, impactColor, 0.3).setDepth(6);
        this.tweens.add({ targets: ring, scale: ringScale, alpha: 0, duration: 200, onComplete: () => ring.destroy() });

        // Enemy white flash on hit
        if (target.sprite && target.sprite.active) {
          target.sprite.setTintFill(0xFFFFFF);
          this.time.delayedCall(50, () => {
            if (target.sprite && target.sprite.active) target.sprite.clearTint();
          });
        }

        // Crit: hitstop + screen flash + camera shake
        if (result.isCrit && !result.evaded && !result.immune) {
          this.audio.play('critHit');
          this.hitstop(50);
          this.shakeCamera(3, 80);
          const { width: cw, height: ch } = this.scale;
          const critFlash = this.add.rectangle(cw / 2, ch / 2, cw, ch, 0xFFFF44, 0.12).setDepth(80);
          this.tweens.add({ targets: critFlash, alpha: 0, duration: 150, onComplete: () => critFlash.destroy() });
        }

        proj.sprite.destroy();
        this.projectiles.splice(i, 1);
      } else {
        proj.sprite.x += (dx / dist) * proj.speed * dt;
        proj.sprite.y += (dy / dist) * proj.speed * dt;
        proj.sprite.angle += 300 * dt;

        if (time - proj.lastTrailTime > 35) {
          const tint = proj.sprite.tintTopLeft;
          // Glow behind projectile
          const glow = this.add.image(proj.sprite.x, proj.sprite.y, 'particle_trail')
            .setDepth(5).setAlpha(0.25).setScale(2).setTint(tint);
          this.tweens.add({ targets: glow, alpha: 0, scale: 0.5, duration: 180, onComplete: () => glow.destroy() });
          // Core trail particle
          const trail = this.add.image(proj.sprite.x, proj.sprite.y, 'particle_trail')
            .setDepth(6).setAlpha(0.7).setTint(tint);
          this.tweens.add({ targets: trail, alpha: 0, scale: 0, duration: 200, onComplete: () => trail.destroy() });
          proj.lastTrailTime = time;
        }
      }
    }
  }

  getProjectileTint(damageType) {
    return DAMAGE_TYPES[damageType]?.color ? parseInt(DAMAGE_TYPES[damageType].color.replace('#', ''), 16) : 0xFFFFFF;
  }

  applyDamageTypeEffect(damageType, target, damage) {
    switch (damageType) {
      case 'blunt': {
        // Visual: heavy impact
        this.spawnParticle(target.sprite.x, target.sprite.y, 'particle_hit', 0xCCAA66, 4);
        break;
      }
      case 'pierce': {
        // Visual: piercing spark
        this.spawnParticle(target.sprite.x, target.sprite.y, 'particle_hit', 0x88DDFF, 4);
        break;
      }
      case 'slash': {
        // Apply bleed DoT (15% hit damage/s for 3s)
        const bleedDps = Math.max(1, Math.floor(damage * 0.15));
        target.bleedDps = Math.max(target.bleedDps, bleedDps); // stacking: take highest
        target.bleedTimer = 3000;
        this.spawnParticle(target.sprite.x, target.sprite.y, 'particle_hit', 0xFF6644, 2);
        this.audio.play('bleed');
        break;
      }
      case 'fire': {
        // Burn DoT (8% hit/s for 4s)
        const burnDps = Math.max(1, Math.floor(damage * 0.08));
        target.burnDps = Math.max(target.burnDps, burnDps);
        target.burnTimer = 4000;
        this.spawnParticle(target.sprite.x, target.sprite.y, 'particle_hit', 0xFF6622, 3);
        this.audio.play('burn');
        break;
      }
      case 'frost': {
        // Slow 40% for 2s
        const slowAmount = 0.40;
        const duration = 2000 + (this.seedlingStats.activeSynergies?.storm_caller?.stormCallerSlowBonus || 0);
        if (1 - slowAmount < target.slowFactor) {
          target.slowFactor = 1 - slowAmount;
          target.slowTimer = duration;
        }
        // Stack toward freeze — bosses resist: need 5 stacks, shorter duration, immunity after
        target.frozenStacks = (target.frozenStacks || 0) + 1;
        const isBoss = !!target.isBoss;
        const freezeThreshold = isBoss ? 5 : 3;
        const freezeDuration = isBoss ? 750 : 1500;
        const canFreeze = target.frozenTimer <= 0 && !(target.freezeImmunityTimer > 0);
        if (target.frozenStacks >= freezeThreshold && canFreeze) {
          target.frozenTimer = freezeDuration;
          target.frozenStacks = 0;
          target.slowFactor = 0;
          if (isBoss) target.freezeImmunityTimer = 4000; // 4s immunity after freeze
          this.showDamageNumber(target.sprite.x, target.sprite.y - 30, 'FROZEN', '#AADDFF', '14px');
          this.audio.play('freeze');
        }
        this.spawnParticle(target.sprite.x, target.sprite.y, 'particle_hit', 0xAADDFF, 3);
        this.audio.play('frost');
        break;
      }
      case 'poison': {
        // Ramping DoT: 5% hit/s for 4s (handled via poisonTimer already for trait-based poison)
        if (!target.poisonImmune) {
          const poisonDps = Math.max(1, Math.floor(damage * 0.05));
          target.poisonDps = Math.max(target.poisonDps, poisonDps);
          target.poisonTimer = 4000;
          this.spawnParticle(target.sprite.x, target.sprite.y, 'particle_poison', 0x88FF44, 3);
          this.audio.play('poison');
        }
        break;
      }
      case 'lightning': {
        this.audio.play('lightning');
        // Chain to 2 nearby enemies at 60% damage
        let chainTargets = 2 + (this.seedlingStats.activeSynergies?.storm_caller?.stormCallerChains || 0);
        const chainDamage = Math.floor(damage * 0.6);
        const chainRadius = 120;
        let chainCount = 0;
        for (const other of this.enemies) {
          if (other === target || chainCount >= chainTargets) break;
          if (other.chainImmunity > 0) continue;
          const d = Phaser.Math.Distance.Between(target.sprite.x, target.sprite.y, other.sprite.x, other.sprite.y);
          if (d <= chainRadius) {
            other.hp -= chainDamage;
            other.chainImmunity = 500; // prevent infinite loops
            this.showDamageNumber(other.sprite.x, other.sprite.y - 15, chainDamage, '#FFFF44', '11px');
            // Lightning arc visual
            const arc = this.add.graphics().setDepth(7);
            arc.lineStyle(2, 0xFFFF44, 0.8);
            arc.lineBetween(target.sprite.x, target.sprite.y, other.sprite.x, other.sprite.y);
            this.tweens.add({ targets: arc, alpha: 0, duration: 200, onComplete: () => arc.destroy() });
            chainCount++;
          }
        }
        this.spawnParticle(target.sprite.x, target.sprite.y, 'particle_hit', 0xFFFF44, 4);
        break;
      }
      case 'void': {
        // Suppress regen for 3s (or 5s with Void Garden synergy)
        const suppressDuration = this.seedlingStats.activeSynergies?.void_garden?.voidGardenSuppressDuration || 3000;
        target.voidRegenSuppressTimer = suppressDuration;
        this.spawnParticle(target.sprite.x, target.sprite.y, 'particle_poison', 0xCC88FF, 3);
        break;
      }
      case 'nature': {
        // Heal attacker for 15% of damage dealt
        let healMult = 0.15;
        if (this.seedlingStats.activeSynergies?.void_garden) {
          healMult *= this.seedlingStats.activeSynergies.void_garden.voidGardenHealMult;
        }
        const healAmt = Math.max(1, Math.floor(damage * healMult));
        this.seedlingStats.hp = Math.min(this.seedlingStats.maxHp, this.seedlingStats.hp + healAmt);
        this.spawnParticle(this.seedling.x, this.seedling.y, 'particle_heal', 0x44CC44, 2);
        break;
      }
    }
  }

  doSporeDamage() {
    const strikeCount = Math.max(1, this.seedlingStats.effectiveSporeStrikeCount || 1);
    const radius = this.seedlingStats.effectiveSporeStrikeRadius || 60;
    const bias = this.seedlingStats.sporeTargetBias || 0.7;
    const { width, height } = this.scale;

    if (this.enemies.length === 0) return;

    // Find boss if present — first strike always targets the boss
    const boss = this.enemies.find(e => e.isBoss);

    for (let i = 0; i < strikeCount; i++) {
      let tx, ty;
      if (i === 0 && boss) {
        // First strike always targets the boss
        tx = boss.sprite.x + Phaser.Math.Between(-10, 10);
        ty = boss.sprite.y + Phaser.Math.Between(-10, 10);
      } else if (Math.random() < bias && this.enemies.length > 0) {
        // Targeted: pick random enemy, add jitter
        const target = this.enemies[Math.floor(Math.random() * this.enemies.length)];
        tx = target.sprite.x + Phaser.Math.Between(-15, 15);
        ty = target.sprite.y + Phaser.Math.Between(-15, 15);
      } else {
        // Predictive: random point biased toward arena edges
        const angle = Math.random() * Math.PI * 2;
        const dist = 0.5 + Math.random() * 0.5;
        tx = width / 2 + Math.cos(angle) * dist * (width / 2 - 20);
        ty = height / 2 + Math.sin(angle) * dist * (height / 2 - 20);
      }
      tx = Phaser.Math.Clamp(tx, 20, width - 20);
      ty = Phaser.Math.Clamp(ty, 60, height - 80);

      // Stagger visuals by 50ms per strike for carpet bombing feel
      this.time.delayedCall(i * 50, () => {
        this.doSporeStrikeAt(tx, ty, this.seedlingStats.sporeDamage, radius);
      });
    }
  }

  doSporeStrikeAt(x, y, damage, radius) {
    // Visual: expanding purple ring
    const ring = this.add.circle(x, y, radius, 0x9944CC, 0.25).setScale(0.1).setDepth(6);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 400, onComplete: () => ring.destroy() });

    // Particles radiating outward
    const particleCount = Math.min(10, Math.max(6, Math.floor(radius / 10)));
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const px = x + Math.cos(angle) * (radius * 0.35);
      const py = y + Math.sin(angle) * (radius * 0.35);
      this.spawnParticle(px, py, 'spore_particle', 0xAA66DD, 2);
    }

    // Pull enemies toward impact (Gravity Well)
    if (this.seedlingStats.sporePull) {
      const pullRadius = radius * 1.5;
      for (const enemy of this.enemies) {
        const d = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y);
        if (d > radius && d <= pullRadius && d > 0) {
          const pullAngle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, x, y);
          const pullDist = Math.min(this.seedlingStats.sporePull, d - radius);
          enemy.sprite.x += Math.cos(pullAngle) * pullDist;
          enemy.sprite.y += Math.sin(pullAngle) * pullDist;
        }
      }
    }

    // Damage enemies in strike zone
    const hitEnemies = [];
    for (const enemy of this.enemies) {
      const dist = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y);
      if (dist <= radius) {
        enemy.hp -= damage;
        this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 15,
          Math.round(damage).toString(), '#CC66FF');
        hitEnemies.push(enemy);

        // Spore slow
        if (this.seedlingStats.sporeSlow) {
          const newSlow = 1 - this.seedlingStats.sporeSlow;
          if (newSlow < enemy.slowFactor) {
            enemy.slowFactor = newSlow;
            enemy.slowTimer = 2000;
          }
        }

        // Spore armor debuff
        if (this.seedlingStats.sporeArmorReduce) {
          enemy.sporeArmorDebuff = this.seedlingStats.sporeArmorReduce;
          enemy.sporeArmorDebuffTimer = 3000;
        }

        // Confuse effect (Hallucinogenic Cloud)
        if (this.seedlingStats.sporeConfuse && Math.random() < 0.15) {
          if (!enemy.confuseImmunityTimer || enemy.confuseImmunityTimer <= 0) {
            const duration = enemy.isBoss
              ? this.seedlingStats.sporeConfuse * 0.4   // Bosses: 40% duration
              : this.seedlingStats.sporeConfuse;
            enemy.confuseTimer = duration;
          }
        }

        // Spore burn DoT
        if (this.seedlingStats.sporeBurnDps) {
          enemy.burnDps = Math.max(enemy.burnDps, this.seedlingStats.sporeBurnDps);
          enemy.burnTimer = 4000;
          this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_hit', 0xFF6622, 1);
        }

        // Spore poison DoT
        if (this.seedlingStats.sporePoisonDps && !enemy.poisonImmune) {
          enemy.poisonDps = Math.max(enemy.poisonDps, this.seedlingStats.sporePoisonDps);
          enemy.poisonTimer = 4000;
          this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_poison', 0x88FF44, 1);
        }

        // Void regen suppression
        if (this.seedlingStats.sporeSuppressRegen) {
          enemy.voidRegenSuppressTimer = 3000;
        }

        // Wildfire synergy: spores spread fire burn
        if (this.seedlingStats.activeSynergies?.wildfire) {
          const burnDps = Math.max(1, Math.floor(damage * 0.08));
          enemy.burnDps = Math.max(enemy.burnDps, burnDps);
          enemy.burnTimer = 4000;
          this.spawnParticle(enemy.sprite.x, enemy.sprite.y, 'particle_hit', 0xFF6622, 1);
        }

        // Spore Sovereign: apply primary damage type on-hit effect
        if (this.seedlingStats.sporeApplyOnHit) {
          const primaryType = this.seedlingStats.primaryDamageType || 'normal';
          if (primaryType !== 'normal') {
            this.applyDamageTypeEffect(primaryType, enemy, damage);
          }
        }
      }
    }

    // Chain lightning (Static Field)
    if (this.seedlingStats.sporeChainTargets && hitEnemies.length > 0) {
      const chainDamage = Math.floor(damage * 0.5);
      const chainRadius = 120;
      for (const hitEnemy of hitEnemies) {
        let chainCount = 0;
        for (const other of this.enemies) {
          if (other === hitEnemy || hitEnemies.includes(other) || chainCount >= this.seedlingStats.sporeChainTargets) continue;
          const d = Phaser.Math.Distance.Between(hitEnemy.sprite.x, hitEnemy.sprite.y, other.sprite.x, other.sprite.y);
          if (d <= chainRadius) {
            other.hp -= chainDamage;
            this.showDamageNumber(other.sprite.x, other.sprite.y - 15, chainDamage, '#FFFF44', '11px');
            // Lightning arc visual
            const arc = this.add.graphics().setDepth(7);
            arc.lineStyle(2, 0xFFFF44, 0.8);
            arc.lineBetween(hitEnemy.sprite.x, hitEnemy.sprite.y, other.sprite.x, other.sprite.y);
            this.tweens.add({ targets: arc, alpha: 0, duration: 200, onComplete: () => arc.destroy() });
            chainCount++;
          }
        }
      }
    }

    // Persistent ground zone (Living Miasma, Mycelium Web, Pandemic)
    if (this.seedlingStats.sporePersistDuration) {
      const zones = this.combatState.sporeGroundZones;
      // Cap at 6 active zones
      if (zones.length >= 6) {
        const oldest = zones.shift();
        if (oldest.visual) oldest.visual.destroy();
      }
      const zoneVisual = this.add.circle(x, y, radius, 0x9944CC, 0.15).setDepth(1);
      zones.push({
        x, y, radius,
        remainingMs: this.seedlingStats.sporePersistDuration,
        dps: this.seedlingStats.sporePersistDamage || 0,
        slow: this.seedlingStats.sporeSlow || 0,
        poisonDps: this.seedlingStats.sporePoisonDps || 0,
        visual: zoneVisual,
        tickTimer: 0,
      });
    }
  }

  // ── Player Debuffs ──────────────────────────────────────────────

  applyPlayerDebuff(enemy) {
    const debuff = enemy.data.debuff;
    if (!debuff) return;
    if (Math.random() > debuff.chance) return;

    // debuffResist reduces duration
    const resist = this.seedlingStats.debuffResist || 0;
    const duration = debuff.duration * (1 - resist);
    if (duration <= 0) return;

    const pd = this.playerDebuffs;
    switch (debuff.type) {
      case 'venom':
        pd.venom.timer = Math.max(pd.venom.timer, duration);
        pd.venom.dps = Math.max(pd.venom.dps, debuff.dps);
        this.showDamageNumber(this.seedling.x, this.seedling.y - 60, 'VENOM', '#8844AA', '12px');
        break;
      case 'wither':
        pd.wither.timer = Math.max(pd.wither.timer, duration);
        pd.wither.regenReduce = Math.max(pd.wither.regenReduce, debuff.regenReduce);
        this.showDamageNumber(this.seedling.x, this.seedling.y - 60, 'WITHER', '#997744', '12px');
        break;
      case 'corrode':
        pd.corrode.timer = Math.max(pd.corrode.timer, duration);
        pd.corrode.armorReduce = Math.max(pd.corrode.armorReduce, debuff.armorReduce);
        this.showDamageNumber(this.seedling.x, this.seedling.y - 60, 'CORRODE', '#AACC22', '12px');
        break;
      case 'entangle':
        pd.entangle.timer = Math.max(pd.entangle.timer, duration);
        pd.entangle.rangeReduce = Math.max(pd.entangle.rangeReduce, debuff.rangeReduce);
        this.showDamageNumber(this.seedling.x, this.seedling.y - 60, 'ENTANGLE', '#448822', '12px');
        break;
      case 'attackSlow':
        pd.attackSlow.timer = Math.max(pd.attackSlow.timer, duration);
        pd.attackSlow.speedReduce = Math.max(pd.attackSlow.speedReduce, debuff.speedReduce);
        this.showDamageNumber(this.seedling.x, this.seedling.y - 60, 'ATK SLOW', '#FF8844', '12px');
        break;
    }
  }

  updatePlayerDebuffs(dt) {
    const pd = this.playerDebuffs;
    const dtMs = dt * 1000;

    // Venom DoT
    if (pd.venom.timer > 0) {
      pd.venom.timer -= dtMs;
      this.seedlingStats.hp -= pd.venom.dps * dt;
      if (Math.random() < 0.08) {
        this.spawnParticle(this.seedling.x + Phaser.Math.Between(-10, 10),
          this.seedling.y + Phaser.Math.Between(-10, 10), 'particle_poison', 0x8844AA, 1);
      }
      if (pd.venom.timer <= 0) { pd.venom.timer = 0; pd.venom.dps = 0; }
    }

    // Wither (effect applied in regen section)
    if (pd.wither.timer > 0) {
      pd.wither.timer -= dtMs;
      if (pd.wither.timer <= 0) { pd.wither.timer = 0; pd.wither.regenReduce = 0; }
    }

    // Corrode (effect applied in armor section)
    if (pd.corrode.timer > 0) {
      pd.corrode.timer -= dtMs;
      if (pd.corrode.timer <= 0) { pd.corrode.timer = 0; pd.corrode.armorReduce = 0; }
    }

    // Entangle (effect applied in range section)
    if (pd.entangle.timer > 0) {
      pd.entangle.timer -= dtMs;
      if (pd.entangle.timer <= 0) { pd.entangle.timer = 0; pd.entangle.rangeReduce = 0; }
    }

    // Attack slow (effect applied in attack speed section)
    if (pd.attackSlow.timer > 0) {
      pd.attackSlow.timer -= dtMs;
      if (pd.attackSlow.timer <= 0) { pd.attackSlow.timer = 0; pd.attackSlow.speedReduce = 0; }
    }
  }

  updateEnemyStatusDots(enemy) {
    const effects = [];
    if (enemy.poisonTimer > 0) effects.push(0x88FF44);
    if (enemy.bleedTimer > 0) effects.push(0xFF4444);
    if (enemy.burnTimer > 0) effects.push(0xFF6622);
    if (enemy.slowTimer > 0 && enemy.frozenTimer <= 0) effects.push(0x88CCFF);
    if (enemy.frozenTimer > 0) effects.push(0xAADDFF);
    if (enemy.rootTimer > 0) effects.push(0x886633);
    if (enemy.voidRegenSuppressTimer > 0) effects.push(0xCC88FF);
    if (enemy.sporeArmorDebuffTimer > 0) effects.push(0xCCAA44);

    // Build a signature to avoid destroy/recreate every frame
    const sig = effects.join(',');
    if (sig === (enemy._lastStatusSig || '')) {
      // Same effects — just reposition existing dots
      if (enemy.statusDots.length > 0) {
        const dotSize = enemy.isBoss ? 4 : 3;
        const spacing = dotSize + 1;
        const totalW = effects.length * spacing - 1;
        const startX = enemy.sprite.x - totalW / 2;
        const dotY = enemy.sprite.y - enemy.barYOff + enemy.barHeight / 2 + dotSize + 2;
        for (let i = 0; i < enemy.statusDots.length; i++) {
          enemy.statusDots[i].setPosition(startX + i * spacing, dotY);
        }
      }
      return;
    }

    // Effects changed — rebuild dots
    enemy._lastStatusSig = sig;
    for (const dot of enemy.statusDots) dot.destroy();
    enemy.statusDots = [];

    if (effects.length === 0) return;

    const dotSize = enemy.isBoss ? 4 : 3;
    const spacing = dotSize + 1;
    const totalW = effects.length * spacing - 1;
    const startX = enemy.sprite.x - totalW / 2;
    const dotY = enemy.sprite.y - enemy.barYOff + enemy.barHeight / 2 + dotSize + 2;

    for (let i = 0; i < effects.length; i++) {
      const dot = this.add.rectangle(startX + i * spacing, dotY, dotSize, dotSize, effects[i])
        .setOrigin(0, 0.5).setDepth(9);
      enemy.statusDots.push(dot);
    }
  }

  updatePlayerStatusUI() {
    const pd = this.playerDebuffs;
    const active = [];
    if (pd.venom.timer > 0) active.push({ key: 'status_venom', timer: pd.venom.timer, color: '#8844AA' });
    if (pd.wither.timer > 0) active.push({ key: 'status_wither', timer: pd.wither.timer, color: '#997744' });
    if (pd.corrode.timer > 0) active.push({ key: 'status_corrode', timer: pd.corrode.timer, color: '#AACC22' });
    if (pd.entangle.timer > 0) active.push({ key: 'status_entangle', timer: pd.entangle.timer, color: '#448822' });
    if (pd.attackSlow.timer > 0) active.push({ key: 'status_attack_slow', timer: pd.attackSlow.timer, color: '#FF8844' });

    // Build signature to avoid destroy/recreate every frame
    const sig = active.map(a => `${a.key}:${Math.ceil(a.timer / 1000)}`).join(',');
    if (sig === (this._lastPlayerStatusSig || '')) return;
    this._lastPlayerStatusSig = sig;

    // Destroy old icons
    for (const icon of this.playerStatusIcons) {
      if (icon.img) icon.img.destroy();
      if (icon.txt) icon.txt.destroy();
    }
    this.playerStatusIcons = [];

    if (active.length === 0) return;

    const iconScale = 2;
    const spacing = 22;
    const barY = this.seedling.y - 44;
    const startX = this.seedling.x - (active.length * spacing) / 2;
    const iconY = barY + 16;

    for (let i = 0; i < active.length; i++) {
      const x = startX + i * spacing + spacing / 2;
      const img = this.add.image(x, iconY, active[i].key).setScale(iconScale).setDepth(10);
      const secs = Math.ceil(active[i].timer / 1000);
      const txt = this.add.text(x, iconY + 12, `${secs}`, {
        fontFamily: 'monospace', fontSize: '10px', color: active[i].color,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0).setDepth(10);
      this.playerStatusIcons.push({ img, txt });
    }
  }

  // ── Enemy Death ─────────────────────────────────────────────────

  onEnemyDeath(enemy, index) {
    this.audio.play(enemy.isBoss ? 'bossKilled' : 'enemyKilled');
    if (this.seedlingStats.healOnKill) {
      this.seedlingStats.hp = Math.min(this.seedlingStats.maxHp, this.seedlingStats.hp + this.seedlingStats.healOnKill);
      this.spawnParticle(this.seedling.x, this.seedling.y, 'particle_heal', 0x66FF66, 4);
      this.showDamageNumber(this.seedling.x + Phaser.Math.Between(-10, 10), this.seedling.y - 35,
        `+${this.seedlingStats.healOnKill}`, '#66FF66', '12px');
    }

    const ex = enemy.sprite.x;
    const ey = enemy.sprite.y;

    enemy.sprite.setTint(0xFFFFFF);

    if (enemy.isBoss) {
      this.hitstop(120);
      this.shakeCamera(8, 200);
      const { width: fw, height: fh } = this.scale;
      const flash = this.add.rectangle(fw / 2, fh / 2, fw, fh, 0xFFFFFF, 0.5).setDepth(80);
      this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const speed = 60 + Math.random() * 80;
        const deathP = this.add.image(ex, ey, 'particle_death').setTint(enemy.data.color || 0x5A2A8E).setDepth(12);
        this.tweens.add({
          targets: deathP,
          x: ex + Math.cos(angle) * speed, y: ey + Math.sin(angle) * speed,
          alpha: 0, duration: 600,
          onComplete: () => deathP.destroy(),
        });
      }
    } else {
      this.hitstop(40);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const speed = 20 + Math.random() * 30;
        const deathP = this.add.image(ex, ey, 'particle_death').setTint(enemy.data.color || 0xAAAAAA).setDepth(12);
        this.tweens.add({
          targets: deathP,
          x: ex + Math.cos(angle) * speed, y: ey + Math.sin(angle) * speed,
          alpha: 0, duration: 350,
          onComplete: () => deathP.destroy(),
        });
      }
    }

    // Explosive on death
    if (enemy.explosive) {
      const { damage: expDmg, radius: expRadius } = enemy.explosive;
      const expRing = this.add.circle(ex, ey, 10, 0xFF8800, 0.5).setDepth(7);
      this.tweens.add({ targets: expRing, scale: expRadius / 10, alpha: 0, duration: 500, onComplete: () => expRing.destroy() });
      this.shakeCamera(4, 100);
      // Damage seedling if in range
      const distToSeedling = Phaser.Math.Distance.Between(ex, ey, this.seedling.x, this.seedling.y);
      if (distToSeedling <= expRadius) {
        const expDmgReduced = Math.max(1, expDmg - (this.seedlingStats.armor || 0));
        this.seedlingStats.hp -= expDmgReduced;
        this.showDamageNumber(this.seedling.x, this.seedling.y - 50, expDmgReduced, '#FFAA22');
      }
      // Damage other nearby enemies
      for (const other of this.enemies) {
        if (other === enemy) continue;
        const d = Phaser.Math.Distance.Between(ex, ey, other.sprite.x, other.sprite.y);
        if (d <= expRadius) {
          other.hp -= Math.floor(expDmg * 0.5);
          this.showDamageNumber(other.sprite.x, other.sprite.y - 15, Math.floor(expDmg * 0.5), '#FFAA22');
        }
      }
    }

    // Fire burn spread on kill: nearby enemies catch fire
    if (enemy.burnTimer > 0 || (this.seedlingStats.primaryDamageType === 'fire')) {
      const spreadRadius = 80;
      for (const other of this.enemies) {
        if (other === enemy) continue;
        const d = Phaser.Math.Distance.Between(ex, ey, other.sprite.x, other.sprite.y);
        if (d <= spreadRadius) {
          other.burnDps = Math.max(other.burnDps, enemy.burnDps || 2);
          other.burnTimer = 3000;
          this.spawnParticle(other.sprite.x, other.sprite.y, 'particle_hit', 0xFF6622, 2);
        }
      }
    }

    // Blighted Harvest synergy: DoT kills heal 5% enemy max HP
    const wasDoTKill = enemy.burnTimer > 0 || enemy.bleedTimer > 0 || enemy.poisonTimer > 0;
    if (wasDoTKill && this.seedlingStats.activeSynergies?.blighted_harvest) {
      const healAmt = Math.floor(enemy.maxHp * this.seedlingStats.activeSynergies.blighted_harvest.blightedHarvestHeal);
      this.seedlingStats.hp = Math.min(this.seedlingStats.maxHp, this.seedlingStats.hp + healAmt);
      this.showDamageNumber(this.seedling.x, this.seedling.y - 40, `+${healAmt}`, '#66FF66', '12px');
      this.spawnParticle(this.seedling.x, this.seedling.y, 'particle_heal', 0x66FF66, 3);
    }

    // Venomous Bloom synergy: kill-heals drop a poison cloud
    if (this.seedlingStats.healOnKill && this.seedlingStats.activeSynergies?.venomous_bloom) {
      const cloudRadius = 60;
      const cloudRing = this.add.circle(ex, ey, cloudRadius, 0x88FF44, 0.2).setDepth(6);
      this.tweens.add({ targets: cloudRing, alpha: 0, duration: 2000, onComplete: () => cloudRing.destroy() });
      for (const other of this.enemies) {
        if (other === enemy) continue;
        const d = Phaser.Math.Distance.Between(ex, ey, other.sprite.x, other.sprite.y);
        if (d <= cloudRadius && !other.poisonImmune) {
          other.poisonDps = Math.max(other.poisonDps, 5);
          other.poisonTimer = 3000;
        }
      }
    }

    // Spore death pulse (Chain Spores trait)
    if (this.seedlingStats.sporeDeathPulse) {
      const strikeRadius = this.seedlingStats.effectiveSporeStrikeRadius || 60;
      this.doSporeStrikeAt(ex, ey, this.seedlingStats.sporeDeathPulse, strikeRadius);
    }

    // Spore death explosion (5-piece spore set bonus)
    if (this.seedlingStats.sporeDeathExplosion && this.seedlingStats.sporeDamage) {
      const expRadius = this.seedlingStats.effectiveSporeStrikeRadius || 60;
      const expDmg = Math.floor(enemy.maxHp * 0.5);
      this.doSporeStrikeAt(ex, ey, expDmg, expRadius);
    }

    // Poof circle
    const poof = this.add.circle(ex, ey, 5, enemy.data.color || 0xAAAAAA, 0.3).setDepth(6);
    this.tweens.add({ targets: poof, scale: enemy.isBoss ? 5 : 3, alpha: 0, duration: 300, onComplete: () => poof.destroy() });

    this.tweens.add({
      targets: enemy.sprite,
      alpha: 0, scaleX: 0, scaleY: 0,
      duration: 150,
      onComplete: () => {
        enemy.sprite.destroy();
        enemy.hpBorder.destroy();
        enemy.hpBg.destroy();
        enemy.hpBar.destroy();
        if (enemy.regenIndicator) enemy.regenIndicator.destroy();
        for (const dot of enemy.statusDots) dot.destroy();
        enemy.statusDots = [];
      },
    });

    this.enemies.splice(index, 1);
    this.remainingEnemies--;
    this.killCount++;
  }

  // ── Wave / Biome Progression ────────────────────────────────────

  onWaveComplete() {
    if (this.waveComplete) return;
    this.waveComplete = true;
    this.audio.play('waveComplete');

    const { width, height } = this.scale;
    const isBossWave = this.waveInBiome === 3;
    const isLastBiome = this.biomeIndex >= this.biomeSequence.length - 1;

    if (isBossWave && isLastBiome) {
      // Run complete — victory!
      this.time.delayedCall(1200, () => {
        this.scene.start('Victory', {
          traits: this.graftedTraits,
          killCount: this.killCount,
          wavesCompleted: this.biomeSequence.length * 4,
          biomeSequence: this.biomeSequence,
        });
      });
      return;
    }

    // Banner
    const bannerText = isBossWave
      ? `${this.currentBiome.name.toUpperCase()} CONQUERED!`
      : 'WAVE COMPLETE!';
    const bannerColor = isBossWave ? '#FFAA22' : '#55FF55';

    const bannerY = height / 2 - 40;
    this.add.text(width / 2 + 2, bannerY + 2, bannerText, {
      fontFamily: 'monospace', fontSize: '26px', color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.3).setDepth(20);

    const banner = this.add.text(width / 2, bannerY, bannerText, {
      fontFamily: 'monospace', fontSize: '26px', color: bannerColor, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0).setDepth(20);

    this.tweens.add({ targets: banner, alpha: 1, y: bannerY - 20, duration: 500, ease: 'Back.easeOut' });

    // Celebratory particle burst from seedling
    const burstCount = isBossWave ? 16 : 10;
    const burstColor = isBossWave ? 0xFFAA22 : 0x66FF88;
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2;
      const speed = 40 + Math.random() * 50;
      const p = this.add.image(this.seedling.x, this.seedling.y, 'particle_hit')
        .setTint(burstColor).setDepth(12).setScale(0.8 + Math.random() * 0.6);
      this.tweens.add({
        targets: p,
        x: this.seedling.x + Math.cos(angle) * speed,
        y: this.seedling.y + Math.sin(angle) * speed,
        alpha: 0, scale: 0, duration: 400 + Math.random() * 200,
        onComplete: () => p.destroy(),
      });
    }

    // Next biome preview (after boss)
    if (isBossWave && !isLastBiome) {
      const nextBiomeId = this.biomeSequence[this.biomeIndex + 1];
      const nextBiome = BIOMES[nextBiomeId];
      if (nextBiome) {
        this.time.delayedCall(300, () => {
          const preview = this.add.text(width / 2, bannerY + 30, `Next: ${nextBiome.name}`, {
            fontFamily: 'monospace', fontSize: '14px', color: '#AAAACC',
          }).setOrigin(0.5).setAlpha(0).setDepth(20);
          this.tweens.add({ targets: preview, alpha: 0.8, duration: 400, delay: 200 });
        });
      }
    }

    this.time.delayedCall(1600, () => {
      this.cameras.main.fadeOut(400);
      this.time.delayedCall(400, () => {
        // Compute next wave state
        let nextBiomeIndex = this.biomeIndex;
        let nextWaveInBiome = this.waveInBiome + 1;
        if (isBossWave) {
          nextBiomeIndex = this.biomeIndex + 1;
          nextWaveInBiome = 0;
        }

        this.scene.start('Shop', {
          biomeSequence: this.biomeSequence,
          biomeIndex: nextBiomeIndex,
          waveInBiome: nextWaveInBiome,
          isBossReward: isBossWave,
          traits: this.graftedTraits,
          seedlingHp: this.seedlingStats.hp,
          seedlingMaxHp: this.seedlingStats.maxHp,
        });
      });
    });
  }

  onPlayerDeath() {
    if (this.waveComplete) return;
    this.waveComplete = true;
    this.audio.play('playerDeath');
    this.audio.stopMusic(true);

    this.tweens.add({
      targets: this.seedling,
      alpha: 0, y: this.seedling.y + 20, angle: 45,
      duration: 1000, ease: 'Power2',
    });

    const { width: fw2, height: fh2 } = this.scale;
    const flash = this.add.rectangle(fw2 / 2, fh2 / 2, fw2, fh2, 0xFF0000, 0.2).setDepth(80);
    this.tweens.add({ targets: flash, alpha: 0, duration: 600 });

    this.time.delayedCall(1800, () => {
      this.scene.start('GameOver', {
        traits: this.graftedTraits,
        biomeSequence: this.biomeSequence,
        biomeIndex: this.biomeIndex,
        waveInBiome: this.waveInBiome,
        waveReached: this.biomeIndex * 4 + this.waveInBiome + 1,
        killCount: this.killCount,
      });
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────

  showDamageNumber(x, y, text, color = '#FFFFFF', fontSize = '14px', isCrit = false) {
    const xOff = Phaser.Math.Between(-8, 8);
    const textObj = this.add.text(x + xOff, y, typeof text === 'number' ? Math.round(text).toString() : text, {
      fontFamily: 'monospace', fontSize, color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);

    if (isCrit) {
      textObj.setScale(1.5);
      this.tweens.add({ targets: textObj, scale: 1, duration: 150 });
    }

    this.tweens.add({
      targets: textObj, y: y - 35, alpha: 0, duration: 700,
      onComplete: () => textObj.destroy(),
    });
  }

  spawnParticle(x, y, texture, tint, count = 3) {
    for (let i = 0; i < count; i++) {
      const size = 0.5 + Math.random() * 1;
      const p = this.add.image(
        x + Phaser.Math.Between(-5, 5),
        y + Phaser.Math.Between(-5, 5),
        texture,
      ).setTint(tint).setDepth(12).setScale(size);

      this.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-25, 25),
        y: p.y + Phaser.Math.Between(-25, 25),
        alpha: 0, scale: 0,
        duration: 350 + Math.random() * 250,
        onComplete: () => p.destroy(),
      });
    }
  }

  shakeCamera(intensity, duration) {
    this.cameras.main.shake(duration, intensity / this.scale.width);
  }

  /** Brief time-scale dip for impact feel ("hitstop") */
  hitstop(durationMs = 60) {
    if (this._hitstopActive) return;
    this._hitstopActive = true;
    this.time.timeScale = 0.15;
    this.time.delayedCall(durationMs, () => {
      this.time.timeScale = 1;
      this._hitstopActive = false;
    });
  }
}
