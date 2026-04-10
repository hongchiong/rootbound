// Biome definitions and wave generation for Rootbound
// Each biome lasts 4 waves — waves 1-3 normal, wave 4 boss

// Inherent power level of each biome's enemy pool (derived from avg sqrt(HP * attack)).
// Used to normalize difficulty so randomized biome order doesn't create spikes/dips.
// basePower = regular enemies, bossBasePower = boss relative to Garden Golem.
const BIOME_POWER = {
  garden:   { base: 1.0,  boss: 1.0  },
  forest:   { base: 1.8,  boss: 1.48 },
  underroot:{ base: 1.5,  boss: 1.33 },
  the_rot:  { base: 1.55, boss: 1.63 },
  canopy:   { base: 1.1,  boss: 1.44 },
  emergent: { base: 2.8,  boss: 2.67 },
};

// Target difficulty at each biome position (0 = garden, 1-2 = randomized middle, 3 = emergent).
// Player accumulates traits between biomes, so difficulty ramps to match.
const POSITION_TARGETS = [1.0, 1.35, 2.5, 4.5];

// Returns the stat multiplier for regular enemies in a given biome at a given position.
// Formula: targetDifficulty / biomeInherentPower — so weaker biomes get boosted
// and stronger biomes get tempered to match the expected challenge for that position.
export function getDifficultyScale(biomeId, biomeIndex) {
  const target = POSITION_TARGETS[biomeIndex] ?? 1.0;
  const power = BIOME_POWER[biomeId]?.base ?? 1.0;
  return target / power;
}

// Returns the stat multiplier for the boss of a given biome at a given position.
export function getBossDifficultyScale(biomeId, biomeIndex) {
  const target = POSITION_TARGETS[biomeIndex] ?? 1.0;
  const power = BIOME_POWER[biomeId]?.boss ?? 1.0;
  return target / power;
}

export const BIOMES = {
  garden: {
    id: 'garden',
    name: 'The Garden',
    subtitle: 'Where your roots first took hold',
    bgColor: 0x141F14,
    tileColors: [0x172617, 0x1A2C1A],
    borderColor: 0x2A4A28,
    accentColor: 0x2A4A28,
    ambientColor: 0x44AA44,
    environmentStyle: 'garden',
    enemies: ['weed', 'slug', 'beetle'],
    bossKey: 'garden_golem',
  },
  forest: {
    id: 'forest',
    name: 'Ancient Forest',
    subtitle: 'Armored foes lurk between the roots',
    bgColor: 0x0D1A0D,
    tileColors: [0x0F1B0D, 0x132010],
    borderColor: 0x1E3A18,
    accentColor: 0x1A3318,
    ambientColor: 0x336633,
    environmentStyle: 'forest',
    enemies: ['bark_beetle', 'tree_spirit', 'woodland_creep'],
    bossKey: 'ancient_oak',
  },
  underroot: {
    id: 'underroot',
    name: 'The Underroot',
    subtitle: 'Spores bloom in the eternal dark',
    bgColor: 0x12100A,
    tileColors: [0x14100A, 0x1A140A],
    borderColor: 0x3A2A0A,
    accentColor: 0x3A2A0A,
    ambientColor: 0xAA8822,
    environmentStyle: 'underroot',
    enemies: ['cave_fungus', 'mycelium_creep', 'blind_crawler'],
    bossKey: 'deep_mycelium',
  },
  the_rot: {
    id: 'the_rot',
    name: 'The Rot',
    subtitle: 'Nothing stays dead here',
    bgColor: 0x120A12,
    tileColors: [0x140A14, 0x1A0F1A],
    borderColor: 0x3A0A2A,
    accentColor: 0x3A0A2A,
    ambientColor: 0xAA22AA,
    environmentStyle: 'rot',
    enemies: ['rot_slug', 'blight_walker', 'decay_moth'],
    bossKey: 'blight_lord',
  },
  canopy: {
    id: 'canopy',
    name: 'The Canopy',
    subtitle: 'Swarms blot out the sky above',
    bgColor: 0x0A1422,
    tileColors: [0x0A1422, 0x0D1A2A],
    borderColor: 0x1A3A5A,
    accentColor: 0x1A3A5A,
    ambientColor: 0x4488CC,
    environmentStyle: 'canopy',
    enemies: ['swarm_moth', 'leaf_hopper', 'wind_sprite'],
    bossKey: 'canopy_queen',
  },
  emergent: {
    id: 'emergent',
    name: 'The Emergent',
    subtitle: 'The surface shatters — final trial awaits',
    bgColor: 0x1A1A0A,
    tileColors: [0x1A1A0A, 0x222210],
    borderColor: 0x4A4A22,
    accentColor: 0x4A4A22,
    ambientColor: 0xCCCC44,
    environmentStyle: 'emergent',
    enemies: ['root_golem', 'crystal_crawler', 'emerald_briar'],
    bossKey: 'world_root',
  },
};

// Build a randomized biome sequence for a new run:
// Always: garden → 2 random middle biomes → emergent
export function buildBiomeSequence() {
  const middleBiomes = ['forest', 'underroot', 'the_rot', 'canopy'];
  const shuffled = [...middleBiomes].sort(() => Math.random() - 0.5);
  return ['garden', shuffled[0], shuffled[1], 'emergent'];
}

// Generate wave spawn data for a biome at waveInBiome 0-3
// waveInBiome 3 = boss wave
export function getBiomeWave(biomeId, waveInBiome) {
  const biome = BIOMES[biomeId];
  if (!biome) return null;

  if (waveInBiome === 3) {
    return {
      isBoss: true,
      spawns: [{ type: biome.bossKey, count: 1, delay: 0 }],
    };
  }

  const defs = WAVE_DEFS[biomeId];
  return {
    isBoss: false,
    spawns: defs ? defs[waveInBiome] : WAVE_DEFS.garden[waveInBiome],
  };
}

// Wave spawn definitions per biome (3 normal waves each)
const WAVE_DEFS = {
  garden: [
    [{ type: 'weed', count: 4, delay: 800 }, { type: 'slug', count: 3, delay: 1200 }],
    [{ type: 'weed', count: 3, delay: 700 }, { type: 'beetle', count: 2, delay: 1200 }],
    [{ type: 'beetle', count: 2, delay: 1000 }, { type: 'slug', count: 2, delay: 600 }, { type: 'weed', count: 3, delay: 900 }],
  ],
  forest: [
    [{ type: 'woodland_creep', count: 6, delay: 700 }, { type: 'bark_beetle', count: 3, delay: 1200 }],
    [{ type: 'bark_beetle', count: 5, delay: 1000 }, { type: 'tree_spirit', count: 3, delay: 1500 }],
    [{ type: 'bark_beetle', count: 4, delay: 900 }, { type: 'tree_spirit', count: 3, delay: 1400 }, { type: 'woodland_creep', count: 3, delay: 600 }],
  ],
  underroot: [
    [{ type: 'mycelium_creep', count: 8, delay: 400 }, { type: 'cave_fungus', count: 3, delay: 1200 }],
    [{ type: 'cave_fungus', count: 4, delay: 1000 }, { type: 'mycelium_creep', count: 6, delay: 400 }],
    [{ type: 'blind_crawler', count: 2, delay: 1500 }, { type: 'cave_fungus', count: 3, delay: 900 }, { type: 'mycelium_creep', count: 5, delay: 400 }],
  ],
  the_rot: [
    [{ type: 'rot_slug', count: 5, delay: 900 }, { type: 'decay_moth', count: 5, delay: 700 }],
    [{ type: 'blight_walker', count: 4, delay: 1000 }, { type: 'rot_slug', count: 4, delay: 900 }],
    [{ type: 'blight_walker', count: 4, delay: 900 }, { type: 'rot_slug', count: 3, delay: 900 }, { type: 'decay_moth', count: 3, delay: 600 }],
  ],
  canopy: [
    [{ type: 'swarm_moth', count: 8, delay: 350 }, { type: 'leaf_hopper', count: 4, delay: 800 }],
    [{ type: 'leaf_hopper', count: 6, delay: 700 }, { type: 'wind_sprite', count: 4, delay: 900 }],
    [{ type: 'swarm_moth', count: 6, delay: 300 }, { type: 'wind_sprite', count: 3, delay: 800 }, { type: 'leaf_hopper', count: 3, delay: 700 }],
  ],
  emergent: [
    [{ type: 'root_golem', count: 4, delay: 1000 }, { type: 'crystal_crawler', count: 6, delay: 500 }],
    [{ type: 'emerald_briar', count: 3, delay: 800 }, { type: 'root_golem', count: 4, delay: 1000 }, { type: 'crystal_crawler', count: 5, delay: 500 }],
    [{ type: 'root_golem', count: 4, delay: 800 }, { type: 'crystal_crawler', count: 5, delay: 500 }, { type: 'emerald_briar', count: 4, delay: 700 }],
  ],
};
