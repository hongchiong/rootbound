// Set bonuses are cumulative: having 5 root traits gives 2-piece + 3-piece + 5-piece bonuses

export const SET_BONUSES = {
  root: {
    2: {
      name: 'Rooted',
      description: '+15 Max HP, +1 Armor',
      stats: { maxHp: 15, armor: 1 },
    },
    3: {
      name: 'Deep Roots',
      description: '+30 Max HP, +3 Armor, +2 Regen',
      stats: { maxHp: 30, armor: 3, hpRegen: 2 },
    },
    5: {
      name: 'Ironbark',
      description: '+50 Max HP, +6 Armor, damage taken -10%',
      stats: { maxHp: 50, armor: 6, damageReduction: 0.10 },
    },
  },
  thorn: {
    2: {
      name: 'Sharpened',
      description: '+5 Attack',
      stats: { attack: 5 },
    },
    3: {
      name: 'Razor Edge',
      description: '+12 Attack, +10% Crit',
      stats: { attack: 12, critChance: 0.10 },
    },
    5: {
      name: 'Death Blossom',
      description: '+25 Attack, +15% Crit, crits deal x2.1',
      stats: { attack: 25, critChance: 0.15, critMultiplier: 0.3 },
    },
  },
  spore: {
    2: {
      name: 'Spore Cloud',
      description: '+2 Spore damage, -0.3s interval, +10% slow',
      stats: { sporeDamage: 2, sporeIntervalReduction: 300, sporeSlow: 0.10 },
    },
    3: {
      name: 'Carpet Bombing',
      description: '+4 Spore damage, +1 strike/volley, spores slow 15%, -3 armor',
      stats: { sporeDamage: 4, sporeStrikeCount: 1, sporeSlow: 0.15, sporeArmorReduce: 3 },
    },
    5: {
      name: 'Plague Bearer',
      description: 'Spore damage x1.3, spore kills explode for 50% max HP, enemies deal -15% dmg',
      stats: { sporeDamageMult: 0.3, sporeDeathExplosion: true, enemyDamageReduce: 0.15 },
    },
  },
  bloom: {
    2: {
      name: 'Budding',
      description: '+3 Regen, +15 Max HP',
      stats: { hpRegen: 3, maxHp: 15 },
    },
    3: {
      name: 'Full Bloom',
      description: '+8 Regen, +30 Max HP, heal 5 on kill',
      stats: { hpRegen: 8, maxHp: 30, healOnKill: 5 },
    },
    5: {
      name: 'Garden of Life',
      description: 'Regen x2, all healing +30%, +1% max HP regen/s',
      stats: { regenMultiplier: 1.0, healingBonus: 0.3, percentRegen: 0.01 },
    },
  },
  vine: {
    2: {
      name: 'Far Reach',
      description: '+15% Range, +10% Attack Speed',
      stats: { rangeMult: 0.15, attackSpeedMult: 0.10 },
    },
    3: {
      name: 'Entangling',
      description: '+30% Range, +20% Attack Speed, +1 target',
      stats: { rangeMult: 0.30, attackSpeedMult: 0.20, extraTargets: 1 },
    },
    5: {
      name: 'The Thicket',
      description: '+50% Range, +20% Attack Speed, +2 targets, projectiles pierce',
      stats: { rangeMult: 0.50, attackSpeedMult: 0.20, extraTargets: 2, projectilePierce: true },
    },
  },
};

// Get active set bonuses for display
export function getActiveSetBonuses(categoryCounts) {
  const active = [];
  for (const [category, count] of Object.entries(categoryCounts)) {
    const bonuses = SET_BONUSES[category];
    if (!bonuses) continue;
    for (const threshold of [2, 3, 5]) {
      if (count >= threshold && bonuses[threshold]) {
        active.push({
          category,
          threshold,
          ...bonuses[threshold],
        });
      }
    }
  }
  return active;
}

// Get next set bonus threshold for a category
export function getNextSetThreshold(category, currentCount) {
  const thresholds = [2, 3, 5];
  for (const t of thresholds) {
    if (currentCount < t) return t;
  }
  return null;
}
