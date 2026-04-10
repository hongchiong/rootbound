Where we are: Balance tuning — post position-target + Emergent wave adjustments
Goal: Enemies deal meaningful damage; Smart strategy ~30-35% win rate.

What's done:

All mid/late enemy attack values buffed ~30-50% in src/data/enemies.js:
Forest: bark_beetle 10→14, tree_spirit 10→14, woodland_creep 4→6
Underroot: cave_fungus 8→12, mycelium_creep 4→6, blind_crawler 10→15
The Rot: rot_slug 8→12, blight_walker 11→15, decay_moth 6→9
Canopy: swarm_moth 4→6, leaf_hopper 7→10, wind_sprite 12→16
Emergent: root_golem 15→22, crystal_crawler 14→18, emerald_briar 10→15
Boss attacks buffed ~25-33%: Ancient Oak 22→28, Deep Mycelium 15→20, Blight Lord 24→32, Canopy Queen 22→28, World Root 30→40
Boss ability damage buffed (ground slam 10→15, life drain 20→28, spore volley 6→10, corruption wave 12→16, world tremor 15→22, elemental barrage 9→14)
Between-wave healing reduced 60%→50% in both simulate.mjs and src/scenes/ShopScene.js
Garden enemies reverted to near-original (5/7/3), Garden Golem at 20
POSITION_TARGETS tuned: [1.0, 1.5, 2.8, 3.5] → [1.0, 1.35, 2.5, 4.5]
  - Mid targets lowered to ease mid-game transitions (Smart wave 5 deaths reduced)
  - Emergent target raised to make final biome harder
Emergent wave compositions beefed up (more enemies, tighter spawn delays):
  - W1: 3+5 → 4+6, delays 1500/800 → 1000/500
  - W2: 3+3+3 → 3+4+5, delays 1000/1500/800 → 800/1000/500
  - W3: 3+4+3 → 4+5+4, delays 1200/800/900 → 800/500/700

Current simulation results (500 runs):
  Smart:       34.2% win rate ✓ (target 30-35%)
  Pure Bloom:   7.8%
  Pure Root:    6.0%
  Random:       5.8%
  Pure Thorn:   4.4%
  Thorn+Vine:   5.4%
  Root+Bloom:   6.4%
  Balanced:     3.6%
  Pure Vine:    0.4%
  Pure Spore:   0.0%

Smart death distribution (well-balanced across bosses):
  Garden Boss (W4):   16.6%
  Mid-1 Boss (W8):    12.8%
  Mid-2 Boss (W12):   15.8%
  Emergent Boss (W16): 5.6%
  Mid-1 W1 (W5):       9.8% (biome transition)

Emergent non-boss waves: still high HP for Smart (98-100%) but lower for weaker strategies (89-96%). Consistent with overall pattern where non-boss waves get easier as traits accumulate. Bosses are the real checkpoints.

Category win rates: root 26.9%, thorn 25.6%, bloom 25.0%, vine 20.4%, spore 15.7%

What's next:

Consider whether more tuning is needed or if this is ready for playtesting
Potential concerns to monitor:
  - Pure Spore 0% win rate (intentional — spores are debuff/utility, not solo viable)
  - Garden Vine trait at 2.9% win rate (worst trait)
  - Some legendaries underperforming (Spore Sovereign 9.1%, Dimensional Reach 8.3%)
  - Vine category lowest win rate at 20.4%
Update where-we-left-off.md when done
