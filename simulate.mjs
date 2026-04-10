#!/usr/bin/env node
// Rootbound Balance Simulation
// Runs automated playtests to identify balance issues
// Usage: node simulate.mjs [--strategy <name>] [--runs <n>] [--verbose] [--trait-analysis] [--wave-analysis]

import { ENEMY_TYPES, BIOME_BOSSES } from './src/data/enemies.js';
import { TRAIT_POOL, RARITY_WEIGHTS, NORMAL_RARITY_WEIGHTS, BOSS_RARITY_WEIGHTS, getRandomTraits } from './src/data/traits.js';
import { SET_BONUSES } from './src/data/setBonuses.js';
import { BIOMES, buildBiomeSequence, getBiomeWave, getDifficultyScale, getBossDifficultyScale } from './src/data/biomes.js';
import { SYNERGY_DEFS } from './src/data/synergies.js';

// ── Combat functions (copied from Combat.js, minus Phaser import) ────

const DAMAGE_TYPES = {
  normal: { id: 'normal', armorPenetration: 0, magicPenetration: 0, isPhysical: true, onHit: null },
  blunt: { id: 'blunt', armorPenetration: 0, magicPenetration: 0, isPhysical: true, bonusVsArmor: 0.5, onHit: null },
  pierce: { id: 'pierce', armorPenetration: 0.8, magicPenetration: 0, isPhysical: true, onHit: null },
  slash: { id: 'slash', armorPenetration: 0, magicPenetration: 0, isPhysical: true, onHit: 'applyBleed' },
  fire: { id: 'fire', armorPenetration: 0, magicPenetration: 0, isPhysical: false, onHit: 'applyBurn' },
  frost: { id: 'frost', armorPenetration: 0, magicPenetration: 0, isPhysical: false, onHit: 'applyFrost' },
  poison: { id: 'poison', armorPenetration: 0, magicPenetration: 1.0, isPhysical: false, onHit: 'applyPoison' },
  lightning: { id: 'lightning', armorPenetration: 0.3, magicPenetration: 0, isPhysical: false, onHit: 'chainLightning' },
  void: { id: 'void', armorPenetration: 0.6, magicPenetration: 0.6, isPhysical: false, onHit: 'suppressRegen' },
  nature: { id: 'nature', armorPenetration: 0, magicPenetration: 0, isPhysical: false, onHit: 'lifeSteal' },
};

const DAMAGE_TYPE_PRIORITY = ['void', 'pierce', 'lightning', 'frost', 'fire', 'poison', 'slash', 'blunt', 'nature', 'normal'];

function computeStats(baseStats, traits, setBonuses = null, synergies = null) {
  const stats = { ...baseStats };
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
    if (s.sporeDamage) stats.sporeDamage = (stats.sporeDamage || 0) + s.sporeDamage;
    if (s.sporeInterval) stats.sporeInterval = Math.min(stats.sporeInterval || Infinity, s.sporeInterval);
    if (s.sporeSlow) stats.sporeSlow = (stats.sporeSlow || 0) + s.sporeSlow;
    if (s.sporeRadiusMult) stats.sporeRadiusMult = (stats.sporeRadiusMult || 0) + s.sporeRadiusMult;
    if (s.healOnKill) stats.healOnKill = (stats.healOnKill || 0) + s.healOnKill;
    if (s.attackSpeedMult) stats.attackSpeedMult = (stats.attackSpeedMult || 0) + s.attackSpeedMult;
    if (s.rangeMult) stats.rangeMult = (stats.rangeMult || 0) + s.rangeMult;
    if (s.extraTargets) stats.extraTargets = (stats.extraTargets || 0) + s.extraTargets;
    if (s.doubleStrikeChance) stats.doubleStrikeChance = (stats.doubleStrikeChance || 0) + s.doubleStrikeChance;
    if (s.lifeSteal) stats.lifeSteal = (stats.lifeSteal || 0) + s.lifeSteal;
    if (s.vampiricPercent) stats.vampiricPercent = (stats.vampiricPercent || 0) + s.vampiricPercent;
    if (s.regenMultiplier) stats.regenMultiplier = (stats.regenMultiplier || 0) + s.regenMultiplier;
    if (s.percentRegen) stats.percentRegen = (stats.percentRegen || 0) + s.percentRegen;
    if (s.healingBonus) stats.healingBonus = (stats.healingBonus || 0) + s.healingBonus;
    if (s.accuracy) stats.accuracy = (stats.accuracy || 1.0) + s.accuracy;
    if (s.enemyDamageReduce) stats.enemyDamageReduce = (stats.enemyDamageReduce || 0) + s.enemyDamageReduce;
    if (s.enemyAttackReduce) stats.enemyAttackReduce = (stats.enemyAttackReduce || 0) + s.enemyAttackReduce;
    if (s.sporeDamageMult) stats.sporeDamageMult = (stats.sporeDamageMult || 0) + s.sporeDamageMult;
    if (s.sporeIntervalReduction) stats.sporeIntervalReduction = (stats.sporeIntervalReduction || 0) + s.sporeIntervalReduction;
    if (s.sporeArmorReduce) stats.sporeArmorReduce = (stats.sporeArmorReduce || 0) + s.sporeArmorReduce;
    if (s.sporeDeathPulse) stats.sporeDeathPulse = (stats.sporeDeathPulse || 0) + s.sporeDeathPulse;
    if (s.sporeBurnDps) stats.sporeBurnDps = (stats.sporeBurnDps || 0) + s.sporeBurnDps;
    if (s.sporePoisonDps) stats.sporePoisonDps = (stats.sporePoisonDps || 0) + s.sporePoisonDps;
    if (s.phoenixRevive) stats.phoenixRevive = Math.max(stats.phoenixRevive || 0, s.phoenixRevive);
    if (s.onHitHealChance) stats.onHitHealChance = (stats.onHitHealChance || 0) + s.onHitHealChance;
    if (s.onHitHealAmount) stats.onHitHealAmount = (stats.onHitHealAmount || 0) + s.onHitHealAmount;
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
    if (s.flyingDamageBonus) stats.flyingDamageBonus = (stats.flyingDamageBonus || 0) + s.flyingDamageBonus;
    if (s.projectilePierce) stats.projectilePierce = true;
    if (s.noRangeLimit) stats.noRangeLimit = true;
    if (s.drainAuraDps) stats.drainAuraDps = (stats.drainAuraDps || 0) + s.drainAuraDps;
    if (s.drainAuraHealPercent) stats.drainAuraHealPercent = (stats.drainAuraHealPercent || 0) + s.drainAuraHealPercent;
    if (s.secondWindHeal) stats.secondWindHeal = s.secondWindHeal;
    if (s.secondWindThreshold) stats.secondWindThreshold = s.secondWindThreshold;
    if (s.soulReaverStacking) stats.soulReaverStacking = s.soulReaverStacking;
    if (s.soulReaverMax) stats.soulReaverMax = s.soulReaverMax;
    if (s.nuclearBloomDamage) stats.nuclearBloomDamage = s.nuclearBloomDamage;
    if (s.nuclearBloomInterval) stats.nuclearBloomInterval = s.nuclearBloomInterval;
    if (s.overgrowthWaveInterval) stats.overgrowthWaveInterval = s.overgrowthWaveInterval;
    if (s.overgrowthWaveDamageMult) stats.overgrowthWaveDamageMult = s.overgrowthWaveDamageMult;

    if (s.damageType && s.damageType !== 'normal') {
      collectedDamageTypes.push(s.damageType);
    }
  }

  // Bloom scaling from visual blooms
  if (stats.hpRegenPerBloom) {
    let bloomCount = 0;
    for (const t of traits) {
      if (t.visual && t.visual.blooms) bloomCount += t.visual.blooms;
    }
    stats.hpRegen += (stats.hpRegenPerBloom || 0) * bloomCount;
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

  // Set bonuses
  if (setBonuses) {
    const categoryCounts = { root: 0, thorn: 0, spore: 0, bloom: 0, vine: 0 };
    for (const trait of traits) {
      if (categoryCounts[trait.category] !== undefined) categoryCounts[trait.category]++;
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

  // Synergies
  if (synergies && synergies.length > 0) {
    stats.activeSynergies = {};
    for (const syn of synergies) {
      stats.activeSynergies[syn.id] = syn.effect;
      if (syn.effect.stats) applyBonusStats(stats, syn.effect.stats);
    }
  }

  // Derived stats
  const uniqueTypes = [...new Set(collectedDamageTypes)];
  uniqueTypes.sort((a, b) => DAMAGE_TYPE_PRIORITY.indexOf(a) - DAMAGE_TYPE_PRIORITY.indexOf(b));
  stats.primaryDamageType = uniqueTypes[0] || 'normal';
  stats.secondaryDamageType = uniqueTypes[1] || null;
  stats.damageType = stats.primaryDamageType;
  stats.allDamageTypes = uniqueTypes;

  if (stats.regenMultiplier) {
    const cappedMult = Math.min(stats.regenMultiplier, 2.5);
    stats.hpRegen = Math.floor(stats.hpRegen * (1 + cappedMult));
  }

  const rawAsMult = stats.attackSpeedMult || 0;
  const effectiveAsMult = rawAsMult > 0 ? rawAsMult / (rawAsMult + 0.6) : rawAsMult;
  stats.effectiveAttackSpeed = stats.attackSpeed * (1 - effectiveAsMult);
  stats.effectiveAttackSpeed = Math.max(stats.effectiveAttackSpeed, 250);
  stats.effectiveRange = stats.noRangeLimit ? 9999 : stats.attackRange * (1 + (stats.rangeMult || 0));
  stats.finalCritMultiplier = 1.8 + (stats.critMultiplier || 0);

  if (stats.percentRegen) {
    stats.hpRegen += Math.floor(stats.maxHp * stats.percentRegen);
  }

  if (stats.sporeIntervalReduction && stats.sporeInterval) {
    stats.sporeInterval = Math.max(500, stats.sporeInterval - stats.sporeIntervalReduction);
  }

  if (stats.sporeDamageMult && stats.sporeDamage) {
    stats.sporeDamage = Math.floor(stats.sporeDamage * (1 + stats.sporeDamageMult));
  }

  stats.effectiveSporeStrikeRadius = 60 * (1 + (stats.sporeRadiusMult || 0));
  stats.effectiveSporeStrikeCount = 1;

  return stats;
}

function applyBonusStats(stats, bonusStats) {
  for (const [key, value] of Object.entries(bonusStats)) {
    if (typeof value === 'boolean') stats[key] = value;
    else if (typeof value === 'number') stats[key] = (stats[key] || 0) + value;
  }
}

function calculateDamage(attackerStats, defenderStats = {}, damageTypeOverride = null) {
  const dtId = damageTypeOverride || attackerStats.damageType || 'normal';
  const dtype = DAMAGE_TYPES[dtId] || DAMAGE_TYPES.normal;
  let damage = attackerStats.attack;
  const armor = defenderStats.armor || 0;
  const magicResist = defenderStats.magicResist || 0;

  let immuneToType = false;
  if (defenderStats.immunities && defenderStats.immunities.includes(dtId)) {
    immuneToType = true;
  }

  const dodgeRate = defenderStats.dodgeRate || 0;
  const accuracy = attackerStats.accuracy || 1.0;
  const effectiveDodge = Math.max(0, dodgeRate - (accuracy - 1.0));
  if (effectiveDodge > 0 && Math.random() < effectiveDodge) {
    return { damage: 0, isCrit: false, damageType: dtId, evaded: true, immune: false, onHit: null };
  }

  const effectiveType = immuneToType ? DAMAGE_TYPES.normal : dtype;

  const penResist = defenderStats.armorPenResist || 0;
  if (effectiveType.isPhysical) {
    const reducedPen = Math.max(0, effectiveType.armorPenetration - penResist * 0.01);
    const effectiveArmor = armor * (1 - reducedPen);
    damage -= effectiveArmor;
  } else {
    const reducedPen = Math.max(0, effectiveType.armorPenetration - penResist * 0.01);
    const effectiveArmor = armor * (1 - reducedPen);
    const effectiveMR = magicResist * (1 - (effectiveType.magicPenetration || 0));
    damage -= effectiveArmor;
    damage -= effectiveMR;
  }

  if (effectiveType.bonusVsArmor) {
    damage += Math.floor(armor * effectiveType.bonusVsArmor);
  }

  if (!immuneToType && defenderStats.resistances && defenderStats.resistances[dtId] !== undefined) {
    damage = Math.floor(damage * defenderStats.resistances[dtId]);
  }

  damage = Math.max(1, Math.floor(damage));

  const isCrit = Math.random() < (attackerStats.critChance || 0);
  if (isCrit) {
    damage = Math.floor(damage * (attackerStats.finalCritMultiplier || 1.8));
  }

  if (defenderStats.damageReduction) {
    damage = Math.max(1, Math.floor(damage * (1 - defenderStats.damageReduction)));
  }

  return { damage, isCrit, damageType: dtId, evaded: false, immune: immuneToType, onHit: immuneToType ? null : dtype.onHit };
}

function computeActiveSynergies(traits, synergyDefs) {
  if (!synergyDefs || synergyDefs.length === 0) return [];
  const categoryCounts = { root: 0, thorn: 0, spore: 0, bloom: 0, vine: 0 };
  const ownedDamageTypes = new Set();
  const ownedStats = new Set();
  for (const t of traits) {
    if (categoryCounts[t.category] !== undefined) categoryCounts[t.category]++;
    if (t.stats) {
      for (const key of Object.keys(t.stats)) {
        ownedStats.add(key);
        if (key === 'damageType' && t.stats.damageType !== 'normal') ownedDamageTypes.add(t.stats.damageType);
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

// ── Base Stats ──────────────────────────────────────────────────────

const BASE_SEEDLING_STATS = {
  maxHp: 120,
  attack: 18,
  attackSpeed: 800,
  attackRange: 160,
  hpRegen: 2,
  armor: 0,
  magicResist: 0,
  critChance: 0.05,
  accuracy: 1.0,
  thornDamage: 0,
  speed: 0,
};

// ── Combat Simulator ────────────────────────────────────────────────

const TICK_MS = 100;
const MAX_COMBAT_TIME = 120_000; // 120s max per wave

function createEnemy(typeId, diffScale, isBoss = false) {
  const template = isBoss ? BIOME_BOSSES[typeId] : ENEMY_TYPES[typeId];
  if (!template) return null;

  const e = {
    id: `${typeId}_${Math.random().toString(36).slice(2, 6)}`,
    typeId,
    name: template.name,
    hp: Math.floor(template.hp * diffScale),
    maxHp: Math.floor(template.hp * diffScale),
    attack: Math.floor(template.attack * diffScale),
    armor: Math.floor((template.armor || 0) * diffScale),
    magicResist: Math.floor((template.magicResist || 0) * diffScale),
    speed: template.speed || 30,
    attackSpeed: template.attackSpeed || 1500,
    attackRange: template.attackRange || 30,
    dodgeRate: template.dodgeRate || 0,
    resistances: template.resistances || {},
    immunities: template.immunities || [],
    regen: (template.regen || 0) * diffScale,
    flying: template.flying || false,
    isBoss,
    attackCooldown: template.attackSpeed || 1500, // start with full cooldown
    alive: true,
    spawned: false,
    spawnTime: 0,
    // Boss-specific
    phases: template.phases || null,
    currentPhase: 0,
    abilities: template.abilities || [],
    abilityCooldowns: {},
    // Debuffs
    debuff: template.debuff || null,
    // Summoner
    summon: template.summon || null,
    summonCooldown: 0,
    // DoT tracking
    bleedStacks: 0,
    burnDps: 0,
    burnTimer: 0,
    poisonTimer: 0,
    poisonBaseDmg: 0,
    frostStacks: 0,
    frozenTimer: 0,
    regenSuppressTimer: 0,
  };

  // Init ability cooldowns
  for (const ab of e.abilities) {
    e.abilityCooldowns[ab.id] = ab.cooldown * 0.5; // first use at half cooldown
  }

  return e;
}

function simulateWave(playerStats, waveData, diffScale, bossDiffScale, biomeId, verbose = false) {
  const result = { won: false, hpRemaining: 0, timeTaken: 0, enemiesKilled: 0, damageDealt: 0, damageTaken: 0 };

  let hp = playerStats.currentHp;
  const maxHp = playerStats.maxHp;
  let soulReaverBonus = playerStats.soulReaverBonus || 0;
  let secondWindUsed = playerStats.secondWindUsed || false;
  let phoenixUsed = playerStats.phoenixUsed || false;

  // Spawn enemies from wave data
  const enemies = [];
  let spawnQueue = [];

  if (waveData.isBoss) {
    const boss = createEnemy(waveData.spawns[0].type, bossDiffScale, true);
    if (boss) {
      boss.spawned = true;
      boss.spawnTime = 0;
      enemies.push(boss);
    }
  } else {
    let spawnTime = 0;
    for (const group of waveData.spawns) {
      for (let i = 0; i < group.count; i++) {
        spawnQueue.push({ typeId: group.type, time: spawnTime });
        spawnTime += group.delay;
      }
    }
  }

  let time = 0;
  let playerAttackCooldown = playerStats.effectiveAttackSpeed;
  let lastSporeTime = -Infinity;
  let lastNuclearBloomTime = -Infinity;
  let lastOvergrowthWaveTime = -Infinity;

  // Effective attack with soul reaver bonus
  const effectiveAttack = () => playerStats.attack + soulReaverBonus;

  while (time < MAX_COMBAT_TIME) {
    // Spawn enemies from queue
    while (spawnQueue.length > 0 && spawnQueue[0].time <= time) {
      const spawn = spawnQueue.shift();
      const enemy = createEnemy(spawn.typeId, diffScale);
      if (enemy) {
        enemy.spawned = true;
        enemy.spawnTime = time;
        enemies.push(enemy);
      }
    }

    const aliveEnemies = enemies.filter(e => e.alive && e.spawned);
    if (aliveEnemies.length === 0 && spawnQueue.length === 0) {
      result.won = true;
      break;
    }

    // ── Player regen (per second, scaled by tick) ──
    let regenPerTick = playerStats.hpRegen * (TICK_MS / 1000);
    if (playerStats.bossRegenDouble && waveData.isBoss) regenPerTick *= 2;
    hp = Math.min(maxHp, hp + regenPerTick);

    // ── Drain aura ──
    if (playerStats.drainAuraDps && aliveEnemies.length > 0) {
      const drainDmg = playerStats.drainAuraDps * (TICK_MS / 1000);
      // Hits closest 3 enemies
      const drainTargets = aliveEnemies.slice(0, 3);
      for (const e of drainTargets) {
        e.hp -= drainDmg;
        result.damageDealt += drainDmg;
        if (playerStats.drainAuraHealPercent) {
          hp = Math.min(maxHp, hp + drainDmg * playerStats.drainAuraHealPercent);
        }
        if (e.hp <= 0) {
          e.alive = false;
          result.enemiesKilled++;
          onEnemyKill(e);
        }
      }
    }

    // ── Player auto-attack ──
    playerAttackCooldown -= TICK_MS;
    if (playerAttackCooldown <= 0 && aliveEnemies.length > 0) {
      playerAttackCooldown = playerStats.effectiveAttackSpeed;

      // Hit primary + extra targets
      const numTargets = 1 + (playerStats.extraTargets || 0);
      const targets = aliveEnemies.slice(0, numTargets);

      for (const target of targets) {
        const atkStats = { ...playerStats, attack: effectiveAttack() };
        const hit = calculateDamage(atkStats, target);
        if (!hit.evaded) {
          target.hp -= hit.damage;
          result.damageDealt += hit.damage;

          // Apply DoTs based on damage type
          applyOnHitEffects(hit, target, atkStats);

          // Life steal
          if (playerStats.lifeSteal) {
            hp = Math.min(maxHp, hp + hit.damage * playerStats.lifeSteal);
          }
          if (playerStats.vampiricPercent) {
            hp = Math.min(maxHp, hp + hit.damage * playerStats.vampiricPercent);
          }

          // Double strike
          if (playerStats.doubleStrikeChance && Math.random() < playerStats.doubleStrikeChance) {
            const hit2 = calculateDamage(atkStats, target);
            if (!hit2.evaded) {
              target.hp -= hit2.damage;
              result.damageDealt += hit2.damage;
              applyOnHitEffects(hit2, target, atkStats);
            }
          }

          // Flying damage bonus
          if (target.flying && playerStats.flyingDamageBonus) {
            const bonusDmg = Math.floor(hit.damage * playerStats.flyingDamageBonus);
            target.hp -= bonusDmg;
            result.damageDealt += bonusDmg;
          }

          if (target.hp <= 0 && target.alive) {
            target.alive = false;
            result.enemiesKilled++;
            onEnemyKill(target);
          }
        }
      }

      // Thorn damage on melee attackers
      if (playerStats.thornDamage) {
        for (const e of aliveEnemies) {
          if (e.attackRange <= 40 && e.alive) {
            e.hp -= playerStats.thornDamage;
            if (e.hp <= 0 && e.alive) {
              e.alive = false;
              result.enemiesKilled++;
              onEnemyKill(e);
            }
          }
        }
      }
    }

    // ── Spore damage ──
    if (playerStats.sporeDamage && playerStats.sporeInterval && time - lastSporeTime >= playerStats.sporeInterval) {
      lastSporeTime = time;
      // Hit enemies in radius (simplified: hits up to 3 nearby enemies)
      const sporeTargets = aliveEnemies.slice(0, Math.min(3, aliveEnemies.length));
      for (const target of sporeTargets) {
        let sporeDmg = playerStats.sporeDamage;
        // Armor reduction from spores
        if (playerStats.sporeArmorReduce) {
          target.armor = Math.max(0, target.armor - playerStats.sporeArmorReduce * (TICK_MS / 1000));
        }
        target.hp -= sporeDmg;
        result.damageDealt += sporeDmg;
        if (target.hp <= 0 && target.alive) {
          target.alive = false;
          result.enemiesKilled++;
          onEnemyKill(target);

          // Spore death pulse
          if (playerStats.sporeDeathPulse) {
            const pulseTargets = enemies.filter(e => e.alive && e.spawned && e !== target).slice(0, 2);
            for (const pt of pulseTargets) {
              pt.hp -= playerStats.sporeDeathPulse;
              if (pt.hp <= 0 && pt.alive) {
                pt.alive = false;
                result.enemiesKilled++;
                onEnemyKill(pt);
              }
            }
          }
        }
      }
    }

    // ── Nuclear Bloom ──
    if (playerStats.nuclearBloomDamage && playerStats.nuclearBloomInterval && time - lastNuclearBloomTime >= playerStats.nuclearBloomInterval) {
      lastNuclearBloomTime = time;
      const nukeTargets = aliveEnemies.slice(0, 5);
      for (const target of nukeTargets) {
        target.hp -= playerStats.nuclearBloomDamage;
        result.damageDealt += playerStats.nuclearBloomDamage;
        if (target.hp <= 0 && target.alive) {
          target.alive = false;
          result.enemiesKilled++;
          onEnemyKill(target);
        }
      }
    }

    // ── Overgrowth Wave ──
    if (playerStats.overgrowthWaveInterval && playerStats.overgrowthWaveDamageMult && time - lastOvergrowthWaveTime >= playerStats.overgrowthWaveInterval) {
      lastOvergrowthWaveTime = time;
      const waveDmg = Math.floor(effectiveAttack() * playerStats.overgrowthWaveDamageMult);
      for (const target of aliveEnemies) {
        target.hp -= waveDmg;
        result.damageDealt += waveDmg;
        if (target.hp <= 0 && target.alive) {
          target.alive = false;
          result.enemiesKilled++;
          onEnemyKill(target);
        }
      }
    }

    // ── Enemy DoTs (on enemies) ──
    for (const e of aliveEnemies) {
      // Bleed (15% of hit damage per second for 3s - simplified as flat DPS)
      if (e.bleedStacks > 0) {
        let bleedDmg = e.bleedStacks * (TICK_MS / 1000);
        // Rot Essence: bleed scales with target missing HP (up to 2x at 0 HP)
        if (playerStats.bleedMissingHpScale) {
          const missingRatio = 1 - (e.hp / e.maxHp);
          bleedDmg *= (1 + missingRatio);
        }
        e.hp -= bleedDmg;
        result.damageDealt += bleedDmg;
      }
      // Burn
      if (e.burnDps > 0 && e.burnTimer > 0) {
        const burnDmg = e.burnDps * (TICK_MS / 1000);
        e.hp -= burnDmg;
        e.burnTimer -= TICK_MS;
        result.damageDealt += burnDmg;
      }
      // Poison (ramping)
      if (e.poisonTimer > 0) {
        const elapsed = (4000 - e.poisonTimer) / 1000;
        const rampMult = Math.pow(2, Math.floor(elapsed));
        const poisonDmg = e.poisonBaseDmg * rampMult * (TICK_MS / 1000);
        e.hp -= poisonDmg;
        e.poisonTimer -= TICK_MS;
        result.damageDealt += poisonDmg;
      }
      // Frozen stun (skip attack)
      if (e.frozenTimer > 0) {
        e.frozenTimer -= TICK_MS;
      }
      // Regen
      if (e.regen > 0 && e.regenSuppressTimer <= 0) {
        e.hp = Math.min(e.maxHp, e.hp + e.regen * (TICK_MS / 1000));
      }
      if (e.regenSuppressTimer > 0) e.regenSuppressTimer -= TICK_MS;

      if (e.hp <= 0 && e.alive) {
        e.alive = false;
        result.enemiesKilled++;
        onEnemyKill(e);
      }
    }

    // ── Enemy attacks on player ──
    const currentAlive = enemies.filter(e => e.alive && e.spawned);
    for (const e of currentAlive) {
      if (e.frozenTimer > 0) continue;

      e.attackCooldown -= TICK_MS;
      if (e.attackCooldown <= 0) {
        e.attackCooldown = e.attackSpeed;

        let eDmg = e.attack;

        // Boss phase scaling
        if (e.isBoss && e.phases) {
          const hpPercent = e.hp / e.maxHp;
          for (let p = e.phases.length - 1; p >= 0; p--) {
            if (hpPercent <= e.phases[p].hpPercent) {
              eDmg = Math.floor(e.attack * (e.phases[p].attackMult || 1.0));
              e.currentPhase = p;
              break;
            }
          }
        }

        // Enemy damage reduction from player stats
        if (playerStats.enemyDamageReduce) {
          eDmg = Math.floor(eDmg * (1 - playerStats.enemyDamageReduce));
        }

        // Apply player armor
        eDmg = Math.max(1, eDmg - playerStats.armor);

        // Player damage reduction
        if (playerStats.damageReduction) {
          eDmg = Math.max(1, Math.floor(eDmg * (1 - playerStats.damageReduction)));
        }

        hp -= eDmg;
        result.damageTaken += eDmg;

        // On-hit heal (flat chance)
        if (playerStats.onHitHealChance && Math.random() < playerStats.onHitHealChance) {
          hp = Math.min(maxHp, hp + (playerStats.onHitHealAmount || 0));
        }
        // Regenerative Cambium: heal % max HP when hit
        if (playerStats.onHitHealPercent) {
          hp = Math.min(maxHp, hp + Math.floor(maxHp * playerStats.onHitHealPercent));
        }

        // Debuffs from enemies (simplified - just apply damage effects)
        if (e.debuff && Math.random() < e.debuff.chance) {
          if (e.debuff.type === 'venom') {
            hp -= e.debuff.dps * (e.debuff.duration / 1000) * 0.3; // simplified tick damage
          }
        }
      }

      // Boss abilities
      if (e.isBoss) {
        for (const ab of e.abilities) {
          if (e.currentPhase < (ab.phaseUnlock || 0)) continue;
          e.abilityCooldowns[ab.id] = (e.abilityCooldowns[ab.id] || 0) - TICK_MS;
          if (e.abilityCooldowns[ab.id] <= 0) {
            e.abilityCooldowns[ab.id] = ab.cooldown;
            // Model ability effects
            if (ab.type === 'aoe') {
              let abDmg = (ab.damage || 0) * (bossDiffScale || 1);
              // 50% dodge chance for telegraphed
              if (ab.telegraph > 800 && Math.random() < 0.5) abDmg = 0;
              hp -= abDmg;
              result.damageTaken += abDmg;
              if (ab.healPercent && !ab.breakable) {
                e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ab.healPercent);
              }
            } else if (ab.type === 'projectile_burst') {
              const count = ab.count || 1;
              const abDmg = (ab.damage || Math.floor(e.attack * (ab.damageMult || 1))) * (bossDiffScale || 1);
              // Each projectile has 60% chance to hit (simplified aiming)
              for (let i = 0; i < count; i++) {
                if (Math.random() < 0.6) {
                  hp -= abDmg;
                  result.damageTaken += abDmg;
                }
              }
            } else if (ab.type === 'summon') {
              const summonType = ab.summonType;
              const summonCount = ab.summonCount || 1;
              for (let i = 0; i < summonCount; i++) {
                const minion = createEnemy(summonType, diffScale);
                if (minion) {
                  minion.spawned = true;
                  minion.spawnTime = time;
                  enemies.push(minion);
                }
              }
              if (ab.extraSummon) {
                for (let i = 0; i < ab.extraSummon.count; i++) {
                  const minion = createEnemy(ab.extraSummon.type, diffScale);
                  if (minion) {
                    minion.spawned = true;
                    minion.spawnTime = time;
                    enemies.push(minion);
                  }
                }
              }
              // Buff from summon ability
              if (ab.buffStat === 'regen' && ab.buffAmount) {
                e.regen += ab.buffAmount; // simplified, doesn't expire
              }
            } else if (ab.type === 'buff_self') {
              if (ab.buffStat === 'armor') {
                e.armor += ab.buffAmount || 0; // simplified, doesn't expire well
              }
              // Breakable buff (DPS check)
              if (ab.breakable) {
                // Model as: player deals enough DPS to break it 50% of the time
                if (Math.random() < 0.5 && ab.buffStats) {
                  for (const bs of ab.buffStats) {
                    if (bs.stat === 'regen') e.regen += bs.amount;
                    if (bs.stat === 'attack') e.attack += bs.amount;
                  }
                }
              }
            } else if (ab.type === 'debuff_aoe') {
              // Debuff effects on player (simplified)
              if (ab.debuff && ab.debuff.type === 'wither') {
                // Reduce effective regen for a short time - simplified as flat HP loss
                result.damageTaken += playerStats.hpRegen * (ab.debuff.duration / 1000) * (ab.debuff.regenReduce || 0);
                hp -= playerStats.hpRegen * (ab.debuff.duration / 1000) * (ab.debuff.regenReduce || 0);
              }
            }
          }
        }
      }

      // Summoner spawns
      if (e.summon && e.alive) {
        e.summonCooldown -= TICK_MS;
        if (e.summonCooldown <= 0) {
          e.summonCooldown = e.summon.cooldown;
          const activeMinions = enemies.filter(m => m.alive && m.spawned && m.typeId === e.summon.type).length;
          if (activeMinions < e.summon.maxActive) {
            for (let i = 0; i < e.summon.count; i++) {
              const minion = createEnemy(e.summon.type, diffScale);
              if (minion) {
                minion.spawned = true;
                minion.spawnTime = time;
                enemies.push(minion);
              }
            }
          }
        }
      }
    }

    // ── Second Wind ──
    if (!secondWindUsed && playerStats.secondWindHeal && hp > 0 && hp / maxHp <= (playerStats.secondWindThreshold || 0.25)) {
      hp = Math.min(maxHp, hp + maxHp * playerStats.secondWindHeal);
      secondWindUsed = true;
    }

    // ── Phoenix Revive ──
    if (hp <= 0 && !phoenixUsed && playerStats.phoenixRevive) {
      hp = maxHp * playerStats.phoenixRevive;
      phoenixUsed = true;
    }

    if (hp <= 0) {
      result.won = false;
      break;
    }

    time += TICK_MS;
  }

  result.hpRemaining = Math.max(0, hp);
  result.timeTaken = time;
  result.soulReaverBonus = soulReaverBonus;
  result.secondWindUsed = secondWindUsed;
  result.phoenixUsed = phoenixUsed;
  return result;

  function onEnemyKill(enemy) {
    // Heal on kill (flat + percent, optionally doubled)
    if (playerStats.healOnKill || playerStats.healOnKillPercent) {
      let healAmt = playerStats.healOnKill || 0;
      if (playerStats.healOnKillPercent) {
        healAmt += Math.floor(maxHp * playerStats.healOnKillPercent);
      }
      if (playerStats.doubleHealOnKill) healAmt *= 2;
      if (playerStats.healingBonus) healAmt = Math.floor(healAmt * (1 + playerStats.healingBonus));
      hp = Math.min(maxHp, hp + healAmt);
    }
    // Soul Reaver stacking
    if (playerStats.soulReaverStacking) {
      soulReaverBonus = Math.min(soulReaverBonus + playerStats.soulReaverStacking, playerStats.soulReaverMax || 20);
    }
  }

  function applyOnHitEffects(hit, target, atkStats) {
    // The Black Thorn: crits apply all DoTs (bleed, burn, poison)
    if (hit.isCrit && atkStats.critApplyAllDots) {
      target.bleedStacks += hit.damage * 0.15;
      setTimeout(() => { target.bleedStacks -= hit.damage * 0.15; }, 3000);
      target.burnDps = Math.max(target.burnDps, hit.damage * 0.08);
      target.burnTimer = 4000;
      target.poisonBaseDmg = hit.damage * 0.05;
      target.poisonTimer = 4000;
      return; // all DoTs already applied, skip normal onHit
    }
    if (!hit.onHit) return;
    switch (hit.onHit) {
      case 'applyBleed':
        target.bleedStacks += hit.damage * 0.15; // 15% as DPS
        setTimeout(() => { target.bleedStacks -= hit.damage * 0.15; }, 3000); // decay - simplified
        // Rotfang: bleed also reduces armor
        if (atkStats.bleedArmorReduce) {
          target.armor = Math.max(0, target.armor - atkStats.bleedArmorReduce);
        }
        break;
      case 'applyBurn':
        target.burnDps = Math.max(target.burnDps, hit.damage * 0.08);
        target.burnTimer = 4000;
        break;
      case 'applyPoison':
        target.poisonBaseDmg = hit.damage * 0.05;
        target.poisonTimer = 4000;
        break;
      case 'applyFrost':
        target.frostStacks++;
        if (target.frostStacks >= 3) {
          target.frozenTimer = 1500;
          target.frostStacks = 0;
        }
        break;
      case 'chainLightning': {
        // Chain to nearby enemies at 60% damage
        const chainCount = 2 + (atkStats.lightningChains || 0);
        const chainTargets = enemies.filter(e => e.alive && e.spawned && e !== target).slice(0, chainCount);
        for (const ct of chainTargets) {
          const chainDmg = Math.floor(hit.damage * 0.6);
          ct.hp -= chainDmg;
          result.damageDealt += chainDmg;
          if (ct.hp <= 0 && ct.alive) {
            ct.alive = false;
            result.enemiesKilled++;
            onEnemyKill(ct);
          }
        }
        break;
      }
      case 'suppressRegen':
        target.regenSuppressTimer = 3000;
        break;
      case 'lifeSteal':
        hp = Math.min(maxHp, hp + hit.damage * 0.15);
        break;
    }
  }
}

// ── Trait Selection Strategies ───────────────────────────────────────

const STRATEGIES = {
  random: {
    name: 'Random',
    pick: (choices, owned) => choices[Math.floor(Math.random() * choices.length)],
  },
  pure_root: {
    name: 'Pure Root',
    pick: (choices, owned) => {
      const rootChoices = choices.filter(t => t.category === 'root');
      if (rootChoices.length > 0) return rootChoices[0];
      return choices[0];
    },
  },
  pure_thorn: {
    name: 'Pure Thorn',
    pick: (choices, owned) => {
      const thornChoices = choices.filter(t => t.category === 'thorn');
      if (thornChoices.length > 0) return thornChoices[0];
      return choices[0];
    },
  },
  pure_spore: {
    name: 'Pure Spore',
    pick: (choices, owned) => {
      const sporeChoices = choices.filter(t => t.category === 'spore');
      if (sporeChoices.length > 0) return sporeChoices[0];
      return choices[0];
    },
  },
  pure_bloom: {
    name: 'Pure Bloom',
    pick: (choices, owned) => {
      const bloomChoices = choices.filter(t => t.category === 'bloom');
      if (bloomChoices.length > 0) return bloomChoices[0];
      return choices[0];
    },
  },
  pure_vine: {
    name: 'Pure Vine',
    pick: (choices, owned) => {
      const vineChoices = choices.filter(t => t.category === 'vine');
      if (vineChoices.length > 0) return vineChoices[0];
      return choices[0];
    },
  },
  balanced: {
    name: 'Balanced',
    pick: (choices, owned) => {
      // Pick from the least-represented category
      const counts = { root: 0, thorn: 0, spore: 0, bloom: 0, vine: 0 };
      for (const t of owned) counts[t.category]++;
      let minCat = 'root';
      let minCount = Infinity;
      for (const [cat, count] of Object.entries(counts)) {
        if (count < minCount) { minCount = count; minCat = cat; }
      }
      const catChoices = choices.filter(t => t.category === minCat);
      if (catChoices.length > 0) return catChoices[0];
      return choices[0];
    },
  },
  smart: {
    name: 'Smart',
    pick: (choices, owned) => {
      // Score each choice based on value
      const scores = choices.map(t => {
        let score = 0;
        const s = t.stats;
        // Value damage stats highly
        if (s.attack) score += s.attack * 2;
        if (s.critChance) score += s.critChance * 100;
        if (s.maxHp) score += s.maxHp * 0.5;
        if (s.armor) score += s.armor * 3;
        if (s.hpRegen) score += s.hpRegen * 2;
        if (s.sporeDamage) score += s.sporeDamage * 2;
        if (s.attackSpeedMult) score += s.attackSpeedMult * 30;
        if (s.extraTargets) score += s.extraTargets * 8;
        if (s.healOnKill) score += s.healOnKill * 1.5;
        if (s.damageReduction) score += s.damageReduction * 80;
        if (s.regenMultiplier) score += s.regenMultiplier * 15;
        if (s.rangeMult) score += s.rangeMult * 10;
        if (s.lifeSteal) score += s.lifeSteal * 50;
        if (s.vampiricPercent) score += s.vampiricPercent * 50;
        if (s.phoenixRevive) score += 20;
        if (s.doubleStrikeChance) score += s.doubleStrikeChance * 50;

        // Rarity bonus
        const rarityBonus = { common: 0, uncommon: 3, rare: 6, legendary: 12 };
        score += rarityBonus[t.rarity] || 0;

        // Set bonus proximity
        const counts = { root: 0, thorn: 0, spore: 0, bloom: 0, vine: 0 };
        for (const ot of owned) counts[ot.category]++;
        const catCount = counts[t.category] || 0;
        if (catCount === 1 || catCount === 2 || catCount === 4) score += 5; // close to threshold

        return { trait: t, score };
      });

      scores.sort((a, b) => b.score - a.score);
      return scores[0].trait;
    },
  },
  thorn_vine: {
    name: 'Thorn+Vine DPS',
    pick: (choices, owned) => {
      // Prioritize thorn and vine traits
      const pvChoices = choices.filter(t => t.category === 'thorn' || t.category === 'vine');
      if (pvChoices.length > 0) {
        // Prefer thorn slightly
        const thornC = pvChoices.filter(t => t.category === 'thorn');
        if (thornC.length > 0) return thornC[0];
        return pvChoices[0];
      }
      return choices[0];
    },
  },
  root_bloom: {
    name: 'Root+Bloom Tank',
    pick: (choices, owned) => {
      const rbChoices = choices.filter(t => t.category === 'root' || t.category === 'bloom');
      if (rbChoices.length > 0) {
        const rootC = rbChoices.filter(t => t.category === 'root');
        if (rootC.length > 0) return rootC[0];
        return rbChoices[0];
      }
      return choices[0];
    },
  },
};

// ── Run Simulator ───────────────────────────────────────────────────

function simulateRun(strategy, verbose = false) {
  const biomes = buildBiomeSequence();
  let ownedTraits = [];
  let currentHp = BASE_SEEDLING_STATS.maxHp;
  let soulReaverBonus = 0;
  let secondWindUsed = false;
  let phoenixUsed = false;
  let totalWave = 0;
  let deathWave = -1;
  const waveResults = [];

  for (let biomeIdx = 0; biomeIdx < biomes.length; biomeIdx++) {
    const biomeId = biomes[biomeIdx];
    const diffScale = getDifficultyScale(biomeId, biomeIdx);
    const bossDiffScale = getBossDifficultyScale(biomeId, biomeIdx);

    for (let waveInBiome = 0; waveInBiome < 4; waveInBiome++) {
      totalWave++;
      const waveData = getBiomeWave(biomeId, waveInBiome);
      if (!waveData) continue;

      // Compute current stats
      const synergies = computeActiveSynergies(ownedTraits, SYNERGY_DEFS);
      const stats = computeStats({ ...BASE_SEEDLING_STATS }, ownedTraits, SET_BONUSES, synergies);

      stats.currentHp = Math.min(currentHp, stats.maxHp);
      stats.soulReaverBonus = soulReaverBonus;
      stats.secondWindUsed = secondWindUsed;
      stats.phoenixUsed = phoenixUsed;

      // Simulate combat
      const result = simulateWave(stats, waveData, diffScale, bossDiffScale, biomeId, verbose);

      waveResults.push({
        wave: totalWave,
        biome: biomeId,
        waveInBiome,
        isBoss: waveData.isBoss,
        won: result.won,
        hpPercent: result.hpRemaining / stats.maxHp,
        timeTaken: result.timeTaken,
        enemiesKilled: result.enemiesKilled,
        damageDealt: result.damageDealt,
        damageTaken: result.damageTaken,
        traitCount: ownedTraits.length,
      });

      if (!result.won) {
        deathWave = totalWave;
        return { won: false, deathWave, totalWave, waveResults, traits: ownedTraits, biomes };
      }

      currentHp = result.hpRemaining;
      soulReaverBonus = result.soulReaverBonus || 0;
      secondWindUsed = result.secondWindUsed || false;
      phoenixUsed = result.phoenixUsed || false;

      // Shop phase: pick a trait
      const isBossReward = waveData.isBoss;
      const excludeIds = ownedTraits.map(t => t.id);
      const choices = getRandomTraits(3, excludeIds, biomeId, isBossReward);

      if (choices.length > 0) {
        const pick = strategy.pick(choices, ownedTraits);
        ownedTraits.push(pick);
      }

      // Between-wave healing
      if (waveInBiome === 3) {
        // After boss: full heal at biome transition
        const newSynergies = computeActiveSynergies(ownedTraits, SYNERGY_DEFS);
        const newStats = computeStats({ ...BASE_SEEDLING_STATS }, ownedTraits, SET_BONUSES, newSynergies);
        currentHp = newStats.maxHp;
      } else {
        // Normal: heal 50% of missing
        const newSynergies = computeActiveSynergies(ownedTraits, SYNERGY_DEFS);
        const newStats = computeStats({ ...BASE_SEEDLING_STATS }, ownedTraits, SET_BONUSES, newSynergies);
        const missing = newStats.maxHp - Math.min(currentHp, newStats.maxHp);
        currentHp = Math.min(newStats.maxHp, currentHp + missing * 0.5);
      }

      // Reset second wind for new wave
      secondWindUsed = false;
    }
  }

  return { won: true, deathWave: -1, totalWave, waveResults, traits: ownedTraits, biomes };
}

// ── Analysis & Reporting ────────────────────────────────────────────

function runAnalysis(numRuns, strategyKeys, verbose = false) {
  const results = {};

  for (const key of strategyKeys) {
    const strategy = STRATEGIES[key];
    if (!strategy) continue;

    const runs = [];
    const traitPickCounts = {};
    const traitWinCounts = {};
    const waveSurvival = Array(16).fill(0);
    const waveHpPercents = Array(16).fill(0);

    for (let i = 0; i < numRuns; i++) {
      const run = simulateRun(strategy);
      runs.push(run);

      // Track wave survival
      for (const wr of run.waveResults) {
        if (wr.won) {
          waveSurvival[wr.wave - 1]++;
          waveHpPercents[wr.wave - 1] += wr.hpPercent;
        }
      }

      // Track trait picks
      for (const t of run.traits) {
        traitPickCounts[t.id] = (traitPickCounts[t.id] || 0) + 1;
        if (run.won) traitWinCounts[t.id] = (traitWinCounts[t.id] || 0) + 1;
      }
    }

    const wins = runs.filter(r => r.won).length;
    const losses = runs.filter(r => !r.won);
    const avgDeathWave = losses.length > 0
      ? losses.reduce((sum, r) => sum + r.deathWave, 0) / losses.length
      : -1;

    // Death wave distribution
    const deathWaveDist = {};
    for (const r of losses) {
      deathWaveDist[r.deathWave] = (deathWaveDist[r.deathWave] || 0) + 1;
    }

    results[key] = {
      name: strategy.name,
      wins,
      losses: losses.length,
      winRate: (wins / numRuns * 100).toFixed(1),
      avgDeathWave: avgDeathWave > 0 ? avgDeathWave.toFixed(1) : 'N/A',
      waveSurvival: waveSurvival.map(s => (s / numRuns * 100).toFixed(0)),
      waveAvgHp: waveHpPercents.map((h, i) => waveSurvival[i] > 0 ? (h / waveSurvival[i] * 100).toFixed(0) : '0'),
      deathWaveDist,
      traitPickCounts,
      traitWinCounts,
      numRuns,
    };
  }

  return results;
}

function printResults(results, showTraits = false, showWaves = false) {
  console.log('\n' + '═'.repeat(80));
  console.log(' ROOTBOUND BALANCE SIMULATION RESULTS');
  console.log('═'.repeat(80));

  for (const [key, data] of Object.entries(results)) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(` Strategy: ${data.name} (${data.numRuns} runs)`);
    console.log(`${'─'.repeat(60)}`);
    console.log(` Win Rate: ${data.winRate}% (${data.wins}/${data.numRuns})`);
    console.log(` Avg Death Wave: ${data.avgDeathWave}`);

    if (showWaves || true) {
      console.log('\n Wave Survival Rates:');
      const biomeNames = ['Garden', 'Garden', 'Garden', 'Garden', 'Mid-1', 'Mid-1', 'Mid-1', 'Mid-1', 'Mid-2', 'Mid-2', 'Mid-2', 'Mid-2', 'Emergent', 'Emergent', 'Emergent', 'Emergent'];
      const waveTypes = ['W1', 'W2', 'W3', 'Boss', 'W1', 'W2', 'W3', 'Boss', 'W1', 'W2', 'W3', 'Boss', 'W1', 'W2', 'W3', 'Boss'];
      for (let i = 0; i < 16; i++) {
        const bar = '█'.repeat(Math.floor(parseInt(data.waveSurvival[i]) / 5));
        const hpStr = data.waveAvgHp[i];
        console.log(`  ${String(i + 1).padStart(2)}. ${biomeNames[i].padEnd(8)} ${waveTypes[i].padEnd(4)} ${data.waveSurvival[i].padStart(3)}% ${bar} (avg HP: ${hpStr}%)`);
      }
    }

    // Death wave hotspots
    if (Object.keys(data.deathWaveDist).length > 0) {
      console.log('\n Death Hotspots:');
      const sorted = Object.entries(data.deathWaveDist).sort((a, b) => b[1] - a[1]).slice(0, 5);
      for (const [wave, count] of sorted) {
        const pct = (count / data.numRuns * 100).toFixed(1);
        const waveType = parseInt(wave) % 4 === 0 ? 'BOSS' : `W${(parseInt(wave) - 1) % 4 + 1}`;
        console.log(`  Wave ${wave} (${waveType}): ${count} deaths (${pct}%)`);
      }
    }
  }

  // Trait analysis across all strategies
  if (showTraits) {
    console.log('\n' + '═'.repeat(80));
    console.log(' TRAIT ANALYSIS (across all strategies)');
    console.log('═'.repeat(80));

    const allPicks = {};
    const allWins = {};
    let totalRuns = 0;

    for (const data of Object.values(results)) {
      totalRuns += data.numRuns;
      for (const [id, count] of Object.entries(data.traitPickCounts)) {
        allPicks[id] = (allPicks[id] || 0) + count;
      }
      for (const [id, count] of Object.entries(data.traitWinCounts)) {
        allWins[id] = (allWins[id] || 0) + count;
      }
    }

    const traitStats = TRAIT_POOL.map(t => {
      const picks = allPicks[t.id] || 0;
      const wins = allWins[t.id] || 0;
      const winRate = picks > 10 ? (wins / picks * 100).toFixed(1) : 'N/A';
      return { id: t.id, name: t.name, category: t.category, rarity: t.rarity, picks, wins, winRate };
    }).filter(t => t.picks > 10);

    // Sort by win rate
    traitStats.sort((a, b) => {
      if (a.winRate === 'N/A') return 1;
      if (b.winRate === 'N/A') return -1;
      return parseFloat(b.winRate) - parseFloat(a.winRate);
    });

    console.log('\n Top 15 Traits by Win Rate (min 10 picks):');
    for (const t of traitStats.slice(0, 15)) {
      console.log(`  ${t.name.padEnd(25)} ${t.category.padEnd(6)} ${t.rarity.padEnd(10)} picks:${String(t.picks).padStart(4)} win:${t.winRate}%`);
    }

    console.log('\n Bottom 15 Traits by Win Rate (min 10 picks):');
    const bottom = traitStats.filter(t => t.winRate !== 'N/A');
    for (const t of bottom.slice(-15)) {
      console.log(`  ${t.name.padEnd(25)} ${t.category.padEnd(6)} ${t.rarity.padEnd(10)} picks:${String(t.picks).padStart(4)} win:${t.winRate}%`);
    }

    // Category comparison
    console.log('\n Category Win Rate Summary:');
    for (const cat of ['root', 'thorn', 'spore', 'bloom', 'vine']) {
      const catTraits = traitStats.filter(t => t.category === cat && t.winRate !== 'N/A');
      if (catTraits.length === 0) continue;
      const avgWr = catTraits.reduce((s, t) => s + parseFloat(t.winRate), 0) / catTraits.length;
      console.log(`  ${cat.padEnd(6)}: avg win rate ${avgWr.toFixed(1)}% across ${catTraits.length} traits`);
    }
  }
}

// ── Main Entry Point ────────────────────────────────────────────────

const args = process.argv.slice(2);
const numRuns = parseInt(args.find((a, i) => args[i - 1] === '--runs') || '500');
const specificStrategy = args.find((a, i) => args[i - 1] === '--strategy');
const verbose = args.includes('--verbose');
const showTraits = args.includes('--trait-analysis') || !specificStrategy;
const showWaves = args.includes('--wave-analysis') || !specificStrategy;

const strategyKeys = specificStrategy
  ? [specificStrategy]
  : Object.keys(STRATEGIES);

console.log(`Running ${numRuns} simulations per strategy...`);
console.log(`Strategies: ${strategyKeys.join(', ')}`);

const results = runAnalysis(numRuns, strategyKeys, verbose);
printResults(results, showTraits, showWaves);
