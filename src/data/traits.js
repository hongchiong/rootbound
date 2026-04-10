// Trait categories: root, thorn, spore, bloom, vine
// Rarities: common (50%), uncommon (30%), rare (15%), legendary (5%)
// Each trait modifies stats and adds visual elements to the seedling

export const TRAIT_POOL = [
  // ═══════════════════════════════════════════════════════════════════
  // ROOT traits (defensive, HP, armor, regen) — 22 traits
  // ═══════════════════════════════════════════════════════════════════

  // Common (7)
  {
    id: 'thick_roots',
    name: 'Thick Roots',
    category: 'root',
    description: '+22 Max HP, +1 HP Regen',
    rarity: 'common',
    stats: { maxHp: 22, hpRegen: 1 },
    visual: { roots: 1 },
  },
  {
    id: 'shallow_roots',
    name: 'Shallow Roots',
    category: 'root',
    description: '+15 Max HP, +4 Armor Pen Resist',
    rarity: 'common',
    stats: { maxHp: 15, armorPenResist: 4 },
    visual: { roots: 1 },
  },
  {
    id: 'fibrous_mat',
    name: 'Fibrous Mat',
    category: 'root',
    description: '+30 Max HP',
    rarity: 'common',
    stats: { maxHp: 30 },
    visual: { roots: 1 },
  },
  {
    id: 'bark_skin',
    name: 'Bark Skin',
    category: 'root',
    description: '+2 Armor',
    rarity: 'common',
    stats: { armor: 2 },
    visual: { roots: 1, color: 0x8B7355 },
  },
  {
    id: 'nutrient_uptake',
    name: 'Nutrient Uptake',
    category: 'root',
    description: '+1.5 HP Regen',
    rarity: 'common',
    stats: { hpRegen: 1.5 },
    visual: { roots: 1 },
  },
  {
    id: 'grounding',
    name: 'Grounding',
    category: 'root',
    description: '+15 Max HP, +8% debuff resistance',
    rarity: 'common',
    stats: { maxHp: 15, debuffResist: 0.08 },
    visual: { roots: 1 },
  },
  {
    id: 'garden_roots',
    name: 'Garden Roots',
    category: 'root',
    description: '+25 Max HP, +1 Armor',
    rarity: 'common',
    biome: 'garden',
    stats: { maxHp: 25, armor: 1 },
    visual: { roots: 1 },
  },

  // Uncommon (7)
  {
    id: 'deep_taproot',
    name: 'Deep Taproot',
    category: 'root',
    description: '+50 Max HP, +2 HP Regen',
    rarity: 'uncommon',
    stats: { maxHp: 50, hpRegen: 2 },
    visual: { roots: 2 },
  },
  {
    id: 'bark_plating',
    name: 'Bark Plating',
    category: 'root',
    description: '+5 Armor, +10 Max HP',
    rarity: 'uncommon',
    biome: 'forest',
    stats: { armor: 5, maxHp: 10 },
    visual: { roots: 2, color: 0x8B7355 },
  },
  {
    id: 'living_foundation',
    name: 'Living Foundation',
    category: 'root',
    description: '+80 Max HP',
    rarity: 'uncommon',
    stats: { maxHp: 80 },
    visual: { roots: 3 },
  },
  {
    id: 'petrified_bark',
    name: 'Petrified Bark',
    category: 'root',
    description: '+8 Armor, -10% Attack Speed',
    rarity: 'uncommon',
    stats: { armor: 8, attackSpeedMult: -0.10 },
    visual: { roots: 2, color: 0x666655 },
  },
  {
    id: 'adaptive_cortex',
    name: 'Adaptive Cortex',
    category: 'root',
    description: '+3 Armor, +2 Magic Resist',
    rarity: 'uncommon',
    stats: { armor: 3, magicResist: 2 },
    visual: { roots: 2 },
  },
  {
    id: 'mycorrhizal_shield',
    name: 'Mycorrhizal Shield',
    category: 'root',
    description: '+30 Max HP, +3 HP Regen',
    rarity: 'uncommon',
    biome: 'underroot',
    stats: { maxHp: 30, hpRegen: 3 },
    visual: { roots: 2, color: 0x9966CC },
  },
  {
    id: 'regenerative_cambium',
    name: 'Regenerative Cambium',
    category: 'root',
    description: '+4 HP Regen, heal 2% max HP when hit',
    rarity: 'uncommon',
    stats: { hpRegen: 4, onHitHealPercent: 0.02 },
    visual: { roots: 2 },
  },

  // Rare (5)
  {
    id: 'ironwood_root',
    name: 'Ironwood Root',
    category: 'root',
    description: '+20 Max HP, +8 Armor',
    rarity: 'rare',
    stats: { maxHp: 20, armor: 8 },
    visual: { roots: 2, color: 0x8B7355, signature: 'iron_plates' },
  },
  {
    id: 'frost_bark',
    name: 'Frost Bark',
    category: 'root',
    description: '+4 Attack, Frost damage type',
    rarity: 'rare',
    stats: { attack: 4, damageType: 'frost' },
    visual: { roots: 1, color: 0xAADDFF, signature: 'frost_crystals' },
  },
  {
    id: 'stone_heart',
    name: 'Stone Heart',
    category: 'root',
    description: '+100 Max HP, +10 Armor, -20% Attack Speed',
    rarity: 'rare',
    stats: { maxHp: 100, armor: 10, attackSpeedMult: -0.20 },
    visual: { roots: 3, color: 0x888888, signature: 'stone_cracks' },
  },
  {
    id: 'living_armor',
    name: 'Living Armor',
    category: 'root',
    description: 'Armor +1 per 3 traits grafted',
    rarity: 'rare',
    stats: { armorPerTraits: 3 },
    visual: { roots: 2, color: 0x669944, signature: 'scale_armor' },
  },
  {
    id: 'root_of_ancients',
    name: 'Root of the Ancients',
    category: 'root',
    description: '+6 Armor, +60 Max HP, regen x2 in boss waves',
    rarity: 'rare',
    biome: 'forest',
    stats: { armor: 6, maxHp: 60, bossRegenDouble: true },
    visual: { roots: 3, color: 0x4A7030, signature: 'ancient_runes' },
  },

  // Legendary (3)
  {
    id: 'worldtree_foundation',
    name: 'Worldtree Foundation',
    category: 'root',
    description: '+150 Max HP, +5 Armor, regen x2, emergency +15 Armor at 30% HP',
    rarity: 'legendary',
    stats: { maxHp: 150, armor: 5, regenMultiplier: 1.0, emergencyArmor: 15, emergencyThreshold: 0.30 },
    visual: { roots: 4, color: 0xFFDD44, signature: 'golden_crown' },
  },
  {
    id: 'diamond_heartwood',
    name: 'Diamond Heartwood',
    category: 'root',
    description: 'All damage taken -15%, +50 Max HP',
    rarity: 'legendary',
    stats: { damageReduction: 0.15, maxHp: 50 },
    visual: { roots: 3, color: 0xAAFFFF, signature: 'crystalline' },
  },
  {
    id: 'primordial_bulwark',
    name: 'Primordial Bulwark',
    category: 'root',
    description: '+10 Armor, +5 Magic Resist, reflect 20% mitigated damage',
    rarity: 'legendary',
    stats: { armor: 10, magicResist: 5, reflectMitigated: 0.20 },
    visual: { roots: 4, color: 0xCC88FF, signature: 'mirror_shield' },
  },

  // ═══════════════════════════════════════════════════════════════════
  // THORN traits (damage, crit, damage types) — 22 traits
  // ═══════════════════════════════════════════════════════════════════

  // Common (7)
  {
    id: 'sharp_thorns',
    name: 'Sharp Thorns',
    category: 'thorn',
    description: '+4 Attack, thorns deal 2 on hit',
    rarity: 'common',
    stats: { attack: 4, thornDamage: 2 },
    visual: { thorns: 1 },
  },
  {
    id: 'barbed_tips',
    name: 'Barbed Tips',
    category: 'thorn',
    description: '+5 Attack',
    rarity: 'common',
    stats: { attack: 5 },
    visual: { thorns: 1 },
  },
  {
    id: 'serrated_edge',
    name: 'Serrated Edge',
    category: 'thorn',
    description: '+3 Attack, Slash damage type',
    rarity: 'common',
    stats: { attack: 3, damageType: 'slash' },
    visual: { thorns: 1, color: 0xFF6644 },
  },
  {
    id: 'heavy_spike',
    name: 'Heavy Spike',
    category: 'thorn',
    description: '+5 Attack, Blunt damage type',
    rarity: 'common',
    stats: { attack: 5, damageType: 'blunt' },
    visual: { thorns: 1, color: 0xCCAA66 },
  },
  {
    id: 'focused_point',
    name: 'Focused Point',
    category: 'thorn',
    description: '+2 Attack, +4% Crit, +5% Accuracy',
    rarity: 'common',
    stats: { attack: 2, critChance: 0.04, accuracy: 0.05 },
    visual: { thorns: 1 },
  },
  {
    id: 'garden_thorns',
    name: 'Garden Thorns',
    category: 'thorn',
    description: '+5 Attack, +4% Crit',
    rarity: 'common',
    biome: 'garden',
    stats: { attack: 5, critChance: 0.04 },
    visual: { thorns: 1 },
  },
  {
    id: 'iron_filings',
    name: 'Iron Filings',
    category: 'thorn',
    description: '+3 Attack, +1 Armor',
    rarity: 'common',
    stats: { attack: 3, armor: 1 },
    visual: { thorns: 1, color: 0x888888 },
  },

  // Uncommon (7)
  {
    id: 'barbed_spikes',
    name: 'Barbed Spikes',
    category: 'thorn',
    description: '+8 Attack, +10% Crit',
    rarity: 'uncommon',
    stats: { attack: 8, critChance: 0.10 },
    visual: { thorns: 2 },
  },
  {
    id: 'razorleaf',
    name: 'Razorleaf',
    category: 'thorn',
    description: '+12 Attack',
    rarity: 'uncommon',
    stats: { attack: 12 },
    visual: { thorns: 2 },
  },
  {
    id: 'crystal_shot',
    name: 'Crystal Shot',
    category: 'thorn',
    description: '+5 Attack, Pierce damage type',
    rarity: 'uncommon',
    stats: { attack: 5, damageType: 'pierce' },
    visual: { thorns: 2, color: 0x88DDFF },
  },
  {
    id: 'double_strike',
    name: 'Double Strike',
    category: 'thorn',
    description: '20% chance to hit twice',
    rarity: 'uncommon',
    stats: { doubleStrikeChance: 0.20 },
    visual: { thorns: 2 },
  },
  {
    id: 'poison_tip',
    name: 'Poison Tip',
    category: 'thorn',
    description: '+4 Attack, Poison damage type',
    rarity: 'uncommon',
    biome: 'underroot',
    stats: { attack: 4, damageType: 'poison' },
    visual: { thorns: 1, color: 0x88FF44 },
  },
  {
    id: 'ember_thorn',
    name: 'Ember Thorn',
    category: 'thorn',
    description: '+5 Attack, Fire damage type',
    rarity: 'uncommon',
    stats: { attack: 5, damageType: 'fire' },
    visual: { thorns: 2, color: 0xFF6622 },
  },
  {
    id: 'voltaic_spine',
    name: 'Voltaic Spine',
    category: 'thorn',
    description: '+5 Attack, Lightning damage type',
    rarity: 'uncommon',
    biome: 'canopy',
    stats: { attack: 5, damageType: 'lightning' },
    visual: { thorns: 2, color: 0xFFFF44 },
  },

  // Rare (5)
  {
    id: 'void_tendril',
    name: 'Void Tendril',
    category: 'thorn',
    description: '+6 Attack, Void damage type',
    rarity: 'rare',
    stats: { attack: 6, damageType: 'void' },
    visual: { thorns: 2, color: 0xCC88FF, signature: 'void_wisps' },
  },
  {
    id: 'venomthorn',
    name: 'Venomthorn',
    category: 'thorn',
    description: '+4 Attack, poison 5/s stacking',
    rarity: 'rare',
    stats: { attack: 4, poisonDamage: 5, poisonDuration: 3000 },
    visual: { thorns: 1, color: 0x88FF44, signature: 'poison_drip' },
  },
  {
    id: 'executioner_spine',
    name: 'Executioner Spine',
    category: 'thorn',
    description: '+10 Attack, +30% Crit Multiplier',
    rarity: 'rare',
    stats: { attack: 10, critMultiplier: 0.30 },
    visual: { thorns: 3, signature: 'blade_glint' },
  },
  {
    id: 'berserker_thorn',
    name: 'Berserker Thorn',
    category: 'thorn',
    description: '+15 Attack, -20 Max HP',
    rarity: 'rare',
    biome: 'the_rot',
    stats: { attack: 15, maxHp: -20 },
    visual: { thorns: 3, color: 0xFF2222, signature: 'blood_splatter' },
  },
  {
    id: 'rotfang',
    name: 'Rotfang',
    category: 'thorn',
    description: '+8 Attack, Slash type, bleed reduces armor by 2',
    rarity: 'rare',
    biome: 'the_rot',
    stats: { attack: 8, damageType: 'slash', bleedArmorReduce: 2 },
    visual: { thorns: 2, color: 0x884422, signature: 'rot_aura' },
  },

  // Legendary (3)
  {
    id: 'the_black_thorn',
    name: 'The Black Thorn',
    category: 'thorn',
    description: '+20 Attack, +15% Crit, crits apply all DoTs',
    rarity: 'legendary',
    stats: { attack: 20, critChance: 0.15, critApplyAllDots: true },
    visual: { thorns: 4, color: 0x222222, signature: 'shadow_form' },
  },
  {
    id: 'soul_reaver',
    name: 'Soul Reaver',
    category: 'thorn',
    description: 'Void type, +2 Attack permanently on kill (max +20)',
    rarity: 'legendary',
    stats: { damageType: 'void', soulReaverStacking: 2, soulReaverMax: 20 },
    visual: { thorns: 3, color: 0xCC88FF, signature: 'soul_wisps' },
  },
  {
    id: 'prismatic_fang',
    name: 'Prismatic Fang',
    category: 'thorn',
    description: 'Cycles through all damage types each hit at 50%',
    rarity: 'legendary',
    stats: { attack: 8, prismaticCycle: true },
    visual: { thorns: 4, color: 0xFF44FF, signature: 'prismatic' },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SPORE traits (AoE, debuff, area control) — 22 traits
  // ═══════════════════════════════════════════════════════════════════

  // Common (7)
  {
    id: 'toxic_spores',
    name: 'Toxic Spores',
    category: 'spore',
    description: 'Launch toxic strikes at enemies, 4 dmg/2s',
    rarity: 'common',
    stats: { sporeDamage: 4, sporeInterval: 2000 },
    visual: { spores: 1 },
  },
  {
    id: 'numbing_dust',
    name: 'Numbing Dust',
    category: 'spore',
    description: 'Strikes slow enemies 18%, 2 dmg/2s',
    rarity: 'common',
    stats: { sporeDamage: 2, sporeInterval: 2000, sporeSlow: 0.18 },
    visual: { spores: 1 },
  },
  {
    id: 'spore_cloud',
    name: 'Spore Cloud',
    category: 'spore',
    description: '+25% spore strike radius',
    rarity: 'common',
    stats: { sporeDamage: 1, sporeInterval: 2500, sporeRadiusMult: 0.25 },
    visual: { spores: 1 },
  },
  {
    id: 'irritant_pollen',
    name: 'Irritant Pollen',
    category: 'spore',
    description: '2 dmg/2.5s, enemies hit deal -12% damage',
    rarity: 'common',
    stats: { sporeDamage: 2, sporeInterval: 2500, enemyAttackReduce: 0.12 },
    visual: { spores: 1, color: 0xFFDD44 },
  },
  {
    id: 'fungal_bloom',
    name: 'Fungal Bloom',
    category: 'spore',
    description: '3 spore dmg/2s, enemies deal -8% damage',
    rarity: 'common',
    biome: 'underroot',
    stats: { sporeDamage: 3, sporeInterval: 2000, enemyDamageReduce: 0.08 },
    visual: { spores: 1, color: 0x9966CC },
  },
  {
    id: 'scatter_spores',
    name: 'Scatter Spores',
    category: 'spore',
    description: '+40% spore radius',
    rarity: 'common',
    stats: { sporeDamage: 1, sporeInterval: 2500, sporeRadiusMult: 0.40 },
    visual: { spores: 1 },
  },
  {
    id: 'choking_dust',
    name: 'Choking Dust',
    category: 'spore',
    description: '2 dmg/2s, enemies deal -15% damage',
    rarity: 'common',
    stats: { sporeDamage: 2, sporeInterval: 2000, enemyDamageReduce: 0.15 },
    visual: { spores: 1, color: 0xAAAA88 },
  },

  // Uncommon (7)
  {
    id: 'hallucinogenic_cloud',
    name: 'Hallucinogenic Cloud',
    category: 'spore',
    description: '25% slow, disorient enemies for 1.5s, 3 dmg/2.5s',
    rarity: 'uncommon',
    stats: { sporeDamage: 3, sporeInterval: 2500, sporeSlow: 0.25, sporeConfuse: 1500 },
    visual: { spores: 2, color: 0xCC66FF },
  },
  {
    id: 'mycelium_web',
    name: 'Mycelium Web',
    category: 'spore',
    description: 'Strikes leave slowing ground zones for 3s, 55% slow',
    rarity: 'uncommon',
    biome: 'underroot',
    stats: { sporeDamage: 3, sporeInterval: 2500, sporeSlow: 0.55, sporePersistDuration: 3000 },
    visual: { spores: 2, color: 0xCCAA44 },
  },
  {
    id: 'ember_burst',
    name: 'Ember Burst',
    category: 'spore',
    description: 'Fire spore strikes, burn enemies 2/s',
    rarity: 'uncommon',
    stats: { sporeDamage: 4, sporeInterval: 2500, sporeDamageType: 'fire', sporeBurnDps: 2 },
    visual: { spores: 2, color: 0xFFAA22 },
  },
  {
    id: 'corrosive_spores',
    name: 'Corrosive Spores',
    category: 'spore',
    description: 'Reduce enemy armor by 4 for 4s, 2 dmg/2s',
    rarity: 'uncommon',
    stats: { sporeDamage: 2, sporeInterval: 2000, sporeArmorReduce: 4 },
    visual: { spores: 2, color: 0xAAFF44 },
  },
  {
    id: 'chain_spores',
    name: 'Chain Spores',
    category: 'spore',
    description: 'Enemy death triggers spore strike at location, 6 dmg',
    rarity: 'uncommon',
    stats: { sporeDeathPulse: 6 },
    visual: { spores: 2 },
  },
  {
    id: 'frost_spores',
    name: 'Frost Spores',
    category: 'spore',
    description: 'Frost strikes, 30% slow, 4 dmg/2.5s',
    rarity: 'uncommon',
    biome: 'canopy',
    stats: { sporeDamage: 4, sporeInterval: 2500, sporeSlow: 0.30, sporeDamageType: 'frost' },
    visual: { spores: 2, color: 0xAADDFF },
  },
  {
    id: 'static_field',
    name: 'Static Field',
    category: 'spore',
    description: 'Lightning strikes chain to 2 nearby enemies, 3 dmg/2s',
    rarity: 'uncommon',
    stats: { sporeDamage: 3, sporeInterval: 2000, sporeChainTargets: 2, sporeDamageType: 'lightning' },
    visual: { spores: 2, color: 0xFFFF44 },
  },

  // Rare (5)
  {
    id: 'death_bloom_spore',
    name: 'Death Bloom Spore',
    category: 'spore',
    description: 'Targeted blast, 12 dmg/3s, +30% radius, -10% enemy damage',
    rarity: 'rare',
    stats: { sporeDamage: 12, sporeInterval: 3000, sporeRadiusMult: 0.30, sporeTargetBias: 1.0, enemyDamageReduce: 0.10 },
    visual: { spores: 3, signature: 'death_cloud' },
  },
  {
    id: 'pandemic',
    name: 'Pandemic',
    category: 'spore',
    description: 'Poison strikes 3/s, leave toxic ground for 3s, 3 dmg/2s',
    rarity: 'rare',
    stats: { sporeDamage: 3, sporeInterval: 2000, sporeDamageType: 'poison', sporePoisonDps: 3, sporePersistDuration: 3000 },
    visual: { spores: 3, color: 0x88FF44, signature: 'contagion_rings' },
  },
  {
    id: 'wildfire_spores',
    name: 'Wildfire Spores',
    category: 'spore',
    description: 'Fire strikes, burn 4/s, +25% radius, 5 dmg/2.5s',
    rarity: 'rare',
    stats: { sporeDamage: 5, sporeInterval: 2500, sporeRadiusMult: 0.25, sporeDamageType: 'fire', sporeBurnDps: 4 },
    visual: { spores: 3, color: 0xFF6622, signature: 'flame_particles' },
  },
  {
    id: 'void_miasma',
    name: 'Void Miasma',
    category: 'spore',
    description: 'Void strikes suppress regen for 4s, -5 armor, 6 dmg/3s',
    rarity: 'rare',
    biome: 'the_rot',
    stats: { sporeDamage: 6, sporeInterval: 3000, sporeDamageType: 'void', sporeSuppressRegen: true, sporeArmorReduce: 5 },
    visual: { spores: 3, color: 0xCC88FF, signature: 'void_mist' },
  },
  {
    id: 'gravity_well',
    name: 'Gravity Well',
    category: 'spore',
    description: 'Pulls nearby enemies toward impact, 20% slow, 4 dmg/2s',
    rarity: 'rare',
    stats: { sporeDamage: 4, sporeInterval: 2000, sporePull: 40, sporeRadiusMult: 0.20, sporeSlow: 0.20 },
    visual: { spores: 3, color: 0x6644CC, signature: 'gravity_distortion' },
  },

  // Legendary (3)
  {
    id: 'spore_sovereign',
    name: 'Spore Sovereign',
    category: 'spore',
    description: 'Spore damage x2.0, applies primary type on-hit, 25% slow, +20% radius',
    rarity: 'legendary',
    stats: { sporeDamageMult: 1.0, sporeRadiusMult: 0.20, sporeApplyOnHit: true, sporeSlow: 0.25 },
    visual: { spores: 4, color: 0xFF44FF, signature: 'fungal_cap' },
  },
  {
    id: 'nuclear_bloom',
    name: 'Nuclear Bloom',
    category: 'spore',
    description: 'Every 12s: 40 dmg at densest cluster, 1.2s stun, -5 armor for 4s',
    rarity: 'legendary',
    stats: { nuclearBloomDamage: 40, nuclearBloomInterval: 12000, nuclearBloomStun: 1200, sporeArmorReduce: 5 },
    visual: { spores: 4, color: 0xFFFF00, signature: 'radiation_glow' },
  },
  {
    id: 'living_miasma',
    name: 'Living Miasma',
    category: 'spore',
    description: 'Strikes persist as debuff zones for 5s, 2 dmg/s, 30% slow in zone',
    rarity: 'legendary',
    stats: { sporeDamage: 5, sporeInterval: 2500, sporePersistDuration: 5000, sporePersistDamage: 2, sporeSlow: 0.30 },
    visual: { spores: 4, color: 0x44CC88, signature: 'miasma_tendrils' },
  },

  // ═══════════════════════════════════════════════════════════════════
  // BLOOM traits (healing, buffs, utility) — 22 traits
  // ═══════════════════════════════════════════════════════════════════

  // Common (7)
  {
    id: 'healing_blossom',
    name: 'Healing Blossom',
    category: 'bloom',
    description: '+4 HP Regen, heal 8 on kill',
    rarity: 'common',
    stats: { hpRegen: 4, healOnKill: 8 },
    visual: { blooms: 1 },
  },
  {
    id: 'morning_dew',
    name: 'Morning Dew',
    category: 'bloom',
    description: '+2 HP Regen, +8 Max HP',
    rarity: 'common',
    stats: { hpRegen: 2, maxHp: 8 },
    visual: { blooms: 1 },
  },
  {
    id: 'pollen_shield',
    name: 'Pollen Shield',
    category: 'bloom',
    description: '15% chance to heal 4 when hit',
    rarity: 'common',
    stats: { onHitHealChance: 0.15, onHitHealAmount: 4 },
    visual: { blooms: 1, color: 0xFFDD88 },
  },
  {
    id: 'nourishing_sap',
    name: 'Nourishing Sap',
    category: 'bloom',
    description: '+3 HP Regen',
    rarity: 'common',
    stats: { hpRegen: 3 },
    visual: { blooms: 1 },
  },
  {
    id: 'garden_bloom',
    name: 'Garden Bloom',
    category: 'bloom',
    description: '+3 HP Regen, +15 Max HP',
    rarity: 'common',
    biome: 'garden',
    stats: { hpRegen: 3, maxHp: 15 },
    visual: { blooms: 1 },
  },
  {
    id: 'vigor_petal',
    name: 'Vigor Petal',
    category: 'bloom',
    description: '+8% Attack Speed, +1.5 HP Regen',
    rarity: 'common',
    stats: { attackSpeedMult: 0.08, hpRegen: 1.5 },
    visual: { blooms: 1 },
  },
  {
    id: 'root_network',
    name: 'Root Network',
    category: 'bloom',
    description: '+1.5 HP Regen per unique graft category',
    rarity: 'common',
    stats: { regenPerCategory: 1.5 },
    visual: { blooms: 1, color: 0x44AA88 },
  },

  // Uncommon (7)
  {
    id: 'sunpetal',
    name: 'Sunpetal',
    category: 'bloom',
    description: '+15% Attack Speed, +3 HP Regen',
    rarity: 'uncommon',
    stats: { attackSpeedMult: 0.15, hpRegen: 3 },
    visual: { blooms: 2, color: 0xFFDD44 },
  },
  {
    id: 'photosynthesis',
    name: 'Photosynthesis',
    category: 'bloom',
    description: '+3 HP Regen per bloom visual',
    rarity: 'uncommon',
    stats: { hpRegenPerBloom: 3 },
    visual: { blooms: 1, color: 0x88FF88 },
  },
  {
    id: 'life_tap',
    name: 'Life Tap',
    category: 'bloom',
    description: 'Nature type, heal 15% of damage dealt',
    rarity: 'uncommon',
    biome: 'forest',
    stats: { damageType: 'nature', lifeSteal: 0.15 },
    visual: { blooms: 2, color: 0x44CC44 },
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    category: 'bloom',
    description: 'Heal 30% max HP at 25% HP, once per wave',
    rarity: 'uncommon',
    stats: { secondWindHeal: 0.30, secondWindThreshold: 0.25 },
    visual: { blooms: 2 },
  },
  {
    id: 'bloom_burst',
    name: 'Bloom Burst',
    category: 'bloom',
    description: 'On kill, heal 5 + 2% max HP',
    rarity: 'uncommon',
    stats: { healOnKill: 5, healOnKillPercent: 0.02 },
    visual: { blooms: 2 },
  },
  {
    id: 'fortifying_nectar',
    name: 'Fortifying Nectar',
    category: 'bloom',
    description: '+2 Armor, +3 HP Regen, +20 Max HP',
    rarity: 'uncommon',
    stats: { armor: 2, hpRegen: 3, maxHp: 20 },
    visual: { blooms: 2, color: 0xFFAA44 },
  },
  {
    id: 'rot_blossom',
    name: 'Rot Blossom',
    category: 'bloom',
    description: '+5 HP Regen, kills heal double',
    rarity: 'uncommon',
    biome: 'the_rot',
    stats: { hpRegen: 5, doubleHealOnKill: true },
    visual: { blooms: 2, color: 0x884444 },
  },

  // Rare (5)
  {
    id: 'lifebloom',
    name: 'Lifebloom',
    category: 'bloom',
    description: '+10 HP Regen, +40 Max HP',
    rarity: 'rare',
    stats: { hpRegen: 10, maxHp: 40 },
    visual: { blooms: 2, signature: 'life_pulse' },
  },
  {
    id: 'rot_essence',
    name: 'Rot Essence',
    category: 'bloom',
    description: 'Slash type, bleed scales with missing HP',
    rarity: 'rare',
    stats: { attack: 4, damageType: 'slash', bleedMissingHpScale: true },
    visual: { blooms: 1, color: 0xFF5544, signature: 'rot_veins' },
  },
  {
    id: 'vampiric_bloom',
    name: 'Vampiric Bloom',
    category: 'bloom',
    description: 'Heal 10% of all damage dealt',
    rarity: 'rare',
    biome: 'the_rot',
    stats: { vampiricPercent: 0.10 },
    visual: { blooms: 2, color: 0xCC2244, signature: 'blood_thorns' },
  },
  {
    id: 'overgrowth',
    name: 'Overgrowth',
    category: 'bloom',
    description: '+5 HP Regen, every 15s +2 all stats for 5s',
    rarity: 'rare',
    stats: { hpRegen: 5, overgrowthInterval: 15000, overgrowthDuration: 5000, overgrowthBonus: 2 },
    visual: { blooms: 3, color: 0x44FF44, signature: 'wild_growth' },
  },
  {
    id: 'phoenix_petal',
    name: 'Phoenix Petal',
    category: 'bloom',
    description: 'Revive once with 50% HP per run',
    rarity: 'rare',
    stats: { phoenixRevive: 0.50 },
    visual: { blooms: 2, color: 0xFF8844, signature: 'phoenix_feathers' },
  },

  // Legendary (3)
  {
    id: 'eternal_bloom',
    name: 'Eternal Bloom',
    category: 'bloom',
    description: 'Regen x3, revive once with 75% HP',
    rarity: 'legendary',
    stats: { regenMultiplier: 1.0, phoenixRevive: 0.75 },
    visual: { blooms: 4, color: 0xFFDD88, signature: 'eternal_glow' },
  },
  {
    id: 'world_tree_blessing',
    name: 'World Tree Blessing',
    category: 'bloom',
    description: 'All healing +50%, 10% chance to duplicate random trait stats on kill',
    rarity: 'legendary',
    stats: { healingBonus: 0.50, traitDuplicateChance: 0.10 },
    visual: { blooms: 4, color: 0x44FF88, signature: 'blessing_aura' },
  },
  {
    id: 'parasitic_garden',
    name: 'Parasitic Garden',
    category: 'bloom',
    description: '6/s drain aura, heal 50% of drain',
    rarity: 'legendary',
    stats: { drainAuraDps: 6, drainAuraHealPercent: 0.50 },
    visual: { blooms: 4, color: 0x882266, signature: 'drain_vines' },
  },

  // ═══════════════════════════════════════════════════════════════════
  // VINE traits (range, speed, multi-target) — 22 traits
  // ═══════════════════════════════════════════════════════════════════

  // Common (7)
  {
    id: 'lashing_vine',
    name: 'Lashing Vine',
    category: 'vine',
    description: '+15% Range, +2 Attack',
    rarity: 'common',
    stats: { rangeMult: 0.15, attack: 2 },
    visual: { vines: 1 },
  },
  {
    id: 'quick_tendril',
    name: 'Quick Tendril',
    category: 'vine',
    description: '+12% Attack Speed',
    rarity: 'common',
    stats: { attackSpeedMult: 0.12 },
    visual: { vines: 1 },
  },
  {
    id: 'reaching_branch',
    name: 'Reaching Branch',
    category: 'vine',
    description: '+19% Range',
    rarity: 'common',
    stats: { rangeMult: 0.19 },
    visual: { vines: 1 },
  },
  {
    id: 'twin_lash',
    name: 'Twin Lash',
    category: 'vine',
    description: '+1 target',
    rarity: 'common',
    stats: { extraTargets: 1 },
    visual: { vines: 1 },
  },
  {
    id: 'garden_vine',
    name: 'Garden Vine',
    category: 'vine',
    description: '+15% Range, +15% Attack Speed',
    rarity: 'common',
    biome: 'garden',
    stats: { rangeMult: 0.15, attackSpeedMult: 0.15 },
    visual: { vines: 1 },
  },
  {
    id: 'flexible_stem',
    name: 'Flexible Stem',
    category: 'vine',
    description: '+8% Range, +8% Attack Speed',
    rarity: 'common',
    stats: { rangeMult: 0.08, attackSpeedMult: 0.08 },
    visual: { vines: 1 },
  },
  {
    id: 'snaking_growth',
    name: 'Snaking Growth',
    category: 'vine',
    description: '+2 Attack, +1 target',
    rarity: 'common',
    stats: { attack: 2, extraTargets: 1 },
    visual: { vines: 1 },
  },

  // Uncommon (7)
  {
    id: 'strangling_tendrils',
    name: 'Strangling Tendrils',
    category: 'vine',
    description: '+2 targets',
    rarity: 'uncommon',
    stats: { extraTargets: 2 },
    visual: { vines: 2 },
  },
  {
    id: 'wind_current',
    name: 'Wind Current',
    category: 'vine',
    description: '+30% Range, +25% Attack Speed',
    rarity: 'uncommon',
    biome: 'canopy',
    stats: { rangeMult: 0.30, attackSpeedMult: 0.25 },
    visual: { vines: 2, color: 0x88CCFF },
  },
  {
    id: 'grasping_roots',
    name: 'Grasping Roots',
    category: 'vine',
    description: 'Snare enemies on hit (40% slow for 1s), +5 Attack',
    rarity: 'uncommon',
    stats: { attack: 5, onHitSlow: 0.40, onHitSlowDuration: 1000 },
    visual: { vines: 1, roots: 1 },
  },
  {
    id: 'rapid_fire',
    name: 'Rapid Fire',
    category: 'vine',
    description: '+40% Attack Speed, -3 Attack',
    rarity: 'uncommon',
    stats: { attackSpeedMult: 0.40, attack: -3 },
    visual: { vines: 2 },
  },
  {
    id: 'keen_vine',
    name: 'Keen Vine',
    category: 'vine',
    description: '+15% Accuracy, +15% Range',
    rarity: 'uncommon',
    stats: { accuracy: 0.15, rangeMult: 0.15 },
    visual: { vines: 2, color: 0x44CC44 },
  },
  {
    id: 'canopy_reach',
    name: 'Canopy Reach',
    category: 'vine',
    description: '+50% Range, +20% vs flying, +10% Accuracy',
    rarity: 'uncommon',
    biome: 'canopy',
    stats: { rangeMult: 0.50, flyingDamageBonus: 0.20, accuracy: 0.10 },
    visual: { vines: 2, color: 0x88CC44 },
  },
  {
    id: 'spreading_roots',
    name: 'Spreading Roots',
    category: 'vine',
    description: '+2 targets, -10% Attack Speed',
    rarity: 'uncommon',
    stats: { extraTargets: 2, attackSpeedMult: -0.10 },
    visual: { vines: 2 },
  },

  // Rare (5)
  {
    id: 'whipvine',
    name: 'Whipvine',
    category: 'vine',
    description: '+40% Range, +20% Attack Speed',
    rarity: 'rare',
    stats: { rangeMult: 0.40, attackSpeedMult: 0.20 },
    visual: { vines: 2, signature: 'whip_trail' },
  },
  {
    id: 'lightning_lash',
    name: 'Lightning Lash',
    category: 'vine',
    description: 'Lightning type, +30% Attack Speed, chains 2',
    rarity: 'rare',
    biome: 'canopy',
    stats: { damageType: 'lightning', attackSpeedMult: 0.30, lightningChains: 2 },
    visual: { vines: 2, color: 0xFFFF44, signature: 'electric_arcs' },
  },
  {
    id: 'omni_strike',
    name: 'Omni Strike',
    category: 'vine',
    description: '+3 targets, +15% Range',
    rarity: 'rare',
    stats: { extraTargets: 3, rangeMult: 0.15 },
    visual: { vines: 3, signature: 'multi_target' },
  },
  {
    id: 'blitz_vine',
    name: 'Blitz Vine',
    category: 'vine',
    description: '+40% Attack Speed, pierce through first target',
    rarity: 'rare',
    stats: { attackSpeedMult: 0.40, projectilePierce: true },
    visual: { vines: 3, color: 0x44CCFF, signature: 'speed_lines' },
  },
  {
    id: 'entangling_canopy',
    name: 'Entangling Canopy',
    category: 'vine',
    description: '+35% Range, hit enemies rooted 1s',
    rarity: 'rare',
    biome: 'canopy',
    stats: { rangeMult: 0.35, rootOnHitDuration: 1000 },
    visual: { vines: 3, color: 0x228844, signature: 'entangle_web' },
  },

  // Legendary (3)
  {
    id: 'thousand_lash',
    name: 'Thousand Lash',
    category: 'vine',
    description: '+5 targets, +50% Range, +30% Attack Speed at 80% per extra',
    rarity: 'legendary',
    stats: { extraTargets: 5, rangeMult: 0.50, attackSpeedMult: 0.30, extraTargetDamageFalloff: 0.80 },
    visual: { vines: 4, color: 0xFF44FF, signature: 'lash_storm' },
  },
  {
    id: 'dimensional_reach',
    name: 'Dimensional Reach',
    category: 'vine',
    description: 'No range limit, +20% Attack Speed, every 5th hit knocks back farthest enemy',
    rarity: 'legendary',
    stats: { noRangeLimit: true, attackSpeedMult: 0.20, knockbackEveryN: 5 },
    visual: { vines: 4, color: 0xCC88FF, signature: 'dimension_rift' },
  },
  {
    id: 'the_overgrowth',
    name: 'The Overgrowth',
    category: 'vine',
    description: 'Every 8s all enemies take 50% attack hit, +25% Range',
    rarity: 'legendary',
    stats: { overgrowthWaveInterval: 8000, overgrowthWaveDamageMult: 0.50, rangeMult: 0.25 },
    visual: { vines: 4, color: 0x22CC22, signature: 'overgrowth_wave' },
  },
];

// ── Rarity Config ───────────────────────────────────────────────────

export const RARITY_COLORS = {
  common: 0xAAAAAA,
  uncommon: 0x44CC44,
  rare: 0xFFAA22,
  legendary: 0xFF44FF,
};

export const RARITY_WEIGHTS = {
  common: 50,
  uncommon: 30,
  rare: 15,
  legendary: 5,
};

// Normal waves: common/uncommon only, rare is a treat
export const NORMAL_RARITY_WEIGHTS = {
  common: 55,
  uncommon: 35,
  rare: 10,
  legendary: 0,
};

// Boss rewards: guaranteed upgrade, but legendary is still special
export const BOSS_RARITY_WEIGHTS = {
  common: 0,
  uncommon: 40,
  rare: 52,
  legendary: 8,
};

export const CATEGORY_COLORS = {
  root: 0x8B4513,
  thorn: 0xCC2222,
  spore: 0x9944CC,
  bloom: 0xFF69B4,
  vine: 0x228B22,
};

// ── Weighted Random Selection ───────────────────────────────────────

export function getRandomTraits(count, excludeIds = [], biomeId = null, isBossReward = false) {
  let available = TRAIT_POOL.filter(t => !excludeIds.includes(t.id));

  // Filter out biome-locked traits from other biomes
  available = available.filter(t => {
    if (!t.biome) return true; // non-biome traits always available
    return t.biome === biomeId; // biome traits only in their biome
  });

  // Use different rarity weights for boss rewards vs normal waves
  const rarityWeights = isBossReward ? BOSS_RARITY_WEIGHTS : NORMAL_RARITY_WEIGHTS;

  // Build weighted pool
  const weighted = available.map(t => {
    let weight = rarityWeights[t.rarity] || 0;
    // Biome-themed traits get +50% weight in their home biome
    if (t.biome && t.biome === biomeId) {
      weight = Math.floor(weight * 1.5);
    }
    return { trait: t, weight };
  }).filter(item => item.weight > 0);

  // Weighted random selection without replacement
  const selected = [];
  const pool = [...weighted];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen = 0;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight;
      if (roll <= 0) {
        chosen = j;
        break;
      }
    }
    selected.push(pool[chosen].trait);
    pool.splice(chosen, 1);
  }

  return selected;
}

// ═══════════════════════════════════════════════════════════════════
// Category Mutation Profiles — how each category transforms the body
// ═══════════════════════════════════════════════════════════════════

export const CATEGORY_MUTATIONS = {
  root: {
    bodyScalePerCount: 0.02,
    bodyWidthBiasPerCount: 0.015,
    barkTextureThreshold: 3,
    eyeStyles: { 2: 'determined', 4: 'stoic', 5: 'ancient' },
    leafStyle: 'thick',
  },
  thorn: {
    bodyAngularityPerCount: 0.08,
    bodyScalePerCount: 0.005,
    bodyRidgesThreshold: 2,
    redGlowThreshold: 5,
    eyeStyles: { 2: 'sharp', 4: 'menacing', 5: 'fierce' },
    leafStyle: 'serrated',
  },
  bloom: {
    bodyRoundnessPerCount: 0.03,
    bodyBrightnessPerCount: 8,
    integratedFlowersThreshold: 3,
    shimmerThreshold: 2,
    eyeStyles: { 2: 'large', 3: 'gentle', 4: 'expressive' },
    leafStyle: 'petals',
  },
  spore: {
    bodyAlphaPerCount: -0.04,
    particleDotsThreshold: 2,
    mistThreshold: 2,
    cloudBodyThreshold: 6,
    eyeStyles: { 2: 'mystical', 4: 'dreamy', 5: 'ethereal' },
    leafStyle: 'wispy',
  },
  vine: {
    bodyElongationPerCount: 0.02,
    bodyScalePerCount: 0.01,
    windingPatternsThreshold: 3,
    vineArmorThreshold: 5,
    eyeStyles: { 2: 'keen', 4: 'focused', 5: 'predatory' },
    leafStyle: 'tendril',
  },
};
