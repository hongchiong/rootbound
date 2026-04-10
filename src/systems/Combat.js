import Phaser from 'phaser';

// ── Damage Types (10 types) ─────────────────────────────────────────

export const DAMAGE_TYPES = {
  normal: {
    id: 'normal',
    name: 'Normal',
    color: '#FFFFFF',
    description: 'Standard damage, reduced by armor',
    armorPenetration: 0,
    magicPenetration: 0,
    isPhysical: true,
    onHit: null,
  },
  blunt: {
    id: 'blunt',
    name: 'Blunt',
    color: '#CCAA66',
    description: 'Bonus damage vs armored targets (+50% of target armor as extra damage)',
    armorPenetration: 0,
    magicPenetration: 0,
    isPhysical: true,
    bonusVsArmor: 0.5,
    onHit: null,
  },
  pierce: {
    id: 'pierce',
    name: 'Pierce',
    color: '#88DDFF',
    description: 'Ignores 80% of physical armor',
    armorPenetration: 0.8,
    magicPenetration: 0,
    isPhysical: true,
    onHit: null,
  },
  slash: {
    id: 'slash',
    name: 'Slash',
    color: '#FF6644',
    description: 'Applies stacking bleed DoT (15% hit damage/s for 3s)',
    armorPenetration: 0,
    magicPenetration: 0,
    isPhysical: true,
    onHit: 'applyBleed',
  },
  fire: {
    id: 'fire',
    name: 'Fire',
    color: '#FF6622',
    description: 'Burn DoT (8% hit/s for 4s), spreads on kill',
    armorPenetration: 0,
    magicPenetration: 0,
    isPhysical: false,
    onHit: 'applyBurn',
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    color: '#AADDFF',
    description: 'Slows 40% briefly; 3 frost hits = Frozen stun 1.5s',
    armorPenetration: 0,
    magicPenetration: 0,
    isPhysical: false,
    onHit: 'applyFrost',
  },
  poison: {
    id: 'poison',
    name: 'Poison',
    color: '#88FF44',
    description: 'Ramping DoT: 5% hit/s, doubles each second for 4s; ignores magic resist',
    armorPenetration: 0,
    magicPenetration: 1.0,
    isPhysical: false,
    onHit: 'applyPoison',
  },
  lightning: {
    id: 'lightning',
    name: 'Lightning',
    color: '#FFFF44',
    description: 'Chains to 2 nearby enemies at 60% damage',
    armorPenetration: 0.3,
    magicPenetration: 0,
    isPhysical: false,
    onHit: 'chainLightning',
  },
  void: {
    id: 'void',
    name: 'Void',
    color: '#CC88FF',
    description: 'Bypasses 60% of all defenses; suppresses regen 3s',
    armorPenetration: 0.6,
    magicPenetration: 0.6,
    isPhysical: false,
    onHit: 'suppressRegen',
  },
  nature: {
    id: 'nature',
    name: 'Nature',
    color: '#44CC44',
    description: 'Heals attacker for 15% of damage dealt',
    armorPenetration: 0,
    magicPenetration: 0,
    isPhysical: false,
    onHit: 'lifeSteal',
  },
};

// Damage type priority for primary/secondary selection
const DAMAGE_TYPE_PRIORITY = ['void', 'pierce', 'lightning', 'frost', 'fire', 'poison', 'slash', 'blunt', 'nature', 'normal'];

// ── Stat Computation ─────────────────────────────────────────────────

export function computeStats(baseStats, traits, setBonuses = null, synergies = null) {
  const stats = { ...baseStats };

  // Phase 1: Base trait stat accumulation
  const collectedDamageTypes = [];

  for (const trait of traits) {
    const s = trait.stats;
    if (s.maxHp) stats.maxHp += s.maxHp;
    if (s.hpRegen) stats.hpRegen += s.hpRegen;
    if (s.attack) stats.attack += s.attack;
    if (s.armor) stats.armor += s.armor;
    if (s.magicResist) stats.magicResist = (stats.magicResist || 0) + s.magicResist;
    if (s.critChance) stats.critChance += s.critChance;
    if (s.critMultiplier) stats.critMultiplier = (stats.critMultiplier || 0) + s.critMultiplier;
    if (s.thornDamage) stats.thornDamage += s.thornDamage;
    if (s.damageReduction) stats.damageReduction = (stats.damageReduction || 0) + s.damageReduction;
    if (s.poisonDamage) stats.poisonDamage = (stats.poisonDamage || 0) + s.poisonDamage;
    if (s.poisonDuration) stats.poisonDuration = Math.max(stats.poisonDuration || 0, s.poisonDuration);
    if (s.sporeDamage) stats.sporeDamage = (stats.sporeDamage || 0) + s.sporeDamage;
    if (s.sporeInterval) stats.sporeInterval = Math.min(stats.sporeInterval || Infinity, s.sporeInterval);
    if (s.sporeSlow) stats.sporeSlow = (stats.sporeSlow || 0) + s.sporeSlow;
    if (s.sporeRadiusMult) stats.sporeRadiusMult = (stats.sporeRadiusMult || 0) + s.sporeRadiusMult;
    if (s.healOnKill) stats.healOnKill = (stats.healOnKill || 0) + s.healOnKill;
    if (s.attackSpeedMult) stats.attackSpeedMult = (stats.attackSpeedMult || 0) + s.attackSpeedMult;
    if (s.rangeMult) stats.rangeMult = (stats.rangeMult || 0) + s.rangeMult;
    if (s.extraTargets) stats.extraTargets = (stats.extraTargets || 0) + s.extraTargets;
    if (s.knockbackStrength) stats.knockbackStrength = (stats.knockbackStrength || 0) + s.knockbackStrength;
    if (s.knockbackEveryN) stats.knockbackEveryN = s.knockbackEveryN;
    if (s.rootOnHitDuration) stats.rootOnHitDuration = Math.max(stats.rootOnHitDuration || 0, s.rootOnHitDuration);
    if (s.onHitSlow) stats.onHitSlow = Math.max(stats.onHitSlow || 0, s.onHitSlow);
    if (s.onHitSlowDuration) stats.onHitSlowDuration = Math.max(stats.onHitSlowDuration || 0, s.onHitSlowDuration);
    if (s.debuffResist) stats.debuffResist = (stats.debuffResist || 0) + s.debuffResist;
    if (s.hpRegenPerBloom) stats.hpRegenPerBloom = (stats.hpRegenPerBloom || 0) + s.hpRegenPerBloom;
    if (s.explosiveSplash) stats.explosiveSplash = (stats.explosiveSplash || 0) + s.explosiveSplash;
    if (s.frostSlowDuration) stats.frostSlowDuration = Math.max(stats.frostSlowDuration || 0, s.frostSlowDuration);
    if (s.bleedDuration) stats.bleedDuration = Math.max(stats.bleedDuration || 0, s.bleedDuration);
    if (s.percentRegen) stats.percentRegen = (stats.percentRegen || 0) + s.percentRegen;
    if (s.healingBonus) stats.healingBonus = (stats.healingBonus || 0) + s.healingBonus;
    if (s.lifeSteal) stats.lifeSteal = (stats.lifeSteal || 0) + s.lifeSteal;
    if (s.doubleStrikeChance) stats.doubleStrikeChance = (stats.doubleStrikeChance || 0) + s.doubleStrikeChance;
    if (s.flyingDamageBonus) stats.flyingDamageBonus = (stats.flyingDamageBonus || 0) + s.flyingDamageBonus;
    if (s.sporeDeathPulse) stats.sporeDeathPulse = (stats.sporeDeathPulse || 0) + s.sporeDeathPulse;
    if (s.sporeArmorReduce) stats.sporeArmorReduce = (stats.sporeArmorReduce || 0) + s.sporeArmorReduce;
    if (s.enemyAttackReduce) stats.enemyAttackReduce = (stats.enemyAttackReduce || 0) + s.enemyAttackReduce;
    if (s.enemyDamageReduce) stats.enemyDamageReduce = (stats.enemyDamageReduce || 0) + s.enemyDamageReduce;
    if (s.sporeChainTargets) stats.sporeChainTargets = (stats.sporeChainTargets || 0) + s.sporeChainTargets;
    if (s.sporePersistDuration) stats.sporePersistDuration = Math.max(stats.sporePersistDuration || 0, s.sporePersistDuration);
    // sporeStrikeCount removed — always exactly 1 strike per volley
    if (s.sporePersistDamage) stats.sporePersistDamage = (stats.sporePersistDamage || 0) + s.sporePersistDamage;
    if (s.sporePull) stats.sporePull = (stats.sporePull || 0) + s.sporePull;
    if (s.sporeConfuse) stats.sporeConfuse = Math.max(stats.sporeConfuse || 0, s.sporeConfuse);
    if (s.sporeTargetBias) stats.sporeTargetBias = Math.max(stats.sporeTargetBias || 0, s.sporeTargetBias);
    if (s.sporeBurnDps) stats.sporeBurnDps = (stats.sporeBurnDps || 0) + s.sporeBurnDps;
    if (s.sporePoisonDps) stats.sporePoisonDps = (stats.sporePoisonDps || 0) + s.sporePoisonDps;
    if (s.sporeSuppressRegen) stats.sporeSuppressRegen = true;
    if (s.projectilePierce) stats.projectilePierce = true;
    if (s.accuracy) stats.accuracy = (stats.accuracy || 1.0) + s.accuracy;
    if (s.noRangeLimit) stats.noRangeLimit = true;
    if (s.onHitHealChance) stats.onHitHealChance = (stats.onHitHealChance || 0) + s.onHitHealChance;
    if (s.onHitHealAmount) stats.onHitHealAmount = (stats.onHitHealAmount || 0) + s.onHitHealAmount;
    if (s.vampiricPercent) stats.vampiricPercent = (stats.vampiricPercent || 0) + s.vampiricPercent;
    if (s.regenMultiplier) stats.regenMultiplier = (stats.regenMultiplier || 0) + s.regenMultiplier;
    if (s.phoenixRevive) stats.phoenixRevive = Math.max(stats.phoenixRevive || 0, s.phoenixRevive);
    if (s.sporeDamageMult) stats.sporeDamageMult = (stats.sporeDamageMult || 0) + s.sporeDamageMult;
    if (s.sporeIntervalReduction) stats.sporeIntervalReduction = (stats.sporeIntervalReduction || 0) + s.sporeIntervalReduction;
    if (s.armorPenResist) stats.armorPenResist = (stats.armorPenResist || 0) + s.armorPenResist;
    if (s.armorPerTraits) stats.armorPerTraits = s.armorPerTraits;
    if (s.regenPerCategory) stats.regenPerCategory = (stats.regenPerCategory || 0) + s.regenPerCategory;
    if (s.bossRegenDouble) stats.bossRegenDouble = true;
    if (s.onHitHealPercent) stats.onHitHealPercent = (stats.onHitHealPercent || 0) + s.onHitHealPercent;
    if (s.healOnKillPercent) stats.healOnKillPercent = (stats.healOnKillPercent || 0) + s.healOnKillPercent;
    if (s.doubleHealOnKill) stats.doubleHealOnKill = true;
    if (s.bleedArmorReduce) stats.bleedArmorReduce = (stats.bleedArmorReduce || 0) + s.bleedArmorReduce;
    if (s.bleedMissingHpScale) stats.bleedMissingHpScale = true;
    if (s.lightningChains) stats.lightningChains = (stats.lightningChains || 0) + s.lightningChains;
    if (s.critApplyAllDots) stats.critApplyAllDots = true;
    if (s.prismaticCycle) stats.prismaticCycle = true;
    if (s.extraTargetDamageFalloff) stats.extraTargetDamageFalloff = s.extraTargetDamageFalloff;

    // Collect attack damage types — spore damage types are tracked separately
    // so spore traits don't change the player's primary/secondary attack type
    if (s.damageType && s.damageType !== 'normal') {
      collectedDamageTypes.push(s.damageType);
    }
  }

  // Count blooms for scaling
  if (stats.hpRegenPerBloom) {
    let bloomCount = 0;
    for (const t of traits) {
      if (t.visual && t.visual.blooms) bloomCount += t.visual.blooms;
    }
    stats.hpRegen += stats.hpRegenPerBloom * bloomCount;
  }

  // Living Armor: +1 armor per N traits grafted
  if (stats.armorPerTraits) {
    stats.armor += Math.floor(traits.length / stats.armorPerTraits);
  }

  // Root Network: +regen per unique graft category
  if (stats.regenPerCategory) {
    const uniqueCategories = new Set(traits.map(t => t.category));
    stats.hpRegen += stats.regenPerCategory * uniqueCategories.size;
  }

  // Phase 2: Set bonus application
  if (setBonuses) {
    const categoryCounts = { root: 0, thorn: 0, spore: 0, bloom: 0, vine: 0 };
    for (const trait of traits) {
      if (categoryCounts[trait.category] !== undefined) {
        categoryCounts[trait.category]++;
      }
    }
    stats.categoryCounts = categoryCounts;

    for (const [category, count] of Object.entries(categoryCounts)) {
      const bonuses = setBonuses[category];
      if (!bonuses) continue;
      for (const threshold of [2, 3, 5]) {
        if (count >= threshold && bonuses[threshold]) {
          applyBonusStats(stats, bonuses[threshold].stats);
        }
      }
    }
  }

  // Phase 3: Synergy application (effects stored as flags)
  if (synergies && synergies.length > 0) {
    stats.activeSynergies = {};
    for (const syn of synergies) {
      stats.activeSynergies[syn.id] = syn.effect;
      // Apply stat-based synergy effects
      if (syn.effect.stats) {
        applyBonusStats(stats, syn.effect.stats);
      }
    }
  }

  // Phase 4: Derived stats

  // Primary/Secondary damage type
  const uniqueTypes = [...new Set(collectedDamageTypes)];
  uniqueTypes.sort((a, b) => DAMAGE_TYPE_PRIORITY.indexOf(a) - DAMAGE_TYPE_PRIORITY.indexOf(b));
  stats.primaryDamageType = uniqueTypes[0] || 'normal';
  stats.secondaryDamageType = uniqueTypes[1] || null;
  stats.damageType = stats.primaryDamageType; // backwards compat
  stats.allDamageTypes = uniqueTypes;

  // Apply regen multiplier (capped at x3 to prevent unkillable builds)
  if (stats.regenMultiplier) {
    const cappedMult = Math.min(stats.regenMultiplier, 2.5);
    stats.hpRegen = Math.floor(stats.hpRegen * (1 + cappedMult));
  }

  // Attack speed & range
  // Diminishing returns on attack speed: low investment feels similar, heavy stacking still helps but doesn't trivially hit floor
  const rawAsMult = stats.attackSpeedMult || 0;
  const effectiveAsMult = rawAsMult > 0 ? rawAsMult / (rawAsMult + 0.6) : rawAsMult;
  stats.effectiveAttackSpeed = stats.attackSpeed * (1 - effectiveAsMult);
  stats.effectiveAttackSpeed = Math.max(stats.effectiveAttackSpeed, 250);
  stats.effectiveRange = stats.noRangeLimit ? 9999 : stats.attackRange * (1 + (stats.rangeMult || 0));

  // Final crit multiplier (base 1.8 + bonuses)
  stats.finalCritMultiplier = 1.8 + (stats.critMultiplier || 0);

  // Percent regen (added to flat regen as HP/s)
  if (stats.percentRegen) {
    stats.hpRegen += Math.floor(stats.maxHp * stats.percentRegen);
  }

  // Spore interval reduction from set bonuses
  if (stats.sporeIntervalReduction && stats.sporeInterval) {
    stats.sporeInterval = Math.max(500, stats.sporeInterval - stats.sporeIntervalReduction);
  }

  // Spore damage multiplier from set bonuses
  if (stats.sporeDamageMult && stats.sporeDamage) {
    stats.sporeDamage = Math.floor(stats.sporeDamage * (1 + stats.sporeDamageMult));
  }

  // Spore strike radius (base 60px per strike, smaller since strikes target enemies directly)
  stats.effectiveSporeStrikeRadius = 60 * (1 + (stats.sporeRadiusMult || 0));
  stats.effectiveSporeRadius = stats.effectiveSporeStrikeRadius; // backward compat
  stats.effectiveSporeStrikeCount = 1; // hardcoded — always 1 strike per volley

  return stats;
}

function applyBonusStats(stats, bonusStats) {
  for (const [key, value] of Object.entries(bonusStats)) {
    if (typeof value === 'boolean') {
      stats[key] = value;
    } else if (typeof value === 'number') {
      stats[key] = (stats[key] || 0) + value;
    }
  }
}

// ── Damage Calculation (data-driven) ────────────────────────────────

export function calculateDamage(attackerStats, defenderStats = {}, damageTypeOverride = null) {
  const dtId = damageTypeOverride || attackerStats.damageType || 'normal';
  const dtype = DAMAGE_TYPES[dtId] || DAMAGE_TYPES.normal;
  let damage = attackerStats.attack;
  const armor = defenderStats.armor || 0;
  const magicResist = defenderStats.magicResist || 0;

  // Check immunities — immune targets still take base physical damage, but the
  // elemental effect (DoT, chain, heal, etc.) is suppressed.  We fall back to
  // 'normal' type so armor applies fully and no on-hit trigger fires.
  let immuneToType = false;
  if (defenderStats.immunities && defenderStats.immunities.includes(dtId)) {
    immuneToType = true;
  }

  // Dodge check: dodgeRate reduced by attacker accuracy above 1.0
  const dodgeRate = defenderStats.dodgeRate || 0;
  const accuracy = attackerStats.accuracy || 1.0;
  const effectiveDodge = Math.max(0, dodgeRate - (accuracy - 1.0));
  if (effectiveDodge > 0 && Math.random() < effectiveDodge) {
    return { damage: 0, isCrit: false, damageType: dtId, evaded: true, immune: false, onHit: null };
  }

  // When immune, fall back to normal-type damage calculation (full armor, no
  // penetration bonuses, no on-hit effects) so the hit still lands.
  const effectiveType = immuneToType ? DAMAGE_TYPES.normal : dtype;

  // Physical armor reduction (armorPenResist reduces enemy penetration effectiveness)
  const penResist = defenderStats.armorPenResist || 0;
  if (effectiveType.isPhysical) {
    const reducedPen = Math.max(0, effectiveType.armorPenetration - penResist * 0.01);
    const effectiveArmor = armor * (1 - reducedPen);
    damage -= effectiveArmor;
  } else {
    // Magic types: apply both armor pen and magic pen
    const reducedPen = Math.max(0, effectiveType.armorPenetration - penResist * 0.01);
    const effectiveArmor = armor * (1 - reducedPen);
    const effectiveMR = magicResist * (1 - (effectiveType.magicPenetration || 0));
    damage -= effectiveArmor;
    damage -= effectiveMR;
  }

  // Blunt bonus vs armor
  if (effectiveType.bonusVsArmor) {
    damage += Math.floor(armor * effectiveType.bonusVsArmor);
  }

  // Per-type resistance multiplier (skip if immune — already penalized by losing penetration)
  if (!immuneToType && defenderStats.resistances && defenderStats.resistances[dtId] !== undefined) {
    damage = Math.floor(damage * defenderStats.resistances[dtId]);
  }

  damage = Math.max(1, Math.floor(damage));

  // Crit
  const isCrit = Math.random() < (attackerStats.critChance || 0);
  if (isCrit) {
    damage = Math.floor(damage * (attackerStats.finalCritMultiplier || 1.8));
  }

  // Damage reduction (multiplicative, from legendaries/set bonuses — for defender)
  if (defenderStats.damageReduction) {
    damage = Math.max(1, Math.floor(damage * (1 - defenderStats.damageReduction)));
  }

  return { damage, isCrit, damageType: dtId, evaded: false, immune: immuneToType, onHit: immuneToType ? null : dtype.onHit };
}

// Returns the display color for a damage type
export function getDamageTypeColor(damageType) {
  return DAMAGE_TYPES[damageType]?.color || '#FFFFFF';
}

// ── Synergy Detection ───────────────────────────────────────────────

export function computeActiveSynergies(traits, synergyDefs) {
  if (!synergyDefs || synergyDefs.length === 0) return [];

  const categoryCounts = { root: 0, thorn: 0, spore: 0, bloom: 0, vine: 0 };
  const ownedDamageTypes = new Set();
  const ownedStats = new Set();

  for (const t of traits) {
    if (categoryCounts[t.category] !== undefined) {
      categoryCounts[t.category]++;
    }
    if (t.stats) {
      for (const key of Object.keys(t.stats)) {
        ownedStats.add(key);
        if (key === 'damageType' && t.stats.damageType !== 'normal') {
          ownedDamageTypes.add(t.stats.damageType);
        }
      }
    }
  }

  return synergyDefs.filter(syn => {
    const req = syn.requires;
    if (req.categories) {
      for (const [cat, min] of Object.entries(req.categories)) {
        if ((categoryCounts[cat] || 0) < min) return false;
      }
    }
    if (req.damageTypes) {
      for (const dt of req.damageTypes) {
        if (!ownedDamageTypes.has(dt)) return false;
      }
    }
    if (req.stats) {
      for (const s of req.stats) {
        if (!ownedStats.has(s)) return false;
      }
    }
    if (req.uniqueDamageTypes) {
      if (ownedDamageTypes.size < req.uniqueDamageTypes) return false;
    }
    return true;
  });
}
