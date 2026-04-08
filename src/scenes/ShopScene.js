import Phaser from 'phaser';
import { getRandomTraits, CATEGORY_COLORS, RARITY_COLORS } from '../data/traits.js';
import { generateSeedlingTexture } from '../systems/SpriteGenerator.js';
import { intToHexColor } from '../systems/utils.js';
import { getActiveSetBonuses, getNextSetThreshold } from '../data/setBonuses.js';
import { getSynergyHints } from '../data/synergies.js';

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  init(data) {
    this.audio = this.registry.get('audio');
    this.biomeSequence = data.biomeSequence || ['garden'];
    this.biomeIndex = data.biomeIndex || 0;
    this.waveInBiome = data.waveInBiome || 0;
    this.isBossReward = data.isBossReward || false;
    this.graftedTraits = data.traits || [];
    this.seedlingHp = data.seedlingHp;
    this.seedlingMaxHp = data.seedlingMaxHp;

    // Heal between waves
    if (this.seedlingHp != null && this.seedlingMaxHp != null) {
      if (this.waveInBiome === 0) {
        // Biome transition (after boss): full heal
        this.seedlingHp = this.seedlingMaxHp;
      } else {
        // Normal wave: heal 50% of missing HP
        const missing = this.seedlingMaxHp - this.seedlingHp;
        this.seedlingHp = Math.min(this.seedlingMaxHp, this.seedlingHp + missing * 0.6);
      }
    }
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    this.cameras.main.setBackgroundColor(0x0D150D);
    this.cameras.main.fadeIn(400);
    this.audio.startMusic('shop');

    // Floating background particles
    for (let i = 0; i < 15; i++) {
      const px = Phaser.Math.Between(20, width - 20);
      const py = Phaser.Math.Between(20, height - 20);
      const p = this.add.circle(px, py, 1, 0x338833, 0).setDepth(0);
      this.tweens.add({
        targets: p,
        alpha: { from: 0, to: 0.3 },
        y: py - Phaser.Math.Between(40, 100),
        duration: 3000 + Math.random() * 3000,
        repeat: -1,
        yoyo: true,
      });
    }

    // Title with shadow
    this.add.text(cx + 1, 26, 'GRAFT A TRAIT', {
      fontFamily: 'monospace', fontSize: '24px', color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.3);
    this.add.text(cx, 25, 'GRAFT A TRAIT', {
      fontFamily: 'monospace', fontSize: '24px', color: '#55CC55', fontStyle: 'bold',
    }).setOrigin(0.5);

    const isBossWave = this.waveInBiome === 3;
    if (isBossWave) {
      // Prominent boss warning
      const warningBg = this.add.rectangle(cx, 52, 280, 22, 0x441111, 0.6)
        .setOrigin(0.5).setStrokeStyle(1, 0xFF4444, 0.4);
      const warningText = this.add.text(cx, 52, `⚠ BOSS WAVE NEXT ⚠`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#FF6644', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.tweens.add({
        targets: [warningBg, warningText], alpha: 0.4,
        duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else {
      this.add.text(cx, 50, `Preparing for Wave ${this.waveInBiome + 1} / 4`, {
        fontFamily: 'monospace', fontSize: '13px', color: '#667766',
      }).setOrigin(0.5);
    }

    // Show current seedling — will crossfade to preview on hover
    const existingIds = this.graftedTraits.map(t => t.id);
    const seedlingY = 108;
    if (this.graftedTraits.length > 0) {
      generateSeedlingTexture(this, this.graftedTraits, 'seedling_shop_preview');
      this.seedlingImg = this.add.image(cx, seedlingY, 'seedling_shop_preview').setScale(1.6).setDepth(1);
    } else {
      this.seedlingImg = this.add.image(cx, seedlingY, 'seedling_base').setScale(1.8).setDepth(1);
    }
    this.tweens.add({
      targets: this.seedlingImg, y: seedlingY - 4, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.add.ellipse(cx, 132, 24, 8, 0x000000, 0.15);

    // Hover preview seedling (hidden initially, overlays current)
    this.previewImg = this.add.image(cx, seedlingY, 'seedling_base').setScale(1.6).setAlpha(0).setDepth(2);
    this.tweens.add({
      targets: this.previewImg, y: seedlingY - 4, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Stat delta text (shown on hover)
    this.statDeltaText = this.add.text(cx, 162, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#88EE88',
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(3).setAlpha(0);

    // Show current traits as icons
    if (this.graftedTraits.length > 0) {
      const traitStartX = cx - (this.graftedTraits.length * 20) / 2;
      for (let i = 0; i < this.graftedTraits.length; i++) {
        const t = this.graftedTraits[i];
        this.add.rectangle(traitStartX + i * 20, 148, 16, 16, 0x111111, 0.6)
          .setOrigin(0, 0).setStrokeStyle(1, CATEGORY_COLORS[t.category], 0.5);
        this.add.image(traitStartX + i * 20 + 8, 148 + 8, `icon_${t.category}`);
      }
    }

    // Show active set bonuses
    this.drawSetBonuses();

    // Generate 3 trait choices (biome-filtered, rarity adjusted for boss/normal)
    const currentBiomeId = this.biomeSequence[this.biomeIndex] || 'garden';
    const choices = getRandomTraits(3, existingIds, currentBiomeId, this.isBossReward);
    this.createTraitCards(choices);

    // Skip button with border
    const skipBg = this.add.rectangle(cx, height - 30, 100, 30, 0x1A1A1A, 0.5)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x444444);
    const skipText = this.add.text(cx, height - 30, 'SKIP', {
      fontFamily: 'monospace', fontSize: '13px', color: '#666655',
    }).setOrigin(0.5);

    skipBg.on('pointerover', () => { skipBg.setStrokeStyle(1, 0x888888); skipText.setColor('#AA9988'); this.audio.play('cardHover'); });
    skipBg.on('pointerout', () => { skipBg.setStrokeStyle(1, 0x444444); skipText.setColor('#666655'); });
    skipBg.on('pointerdown', () => { this.audio.play('uiClick'); this.goToNextWave(null); });

    // Mute toggle
    this.audio.createMuteButton(this);
  }

  createTraitCards(choices) {
    const { width, height } = this.scale;
    const cardWidth = 180;
    const cardHeight = 230;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * 20;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const cardY = height * 0.54;

    for (let i = 0; i < choices.length; i++) {
      const trait = choices[i];
      const cx = startX + i * (cardWidth + 20);
      const catColor = CATEGORY_COLORS[trait.category];
      const isLegendary = trait.rarity === 'legendary';

      // Legendary shimmer glow
      const glow = this.add.rectangle(cx, cardY, cardWidth + 8, cardHeight + 8,
        isLegendary ? 0xFF44FF : catColor, 0).setDepth(0);
      if (isLegendary) {
        this.tweens.add({
          targets: glow, alpha: { from: 0.05, to: 0.2 },
          duration: 800, yoyo: true, repeat: -1,
        });
      }

      // Card outer border — legendary gets golden/magenta border
      const borderColor = isLegendary ? 0xFF44FF : 0x111111;
      const cardOuter = this.add.rectangle(cx, cardY, cardWidth + 4, cardHeight + 4, borderColor)
        .setDepth(1);

      // Card background — legendary slightly different
      const bgColor = isLegendary ? 0x2A1A2A : 0x1A2A1A;
      const card = this.add.rectangle(cx, cardY, cardWidth, cardHeight, bgColor, 0.95)
        .setInteractive({ useHandCursor: true }).setDepth(1);

      // Inner inset border
      this.add.rectangle(cx, cardY, cardWidth - 6, cardHeight - 6, 0x000000, 0)
        .setStrokeStyle(1, isLegendary ? 0xFF44FF : catColor, isLegendary ? 0.4 : 0.2).setDepth(2);

      // Rarity stripe
      this.add.rectangle(cx, cardY - cardHeight / 2 + 4, cardWidth - 8, 4, RARITY_COLORS[trait.rarity]).setDepth(2);
      // Legendary gets a second stripe at bottom
      if (isLegendary) {
        this.add.rectangle(cx, cardY + cardHeight / 2 - 4, cardWidth - 8, 4, 0xFF44FF).setDepth(2);
      }

      // Category icon
      this.add.circle(cx, cardY - 72, 18, catColor, 0.15).setDepth(2);
      this.add.image(cx, cardY - 72, `icon_${trait.category}`).setScale(1.2).setDepth(2);

      // Trait name
      const nameColor = isLegendary ? '#FF88FF' : '#EEEEEE';
      this.add.text(cx, cardY - 44, trait.name, {
        fontFamily: 'monospace', fontSize: '13px', color: nameColor, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(2);

      // Category label
      this.add.text(cx, cardY - 30, trait.category.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '9px', color: intToHexColor(catColor),
      }).setOrigin(0.5).setDepth(2);

      // Rarity
      this.add.text(cx, cardY - 19, trait.rarity.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '8px', color: intToHexColor(RARITY_COLORS[trait.rarity]),
      }).setOrigin(0.5).setDepth(2);

      // Description
      this.add.text(cx, cardY - 4, trait.description, {
        fontFamily: 'monospace', fontSize: '11px', color: isLegendary ? '#DDAADD' : '#AACCAA',
        wordWrap: { width: cardWidth - 24 }, align: 'center',
      }).setOrigin(0.5, 0).setDepth(2);

      // Stat lines
      const statLines = [];
      const s = trait.stats;
      if (s.maxHp) statLines.push(`+${s.maxHp} Max HP`);
      if (s.attack) statLines.push(`+${s.attack} ATK`);
      if (s.hpRegen) statLines.push(`+${s.hpRegen} Regen`);
      if (s.armor) statLines.push(`+${s.armor} Armor`);
      if (s.critChance) statLines.push(`+${Math.round(s.critChance * 100)}% Crit`);
      if (s.attackSpeedMult) statLines.push(`+${Math.round(s.attackSpeedMult * 100)}% ASpd`);
      if (s.rangeMult) statLines.push(`+${Math.round(s.rangeMult * 100)}% Range`);
      if (s.thornDamage) statLines.push(`+${s.thornDamage} Thorns`);
      if (s.sporeDamage) statLines.push(`+${s.sporeDamage} Spore`);
      if (s.extraTargets) statLines.push(`+${s.extraTargets} Targets`);

      if (statLines.length > 0) {
        this.add.text(cx, cardY + 42, statLines.join('\n'), {
          fontFamily: 'monospace', fontSize: '10px', color: '#88BB88', align: 'center',
        }).setOrigin(0.5, 0).setDepth(2);
      }

      // Synergy hints — show which synergies this trait would complete
      const hints = getSynergyHints(this.graftedTraits, trait);
      if (hints.length > 0) {
        const hintText = hints.map(h => `★ ${h.name}`).join('\n');
        this.add.text(cx, cardY + cardHeight / 2 - 24, hintText, {
          fontFamily: 'monospace', fontSize: '9px', color: '#FFCC44',
          wordWrap: { width: cardWidth - 16 }, align: 'center',
        }).setOrigin(0.5, 1).setDepth(2);
      }

      // Set bonus hint — show if this trait pushes toward next set threshold
      const categoryCounts = { root: 0, thorn: 0, spore: 0, bloom: 0, vine: 0 };
      for (const t of this.graftedTraits) {
        if (categoryCounts[t.category] !== undefined) categoryCounts[t.category]++;
      }
      const currentCount = categoryCounts[trait.category] || 0;
      const nextThreshold = getNextSetThreshold(trait.category, currentCount);
      if (nextThreshold && currentCount + 1 >= nextThreshold) {
        // This trait completes a set bonus!
        this.add.text(cx, cardY + cardHeight / 2 - 10, `${trait.category} ${nextThreshold}-set!`, {
          fontFamily: 'monospace', fontSize: '9px', color: '#44DDFF',
        }).setOrigin(0.5, 1).setDepth(2);
      }

      // Entry animation — fly in from bottom
      const allElements = [glow, cardOuter, card];
      [glow, cardOuter, card].forEach(el => el.setPosition(el.x, el.y + 200).setAlpha(0));

      this.tweens.add({
        targets: allElements,
        y: `-=200`,
        alpha: 1,
        duration: 400,
        delay: i * 100,
        ease: 'Back.easeOut',
      });

      // Hover effects — card scale + seedling preview
      card.on('pointerover', () => {
        this.tweens.add({ targets: glow, alpha: isLegendary ? 0.25 : 0.12, duration: 150 });
        this.tweens.add({ targets: [card, cardOuter], scaleX: 1.03, scaleY: 1.03, duration: 100 });
        this.showTraitPreview(trait);
        this.audio.play('cardHover');
      });
      card.on('pointerout', () => {
        this.tweens.add({ targets: glow, alpha: isLegendary ? 0.05 : 0, duration: 150 });
        this.tweens.add({ targets: [card, cardOuter], scaleX: 1, scaleY: 1, duration: 100 });
        this.hideTraitPreview();
      });
      card.on('pointerdown', () => this.selectTrait(trait, card));
    }
  }

  drawSetBonuses() {
    const categoryCounts = { root: 0, thorn: 0, spore: 0, bloom: 0, vine: 0 };
    for (const t of this.graftedTraits) {
      if (categoryCounts[t.category] !== undefined) categoryCounts[t.category]++;
    }

    const activeBonuses = getActiveSetBonuses(categoryCounts);
    if (activeBonuses.length === 0) return;

    const startY = 170;
    this.add.text(10, startY, 'SET BONUSES:', {
      fontFamily: 'monospace', fontSize: '9px', color: '#556655',
    }).setDepth(2);

    for (let i = 0; i < activeBonuses.length; i++) {
      const b = activeBonuses[i];
      const col = intToHexColor(CATEGORY_COLORS[b.category]);
      const y = startY + 14 + i * 22;
      this.add.text(10, y, `${b.name} (${b.threshold})`, {
        fontFamily: 'monospace', fontSize: '9px', color: col,
      }).setDepth(2);
      this.add.text(10, y + 10, b.description, {
        fontFamily: 'monospace', fontSize: '8px', color: '#667766',
      }).setDepth(2);
    }
  }

  showTraitPreview(trait) {
    // Generate preview texture with this trait added
    const previewTraits = [...this.graftedTraits, trait];
    generateSeedlingTexture(this, previewTraits, 'seedling_hover_preview');
    this.previewImg.setTexture('seedling_hover_preview');
    this.previewImg.setScale(this.graftedTraits.length > 0 ? 1.6 : 1.8);

    // Crossfade: dim current, show preview
    this.tweens.add({ targets: this.seedlingImg, alpha: 0.25, duration: 150 });
    this.tweens.add({ targets: this.previewImg, alpha: 1, duration: 150 });

    // Build stat delta text
    const s = trait.stats;
    const deltas = [];
    if (s.maxHp) deltas.push(`+${s.maxHp} HP`);
    if (s.attack) deltas.push(`+${s.attack} ATK`);
    if (s.armor) deltas.push(`+${s.armor} ARM`);
    if (s.hpRegen) deltas.push(`+${s.hpRegen} Regen`);
    if (s.critChance) deltas.push(`+${Math.round(s.critChance * 100)}% Crit`);
    if (s.attackSpeedMult) deltas.push(`+${Math.round(s.attackSpeedMult * 100)}% ASpd`);
    if (s.rangeMult) deltas.push(`+${Math.round(s.rangeMult * 100)}% Range`);
    if (s.thornDamage) deltas.push(`+${s.thornDamage} Thorns`);
    if (s.sporeDamage) deltas.push(`+${s.sporeDamage} Spore`);
    if (s.extraTargets) deltas.push(`+${s.extraTargets} Targets`);

    if (deltas.length > 0) {
      this.statDeltaText.setText(deltas.join('  '));
      this.tweens.add({ targets: this.statDeltaText, alpha: 1, duration: 150 });
    }
  }

  hideTraitPreview() {
    // Crossfade back: restore current, hide preview
    this.tweens.add({ targets: this.seedlingImg, alpha: 1, duration: 150 });
    this.tweens.add({ targets: this.previewImg, alpha: 0, duration: 150 });
    this.tweens.add({ targets: this.statDeltaText, alpha: 0, duration: 100 });
  }

  selectTrait(trait, card) {
    this.audio.play('traitSelected');
    // Scale up selected card, fade others
    this.tweens.add({
      targets: card,
      scaleX: 1.1, scaleY: 1.1,
      duration: 200,
      onComplete: () => this.goToNextWave(trait),
    });
  }

  goToNextWave(trait) {
    const traits = [...this.graftedTraits];
    if (trait) traits.push(trait);

    this.cameras.main.fadeOut(400);
    this.time.delayedCall(400, () => {
      this.scene.start('Combat', {
        biomeSequence: this.biomeSequence,
        biomeIndex: this.biomeIndex,
        waveInBiome: this.waveInBiome,
        traits,
        seedlingHp: this.seedlingHp,
        seedlingMaxHp: this.seedlingMaxHp,
      });
    });
  }
}
