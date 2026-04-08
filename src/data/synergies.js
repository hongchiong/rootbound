// Cross-category synergies detected once on trait graft
// Each synergy has: id, name, description, requires (conditions), effect (combat flags/stats)

export const SYNERGY_DEFS = [
  {
    id: 'frozen_grasp',
    name: 'Frozen Grasp',
    description: 'Slowed enemies take +50% Frost damage',
    requires: { damageTypes: ['frost'], stats: ['sporeSlow'] },
    effect: { frozenGraspBonus: 0.5 },
  },
  {
    id: 'wildfire',
    name: 'Wildfire',
    description: 'Spores spread fire burn',
    requires: { damageTypes: ['fire'], categories: { spore: 2 } },
    effect: { wildfireSpores: true },
  },
  {
    id: 'elemental_mastery',
    name: 'Elemental Mastery',
    description: '+15% damage per unique element type (max 4)',
    requires: { uniqueDamageTypes: 3 },
    effect: { elementalMasteryBonus: 0.15 },
  },
  {
    id: 'thorny_roots',
    name: 'Thorny Roots',
    description: 'Thorn reflect gains +50% of Armor as bonus damage',
    requires: { categories: { root: 2, thorn: 2 } },
    effect: { thornArmorScaling: 0.5 },
  },
  {
    id: 'venomous_bloom',
    name: 'Venomous Bloom',
    description: 'Kill-heals also drop a poison cloud',
    requires: { damageTypes: ['poison'], stats: ['healOnKill'] },
    effect: { venomousBloomCloud: true },
  },
  {
    id: 'living_fortress',
    name: 'Living Fortress',
    description: 'Regen doubled while above 75% HP, +5 Armor',
    requires: { categories: { root: 3, bloom: 2 } },
    effect: { livingFortress: true, livingFortressThreshold: 0.75, stats: { armor: 5 } },
  },
  {
    id: 'storm_caller',
    name: 'Storm Caller',
    description: 'Lightning chains +2 targets, Frost slow +1s',
    requires: { damageTypes: ['lightning', 'frost'] },
    effect: { stormCallerChains: 2, stormCallerSlowBonus: 1000 },
  },
  {
    id: 'blighted_harvest',
    name: 'Blighted Harvest',
    description: 'DoT kills heal 5% of enemy max HP',
    requires: { damageTypes: ['slash', 'poison'] },
    effect: { blightedHarvestHeal: 0.05 },
  },
  {
    id: 'void_garden',
    name: 'Void Garden',
    description: 'Nature heal doubled, Void suppress lasts 5s',
    requires: { damageTypes: ['void', 'nature'] },
    effect: { voidGardenHealMult: 2.0, voidGardenSuppressDuration: 5000 },
  },
  {
    id: 'rapid_devastation',
    name: 'Rapid Devastation',
    description: 'Every 10th hit in 5s triggers a free AoE explosion',
    requires: { categories: { vine: 3, thorn: 2 } },
    effect: { rapidDevastationThreshold: 10, rapidDevastationWindow: 5000 },
  },
  {
    id: 'spore_snare',
    name: 'Spore Snare',
    description: 'Slowed enemies take +25% damage from all sources',
    requires: { categories: { spore: 2, vine: 1 }, stats: ['sporeSlow'] },
    effect: { sporeSnareBonus: 0.25 },
  },
  {
    id: 'fire_and_ice',
    name: 'Fire and Ice',
    description: 'Frozen enemies that burn: shatter for 15% of their max HP',
    requires: { damageTypes: ['frost', 'fire'] },
    effect: { fireAndIceShatterPercent: 0.15 },
  },
];

// Get synergy hint text for a trait card (which synergies would this trait complete?)
export function getSynergyHints(currentTraits, candidateTrait, synergyDefs = SYNERGY_DEFS) {
  const hypotheticalTraits = [...currentTraits, candidateTrait];

  // Import is circular-safe since we only need the logic
  const categoryCounts = { root: 0, thorn: 0, spore: 0, bloom: 0, vine: 0 };
  const ownedDamageTypes = new Set();
  const ownedStats = new Set();

  for (const t of hypotheticalTraits) {
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

  // Check which synergies are newly completed
  const currentActive = getActiveSynergyIds(currentTraits);
  const completedSynergies = [];

  for (const syn of synergyDefs) {
    if (currentActive.has(syn.id)) continue; // already active
    const req = syn.requires;
    let met = true;
    if (req.categories) {
      for (const [cat, min] of Object.entries(req.categories)) {
        if ((categoryCounts[cat] || 0) < min) { met = false; break; }
      }
    }
    if (met && req.damageTypes) {
      for (const dt of req.damageTypes) {
        if (!ownedDamageTypes.has(dt)) { met = false; break; }
      }
    }
    if (met && req.stats) {
      for (const s of req.stats) {
        if (!ownedStats.has(s)) { met = false; break; }
      }
    }
    if (met && req.uniqueDamageTypes) {
      if (ownedDamageTypes.size < req.uniqueDamageTypes) met = false;
    }
    if (met) completedSynergies.push(syn);
  }

  return completedSynergies;
}

function getActiveSynergyIds(traits) {
  const ids = new Set();
  const categoryCounts = { root: 0, thorn: 0, spore: 0, bloom: 0, vine: 0 };
  const ownedDamageTypes = new Set();
  const ownedStats = new Set();

  for (const t of traits) {
    if (categoryCounts[t.category] !== undefined) categoryCounts[t.category]++;
    if (t.stats) {
      for (const key of Object.keys(t.stats)) {
        ownedStats.add(key);
        if (key === 'damageType' && t.stats.damageType !== 'normal') {
          ownedDamageTypes.add(t.stats.damageType);
        }
      }
    }
  }

  for (const syn of SYNERGY_DEFS) {
    const req = syn.requires;
    let met = true;
    if (req.categories) {
      for (const [cat, min] of Object.entries(req.categories)) {
        if ((categoryCounts[cat] || 0) < min) { met = false; break; }
      }
    }
    if (met && req.damageTypes) {
      for (const dt of req.damageTypes) {
        if (!ownedDamageTypes.has(dt)) { met = false; break; }
      }
    }
    if (met && req.stats) {
      for (const s of req.stats) {
        if (!ownedStats.has(s)) { met = false; break; }
      }
    }
    if (met && req.uniqueDamageTypes) {
      if (ownedDamageTypes.size < req.uniqueDamageTypes) met = false;
    }
    if (met) ids.add(syn.id);
  }

  return ids;
}
