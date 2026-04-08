import Phaser from 'phaser';
import { CATEGORY_COLORS, CATEGORY_MUTATIONS } from '../data/traits.js';

// ── Color Utilities ──────────────────────────────────────────────

function brightenColor(color, amount) {
  const r = Math.min(255, ((color >> 16) & 0xFF) + amount);
  const g = Math.min(255, ((color >> 8) & 0xFF) + amount);
  const b = Math.min(255, (color & 0xFF) + amount);
  return (r << 16) | (g << 8) | b;
}

function darkenColor(color, amount) {
  const r = Math.max(0, ((color >> 16) & 0xFF) - amount);
  const g = Math.max(0, ((color >> 8) & 0xFF) - amount);
  const b = Math.max(0, (color & 0xFF) - amount);
  return (r << 16) | (g << 8) | b;
}

function blendColors(c1, c2, ratio) {
  const r1 = (c1 >> 16) & 0xFF, g1 = (c1 >> 8) & 0xFF, b1 = c1 & 0xFF;
  const r2 = (c2 >> 16) & 0xFF, g2 = (c2 >> 8) & 0xFF, b2 = c2 & 0xFF;
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return (r << 16) | (g << 8) | b;
}

function computeBlendedColor(traits) {
  const RARITY_WEIGHT = { common: 1, uncommon: 2, rare: 4, legendary: 8 };
  let rSum = 0, gSum = 0, bSum = 0, totalWeight = 0;
  for (const t of traits) {
    if (t.visual.color) {
      const w = RARITY_WEIGHT[t.rarity] || 1;
      rSum += ((t.visual.color >> 16) & 0xFF) * w;
      gSum += ((t.visual.color >> 8) & 0xFF) * w;
      bSum += (t.visual.color & 0xFF) * w;
      totalWeight += w;
    }
  }
  if (totalWeight === 0) return null;
  const r = Math.round(rSum / totalWeight);
  const g = Math.round(gSum / totalWeight);
  const b = Math.round(bSum / totalWeight);
  return (r << 16) | (g << 8) | b;
}

// ── Trait DNA System ─────────────────────────────────────────────
// Each trait contributes a deterministic visual "DNA" derived from its ID,
// so every trait combination produces a visually unique seedling.

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

function seededRandom(hash, index) {
  const x = Math.sin(hash * 9301 + index * 49297 + 233) * 49297;
  return x - Math.floor(x);
}

function shiftHue(color, degrees) {
  let r = ((color >> 16) & 0xFF) / 255;
  let g = ((color >> 8) & 0xFF) / 255;
  let b = (color & 0xFF) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = 0; s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  h = (((h * 360 + degrees) % 360) + 360) % 360 / 360;
  if (s === 0) { r = g = b = l; } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

function computeTraitDNA(traits) {
  const dna = {
    hueShift: 0,
    bodySkewX: 0,
    bodySkewY: 0,
    trunkBend: 0,
    sproutCurl: 0,
    sproutForks: 0,
    eyeSizeMod: 0,
    eyeSpacingMod: 0,
    pupilSquash: 0,
    markings: [],
    bodyBumps: [],
  };

  for (const t of traits) {
    const h = hashString(t.id);
    const sr = (n) => seededRandom(h, n);

    // Each trait shifts the hue by ±12 degrees — accumulates to unique color
    dna.hueShift += sr(1) * 24 - 12;
    // Body asymmetry — slight left/right and top/bottom skew
    dna.bodySkewX += sr(2) * 0.05 - 0.025;
    dna.bodySkewY += sr(3) * 0.04 - 0.02;
    // Trunk leans left or right
    dna.trunkBend += sr(4) * 2.5 - 1.25;
    // Sprout curls one direction
    dna.sproutCurl += sr(5) * 0.3 - 0.15;
    // Chance to add a sprout fork
    if (sr(6) > 0.7) dna.sproutForks += 1;
    // Eye tweaks
    dna.eyeSizeMod += sr(7) * 0.08 - 0.04;
    dna.eyeSpacingMod += sr(8) * 0.12 - 0.06;
    dna.pupilSquash += sr(9) * 0.3 - 0.15;

    // Each trait adds 1-2 unique body markings at deterministic positions
    const markCount = sr(10) > 0.6 ? 2 : 1;
    for (let m = 0; m < markCount; m++) {
      dna.markings.push({
        angle: sr(11 + m * 5) * Math.PI * 2,
        dist: 0.35 + sr(12 + m * 5) * 0.45,
        size: 0.6 + sr(13 + m * 5) * 1.2,
        type: Math.floor(sr(14 + m * 5) * 4), // 0=dot, 1=dash, 2=arc, 3=ring
        hue: sr(15 + m * 5) * 360,
      });
    }

    // Each trait adds a unique body surface bump/indent
    dna.bodyBumps.push({
      angle: sr(21) * Math.PI * 2,
      magnitude: sr(22) * 0.12 - 0.04, // mostly outward bumps
    });
  }

  // Clamp accumulated values to sane ranges
  dna.hueShift = Math.max(-60, Math.min(60, dna.hueShift));
  dna.bodySkewX = Math.max(-0.15, Math.min(0.15, dna.bodySkewX));
  dna.bodySkewY = Math.max(-0.12, Math.min(0.12, dna.bodySkewY));
  dna.trunkBend = Math.max(-6, Math.min(6, dna.trunkBend));
  dna.sproutCurl = Math.max(-0.8, Math.min(0.8, dna.sproutCurl));
  dna.sproutForks = Math.min(3, dna.sproutForks);
  dna.eyeSizeMod = Math.max(-0.15, Math.min(0.2, dna.eyeSizeMod));
  dna.eyeSpacingMod = Math.max(-0.2, Math.min(0.25, dna.eyeSpacingMod));
  dna.pupilSquash = Math.max(-0.5, Math.min(0.5, dna.pupilSquash));

  return dna;
}

// ── Main Entry ───────────────────────────────────────────────────

export function generateTextures(scene) {
  generateSeedlingBase(scene);
  generateEnemyTextures(scene);
  generateBiomeEnemyTextures(scene);
  generateBossTexture(scene);
  generateBiomeBossTextures(scene);
  generateProjectileTexture(scene);
  generateParticleTextures(scene);
  generateCategoryIcons(scene);
  generateStatusIcons(scene);
  generateUITextures(scene);
}

// ── Base Seedling (48x48) — cute, likeable starter ───────────────

function generateSeedlingBase(scene) {
  const size = 48;
  const g = scene.make.graphics({ add: false });
  const cx = 24;
  const cy = 26;

  drawCuteSeedling(g, cx, cy, 0x44BB44, 1.0);

  g.generateTexture('seedling_base', size, size);
  g.destroy();
}

function drawCuteSeedling(g, cx, cy, baseColor, scale) {
  const s = scale;

  // Ground shadow (below mound)
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(cx, cy + Math.round(16 * s), Math.round(18 * s), Math.round(4 * s));

  // Soil mound
  g.fillStyle(0x5A3A1A);
  g.fillEllipse(cx, cy + Math.round(13 * s), Math.round(22 * s), Math.round(8 * s));
  // Mound highlight
  g.fillStyle(0x7B5230, 0.6);
  g.fillEllipse(cx, cy + Math.round(12 * s), Math.round(16 * s), Math.round(5 * s));

  // Ground roots — thin tendrils from mound edges
  g.lineStyle(1, darkenColor(baseColor, 40));
  g.lineBetween(cx - Math.round(10 * s), cy + Math.round(14 * s), cx - Math.round(15 * s), cy + Math.round(16 * s));
  g.lineBetween(cx + Math.round(10 * s), cy + Math.round(14 * s), cx + Math.round(15 * s), cy + Math.round(16 * s));

  // Tapered trunk — wider at mound, narrow at body
  g.fillStyle(darkenColor(baseColor, 20));
  g.fillTriangle(
    cx - Math.round(4 * s), cy + Math.round(10 * s),
    cx + Math.round(4 * s), cy + Math.round(10 * s),
    cx - Math.round(2 * s), cy - Math.round(6 * s),
  );
  g.fillTriangle(
    cx + Math.round(4 * s), cy + Math.round(10 * s),
    cx + Math.round(2 * s), cy - Math.round(6 * s),
    cx - Math.round(2 * s), cy - Math.round(6 * s),
  );
  // Trunk highlight
  g.fillStyle(brightenColor(baseColor, 10));
  g.fillTriangle(
    cx, cy + Math.round(10 * s),
    cx + Math.round(2 * s), cy + Math.round(10 * s),
    cx + Math.round(1 * s), cy - Math.round(6 * s),
  );

  // Body — teardrop shape via overlapping circles
  g.fillStyle(darkenColor(baseColor, 10)); // shadow side
  g.fillCircle(cx - Math.round(1 * s), cy + Math.round(1 * s), Math.round(10 * s));
  g.fillStyle(baseColor);
  g.fillCircle(cx, cy, Math.round(9 * s));
  g.fillStyle(brightenColor(baseColor, 25)); // highlight
  g.fillCircle(cx + Math.round(2 * s), cy - Math.round(2 * s), Math.round(6 * s));

  // Left leaf — pointed, with vein
  const leafColor = brightenColor(baseColor, 35);
  const leafDark = darkenColor(baseColor, 5);
  g.fillStyle(leafColor);
  // Left leaf body
  g.fillEllipse(cx - Math.round(8 * s), cy - Math.round(14 * s), Math.round(12 * s), Math.round(7 * s));
  // Left leaf tip
  g.fillTriangle(
    cx - Math.round(14 * s), cy - Math.round(15 * s),
    cx - Math.round(11 * s), cy - Math.round(12 * s),
    cx - Math.round(11 * s), cy - Math.round(17 * s),
  );
  // Left leaf vein
  g.lineStyle(1, leafDark);
  g.lineBetween(cx - Math.round(3 * s), cy - Math.round(13 * s), cx - Math.round(13 * s), cy - Math.round(15 * s));

  // Right leaf — slightly different angle
  g.fillStyle(brightenColor(baseColor, 40));
  g.fillEllipse(cx + Math.round(8 * s), cy - Math.round(13 * s), Math.round(11 * s), Math.round(7 * s));
  g.fillTriangle(
    cx + Math.round(13 * s), cy - Math.round(14 * s),
    cx + Math.round(10 * s), cy - Math.round(11 * s),
    cx + Math.round(10 * s), cy - Math.round(16 * s),
  );
  g.lineStyle(1, leafDark);
  g.lineBetween(cx + Math.round(3 * s), cy - Math.round(12 * s), cx + Math.round(12 * s), cy - Math.round(14 * s));

  // Top sprout
  g.fillStyle(brightenColor(baseColor, 50));
  g.fillTriangle(
    cx, cy - Math.round(20 * s),
    cx - Math.round(2 * s), cy - Math.round(12 * s),
    cx + Math.round(2 * s), cy - Math.round(12 * s),
  );

  // Eyes — large oval Digimon-style, no expressions
  // Outer eye white
  g.fillStyle(0xEEFFEE);
  g.fillEllipse(cx - Math.round(4 * s), cy - Math.round(1 * s), Math.round(7 * s), Math.round(8 * s));
  g.fillEllipse(cx + Math.round(4 * s), cy - Math.round(1 * s), Math.round(7 * s), Math.round(8 * s));
  // Iris — deep teal
  g.fillStyle(0x1A7A5E);
  g.fillEllipse(cx - Math.round(4 * s), cy - Math.round(0.5 * s), Math.round(5 * s), Math.round(6 * s));
  g.fillEllipse(cx + Math.round(4 * s), cy - Math.round(0.5 * s), Math.round(5 * s), Math.round(6 * s));
  // Pupil
  g.fillStyle(0x0A0A0A);
  g.fillEllipse(cx - Math.round(4 * s), cy, Math.round(3 * s), Math.round(4 * s));
  g.fillEllipse(cx + Math.round(4 * s), cy, Math.round(3 * s), Math.round(4 * s));
  // Bright anime highlight — top-left of each eye
  g.fillStyle(0xFFFFFF);
  g.fillCircle(cx - Math.round(5.5 * s), cy - Math.round(2 * s), Math.round(1.5 * s));
  g.fillCircle(cx + Math.round(2.5 * s), cy - Math.round(2 * s), Math.round(1.5 * s));
  // Small secondary highlight
  g.fillStyle(0xCCFFCC, 0.7);
  g.fillCircle(cx - Math.round(3.5 * s), cy + Math.round(0.5 * s), Math.round(0.8 * s));
  g.fillCircle(cx + Math.round(4.5 * s), cy + Math.round(0.5 * s), Math.round(0.8 * s));
}

// ── Evolved Seedling (64x64) — the star of the run ──────────────

export function generateSeedlingTexture(scene, traits, textureKey = 'seedling_custom') {
  const totalVis = countVisuals(traits);
  const mut = computeMutationState(totalVis, traits);
  const totalElements = totalVis.roots + totalVis.thorns + totalVis.spores + totalVis.blooms + totalVis.vines;

  // Dynamic size based on body scale and element count
  let size = 64;
  if (totalElements >= 5 || mut.bodyScale > 1.1) size = 72;
  if (mut.bodyScale > 1.2 || totalElements >= 8) size = 80;

  const g = scene.make.graphics({ add: false });
  const cx = size / 2;
  const cy = size / 2 + 2;

  const tintColor = computeBlendedColor(traits);
  const bodyColor = tintColor ? blendColors(0x44BB44, tintColor, 0.5) : 0x44BB44;

  // Layer 1: Roots (below everything)
  drawRoots(g, cx, cy, totalVis.roots, mut);

  // Layer 2: Vines (behind body)
  drawVines(g, cx, cy, totalVis.vines, mut);

  // Layer 3: Mutated body (includes shadow, body shape, textures, eyes, leaves)
  drawMutatedSeedling(g, cx, cy, bodyColor, 1.15, mut);

  // Layer 4: Thorns (on body, reduced if body has ridges)
  const thornCount = mut.hasBodyRidges ? Math.max(0, totalVis.thorns - 2) : totalVis.thorns;
  drawThorns(g, cx, cy, thornCount, mut);

  // Layer 5: Blooms (reduced if integrated into body)
  const bloomCount = mut.hasIntegratedFlowers ? Math.max(0, totalVis.blooms - 2) : totalVis.blooms;
  drawBlooms(g, cx, cy, bloomCount, mut);

  // Layer 6: Spores (softer when mist is active)
  drawSpores(g, cx, cy, totalVis.spores, mut);

  // Layer 7: Overlay shimmer particles
  if (mut.hasShimmer) {
    g.fillStyle(0xFFFFFF, 0.3);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.5;
      const dist = 12 + (i % 2) * 5;
      g.fillCircle(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 1);
    }
  }

  // Layer 8: Trait-specific visual signatures
  drawSignatures(g, cx, cy, 1.15, traits, mut);

  if (scene.textures.exists(textureKey)) {
    scene.textures.remove(textureKey);
  }
  g.generateTexture(textureKey, size, size);
  g.destroy();
  return textureKey;
}

// ── Victory Seedling (128x128) — showcase masterpiece ────────────

export function generateVictorySeedlingTexture(scene, traits, textureKey = 'seedling_victory') {
  const size = 128;
  const g = scene.make.graphics({ add: false });
  const cx = size / 2;
  const cy = size / 2 + 4;

  const totalVis = countVisuals(traits);
  const mut = computeMutationState(totalVis, traits);
  const tintColor = computeBlendedColor(traits);
  const bodyColor = tintColor ? blendColors(0x44BB44, tintColor, 0.5) : 0x44BB44;

  // Dominant trait color for glow
  let dominant = bodyColor;
  let maxCount = 0;
  const cats = { root: totalVis.roots, thorn: totalVis.thorns, spore: totalVis.spores, bloom: totalVis.blooms, vine: totalVis.vines };
  for (const [cat, count] of Object.entries(cats)) {
    if (count > maxCount) { maxCount = count; dominant = CATEGORY_COLORS[cat]; }
  }

  // Radial glow halo
  g.fillStyle(dominant, 0.08);
  g.fillCircle(cx, cy, 58);
  g.fillStyle(dominant, 0.05);
  g.fillCircle(cx, cy, 50);
  g.fillStyle(dominant, 0.12);
  g.fillCircle(cx, cy, 38);

  // Layer 1: Roots at 2x
  drawRootsLarge(g, cx, cy, totalVis.roots);

  // Layer 2: Vines at 2x (behind body)
  drawVinesLarge(g, cx, cy, totalVis.vines, mut);

  // Layer 3: Mutated body at 2x scale (shadow, body shape, textures, eyes, leaves)
  drawMutatedSeedling(g, cx, cy, bodyColor, 2.0, mut);

  // Layer 4: Thorns at 2x
  const thornCount = mut.hasBodyRidges ? Math.max(0, totalVis.thorns - 2) : totalVis.thorns;
  drawThornsLarge(g, cx, cy, thornCount, mut);

  // Layer 5: Blooms at 2x
  const bloomCount = mut.hasIntegratedFlowers ? Math.max(0, totalVis.blooms - 2) : totalVis.blooms;
  drawBloomsLarge(g, cx, cy, bloomCount, mut);

  // Layer 6: Spores at 2x
  drawSporesLarge(g, cx, cy, totalVis.spores, mut);

  // Sparkle dots
  const sparkles = [[cx - 30, cy - 35], [cx + 28, cy - 30], [cx - 25, cy + 20],
    [cx + 32, cy + 15], [cx - 10, cy - 40], [cx + 18, cy - 42]];
  g.fillStyle(0xFFFFFF, 0.5);
  for (const [sx, sy] of sparkles) {
    g.fillCircle(sx, sy, 1);
    g.lineStyle(1, 0xFFFFFF, 0.3);
    g.lineBetween(sx - 3, sy, sx + 3, sy);
    g.lineBetween(sx, sy - 3, sx, sy + 3);
  }

  // Overlay shimmer particles at victory scale
  if (mut.hasShimmer) {
    g.fillStyle(0xFFFFFF, 0.35);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.3;
      const dist = 24 + (i % 2) * 10;
      g.fillCircle(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 1.5);
    }
  }

  // Layer 8: Trait-specific visual signatures at victory scale
  drawSignatures(g, cx, cy, 2.0, traits, mut);

  if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
  g.generateTexture(textureKey, size, size);
  g.destroy();
  return textureKey;
}

// ── Signature Drawing System ─────────────────────────────────────
// Each rare/legendary trait can have a unique visual signature that
// draws a distinctive overlay element on the seedling.

// Generic helpers used by signature functions
function drawParticleRing(g, cx, cy, radius, color, alpha, count, size) {
  g.fillStyle(color, alpha);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.4;
    g.fillCircle(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, size);
  }
}

function drawGlowCircle(g, cx, cy, radius, color, alpha) {
  g.fillStyle(color, alpha);
  g.fillCircle(cx, cy, radius);
  g.fillStyle(color, alpha * 0.5);
  g.fillCircle(cx, cy, radius * 1.4);
}

function drawRadialLines(g, cx, cy, innerR, outerR, color, alpha, count) {
  g.lineStyle(1, color, alpha);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    g.lineBetween(
      cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR,
      cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR,
    );
  }
}

function drawScatteredDots(g, cx, cy, radius, color, alpha, count, size) {
  g.fillStyle(color, alpha);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + i * 0.7;
    const dist = radius * (0.5 + (i % 3) * 0.2);
    g.fillCircle(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, size);
  }
}

// ── Root Signatures ──

function drawIronPlates(g, cx, cy, s, mut) {
  const r = 9 * s * mut.bodyScale;
  g.fillStyle(0x888899, 0.5);
  for (let i = 0; i < 4; i++) {
    const angle = -Math.PI * 0.8 + i * 0.5;
    const bx = cx + Math.cos(angle) * r;
    const by = cy + Math.sin(angle) * r;
    g.fillRect(bx - 2 * s, by - 1 * s, 4 * s, 2 * s);
  }
  g.fillStyle(0xAABBCC, 0.3);
  for (let i = 0; i < 3; i++) {
    const angle = -Math.PI * 0.7 + i * 0.5;
    const bx = cx + Math.cos(angle) * r;
    const by = cy + Math.sin(angle) * r;
    g.fillRect(bx - 1 * s, by - 0.5 * s, 2 * s, 1 * s);
  }
}

function drawFrostCrystals(g, cx, cy, s, mut) {
  const r = 10 * s * mut.bodyScale;
  const iceColor = 0xAADDFF;
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + 0.2;
    const bx = cx + Math.cos(angle) * r;
    const by = cy + Math.sin(angle) * r;
    // 6-pointed crystal
    g.lineStyle(1, iceColor, 0.7);
    for (let j = 0; j < 3; j++) {
      const a2 = j * Math.PI / 3;
      g.lineBetween(bx + Math.cos(a2) * 2.5 * s, by + Math.sin(a2) * 2.5 * s,
        bx - Math.cos(a2) * 2.5 * s, by - Math.sin(a2) * 2.5 * s);
    }
    g.fillStyle(0xCCEEFF, 0.4);
    g.fillCircle(bx, by, 1 * s);
  }
}

function drawStoneCracks(g, cx, cy, s, mut) {
  const r = 8 * s * mut.bodyScale;
  g.lineStyle(1.5, 0x555555, 0.6);
  // Major crack from top to bottom-right
  g.lineBetween(cx - 2 * s, cy - r * 0.7, cx + 1 * s, cy);
  g.lineBetween(cx + 1 * s, cy, cx + 3 * s, cy + r * 0.5);
  // Branch crack
  g.lineStyle(1, 0x666666, 0.4);
  g.lineBetween(cx + 1 * s, cy, cx - 2 * s, cy + r * 0.4);
  g.lineBetween(cx - 2 * s, cy - r * 0.7, cx - 4 * s, cy - r * 0.3);
  // Stone grain dots
  g.fillStyle(0x777777, 0.3);
  g.fillCircle(cx + 3 * s, cy - 2 * s, 1 * s);
  g.fillCircle(cx - 3 * s, cy + 1 * s, 0.8 * s);
}

function drawScaleArmor(g, cx, cy, s, mut) {
  const r = 8 * s * mut.bodyScale;
  const scaleColor = 0x7A9955;
  g.fillStyle(scaleColor, 0.4);
  // Overlapping scales on lower body
  for (let row = 0; row < 3; row++) {
    for (let col = -1; col <= 1; col++) {
      const sx = cx + col * 4 * s + (row % 2) * 2 * s;
      const sy = cy + row * 3 * s;
      g.fillEllipse(sx, sy, 3.5 * s, 2.5 * s);
    }
  }
  g.lineStyle(0.5, darkenColor(scaleColor, 30), 0.3);
  for (let row = 0; row < 3; row++) {
    for (let col = -1; col <= 1; col++) {
      const sx = cx + col * 4 * s + (row % 2) * 2 * s;
      const sy = cy + row * 3 * s;
      g.strokeEllipse(sx, sy, 3.5 * s, 2.5 * s);
    }
  }
}

function drawAncientRunes(g, cx, cy, s, mut) {
  const r = 7 * s * mut.bodyScale;
  const runeColor = 0x88CCAA;
  g.lineStyle(1, runeColor, 0.5);
  // Rune 1: vertical with crossbar
  g.lineBetween(cx - 4 * s, cy - 3 * s, cx - 4 * s, cy + 3 * s);
  g.lineBetween(cx - 5.5 * s, cy - 1 * s, cx - 2.5 * s, cy - 1 * s);
  // Rune 2: diamond
  g.lineBetween(cx + 4 * s, cy - 3 * s, cx + 6 * s, cy);
  g.lineBetween(cx + 6 * s, cy, cx + 4 * s, cy + 3 * s);
  g.lineBetween(cx + 4 * s, cy + 3 * s, cx + 2 * s, cy);
  g.lineBetween(cx + 2 * s, cy, cx + 4 * s, cy - 3 * s);
  // Glow dots at rune centers
  g.fillStyle(runeColor, 0.35);
  g.fillCircle(cx - 4 * s, cy, 1.2 * s);
  g.fillCircle(cx + 4 * s, cy, 1.2 * s);
}

function drawGoldenCrown(g, cx, cy, s, mut) {
  const crownY = cy - 14 * s * mut.bodyScale;
  // Halo ring
  g.lineStyle(1.5, 0xFFDD44, 0.6);
  g.strokeEllipse(cx, crownY, 12 * s, 4 * s);
  // Crown points
  g.fillStyle(0xFFDD44, 0.5);
  g.fillTriangle(cx - 5 * s, crownY, cx - 4 * s, crownY - 3 * s, cx - 3 * s, crownY);
  g.fillTriangle(cx - 1 * s, crownY, cx, crownY - 4 * s, cx + 1 * s, crownY);
  g.fillTriangle(cx + 3 * s, crownY, cx + 4 * s, crownY - 3 * s, cx + 5 * s, crownY);
  // Glow
  g.fillStyle(0xFFEE88, 0.15);
  g.fillCircle(cx, crownY, 8 * s);
}

function drawCrystalline(g, cx, cy, s, mut) {
  const r = 9 * s * mut.bodyScale;
  // Faceted diamond shapes on body
  g.fillStyle(0xAAFFFF, 0.25);
  g.lineStyle(0.5, 0xCCFFFF, 0.5);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.3;
    const fx = cx + Math.cos(angle) * r * 0.6;
    const fy = cy + Math.sin(angle) * r * 0.6;
    // Diamond facet
    g.fillTriangle(fx, fy - 3 * s, fx - 2 * s, fy, fx + 2 * s, fy);
    g.fillTriangle(fx, fy + 2.5 * s, fx - 2 * s, fy, fx + 2 * s, fy);
  }
  // Central sparkle
  g.fillStyle(0xFFFFFF, 0.4);
  g.fillCircle(cx + 2 * s, cy - 2 * s, 1.5 * s);
  g.lineStyle(0.5, 0xFFFFFF, 0.3);
  g.lineBetween(cx, cy - 4 * s, cx + 4 * s, cy);
  g.lineBetween(cx - 3 * s, cy - 1 * s, cx + 1 * s, cy + 3 * s);
}

function drawMirrorShield(g, cx, cy, s, mut) {
  const r = 11 * s * mut.bodyScale;
  // Shield circle
  g.fillStyle(0xCC88FF, 0.12);
  g.fillCircle(cx, cy, r);
  g.lineStyle(1.5, 0xCC88FF, 0.4);
  g.strokeCircle(cx, cy, r);
  // Inner reflection arc
  g.lineStyle(1, 0xDDBBFF, 0.3);
  g.beginPath();
  g.arc(cx - 2 * s, cy - 2 * s, r * 0.6, -Math.PI * 0.3, Math.PI * 0.3);
  g.strokePath();
  // Highlight gleam
  g.fillStyle(0xFFFFFF, 0.25);
  g.fillCircle(cx - 3 * s, cy - 3 * s, 2 * s);
}

// ── Thorn Signatures ──

function drawVoidWisps(g, cx, cy, s, mut) {
  const r = 12 * s * mut.bodyScale;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.8;
    const dist = r * (0.8 + (i % 2) * 0.3);
    const wx = cx + Math.cos(angle) * dist;
    const wy = cy + Math.sin(angle) * dist;
    // Wisp trail
    g.fillStyle(0x6633AA, 0.35);
    g.fillCircle(wx, wy, 1.5 * s);
    g.fillStyle(0x8844CC, 0.2);
    g.fillCircle(wx + Math.cos(angle) * 2 * s, wy + Math.sin(angle) * 2 * s, 1 * s);
    g.fillStyle(0xAA66DD, 0.1);
    g.fillCircle(wx + Math.cos(angle) * 4 * s, wy + Math.sin(angle) * 4 * s, 0.7 * s);
  }
}

function drawPoisonDrip(g, cx, cy, s, mut) {
  const baseY = cy + 10 * s * mut.bodyScale;
  g.fillStyle(0x44CC44, 0.5);
  // Drip drops at different heights
  for (let i = 0; i < 4; i++) {
    const dx = cx + (i - 1.5) * 3 * s;
    const dy = baseY + (i % 3) * 2.5 * s;
    // Teardrop shape
    g.fillCircle(dx, dy, 1.2 * s);
    g.fillTriangle(dx - 1 * s, dy, dx + 1 * s, dy, dx, dy - 2 * s);
  }
  // Splash puddle
  g.fillStyle(0x33AA33, 0.2);
  g.fillEllipse(cx, baseY + 5 * s, 10 * s, 2 * s);
}

function drawBladeGlint(g, cx, cy, s, mut) {
  // White flash lines at thorn positions
  g.lineStyle(1, 0xFFFFFF, 0.6);
  const r = 10 * s * mut.bodyScale;
  for (let i = 0; i < 3; i++) {
    const angle = -Math.PI * 0.4 + i * 0.4;
    const bx = cx + Math.cos(angle) * r;
    const by = cy + Math.sin(angle) * r;
    // Small star glint
    g.lineBetween(bx - 2 * s, by, bx + 2 * s, by);
    g.lineBetween(bx, by - 2 * s, bx, by + 2 * s);
    g.fillStyle(0xFFFFFF, 0.4);
    g.fillCircle(bx, by, 0.8 * s);
  }
}

function drawBloodSplatter(g, cx, cy, s, mut) {
  const r = 12 * s * mut.bodyScale;
  g.fillStyle(0xAA1111, 0.4);
  const positions = [
    [-0.7, -0.5], [0.8, -0.3], [-0.4, 0.7], [0.6, 0.6], [-0.9, 0.1], [0.3, -0.8],
  ];
  for (const [px, py] of positions) {
    const bx = cx + px * r;
    const by = cy + py * r;
    g.fillCircle(bx, by, (0.6 + Math.abs(px) * 0.5) * s);
  }
  // Streaks
  g.lineStyle(1, 0x881111, 0.3);
  g.lineBetween(cx + 0.8 * r, cy - 0.3 * r, cx + 0.9 * r, cy + 0.1 * r);
  g.lineBetween(cx - 0.7 * r, cy - 0.5 * r, cx - 0.8 * r, cy - 0.1 * r);
}

function drawRotAura(g, cx, cy, s, mut) {
  const r = 11 * s * mut.bodyScale;
  drawScatteredDots(g, cx, cy, r, 0x884422, 0.35, 6, 1.2 * s);
  drawScatteredDots(g, cx, cy + 2 * s, r * 0.7, 0x663311, 0.25, 4, 0.8 * s);
  // Decay cloud
  g.fillStyle(0x775533, 0.1);
  g.fillCircle(cx, cy + 3 * s, r * 0.8);
}

function drawShadowForm(g, cx, cy, s, mut) {
  const r = 9 * s * mut.bodyScale;
  // Dark overlay on body
  g.fillStyle(0x111111, 0.3);
  g.fillEllipse(cx, cy, r * 2, r * 2);
  // Deeper shadow core
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, cy, r * 1.4, r * 1.4);
  // Glowing eye accent
  g.fillStyle(0xFF2222, 0.5);
  g.fillCircle(cx - 2 * s, cy - 1 * s, 0.8 * s);
  g.fillCircle(cx + 3 * s, cy - 1 * s, 0.8 * s);
}

function drawSoulWisps(g, cx, cy, s, mut) {
  const r = 13 * s * mut.bodyScale;
  // Ghostly wisps being pulled toward center
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + 0.6;
    const outerX = cx + Math.cos(angle) * r;
    const outerY = cy + Math.sin(angle) * r;
    const midX = cx + Math.cos(angle) * r * 0.6;
    const midY = cy + Math.sin(angle) * r * 0.6;
    // Wisp tail (outer, faint)
    g.fillStyle(0xCCBBDD, 0.15);
    g.fillCircle(outerX, outerY, 1.5 * s);
    // Wisp body (mid, stronger)
    g.fillStyle(0xDDCCEE, 0.3);
    g.fillCircle(midX, midY, 1 * s);
    // Trail line
    g.lineStyle(0.5, 0xCCBBDD, 0.2);
    g.lineBetween(outerX, outerY, midX, midY);
  }
}

function drawPrismatic(g, cx, cy, s, mut) {
  const r = 11 * s * mut.bodyScale;
  const colors = [0xFF4444, 0xFF8844, 0xFFFF44, 0x44FF44, 0x4444FF, 0xFF44FF];
  for (let i = 0; i < colors.length; i++) {
    const angle = (i / colors.length) * Math.PI * 2 + 0.2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    g.fillStyle(colors[i], 0.5);
    g.fillCircle(px, py, 1.5 * s);
    // Glow ring
    g.fillStyle(colors[i], 0.15);
    g.fillCircle(px, py, 3 * s);
  }
}

// ── Spore Signatures ──

function drawDeathCloud(g, cx, cy, s, mut) {
  const cloudY = cy - 13 * s * mut.bodyScale;
  // Skull-like cloud puff
  g.fillStyle(0x664466, 0.3);
  g.fillCircle(cx, cloudY, 4 * s);
  g.fillCircle(cx - 3 * s, cloudY + 1 * s, 3 * s);
  g.fillCircle(cx + 3 * s, cloudY + 1 * s, 3 * s);
  // Eye holes
  g.fillStyle(0x220022, 0.5);
  g.fillCircle(cx - 1.5 * s, cloudY - 0.5 * s, 1 * s);
  g.fillCircle(cx + 1.5 * s, cloudY - 0.5 * s, 1 * s);
  // Nose
  g.fillStyle(0x220022, 0.3);
  g.fillTriangle(cx, cloudY + 0.5 * s, cx - 0.5 * s, cloudY + 1.5 * s, cx + 0.5 * s, cloudY + 1.5 * s);
}

function drawContagionRings(g, cx, cy, s, mut) {
  const r = 10 * s * mut.bodyScale;
  g.lineStyle(1, 0x99CC44, 0.3);
  g.strokeCircle(cx, cy, r);
  g.lineStyle(0.8, 0x99CC44, 0.2);
  g.strokeCircle(cx, cy, r * 1.3);
  g.lineStyle(0.5, 0x99CC44, 0.12);
  g.strokeCircle(cx, cy, r * 1.6);
  // Contagion dots on rings
  g.fillStyle(0xBBDD55, 0.35);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 0.67;
    g.fillCircle(cx + Math.cos(angle) * r * 1.3, cy + Math.sin(angle) * r * 1.3, 1 * s);
  }
}

function drawFlameParticles(g, cx, cy, s, mut) {
  const r = 11 * s * mut.bodyScale;
  const flameColors = [0xFF4400, 0xFF8800, 0xFFCC00, 0xFF6600];
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2 + 0.5;
    const dist = r * (0.7 + (i % 3) * 0.15);
    const fx = cx + Math.cos(angle) * dist;
    const fy = cy + Math.sin(angle) * dist;
    const color = flameColors[i % flameColors.length];
    // Flame teardrop (inverted - pointing up)
    g.fillStyle(color, 0.45);
    g.fillCircle(fx, fy, 1.2 * s);
    g.fillTriangle(fx - 0.8 * s, fy, fx + 0.8 * s, fy, fx, fy - 2.5 * s);
  }
}

function drawVoidMist(g, cx, cy, s, mut) {
  const baseY = cy + 8 * s * mut.bodyScale;
  // Dark mist pool
  g.fillStyle(0x331155, 0.25);
  g.fillEllipse(cx, baseY + 4 * s, 18 * s, 6 * s);
  g.fillStyle(0x220044, 0.15);
  g.fillEllipse(cx, baseY + 3 * s, 14 * s, 4 * s);
  // Mist wisps rising
  g.fillStyle(0x553388, 0.2);
  g.fillCircle(cx - 5 * s, baseY, 2 * s);
  g.fillCircle(cx + 4 * s, baseY - 1 * s, 1.5 * s);
  g.fillCircle(cx, baseY - 2 * s, 1.8 * s);
}

function drawGravityDistortion(g, cx, cy, s, mut) {
  const r = 12 * s * mut.bodyScale;
  // Inward-pointing lines (gravity pull)
  g.lineStyle(1, 0x9966CC, 0.35);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const outerX = cx + Math.cos(angle) * r;
    const outerY = cy + Math.sin(angle) * r;
    const innerX = cx + Math.cos(angle) * r * 0.5;
    const innerY = cy + Math.sin(angle) * r * 0.5;
    g.lineBetween(outerX, outerY, innerX, innerY);
    // Arrow head
    g.fillStyle(0x9966CC, 0.3);
    g.fillCircle(innerX, innerY, 0.8 * s);
  }
}

function drawFungalCap(g, cx, cy, s, mut) {
  const capY = cy - 12 * s * mut.bodyScale;
  // Mushroom cap dome
  g.fillStyle(0x9944CC, 0.5);
  g.fillEllipse(cx, capY, 14 * s, 6 * s);
  // Cap highlight
  g.fillStyle(0xBB66DD, 0.3);
  g.fillEllipse(cx - 1 * s, capY - 1.5 * s, 10 * s, 3 * s);
  // Spots on cap
  g.fillStyle(0xDDAAEE, 0.4);
  g.fillCircle(cx - 3 * s, capY - 0.5 * s, 1.2 * s);
  g.fillCircle(cx + 2 * s, capY + 0.5 * s, 1 * s);
  g.fillCircle(cx + 4.5 * s, capY - 0.5 * s, 0.8 * s);
  // Cap underside (gills)
  g.lineStyle(0.5, 0x774499, 0.3);
  g.lineBetween(cx - 5 * s, capY + 2 * s, cx + 5 * s, capY + 2 * s);
}

function drawRadiationGlow(g, cx, cy, s, mut) {
  const r = 9 * s * mut.bodyScale;
  // Bright yellow-green inner glow
  g.fillStyle(0xCCFF00, 0.12);
  g.fillCircle(cx, cy, r * 1.3);
  g.fillStyle(0xEEFF44, 0.08);
  g.fillCircle(cx, cy, r * 1.7);
  // Radiation symbol hint (3 sectors)
  g.fillStyle(0xDDFF22, 0.2);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(angle) * r * 0.5;
    const py = cy + Math.sin(angle) * r * 0.5;
    g.fillCircle(px, py, 2 * s);
  }
}

function drawMiasmaTendrils(g, cx, cy, s, mut) {
  const r = 10 * s * mut.bodyScale;
  g.lineStyle(1.5, 0x44CC88, 0.4);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + 0.3;
    let tx = cx + Math.cos(angle) * r * 0.3;
    let ty = cy + Math.sin(angle) * r * 0.3;
    // Wispy curved tendril
    for (let seg = 0; seg < 3; seg++) {
      const nx = tx + Math.cos(angle + seg * 0.4) * 3.5 * s;
      const ny = ty + Math.sin(angle + seg * 0.3 + 0.2) * 3.5 * s;
      g.lineBetween(tx, ty, nx, ny);
      tx = nx;
      ty = ny;
    }
    // Tendril tip
    g.fillStyle(0x66DDAA, 0.3);
    g.fillCircle(tx, ty, 1 * s);
  }
}

// ── Bloom Signatures ──

function drawLifePulse(g, cx, cy, s, mut) {
  const r = 10 * s * mut.bodyScale;
  // Soft green pulse ring
  g.lineStyle(2, 0x44DD66, 0.25);
  g.strokeCircle(cx, cy, r);
  g.lineStyle(1, 0x66EE88, 0.15);
  g.strokeCircle(cx, cy, r * 1.25);
  // Inner pulse glow
  g.fillStyle(0x44FF66, 0.06);
  g.fillCircle(cx, cy, r);
}

function drawRotVeins(g, cx, cy, s, mut) {
  const r = 8 * s * mut.bodyScale;
  g.lineStyle(1, 0xAA2233, 0.5);
  // Branching vein pattern
  g.lineBetween(cx, cy - r * 0.5, cx - 3 * s, cy + r * 0.3);
  g.lineBetween(cx - 3 * s, cy + r * 0.3, cx - 5 * s, cy + r * 0.6);
  g.lineBetween(cx - 3 * s, cy + r * 0.3, cx - 1 * s, cy + r * 0.7);
  g.lineStyle(0.8, 0x882233, 0.35);
  g.lineBetween(cx + 1 * s, cy - r * 0.3, cx + 4 * s, cy + r * 0.2);
  g.lineBetween(cx + 4 * s, cy + r * 0.2, cx + 3 * s, cy + r * 0.6);
  g.lineBetween(cx + 4 * s, cy + r * 0.2, cx + 6 * s, cy + r * 0.5);
}

function drawBloodThorns(g, cx, cy, s, mut) {
  const r = 10 * s * mut.bodyScale;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const bx = cx + Math.cos(angle) * r * 0.7;
    const by = cy + Math.sin(angle) * r * 0.7;
    // Small red thorn
    g.fillStyle(0xCC2244, 0.6);
    g.fillTriangle(
      bx + Math.cos(angle) * 3 * s, by + Math.sin(angle) * 3 * s,
      bx + Math.cos(angle + 0.5) * 1 * s, by + Math.sin(angle + 0.5) * 1 * s,
      bx + Math.cos(angle - 0.5) * 1 * s, by + Math.sin(angle - 0.5) * 1 * s,
    );
    // Blood drip
    g.fillStyle(0xAA1133, 0.4);
    const tipX = bx + Math.cos(angle) * 3 * s;
    const tipY = by + Math.sin(angle) * 3 * s;
    g.fillCircle(tipX, tipY + 1.5 * s, 0.7 * s);
  }
}

function drawWildGrowth(g, cx, cy, s, mut) {
  const r = 10 * s * mut.bodyScale;
  // Scattered tiny leaves and buds
  const leafColor = 0x55CC44;
  const budColor = 0xFFCC66;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.7;
    const dist = r * (0.6 + (i % 3) * 0.15);
    const lx = cx + Math.cos(angle) * dist;
    const ly = cy + Math.sin(angle) * dist;
    // Tiny leaf
    g.fillStyle(leafColor, 0.5);
    g.fillTriangle(lx, ly - 1.5 * s, lx - 1 * s, ly + 0.5 * s, lx + 1 * s, ly + 0.5 * s);
  }
  // Small buds
  g.fillStyle(budColor, 0.45);
  g.fillCircle(cx - 5 * s, cy - 6 * s, 1 * s);
  g.fillCircle(cx + 6 * s, cy - 4 * s, 0.8 * s);
  g.fillCircle(cx + 3 * s, cy + 5 * s, 0.9 * s);
}

function drawPhoenixFeathers(g, cx, cy, s, mut) {
  const r = 12 * s * mut.bodyScale;
  const colors = [0xFF8844, 0xFFAA33, 0xFFCC44, 0xFF6633];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + 0.9;
    const dist = r * (0.7 + (i % 2) * 0.25);
    const fx = cx + Math.cos(angle) * dist;
    const fy = cy + Math.sin(angle) * dist - 2 * s; // Float upward
    const color = colors[i % colors.length];
    // Feather shape (elongated teardrop pointing up)
    g.fillStyle(color, 0.45);
    g.fillTriangle(fx, fy - 3 * s, fx - 1 * s, fy + 0.5 * s, fx + 1 * s, fy + 0.5 * s);
    g.fillCircle(fx, fy + 0.5 * s, 0.8 * s);
  }
}

function drawEternalGlow(g, cx, cy, s, mut) {
  const r = 8 * s * mut.bodyScale;
  // Soft white inner glow
  g.fillStyle(0xFFFFFF, 0.1);
  g.fillCircle(cx, cy, r * 1.2);
  g.fillStyle(0xFFFFEE, 0.08);
  g.fillCircle(cx, cy, r * 1.6);
  // Radiant lines
  g.lineStyle(0.5, 0xFFFFDD, 0.2);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    g.lineBetween(
      cx + Math.cos(angle) * r * 0.8, cy + Math.sin(angle) * r * 0.8,
      cx + Math.cos(angle) * r * 1.5, cy + Math.sin(angle) * r * 1.5,
    );
  }
}

function drawBlessingAura(g, cx, cy, s, mut) {
  const r = 12 * s * mut.bodyScale;
  // Gold sparkle ring
  drawParticleRing(g, cx, cy, r, 0xFFDD44, 0.4, 8, 1 * s);
  // Leaf particles
  g.fillStyle(0x66DD55, 0.35);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 1.2;
    const lx = cx + Math.cos(angle) * r * 0.85;
    const ly = cy + Math.sin(angle) * r * 0.85;
    g.fillTriangle(lx, ly - 1.5 * s, lx - 1 * s, ly + 0.5 * s, lx + 1 * s, ly + 0.5 * s);
  }
  // Inner warm glow
  g.fillStyle(0xFFEE88, 0.06);
  g.fillCircle(cx, cy, r * 0.7);
}

function drawDrainVines(g, cx, cy, s, mut) {
  const r = 10 * s * mut.bodyScale;
  g.lineStyle(1.5, 0x882266, 0.45);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.5;
    let tx = cx + Math.cos(angle) * r * 0.3;
    let ty = cy + Math.sin(angle) * r * 0.3;
    for (let seg = 0; seg < 2; seg++) {
      const nx = tx + Math.cos(angle + seg * 0.5) * 4 * s;
      const ny = ty + Math.sin(angle + seg * 0.3) * 4 * s;
      g.lineBetween(tx, ty, nx, ny);
      tx = nx;
      ty = ny;
    }
    // Thorny tip
    g.fillStyle(0xAA3355, 0.4);
    g.fillCircle(tx, ty, 1.2 * s);
  }
}

// ── Vine Signatures ──

function drawWhipTrail(g, cx, cy, s, mut) {
  const r = 10 * s * mut.bodyScale;
  g.lineStyle(1.5, 0x228B22, 0.5);
  // Curved whip extending right
  const startX = cx + r * 0.3;
  const startY = cy;
  g.lineBetween(startX, startY, startX + 5 * s, startY - 3 * s);
  g.lineBetween(startX + 5 * s, startY - 3 * s, startX + 10 * s, startY - 1 * s);
  g.lineBetween(startX + 10 * s, startY - 1 * s, startX + 13 * s, startY - 4 * s);
  // Whip tip
  g.fillStyle(0x33AA33, 0.4);
  g.fillCircle(startX + 13 * s, startY - 4 * s, 1 * s);
}

function drawElectricArcs(g, cx, cy, s, mut) {
  const r = 11 * s * mut.bodyScale;
  const lightningColor = 0xFFFF44;
  g.lineStyle(1, lightningColor, 0.6);
  // 3 small lightning bolts between random points
  for (let i = 0; i < 3; i++) {
    const a1 = (i / 3) * Math.PI * 2 + 0.3;
    const a2 = a1 + Math.PI * 0.4;
    const x1 = cx + Math.cos(a1) * r * 0.6;
    const y1 = cy + Math.sin(a1) * r * 0.6;
    const x2 = cx + Math.cos(a2) * r * 0.8;
    const y2 = cy + Math.sin(a2) * r * 0.8;
    const mx = (x1 + x2) / 2 + (i - 1) * 2 * s;
    const my = (y1 + y2) / 2 + (i % 2 - 0.5) * 3 * s;
    g.lineBetween(x1, y1, mx, my);
    g.lineBetween(mx, my, x2, y2);
  }
  // Spark dots
  g.fillStyle(0xFFFF88, 0.4);
  g.fillCircle(cx + r * 0.3, cy - r * 0.4, 0.8 * s);
  g.fillCircle(cx - r * 0.5, cy + r * 0.2, 0.7 * s);
}

function drawMultiTarget(g, cx, cy, s, mut) {
  const r = 14 * s * mut.bodyScale;
  // Small crosshair dots at various distances
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + 0.4;
    const dist = r * (0.6 + (i % 2) * 0.3);
    const tx = cx + Math.cos(angle) * dist;
    const ty = cy + Math.sin(angle) * dist;
    // Crosshair
    g.lineStyle(0.5, 0xFF4444, 0.4);
    g.lineBetween(tx - 1.5 * s, ty, tx + 1.5 * s, ty);
    g.lineBetween(tx, ty - 1.5 * s, tx, ty + 1.5 * s);
    g.strokeCircle(tx, ty, 1.5 * s);
  }
}

function drawSpeedLines(g, cx, cy, s, mut) {
  // Horizontal streak lines behind body (motion effect)
  g.lineStyle(1, 0x88DD88, 0.35);
  const startX = cx - 10 * s;
  for (let i = 0; i < 5; i++) {
    const ly = cy + (i - 2) * 3 * s;
    const length = (8 + (i % 3) * 4) * s;
    g.lineBetween(startX - length, ly, startX, ly);
  }
  // Fading trail dots
  g.fillStyle(0x88DD88, 0.2);
  g.fillCircle(startX - 12 * s, cy, 1.5 * s);
  g.fillCircle(startX - 16 * s, cy - 2 * s, 1 * s);
}

function drawEntangleWeb(g, cx, cy, s, mut) {
  const r = 12 * s * mut.bodyScale;
  // Thin vine web pattern
  g.lineStyle(0.5, 0x228B22, 0.3);
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }
  // Connect alternating points
  for (let i = 0; i < points.length; i++) {
    g.lineBetween(points[i].x, points[i].y, points[(i + 2) % points.length].x, points[(i + 2) % points.length].y);
  }
  // Small leaves at vertices
  g.fillStyle(0x44AA33, 0.35);
  for (let i = 0; i < 3; i++) {
    g.fillCircle(points[i * 2].x, points[i * 2].y, 1 * s);
  }
}

function drawLashStorm(g, cx, cy, s, mut) {
  const r = 10 * s * mut.bodyScale;
  g.lineStyle(1.5, 0x228B22, 0.45);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.2;
    const startX = cx + Math.cos(angle) * r * 0.3;
    const startY = cy + Math.sin(angle) * r * 0.3;
    const midX = startX + Math.cos(angle + 0.3) * 5 * s;
    const midY = startY + Math.sin(angle + 0.3) * 5 * s;
    const endX = midX + Math.cos(angle - 0.2) * 4 * s;
    const endY = midY + Math.sin(angle - 0.2) * 4 * s;
    g.lineBetween(startX, startY, midX, midY);
    g.lineBetween(midX, midY, endX, endY);
  }
}

function drawDimensionRift(g, cx, cy, s, mut) {
  const riftX = cx - 8 * s;
  const riftY = cy - 2 * s;
  // Portal circle
  g.fillStyle(0x442266, 0.25);
  g.fillEllipse(riftX, riftY, 8 * s, 10 * s);
  g.lineStyle(1.5, 0xCC88FF, 0.5);
  g.strokeEllipse(riftX, riftY, 8 * s, 10 * s);
  // Inner spiral
  g.lineStyle(0.8, 0xAA66DD, 0.3);
  g.beginPath();
  g.arc(riftX, riftY, 3 * s, 0, Math.PI * 1.5);
  g.strokePath();
  // Star points at edge
  g.fillStyle(0xDDBBFF, 0.4);
  g.fillCircle(riftX, riftY - 5 * s, 0.8 * s);
  g.fillCircle(riftX + 4 * s, riftY, 0.7 * s);
}

function drawOvergrowthWave(g, cx, cy, s, mut) {
  const r = 11 * s * mut.bodyScale;
  // Wave-like green crescents expanding outward
  g.lineStyle(1.5, 0x22CC22, 0.35);
  for (let i = 0; i < 3; i++) {
    const waveR = r * (0.8 + i * 0.3);
    const startAngle = -Math.PI * 0.3 + i * 0.4;
    g.beginPath();
    g.arc(cx, cy, waveR, startAngle, startAngle + Math.PI * 0.5);
    g.strokePath();
  }
  // Leaf particles in wave
  g.fillStyle(0x44DD33, 0.3);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const dist = r * 1.2;
    g.fillTriangle(
      cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist - 1.5 * s,
      cx + Math.cos(angle) * dist - 1 * s, cy + Math.sin(angle) * dist + 0.5 * s,
      cx + Math.cos(angle) * dist + 1 * s, cy + Math.sin(angle) * dist + 0.5 * s,
    );
  }
}

// ── Signature Dispatch ──

const SIGNATURE_DRAWERS = {
  // Root
  iron_plates: drawIronPlates,
  frost_crystals: drawFrostCrystals,
  stone_cracks: drawStoneCracks,
  scale_armor: drawScaleArmor,
  ancient_runes: drawAncientRunes,
  golden_crown: drawGoldenCrown,
  crystalline: drawCrystalline,
  mirror_shield: drawMirrorShield,
  // Thorn
  void_wisps: drawVoidWisps,
  poison_drip: drawPoisonDrip,
  blade_glint: drawBladeGlint,
  blood_splatter: drawBloodSplatter,
  rot_aura: drawRotAura,
  shadow_form: drawShadowForm,
  soul_wisps: drawSoulWisps,
  prismatic: drawPrismatic,
  // Spore
  death_cloud: drawDeathCloud,
  contagion_rings: drawContagionRings,
  flame_particles: drawFlameParticles,
  void_mist: drawVoidMist,
  gravity_distortion: drawGravityDistortion,
  fungal_cap: drawFungalCap,
  radiation_glow: drawRadiationGlow,
  miasma_tendrils: drawMiasmaTendrils,
  // Bloom
  life_pulse: drawLifePulse,
  rot_veins: drawRotVeins,
  blood_thorns: drawBloodThorns,
  wild_growth: drawWildGrowth,
  phoenix_feathers: drawPhoenixFeathers,
  eternal_glow: drawEternalGlow,
  blessing_aura: drawBlessingAura,
  drain_vines: drawDrainVines,
  // Vine
  whip_trail: drawWhipTrail,
  electric_arcs: drawElectricArcs,
  multi_target: drawMultiTarget,
  speed_lines: drawSpeedLines,
  entangle_web: drawEntangleWeb,
  lash_storm: drawLashStorm,
  dimension_rift: drawDimensionRift,
  overgrowth_wave: drawOvergrowthWave,
};

function drawSignatures(g, cx, cy, scale, traits, mut) {
  for (const t of traits) {
    const sig = t.visual.signature;
    if (sig && SIGNATURE_DRAWERS[sig]) {
      SIGNATURE_DRAWERS[sig](g, cx, cy, scale, mut);
    }
  }
}

// ── Trait Drawing Helpers (normal scale, 64x64) ──────────────────

function countVisuals(traits) {
  const vis = { roots: 0, thorns: 0, spores: 0, blooms: 0, vines: 0 };
  for (const t of traits) {
    if (t.visual.roots) vis.roots += t.visual.roots;
    if (t.visual.thorns) vis.thorns += t.visual.thorns;
    if (t.visual.spores) vis.spores += t.visual.spores;
    if (t.visual.blooms) vis.blooms += t.visual.blooms;
    if (t.visual.vines) vis.vines += t.visual.vines;
  }
  return vis;
}

// ── Mutation State Computation ───────────────────────────────────

function computeMutationState(vis, traits = []) {
  const m = CATEGORY_MUTATIONS;

  // Body shape
  const bodyScale = 1.0
    + vis.roots * (m.root.bodyScalePerCount || 0)
    + vis.vines * (m.vine.bodyScalePerCount || 0)
    + vis.thorns * (m.thorn.bodyScalePerCount || 0);
  const bodyWidthBias = vis.roots * (m.root.bodyWidthBiasPerCount || 0);
  const bodyElongation = vis.vines * (m.vine.bodyElongationPerCount || 0);
  const bodyAngularity = vis.thorns * (m.thorn.bodyAngularityPerCount || 0);
  const bodyRoundness = vis.blooms * (m.bloom.bodyRoundnessPerCount || 0);
  const bodyAlpha = Math.max(0.55, 1.0 + vis.spores * (m.spore.bodyAlphaPerCount || 0));
  const bodyBrightnessShift = vis.blooms * (m.bloom.bodyBrightnessPerCount || 0);

  // Eye style — highest threshold from dominant category wins
  const eyeStyle = resolveEyeStyle(vis);

  // Leaf style — highest-count category with a leaf style wins
  const leafStyle = resolveLeafStyle(vis);

  const totalElements = vis.roots + vis.thorns + vis.spores + vis.blooms + vis.vines;

  // Trait DNA — unique visual fingerprint from specific trait combination
  const dna = computeTraitDNA(traits);

  return {
    bodyScale,
    bodyWidthBias,
    bodyElongation,
    bodyAngularity,
    bodyRoundness,
    bodyAlpha,
    bodyBrightnessShift,
    eyeStyle,
    leafStyle,
    totalElements,
    dna,

    // Texture flags
    hasBarkTexture: vis.roots >= (m.root.barkTextureThreshold || 99),
    hasBodyRidges: vis.thorns >= (m.thorn.bodyRidgesThreshold || 99),
    hasWindingPatterns: vis.vines >= (m.vine.windingPatternsThreshold || 99),
    hasParticleDots: vis.spores >= (m.spore.particleDotsThreshold || 99),
    hasIntegratedFlowers: vis.blooms >= (m.bloom.integratedFlowersThreshold || 99),

    // Aura flags
    hasRedGlow: vis.thorns >= (m.thorn.redGlowThreshold || 99),
    hasShimmer: vis.blooms >= (m.bloom.shimmerThreshold || 99),
    hasMist: vis.spores >= (m.spore.mistThreshold || 99),
    hasVineArmor: vis.vines >= (m.vine.vineArmorThreshold || 99),
    cloudBody: vis.spores >= (m.spore.cloudBodyThreshold || 99),

    // Raw counts
    ...vis,
  };
}

function resolveEyeStyle(vis) {
  // Find the dominant category (highest count), resolve its eye style threshold
  const categories = [
    { count: vis.roots, styles: CATEGORY_MUTATIONS.root.eyeStyles },
    { count: vis.thorns, styles: CATEGORY_MUTATIONS.thorn.eyeStyles },
    { count: vis.blooms, styles: CATEGORY_MUTATIONS.bloom.eyeStyles },
    { count: vis.spores, styles: CATEGORY_MUTATIONS.spore.eyeStyles },
    { count: vis.vines, styles: CATEGORY_MUTATIONS.vine.eyeStyles },
  ];

  let bestStyle = 'default';
  let bestPriority = 0;

  for (const cat of categories) {
    const thresholds = Object.keys(cat.styles).map(Number).sort((a, b) => b - a);
    for (const threshold of thresholds) {
      if (cat.count >= threshold && cat.count > bestPriority) {
        bestStyle = cat.styles[threshold];
        bestPriority = cat.count;
        break;
      }
    }
  }
  return bestStyle;
}

function resolveLeafStyle(vis) {
  const candidates = [
    { count: vis.thorns, style: CATEGORY_MUTATIONS.thorn.leafStyle },
    { count: vis.blooms, style: CATEGORY_MUTATIONS.bloom.leafStyle },
    { count: vis.vines, style: CATEGORY_MUTATIONS.vine.leafStyle },
  ].filter(c => c.style && c.count >= 2);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.count - a.count);
  return candidates[0].style;
}

// ── Mutated Seedling Body Drawing ───────────────────────────────

function drawMutatedSeedling(g, cx, cy, baseColor, scale, mut) {
  const s = scale;

  // Apply DNA hue shift + brightness shift from blooms
  let bodyColor = baseColor;
  if (mut.dna && mut.dna.hueShift !== 0) {
    bodyColor = shiftHue(bodyColor, mut.dna.hueShift);
  }
  if (mut.bodyBrightnessShift > 0) {
    bodyColor = brightenColor(bodyColor, Math.min(mut.bodyBrightnessShift, 40));
  }

  // Body dimensions — affected by mutations + DNA asymmetry
  const baseRadius = 9;
  const scaledR = baseRadius * s * mut.bodyScale;
  const dna = mut.dna || { bodySkewX: 0, bodySkewY: 0, trunkBend: 0, sproutCurl: 0, sproutForks: 0, markings: [], bodyBumps: [] };
  const bodyW = scaledR * (1 + mut.bodyWidthBias + dna.bodySkewX);
  const bodyH = scaledR * (1 + mut.bodyElongation + dna.bodySkewY);

  // ── Pre-body auras ──
  if (mut.hasRedGlow) {
    g.fillStyle(0xFF2222, 0.08);
    g.fillCircle(cx, cy, Math.round((bodyW + 10) * s));
  }
  if (mut.hasMist) {
    g.fillStyle(CATEGORY_COLORS.spore, 0.05);
    g.fillCircle(cx, cy, Math.round((bodyW + 14) * s));
    g.fillStyle(CATEGORY_COLORS.spore, 0.03);
    g.fillCircle(cx, cy, Math.round((bodyW + 20) * s));
  }
  if (mut.hasShimmer) {
    g.fillStyle(0xFFFFFF, 0.04);
    g.fillCircle(cx, cy, Math.round((bodyW + 8) * s));
  }

  // ── Ground shadow (below mound) ──
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(cx, cy + Math.round(16 * s * mut.bodyScale), Math.round(18 * s * mut.bodyScale), Math.round(4 * s));

  // ── Soil mound (scales with bodyScale) ──
  const moundW = Math.round(22 * s * mut.bodyScale);
  const moundH = Math.round(8 * s * (1 + (mut.bodyScale - 1) * 0.5));
  const moundY = cy + Math.round(13 * s * mut.bodyScale);
  g.fillStyle(0x5A3A1A);
  g.fillEllipse(cx, moundY, moundW, moundH);
  // Mound highlight
  g.fillStyle(0x7B5230, 0.6);
  g.fillEllipse(cx, moundY - Math.round(1 * s), Math.round(moundW * 0.7), Math.round(moundH * 0.6));
  // Richer mound at high element counts
  if (mut.totalElements >= 5) {
    g.fillStyle(0x8B6340, 0.3);
    g.fillEllipse(cx, moundY - Math.round(2 * s), Math.round(moundW * 0.5), Math.round(moundH * 0.4));
  }
  // Dirt crumbles at high root counts
  if (mut.roots >= 3) {
    g.fillStyle(0x6B4226, 0.5);
    const crumbles = Math.min(4, mut.roots - 1);
    for (let i = 0; i < crumbles; i++) {
      const cx2 = cx + Math.round((i - crumbles / 2 + 0.5) * 5 * s * mut.bodyScale);
      g.fillCircle(cx2, moundY + Math.round(moundH * 0.4), Math.round(1.5 * s));
    }
  }

  // ── Ground roots (scale with totalElements) ──
  const rootColor = mut.roots >= 2
    ? blendColors(darkenColor(bodyColor, 40), CATEGORY_COLORS.root, Math.min(0.5, mut.roots * 0.1))
    : darkenColor(bodyColor, 40);
  const rootBaseY = moundY + Math.round(1 * s);
  const rootSpread = Math.round(10 * s * mut.bodyScale);
  // Always draw 2 anchor tendrils
  g.lineStyle(1, rootColor);
  g.lineBetween(cx - rootSpread, rootBaseY, cx - rootSpread - Math.round(5 * s), rootBaseY + Math.round(2 * s));
  g.lineBetween(cx + rootSpread, rootBaseY, cx + rootSpread + Math.round(5 * s), rootBaseY + Math.round(2 * s));
  // More tendrils as traits accumulate
  if (mut.totalElements >= 4) {
    g.lineStyle(2, rootColor, 0.8);
    g.lineBetween(cx - Math.round(rootSpread * 0.6), rootBaseY, cx - rootSpread - Math.round(8 * s), rootBaseY + Math.round(4 * s));
    g.lineBetween(cx + Math.round(rootSpread * 0.6), rootBaseY, cx + rootSpread + Math.round(8 * s), rootBaseY + Math.round(4 * s));
  }
  if (mut.totalElements >= 7) {
    g.lineStyle(2, rootColor, 0.7);
    const farSpread = rootSpread + Math.round(8 * s);
    // Outer tendrils with sub-branches
    g.lineBetween(cx - Math.round(rootSpread * 0.3), rootBaseY, cx - farSpread, rootBaseY + Math.round(5 * s));
    g.lineBetween(cx + Math.round(rootSpread * 0.3), rootBaseY, cx + farSpread, rootBaseY + Math.round(5 * s));
    g.lineStyle(1, rootColor, 0.5);
    g.lineBetween(cx - farSpread, rootBaseY + Math.round(5 * s), cx - farSpread - Math.round(3 * s), rootBaseY + Math.round(3 * s));
    g.lineBetween(cx + farSpread, rootBaseY + Math.round(5 * s), cx + farSpread + Math.round(3 * s), rootBaseY + Math.round(3 * s));
  }

  // ── Tapered trunk (wider at mound, narrow at body) — DNA bend ──
  const trunkBaseW = Math.round(4 * s * (1 + mut.bodyWidthBias * 0.5));
  const trunkTopW = Math.round(2 * s);
  const trunkTopY = cy - Math.round(6 * s);
  const trunkBaseY = cy + Math.round(10 * s * mut.bodyScale);
  const trunkBend = Math.round(dna.trunkBend * s);
  g.fillStyle(darkenColor(bodyColor, 20));
  g.fillTriangle(
    cx - trunkBaseW, trunkBaseY,
    cx + trunkBaseW, trunkBaseY,
    cx + trunkBend - trunkTopW, trunkTopY,
  );
  g.fillTriangle(
    cx + trunkBaseW, trunkBaseY,
    cx + trunkBend + trunkTopW, trunkTopY,
    cx + trunkBend - trunkTopW, trunkTopY,
  );
  // Trunk highlight
  g.fillStyle(brightenColor(bodyColor, 10));
  g.fillTriangle(
    cx, trunkBaseY,
    cx + Math.round(trunkBaseW * 0.5), trunkBaseY,
    cx + trunkBend + Math.round(trunkTopW * 0.5), trunkTopY,
  );
  // Bark cracks on trunk when bark texture active
  if (mut.hasBarkTexture) {
    g.lineStyle(1, darkenColor(bodyColor, 30), 0.3);
    const midTrunkY = (trunkBaseY + trunkTopY) / 2;
    const midW = (trunkBaseW + trunkTopW) / 2;
    g.lineBetween(cx - midW * 0.6, midTrunkY, cx + midW * 0.4, midTrunkY);
    g.lineBetween(cx - midW * 0.4, midTrunkY + 3 * s, cx + midW * 0.3, midTrunkY + 3 * s);
  }

  // ── Body — ellipse shape ──
  const bwRound = Math.round(bodyW);
  const bhRound = Math.round(bodyH);

  // Shadow side
  g.fillStyle(darkenColor(bodyColor, 10), mut.bodyAlpha);
  g.fillEllipse(cx - Math.round(1 * s), cy + Math.round(1 * s), bwRound * 2 + 2, bhRound * 2 + 2);

  // Main body
  g.fillStyle(bodyColor, mut.bodyAlpha);
  g.fillEllipse(cx, cy, bwRound * 2, bhRound * 2);

  // Highlight
  const hlScale = 1 + mut.bodyRoundness * 2;
  g.fillStyle(brightenColor(bodyColor, 25), mut.bodyAlpha);
  g.fillEllipse(cx + Math.round(2 * s), cy - Math.round(2 * s), Math.round(6 * s * hlScale), Math.round(6 * s * hlScale));

  // Extra bloom softness highlight
  if (mut.bodyRoundness > 0.06) {
    g.fillStyle(brightenColor(bodyColor, 45), 0.3 * mut.bodyAlpha);
    g.fillEllipse(cx + Math.round(1 * s), cy - Math.round(1 * s), Math.round(4 * s * hlScale), Math.round(4 * s * hlScale));
  }

  // ── Body angularity (thorns) — spiky ridges on body ──
  if (mut.bodyAngularity > 0.1) {
    const ridgeCount = Math.min(5, Math.floor(mut.bodyAngularity / 0.08));
    g.fillStyle(darkenColor(bodyColor, 15), mut.bodyAlpha);
    for (let i = 0; i < ridgeCount; i++) {
      const angle = -Math.PI / 2 + (i - ridgeCount / 2 + 0.5) * 0.5;
      const bx = cx + Math.cos(angle) * bwRound;
      const by = cy + Math.sin(angle) * bhRound;
      const tipLen = 3 * s * (1 + mut.bodyAngularity * 0.5);
      g.fillTriangle(
        bx + Math.cos(angle) * tipLen, by + Math.sin(angle) * tipLen,
        bx + Math.cos(angle + 0.4) * 2 * s, by + Math.sin(angle + 0.4) * 2 * s,
        bx + Math.cos(angle - 0.4) * 2 * s, by + Math.sin(angle - 0.4) * 2 * s,
      );
    }
  }

  // ── Body texture: bark plates (roots) ──
  if (mut.hasBarkTexture) {
    g.lineStyle(1, darkenColor(bodyColor, 30), 0.35);
    const lines = Math.min(4, mut.roots - 1);
    for (let i = 0; i < lines; i++) {
      const ly = cy - bhRound * 0.6 + (i / lines) * bhRound * 1.2;
      const halfW = Math.sqrt(Math.max(0, 1 - Math.pow((ly - cy) / bhRound, 2))) * bwRound * 0.7;
      g.lineBetween(cx - halfW, ly, cx + halfW, ly);
    }
    // Vertical bark crack
    g.lineStyle(1, darkenColor(bodyColor, 25), 0.2);
    g.lineBetween(cx - 2 * s, cy - bhRound * 0.4, cx - 1 * s, cy + bhRound * 0.3);
  }

  // ── Body texture: winding vine patterns ──
  if (mut.hasWindingPatterns) {
    g.lineStyle(1, darkenColor(bodyColor, 15), 0.3);
    for (let i = 0; i < 2; i++) {
      const startAngle = i * Math.PI;
      let vx = cx + Math.cos(startAngle) * bwRound * 0.3;
      let vy = cy + Math.sin(startAngle) * bhRound * 0.3;
      for (let seg = 0; seg < 3; seg++) {
        const nx = vx + Math.cos(startAngle + seg * 0.8) * 3 * s;
        const ny = vy + Math.sin(startAngle + seg * 0.8 + 0.5) * 3 * s;
        g.lineBetween(vx, vy, nx, ny);
        vx = nx;
        vy = ny;
      }
    }
  }

  // ── Body texture: spore particle dots ──
  if (mut.hasParticleDots) {
    g.fillStyle(CATEGORY_COLORS.spore, 0.25);
    const dotCount = Math.min(8, mut.spores + 2);
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2 + 0.3;
      const dist = bwRound * (0.3 + (i % 3) * 0.2);
      g.fillCircle(
        cx + Math.cos(angle) * dist,
        cy + Math.sin(angle) * dist * (bhRound / bwRound),
        1 * s,
      );
    }
  }

  // ── Body texture: integrated flowers (blooms) ──
  if (mut.hasIntegratedFlowers) {
    const bloomColor = CATEGORY_COLORS.bloom;
    const positions = [[-0.6, -0.3], [0.5, -0.5], [-0.4, 0.4]];
    for (let i = 0; i < Math.min(positions.length, mut.blooms - 1); i++) {
      const [px, py] = positions[i];
      const fx = cx + px * bwRound;
      const fy = cy + py * bhRound;
      // 3-petal mini flower
      for (let p = 0; p < 3; p++) {
        const a = (p / 3) * Math.PI * 2 - Math.PI / 2;
        g.fillStyle(bloomColor, 0.5);
        g.fillCircle(fx + Math.cos(a) * 2 * s, fy + Math.sin(a) * 2 * s, 1.5 * s);
      }
      g.fillStyle(0xFFEE44, 0.6);
      g.fillCircle(fx, fy, 1 * s);
    }
  }

  // ── Body texture: body ridges (thorns) ──
  if (mut.hasBodyRidges) {
    const ridgeColor = blendColors(bodyColor, CATEGORY_COLORS.thorn, 0.3);
    g.fillStyle(ridgeColor, 0.7);
    const count = Math.min(4, mut.thorns);
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.7 + (i / count) * Math.PI * 0.4;
      const bx = cx + Math.cos(angle) * (bwRound - 1);
      const by = cy + Math.sin(angle) * (bhRound - 1);
      g.fillTriangle(
        bx + Math.cos(angle) * 4 * s, by + Math.sin(angle) * 4 * s,
        bx + Math.cos(angle + 0.5) * 1.5 * s, by + Math.sin(angle + 0.5) * 1.5 * s,
        bx + Math.cos(angle - 0.5) * 1.5 * s, by + Math.sin(angle - 0.5) * 1.5 * s,
      );
    }
  }

  // ── Vine armor wrapping ──
  if (mut.hasVineArmor) {
    g.lineStyle(2, CATEGORY_COLORS.vine, 0.4);
    for (let i = 0; i < 3; i++) {
      const startA = -Math.PI * 0.6 + i * 0.6;
      const arcR = bwRound * 0.85;
      g.beginPath();
      g.arc(cx, cy, arcR, startA, startA + 0.8);
      g.strokePath();
    }
    // Small leaves on vine armor
    g.fillStyle(brightenColor(CATEGORY_COLORS.vine, 20), 0.5);
    g.fillTriangle(cx - bwRound * 0.7, cy - 2 * s, cx - bwRound * 0.7 - 3 * s, cy, cx - bwRound * 0.7 + 1, cy + 2 * s);
    g.fillTriangle(cx + bwRound * 0.6, cy + 2 * s, cx + bwRound * 0.6 + 3 * s, cy, cx + bwRound * 0.6 - 1, cy - 2 * s);
  }

  // ── DNA body markings — unique per trait combination ──
  if (dna.markings.length > 0) {
    for (const mark of dna.markings) {
      const mx = cx + Math.cos(mark.angle) * bwRound * mark.dist;
      const my = cy + Math.sin(mark.angle) * bhRound * mark.dist;
      const markColor = shiftHue(darkenColor(bodyColor, 15), mark.hue);
      const markSize = mark.size * s;
      if (mark.type === 0) {
        // Dot
        g.fillStyle(markColor, 0.35);
        g.fillCircle(mx, my, markSize);
      } else if (mark.type === 1) {
        // Dash
        g.lineStyle(Math.max(1, markSize * 0.6), markColor, 0.3);
        const da = mark.angle + Math.PI / 2;
        g.lineBetween(mx - Math.cos(da) * markSize, my - Math.sin(da) * markSize,
          mx + Math.cos(da) * markSize, my + Math.sin(da) * markSize);
      } else if (mark.type === 2) {
        // Arc
        g.lineStyle(1, markColor, 0.3);
        g.beginPath();
        g.arc(mx, my, markSize * 1.2, mark.angle, mark.angle + 1.2);
        g.strokePath();
      } else {
        // Ring
        g.lineStyle(1, markColor, 0.25);
        g.strokeCircle(mx, my, markSize * 0.8);
      }
    }
  }

  // ── DNA body bumps — unique surface deformations ──
  if (dna.bodyBumps.length > 0) {
    for (const bump of dna.bodyBumps) {
      if (Math.abs(bump.magnitude) < 0.02) continue;
      const bx = cx + Math.cos(bump.angle) * bwRound * (1 + bump.magnitude);
      const by = cy + Math.sin(bump.angle) * bhRound * (1 + bump.magnitude);
      const bumpSize = Math.abs(bump.magnitude) * 25 * s;
      g.fillStyle(bump.magnitude > 0 ? brightenColor(bodyColor, 10) : darkenColor(bodyColor, 10), 0.4);
      g.fillCircle(bx, by, bumpSize);
    }
  }

  // ── Leaves ──
  drawMutatedLeaves(g, cx, cy, s, mut.leafStyle, bodyColor, mut);

  // ── Top sprout — DNA curl and fork variation ──
  const sproutBrightness = mut.hasShimmer ? 60 : 50;
  g.fillStyle(brightenColor(bodyColor, sproutBrightness));
  const sproutH = 20 * s * (1 + mut.bodyElongation * 0.3);
  const sproutTipX = cx + Math.round(dna.sproutCurl * sproutH * 0.4);
  g.fillTriangle(
    sproutTipX, cy - Math.round(sproutH),
    cx - Math.round(2 * s), cy - Math.round(12 * s),
    cx + Math.round(2 * s), cy - Math.round(12 * s),
  );
  // DNA sprout forks — extra tips branching from main sprout
  if (dna.sproutForks > 0) {
    const forkBaseY = cy - Math.round(14 * s);
    for (let f = 0; f < dna.sproutForks; f++) {
      const side = f % 2 === 0 ? -1 : 1;
      const forkAngle = side * (0.4 + f * 0.25);
      const forkLen = sproutH * (0.35 - f * 0.06);
      const fx = sproutTipX + Math.sin(forkAngle) * forkLen * 0.5;
      const fy = forkBaseY - Math.cos(forkAngle) * forkLen;
      g.fillTriangle(
        fx, fy,
        sproutTipX - Math.round(1 * s), forkBaseY,
        sproutTipX + Math.round(1 * s), forkBaseY,
      );
    }
  }

  // ── Eyes ──
  drawMutatedEyes(g, cx, cy, s, mut.eyeStyle, mut);
}

// ── Eye Style Variants ──────────────────────────────────────────

function drawMutatedEyes(g, cx, cy, s, style, mut) {
  const dna = mut.dna || { eyeSizeMod: 0, eyeSpacingMod: 0, pupilSquash: 0, hueShift: 0 };
  const eyeSpacing = Math.round(4 * s * (1 + dna.eyeSpacingMod));

  // Base dimensions (modified per style + DNA)
  const sizeMod = 1 + dna.eyeSizeMod;
  let eyeW = Math.round(7 * s * sizeMod);
  let eyeH = Math.round(8 * s * sizeMod);
  let irisW = Math.round(5 * s * sizeMod);
  let irisH = Math.round(6 * s * sizeMod);
  let pupilW = Math.round(3 * s * sizeMod);
  let pupilH = Math.round(4 * s * sizeMod);
  let irisColor = dna.hueShift !== 0 ? shiftHue(0x1A7A5E, dna.hueShift * 0.5) : 0x1A7A5E;
  let hasGlow = false;
  let hasSparkles = false;
  let hasBrows = false;

  switch (style) {
    case 'determined':
      // Slightly squarer, with eyebrows
      eyeH = Math.round(7 * s);
      hasBrows = true;
      break;
    case 'ancient':
      eyeH = Math.round(7 * s);
      eyeW = Math.round(8 * s);
      irisColor = 0x2A6A3E;
      hasBrows = true;
      break;
    case 'sharp':
      // Narrower, angled
      eyeH = Math.round(6 * s);
      irisH = Math.round(5 * s);
      pupilH = Math.round(3 * s);
      break;
    case 'fierce':
      eyeH = Math.round(5.5 * s);
      irisH = Math.round(4 * s);
      irisColor = 0x8A2222;
      pupilH = Math.round(3 * s);
      break;
    case 'large':
      // Bigger, cuter
      eyeW = Math.round(8.5 * s);
      eyeH = Math.round(10 * s);
      irisW = Math.round(6 * s);
      irisH = Math.round(7.5 * s);
      pupilW = Math.round(3.5 * s);
      pupilH = Math.round(5 * s);
      break;
    case 'expressive':
      eyeW = Math.round(9 * s);
      eyeH = Math.round(11 * s);
      irisW = Math.round(6.5 * s);
      irisH = Math.round(8 * s);
      pupilW = Math.round(3.5 * s);
      pupilH = Math.round(5 * s);
      hasSparkles = true;
      break;
    case 'mystical':
      irisColor = 0x6A3AAA;
      hasGlow = true;
      break;
    case 'ethereal':
      irisColor = 0x8855CC;
      hasGlow = true;
      eyeW = Math.round(8 * s);
      eyeH = Math.round(9 * s);
      irisW = Math.round(6.5 * s);
      irisH = Math.round(7.5 * s);
      break;
    case 'keen':
      // Horizontally elongated
      eyeW = Math.round(8 * s);
      eyeH = Math.round(7 * s);
      irisW = Math.round(6 * s);
      irisH = Math.round(5 * s);
      irisColor = 0x2A8A4E;
      break;
    case 'predatory':
      eyeW = Math.round(8 * s);
      eyeH = Math.round(7 * s);
      irisColor = 0x2A8A4E;
      // Slit pupils
      pupilW = Math.round(1.5 * s);
      pupilH = Math.round(5 * s);
      break;
  }

  // Glow behind eyes
  if (hasGlow) {
    g.fillStyle(irisColor, 0.15);
    g.fillCircle(cx - eyeSpacing, cy - Math.round(1 * s), eyeW * 0.9);
    g.fillCircle(cx + eyeSpacing, cy - Math.round(1 * s), eyeW * 0.9);
  }

  // Eyebrows
  if (hasBrows) {
    g.lineStyle(Math.round(1.5 * s), darkenColor(0x1A7A5E, 30));
    g.lineBetween(
      cx - eyeSpacing - Math.round(3 * s), cy - Math.round(5.5 * s),
      cx - eyeSpacing + Math.round(2 * s), cy - Math.round(6 * s),
    );
    g.lineBetween(
      cx + eyeSpacing - Math.round(2 * s), cy - Math.round(6 * s),
      cx + eyeSpacing + Math.round(3 * s), cy - Math.round(5.5 * s),
    );
  }

  // Outer eye white
  g.fillStyle(0xEEFFEE);
  g.fillEllipse(cx - eyeSpacing, cy - Math.round(1 * s), eyeW, eyeH);
  g.fillEllipse(cx + eyeSpacing, cy - Math.round(1 * s), eyeW, eyeH);

  // Iris
  g.fillStyle(irisColor);
  g.fillEllipse(cx - eyeSpacing, cy - Math.round(0.5 * s), irisW, irisH);
  g.fillEllipse(cx + eyeSpacing, cy - Math.round(0.5 * s), irisW, irisH);

  // Pupil — DNA squash makes pupils more round or more slit-like
  const pSquash = dna.pupilSquash;
  const finalPupilW = Math.max(1, Math.round(pupilW * (1 + pSquash * 0.3)));
  const finalPupilH = Math.max(1, Math.round(pupilH * (1 - pSquash * 0.2)));
  g.fillStyle(0x0A0A0A);
  g.fillEllipse(cx - eyeSpacing, cy, finalPupilW, finalPupilH);
  g.fillEllipse(cx + eyeSpacing, cy, finalPupilW, finalPupilH);

  // Primary anime highlight
  g.fillStyle(0xFFFFFF);
  g.fillCircle(cx - eyeSpacing - Math.round(1.5 * s), cy - Math.round(2 * s), Math.round(1.5 * s));
  g.fillCircle(cx + eyeSpacing - Math.round(1.5 * s), cy - Math.round(2 * s), Math.round(1.5 * s));

  // Secondary highlight
  g.fillStyle(0xCCFFCC, 0.7);
  g.fillCircle(cx - eyeSpacing + Math.round(0.5 * s), cy + Math.round(0.5 * s), Math.round(0.8 * s));
  g.fillCircle(cx + eyeSpacing + Math.round(0.5 * s), cy + Math.round(0.5 * s), Math.round(0.8 * s));

  // Extra sparkles for expressive eyes
  if (hasSparkles) {
    g.fillStyle(0xFFFFFF, 0.8);
    g.fillCircle(cx - eyeSpacing + Math.round(1.5 * s), cy - Math.round(3 * s), Math.round(0.7 * s));
    g.fillCircle(cx + eyeSpacing + Math.round(2 * s), cy - Math.round(2.5 * s), Math.round(0.7 * s));
    g.fillStyle(0xFFDDFF, 0.5);
    g.fillCircle(cx - eyeSpacing - Math.round(2 * s), cy + Math.round(1 * s), Math.round(0.5 * s));
    g.fillCircle(cx + eyeSpacing + Math.round(2.5 * s), cy + Math.round(0.5 * s), Math.round(0.5 * s));
  }
}

// ── Leaf Style Variants ─────────────────────────────────────────

function drawMutatedLeaves(g, cx, cy, s, leafStyle, bodyColor, mut) {
  const leafBright = brightenColor(bodyColor, 35);
  const leafDark = darkenColor(bodyColor, 5);

  switch (leafStyle) {
    case 'serrated':
      drawSerratedLeaves(g, cx, cy, s, bodyColor);
      break;
    case 'petals':
      drawPetalLeaves(g, cx, cy, s, bodyColor);
      break;
    case 'tendril':
      drawTendrilLeaves(g, cx, cy, s, bodyColor);
      break;
    default:
      drawDefaultLeaves(g, cx, cy, s, bodyColor);
      break;
  }
}

function drawDefaultLeaves(g, cx, cy, s, bodyColor) {
  const leafColor = brightenColor(bodyColor, 35);
  const leafDark = darkenColor(bodyColor, 5);

  // Left leaf
  g.fillStyle(leafColor);
  g.fillEllipse(cx - Math.round(8 * s), cy - Math.round(14 * s), Math.round(12 * s), Math.round(7 * s));
  g.fillTriangle(
    cx - Math.round(14 * s), cy - Math.round(15 * s),
    cx - Math.round(11 * s), cy - Math.round(12 * s),
    cx - Math.round(11 * s), cy - Math.round(17 * s),
  );
  g.lineStyle(1, leafDark);
  g.lineBetween(cx - Math.round(3 * s), cy - Math.round(13 * s), cx - Math.round(13 * s), cy - Math.round(15 * s));

  // Right leaf
  g.fillStyle(brightenColor(bodyColor, 40));
  g.fillEllipse(cx + Math.round(8 * s), cy - Math.round(13 * s), Math.round(11 * s), Math.round(7 * s));
  g.fillTriangle(
    cx + Math.round(13 * s), cy - Math.round(14 * s),
    cx + Math.round(10 * s), cy - Math.round(11 * s),
    cx + Math.round(10 * s), cy - Math.round(16 * s),
  );
  g.lineStyle(1, leafDark);
  g.lineBetween(cx + Math.round(3 * s), cy - Math.round(12 * s), cx + Math.round(12 * s), cy - Math.round(14 * s));
}

function drawSerratedLeaves(g, cx, cy, s, bodyColor) {
  const leafColor = blendColors(brightenColor(bodyColor, 30), CATEGORY_COLORS.thorn, 0.15);
  const leafDark = darkenColor(bodyColor, 10);

  // Left serrated leaf — jagged edge
  g.fillStyle(leafColor);
  g.fillEllipse(cx - Math.round(8 * s), cy - Math.round(14 * s), Math.round(12 * s), Math.round(6 * s));
  // Serration points along top edge
  for (let i = 0; i < 4; i++) {
    const px = cx - Math.round((13 - i * 3) * s);
    const py = cy - Math.round((16 + (i % 2) * 1.5) * s);
    g.fillTriangle(px, py - Math.round(2 * s), px - Math.round(1.5 * s), py, px + Math.round(1.5 * s), py);
  }
  g.lineStyle(1, leafDark);
  g.lineBetween(cx - Math.round(3 * s), cy - Math.round(13 * s), cx - Math.round(13 * s), cy - Math.round(15 * s));

  // Right serrated leaf
  g.fillStyle(blendColors(brightenColor(bodyColor, 35), CATEGORY_COLORS.thorn, 0.15));
  g.fillEllipse(cx + Math.round(8 * s), cy - Math.round(13 * s), Math.round(11 * s), Math.round(6 * s));
  for (let i = 0; i < 4; i++) {
    const px = cx + Math.round((4 + i * 3) * s);
    const py = cy - Math.round((15 + (i % 2) * 1.5) * s);
    g.fillTriangle(px, py - Math.round(2 * s), px - Math.round(1.5 * s), py, px + Math.round(1.5 * s), py);
  }
  g.lineStyle(1, leafDark);
  g.lineBetween(cx + Math.round(3 * s), cy - Math.round(12 * s), cx + Math.round(12 * s), cy - Math.round(14 * s));
}

function drawPetalLeaves(g, cx, cy, s, bodyColor) {
  const petalColor = blendColors(brightenColor(bodyColor, 40), CATEGORY_COLORS.bloom, 0.25);
  const petalLight = brightenColor(petalColor, 20);

  // Left petal-leaf — rounded tip instead of pointed
  g.fillStyle(petalColor);
  g.fillEllipse(cx - Math.round(9 * s), cy - Math.round(14 * s), Math.round(13 * s), Math.round(8 * s));
  // Rounded tip (circle instead of triangle)
  g.fillCircle(cx - Math.round(14 * s), cy - Math.round(14 * s), Math.round(3.5 * s));
  g.fillStyle(petalLight, 0.4);
  g.fillEllipse(cx - Math.round(8 * s), cy - Math.round(15 * s), Math.round(8 * s), Math.round(4 * s));
  // Soft vein
  g.lineStyle(1, darkenColor(petalColor, 15), 0.5);
  g.lineBetween(cx - Math.round(3 * s), cy - Math.round(13 * s), cx - Math.round(13 * s), cy - Math.round(14 * s));

  // Right petal-leaf
  g.fillStyle(brightenColor(petalColor, 5));
  g.fillEllipse(cx + Math.round(9 * s), cy - Math.round(13 * s), Math.round(12 * s), Math.round(8 * s));
  g.fillCircle(cx + Math.round(14 * s), cy - Math.round(13 * s), Math.round(3.5 * s));
  g.fillStyle(petalLight, 0.4);
  g.fillEllipse(cx + Math.round(8 * s), cy - Math.round(14 * s), Math.round(8 * s), Math.round(4 * s));
  g.lineStyle(1, darkenColor(petalColor, 15), 0.5);
  g.lineBetween(cx + Math.round(3 * s), cy - Math.round(12 * s), cx + Math.round(13 * s), cy - Math.round(13 * s));
}

function drawTendrilLeaves(g, cx, cy, s, bodyColor) {
  const vineColor = blendColors(brightenColor(bodyColor, 30), CATEGORY_COLORS.vine, 0.2);

  // Left tendril — narrow curling shape
  g.lineStyle(Math.round(2 * s), vineColor);
  let lx = cx - Math.round(3 * s);
  let ly = cy - Math.round(12 * s);
  for (let i = 0; i < 4; i++) {
    const nx = lx - Math.round((3 + Math.sin(i * 1.5) * 2) * s);
    const ny = ly - Math.round((1.5 - Math.cos(i * 1.2) * 0.5) * s);
    g.lineBetween(lx, ly, nx, ny);
    lx = nx;
    ly = ny;
  }
  // Curl at tip
  g.fillStyle(brightenColor(vineColor, 15));
  g.fillCircle(lx, ly, Math.round(1.5 * s));

  // Right tendril
  g.lineStyle(Math.round(2 * s), brightenColor(vineColor, 5));
  let rx = cx + Math.round(3 * s);
  let ry = cy - Math.round(11 * s);
  for (let i = 0; i < 4; i++) {
    const nx = rx + Math.round((3 + Math.sin(i * 1.5 + 1) * 2) * s);
    const ny = ry - Math.round((1.5 - Math.cos(i * 1.2 + 0.5) * 0.5) * s);
    g.lineBetween(rx, ry, nx, ny);
    rx = nx;
    ry = ny;
  }
  g.fillStyle(brightenColor(vineColor, 15));
  g.fillCircle(rx, ry, Math.round(1.5 * s));
}

// ── Trait Drawing Helpers (normal scale, 64x64) ──────────────────

function drawRoots(g, cx, cy, count, mut) {
  if (count <= 0) return;
  const n = Math.min(count, 6);
  const rootColor = CATEGORY_COLORS.root;
  const bodyOffset = mut ? (mut.bodyScale - 1) * 10 : 0;

  // Central taproot — now at 3+ instead of 4+
  if (n >= 3) {
    g.lineStyle(n >= 5 ? 4 : 3, darkenColor(rootColor, 20));
    g.lineBetween(cx, cy + 13 + bodyOffset, cx, cy + 28 + bodyOffset);
    g.lineStyle(2, rootColor);
    g.lineBetween(cx - 3, cy + 22 + bodyOffset, cx - 8, cy + 30 + bodyOffset);
    g.lineBetween(cx + 3, cy + 22 + bodyOffset, cx + 8, cy + 30 + bodyOffset);
  }

  for (let i = 0; i < n; i++) {
    const angle = Math.PI / 2 + (i - n / 2 + 0.5) * 0.35;
    const startX = cx + Math.cos(angle) * (6 + bodyOffset * 0.5);
    const startY = cy + 13 + bodyOffset;

    g.lineStyle(2, rootColor);
    const midX = startX + Math.cos(angle) * 10;
    const midY = startY + Math.sin(angle) * 10;
    g.lineBetween(startX, startY, midX, midY);

    g.lineStyle(1, brightenColor(rootColor, 15));
    g.lineBetween(midX, midY, midX + Math.cos(angle - 0.4) * 7, midY + Math.sin(angle - 0.4) * 7);
    g.lineBetween(midX, midY, midX + Math.cos(angle + 0.4) * 7, midY + Math.sin(angle + 0.4) * 7);

    // Root hairs at high counts
    if (n >= 5) {
      g.lineStyle(1, brightenColor(rootColor, 25), 0.6);
      const tipX = midX + Math.cos(angle) * 4;
      const tipY = midY + Math.sin(angle) * 4;
      g.lineBetween(tipX, tipY, tipX + Math.cos(angle - 0.7) * 4, tipY + Math.sin(angle - 0.7) * 4);
      g.lineBetween(tipX, tipY, tipX + Math.cos(angle + 0.7) * 4, tipY + Math.sin(angle + 0.7) * 4);
    }
  }
}

function drawThorns(g, cx, cy, count, mut) {
  if (count <= 0) return;
  const n = Math.min(count, 8);
  const fierce = mut && mut.bodyAngularity > 0.2;
  const thornLen = fierce ? 10 : 8;
  const thornW = fierce ? 3.5 : 3;

  // Red glow aura at high counts — stronger with mutation
  if (n >= 4 || (mut && mut.hasRedGlow)) {
    const glowAlpha = mut && mut.hasRedGlow ? 0.15 : 0.1;
    g.fillStyle(0xFF2222, glowAlpha);
    g.fillCircle(cx, cy, fierce ? 22 : 18);
  }

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const baseR = mut ? 11 * mut.bodyScale : 11;
    const bx = cx + Math.cos(angle) * baseR;
    const by = cy + Math.sin(angle) * baseR;
    const tipX = bx + Math.cos(angle) * thornLen;
    const tipY = by + Math.sin(angle) * thornLen;
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    // Dark outline
    g.fillStyle(darkenColor(CATEGORY_COLORS.thorn, 40));
    g.fillTriangle(tipX, tipY, bx + perpX * thornW, by + perpY * thornW, bx - perpX * thornW, by - perpY * thornW);
    // Bright inner
    g.fillStyle(CATEGORY_COLORS.thorn);
    g.fillTriangle(tipX, tipY, bx + perpX * (thornW - 1), by + perpY * (thornW - 1), bx - perpX * (thornW - 1), by - perpY * (thornW - 1));
    // Highlight edge
    g.fillStyle(brightenColor(CATEGORY_COLORS.thorn, fierce ? 55 : 40));
    g.fillTriangle(tipX, tipY, bx + perpX * 1, by + perpY * 1, bx, by);
  }
}

function drawBlooms(g, cx, cy, count, mut) {
  if (count <= 0) return;
  const n = Math.min(count, 5);
  const bloomColor = CATEGORY_COLORS.bloom;
  const bright = mut && mut.bodyBrightnessShift > 15;
  const petalLight = brightenColor(bloomColor, bright ? 55 : 40);
  const petalSize = bright ? 3.5 : 3;

  // Crown bloom at high counts — larger if shimmer active
  if (n >= 3) {
    const crownSize = mut && mut.hasShimmer ? 5 : 4;
    drawFlower(g, cx, cy - 22, bloomColor, petalLight, crownSize);
  }

  const sc = mut ? mut.bodyScale : 1;
  const positions = [
    [-14 * sc, -8], [14 * sc, -6], [-12 * sc, 6], [12 * sc, 8], [0, 12 * sc],
  ];
  for (let i = 0; i < n; i++) {
    const [ox, oy] = positions[i];
    drawFlower(g, cx + ox, cy + oy, bloomColor, petalLight, petalSize);
  }
}

function drawFlower(g, fx, fy, color, highlight, petalSize) {
  // 5 petals with 2-tone coloring
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
    const px = fx + Math.cos(a) * petalSize;
    const py = fy + Math.sin(a) * petalSize;
    g.fillStyle(color);
    g.fillCircle(px, py, petalSize);
    g.fillStyle(highlight);
    g.fillCircle(px + Math.cos(a) * 0.5, py + Math.sin(a) * 0.5, petalSize * 0.5);
  }
  // Center
  g.fillStyle(0xFFEE44);
  g.fillCircle(fx, fy, petalSize * 0.6);
  g.fillStyle(0xFFFF88);
  g.fillCircle(fx - 0.5, fy - 0.5, petalSize * 0.3);
}

function drawSpores(g, cx, cy, count, mut) {
  if (count <= 0) return;
  const n = Math.min(count, 6);
  const sporeColor = CATEGORY_COLORS.spore;
  const misty = mut && mut.hasMist;
  const sporeAlpha = misty ? 0.7 : 1.0;

  // Haze ring at high counts — wider and softer with mist
  if (n >= 3 || misty) {
    const hazeR = misty ? 30 : 26;
    g.fillStyle(sporeColor, misty ? 0.1 : 0.07);
    g.fillCircle(cx, cy, hazeR);
  }

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const dist = 18 + (i % 2) * 4;
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;

    // Star/asterisk shape — softer when misty
    g.fillStyle(sporeColor, sporeAlpha);
    g.fillCircle(sx, sy, misty ? 2.5 : 2);
    g.lineStyle(1, brightenColor(sporeColor, 30), sporeAlpha);
    g.lineBetween(sx - 3, sy, sx + 3, sy);
    g.lineBetween(sx, sy - 3, sx, sy + 3);
    g.lineBetween(sx - 2, sy - 2, sx + 2, sy + 2);

    // Secondary smaller spore
    const s2x = cx + Math.cos(angle + 0.3) * (dist - 5);
    const s2y = cy + Math.sin(angle + 0.3) * (dist - 5);
    g.fillStyle(brightenColor(sporeColor, 20), 0.5 * sporeAlpha);
    g.fillCircle(s2x, s2y, 1.5);

    // Extra haze particle when misty
    if (misty) {
      const h3x = cx + Math.cos(angle - 0.4) * (dist + 3);
      const h3y = cy + Math.sin(angle - 0.4) * (dist + 3);
      g.fillStyle(sporeColor, 0.15);
      g.fillCircle(h3x, h3y, 2);
    }
  }
}

function drawVines(g, cx, cy, count, mut) {
  if (count <= 0) return;
  const n = Math.min(count, 5);
  const vineColor = CATEGORY_COLORS.vine;
  const armored = mut && mut.hasVineArmor;
  const lineW = armored ? 3 : 2;
  const segLen = armored ? 8 : 7;

  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (i - n / 2 + 0.5) * 0.7;
    const baseR = mut ? 10 * mut.bodyScale : 10;
    let vx = cx + Math.cos(angle) * baseR;
    let vy = cy + Math.sin(angle) * 4;

    g.lineStyle(lineW, vineColor);
    const segments = armored ? 5 : 4;
    for (let s = 0; s < segments; s++) {
      const wave = Math.sin(s * 2.5 + i) * (armored ? 5 : 4);
      const nx = vx + Math.cos(angle) * segLen + wave;
      const ny = vy + Math.sin(angle) * segLen;
      g.lineBetween(vx, vy, nx, ny);

      // Tiny leaf at segment joints
      if (s === 1 || s === 3) {
        g.fillStyle(brightenColor(vineColor, 25));
        const leafAngle = angle + Math.PI / 2;
        const leafSize = armored ? 4 : 3;
        g.fillTriangle(
          nx, ny,
          nx + Math.cos(leafAngle) * leafSize, ny + Math.sin(leafAngle) * leafSize,
          nx + Math.cos(angle) * (leafSize - 1), ny + Math.sin(angle) * (leafSize - 1),
        );
      }

      vx = nx;
      vy = ny;
    }

    // Leaf at vine tip — larger when armored
    g.fillStyle(brightenColor(vineColor, 30));
    g.fillCircle(vx, vy, armored ? 3 : 2);
  }
}

// ── Large Trait Drawing (for 128x128 victory) ────────────────────

function drawRootsLarge(g, cx, cy, count) {
  if (count <= 0) return;
  const n = Math.min(count, 6);
  const rootColor = CATEGORY_COLORS.root;

  if (n >= 4) {
    g.lineStyle(5, darkenColor(rootColor, 20));
    g.lineBetween(cx, cy + 26, cx, cy + 52);
    g.lineStyle(3, rootColor);
    g.lineBetween(cx - 5, cy + 42, cx - 14, cy + 56);
    g.lineBetween(cx + 5, cy + 42, cx + 14, cy + 56);
  }

  for (let i = 0; i < n; i++) {
    const angle = Math.PI / 2 + (i - n / 2 + 0.5) * 0.35;
    const startX = cx + Math.cos(angle) * 12;
    const startY = cy + 26;

    g.lineStyle(3, rootColor);
    const midX = startX + Math.cos(angle) * 18;
    const midY = startY + Math.sin(angle) * 18;
    g.lineBetween(startX, startY, midX, midY);

    g.lineStyle(2, brightenColor(rootColor, 15));
    g.lineBetween(midX, midY, midX + Math.cos(angle - 0.4) * 12, midY + Math.sin(angle - 0.4) * 12);
    g.lineBetween(midX, midY, midX + Math.cos(angle + 0.4) * 12, midY + Math.sin(angle + 0.4) * 12);

    // Tiny root hairs
    g.lineStyle(1, brightenColor(rootColor, 30));
    const tipX = midX + Math.cos(angle) * 5;
    const tipY = midY + Math.sin(angle) * 5;
    g.lineBetween(tipX, tipY, tipX + Math.cos(angle - 0.8) * 5, tipY + Math.sin(angle - 0.8) * 5);
    g.lineBetween(tipX, tipY, tipX + Math.cos(angle + 0.8) * 5, tipY + Math.sin(angle + 0.8) * 5);
  }
}

function drawThornsLarge(g, cx, cy, count, mut) {
  if (count <= 0) return;
  const n = Math.min(count, 8);
  const fierce = mut && mut.bodyAngularity > 0.2;
  const thornLen = fierce ? 18 : 14;
  const thornW = fierce ? 6 : 5;

  if (n >= 4 || (mut && mut.hasRedGlow)) {
    const glowAlpha = mut && mut.hasRedGlow ? 0.12 : 0.08;
    g.fillStyle(0xFF2222, glowAlpha);
    g.fillCircle(cx, cy, fierce ? 42 : 36);
  }

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const baseR = mut ? 22 * mut.bodyScale : 22;
    const bx = cx + Math.cos(angle) * baseR;
    const by = cy + Math.sin(angle) * baseR;
    const tipX = bx + Math.cos(angle) * thornLen;
    const tipY = by + Math.sin(angle) * thornLen;
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    g.fillStyle(darkenColor(CATEGORY_COLORS.thorn, 40));
    g.fillTriangle(tipX, tipY, bx + perpX * thornW, by + perpY * thornW, bx - perpX * thornW, by - perpY * thornW);
    g.fillStyle(CATEGORY_COLORS.thorn);
    g.fillTriangle(tipX, tipY, bx + perpX * (thornW - 2), by + perpY * (thornW - 2), bx - perpX * (thornW - 2), by - perpY * (thornW - 2));
    g.fillStyle(brightenColor(CATEGORY_COLORS.thorn, fierce ? 65 : 50));
    g.fillTriangle(tipX, tipY, bx + perpX * 1.5, by + perpY * 1.5, bx, by);
  }
}

function drawBloomsLarge(g, cx, cy, count, mut) {
  if (count <= 0) return;
  const n = Math.min(count, 5);
  const bloomColor = CATEGORY_COLORS.bloom;
  const bright = mut && mut.bodyBrightnessShift > 15;
  const petalLight = brightenColor(bloomColor, bright ? 55 : 40);
  const petalSize = bright ? 6 : 5;

  if (n >= 3) {
    const crownSize = mut && mut.hasShimmer ? 9 : 7;
    drawFlower(g, cx, cy - 44, bloomColor, petalLight, crownSize);
  }

  const sc = mut ? mut.bodyScale : 1;
  const positions = [[-28 * sc, -16], [28 * sc, -12], [-24 * sc, 12], [24 * sc, 16], [0, 24 * sc]];
  for (let i = 0; i < n; i++) {
    const [ox, oy] = positions[i];
    drawFlower(g, cx + ox, cy + oy, bloomColor, petalLight, petalSize);
  }
}

function drawSporesLarge(g, cx, cy, count, mut) {
  if (count <= 0) return;
  const n = Math.min(count, 6);
  const sporeColor = CATEGORY_COLORS.spore;
  const misty = mut && mut.hasMist;
  const sporeAlpha = misty ? 0.7 : 1.0;

  if (n >= 3 || misty) {
    const hazeR = misty ? 58 : 52;
    g.fillStyle(sporeColor, misty ? 0.09 : 0.06);
    g.fillCircle(cx, cy, hazeR);
  }

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const dist = 36 + (i % 2) * 8;
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;

    g.fillStyle(sporeColor, sporeAlpha);
    g.fillCircle(sx, sy, misty ? 4 : 3);
    g.lineStyle(1, brightenColor(sporeColor, 30), sporeAlpha);
    g.lineBetween(sx - 5, sy, sx + 5, sy);
    g.lineBetween(sx, sy - 5, sx, sy + 5);
    g.lineBetween(sx - 3, sy - 3, sx + 3, sy + 3);
    g.lineBetween(sx + 3, sy - 3, sx - 3, sy + 3);

    const s2x = cx + Math.cos(angle + 0.3) * (dist - 10);
    const s2y = cy + Math.sin(angle + 0.3) * (dist - 10);
    g.fillStyle(brightenColor(sporeColor, 20), 0.5 * sporeAlpha);
    g.fillCircle(s2x, s2y, 2);

    // Extra haze particle when misty
    if (misty) {
      const h3x = cx + Math.cos(angle - 0.4) * (dist + 5);
      const h3y = cy + Math.sin(angle - 0.4) * (dist + 5);
      g.fillStyle(sporeColor, 0.15);
      g.fillCircle(h3x, h3y, 3);
    }
  }
}

function drawVinesLarge(g, cx, cy, count, mut) {
  if (count <= 0) return;
  const n = Math.min(count, 5);
  const vineColor = CATEGORY_COLORS.vine;
  const armored = mut && mut.hasVineArmor;
  const lineW = armored ? 4 : 3;
  const segLen = armored ? 14 : 12;

  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (i - n / 2 + 0.5) * 0.7;
    const baseR = mut ? 20 * mut.bodyScale : 20;
    let vx = cx + Math.cos(angle) * baseR;
    let vy = cy + Math.sin(angle) * 8;

    g.lineStyle(lineW, vineColor);
    const segments = armored ? 6 : 5;
    for (let s = 0; s < segments; s++) {
      const wave = Math.sin(s * 2.5 + i) * (armored ? 9 : 7);
      const nx = vx + Math.cos(angle) * segLen + wave;
      const ny = vy + Math.sin(angle) * segLen;
      g.lineBetween(vx, vy, nx, ny);

      if (s % 2 === 1) {
        g.fillStyle(brightenColor(vineColor, 25));
        const la = angle + Math.PI / 2;
        const leafSize = armored ? 7 : 5;
        g.fillTriangle(nx, ny, nx + Math.cos(la) * leafSize, ny + Math.sin(la) * leafSize, nx + Math.cos(angle) * (leafSize - 1), ny + Math.sin(angle) * (leafSize - 1));
      }
      vx = nx;
      vy = ny;
    }

    g.fillStyle(brightenColor(vineColor, 30));
    g.fillCircle(vx, vy, armored ? 4 : 3);
  }
}

// ── Enemy Textures (32x32) — detailed and characterful ───────────

function generateEnemyTextures(scene) {
  const size = 32;

  // Weed — jagged plant with red eyes
  let g = scene.make.graphics({ add: false });
  let cx = 16, cy = 16;
  g.fillStyle(0x3A5422);
  g.fillRect(cx - 2, cy + 2, 4, 10); // stem
  g.fillStyle(0x556B2F);
  // Alternating pointed leaves
  g.fillTriangle(cx, cy - 4, cx - 10, cy + 2, cx - 2, cy + 4);
  g.fillTriangle(cx, cy - 4, cx + 10, cy + 2, cx + 2, cy + 4);
  g.fillTriangle(cx, cy - 8, cx - 7, cy - 2, cx, cy);
  g.fillTriangle(cx, cy - 8, cx + 7, cy - 2, cx, cy);
  // Top spike
  g.fillStyle(0x668B3A);
  g.fillTriangle(cx, cy - 14, cx - 3, cy - 6, cx + 3, cy - 6);
  // Beady red eyes
  g.fillStyle(0xCC2222);
  g.fillCircle(cx - 3, cy - 2, 1.5);
  g.fillCircle(cx + 3, cy - 2, 1.5);
  g.generateTexture('enemy_weed', size, size);
  g.destroy();

  // Beetle — armored with mandibles and legs
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  g.fillStyle(0x4A3728);
  g.fillCircle(cx, cy, 10);
  g.fillStyle(0x5A4738);
  g.fillCircle(cx, cy, 8);
  // Wing case line
  g.lineStyle(1, 0x3A2718);
  g.lineBetween(cx, cy - 8, cx, cy + 8);
  // Mandibles
  g.lineStyle(2, 0x6A5748);
  g.lineBetween(cx - 3, cy - 9, cx - 6, cy - 13);
  g.lineBetween(cx + 3, cy - 9, cx + 6, cy - 13);
  // 3 legs per side
  g.lineStyle(1, 0x3A2718);
  for (let i = 0; i < 3; i++) {
    const ly = cy - 3 + i * 5;
    g.lineBetween(cx - 8, ly, cx - 13, ly + 2);
    g.lineBetween(cx + 8, ly, cx + 13, ly + 2);
  }
  // Eyes
  g.fillStyle(0xFFDD44);
  g.fillCircle(cx - 4, cy - 5, 2);
  g.fillCircle(cx + 4, cy - 5, 2);
  g.fillStyle(0x111111);
  g.fillCircle(cx - 4, cy - 5, 1);
  g.fillCircle(cx + 4, cy - 5, 1);
  g.generateTexture('enemy_beetle', size, size);
  g.destroy();

  // Slug — slimy with antennae
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 18;
  // Trail
  g.fillStyle(0x6A8A61, 0.3);
  g.fillEllipse(cx - 6, cy + 2, 10, 4);
  // Body
  g.fillStyle(0x7B9971);
  g.fillEllipse(cx, cy, 20, 10);
  g.fillStyle(0x8BAA81);
  g.fillEllipse(cx + 1, cy - 1, 16, 7);
  // Top stripe
  g.lineStyle(1, 0x6A8861);
  g.lineBetween(cx - 7, cy, cx + 7, cy);
  // Antennae
  g.lineStyle(1, 0x9BBB91);
  g.lineBetween(cx + 6, cy - 4, cx + 10, cy - 10);
  g.lineBetween(cx + 7, cy - 3, cx + 12, cy - 8);
  g.fillStyle(0xBBDDB1);
  g.fillCircle(cx + 10, cy - 10, 1.5);
  g.fillCircle(cx + 12, cy - 8, 1.5);
  // Eye
  g.fillStyle(0x222222);
  g.fillCircle(cx + 5, cy - 2, 1.5);
  g.generateTexture('enemy_slug', size, size);
  g.destroy();

  // Fungus — wide cap mushroom with spots
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 18;
  // Stem
  g.fillStyle(0x9B8090);
  g.fillRect(cx - 3, cy, 6, 10);
  g.fillStyle(0xAB90A0);
  g.fillRect(cx - 1, cy, 2, 10);
  // Cap — half circle shape
  g.fillStyle(0x8B668B);
  g.fillCircle(cx, cy, 12);
  g.fillStyle(0x1A2E1A, 1);
  g.fillRect(0, cy + 1, size, size - cy); // cut bottom half
  g.fillStyle(0x8B668B);
  g.fillRect(cx - 3, cy, 6, 3); // stem connection
  // Cap highlight
  g.fillStyle(0x9B76A0);
  g.fillCircle(cx + 2, cy - 4, 6);
  // Spots
  g.fillStyle(0xEEDDEE);
  g.fillCircle(cx - 5, cy - 4, 2.5);
  g.fillCircle(cx + 4, cy - 6, 2);
  g.fillCircle(cx - 1, cy - 8, 1.5);
  g.fillCircle(cx + 7, cy - 2, 1.5);
  // Gill dots under cap
  g.fillStyle(0x7B567B);
  for (let i = -3; i <= 3; i++) {
    g.fillCircle(cx + i * 3, cy + 1, 0.8);
  }
  g.generateTexture('enemy_fungus', size, size);
  g.destroy();

  // Briar — gnarled spiky ball with eyes
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Gnarled center
  g.fillStyle(0x5C4033);
  g.fillCircle(cx, cy, 9);
  g.fillStyle(0x4A3025);
  g.fillCircle(cx - 1, cy + 1, 7);
  // Crosshatch texture
  g.lineStyle(1, 0x3A2015, 0.5);
  for (let i = -6; i <= 6; i += 3) {
    g.lineBetween(cx + i - 3, cy - 6, cx + i + 3, cy + 6);
    g.lineBetween(cx - 6, cy + i - 3, cx + 6, cy + i + 3);
  }
  // Irregular spikes
  const spikeAngles = [0, 0.7, 1.3, 2.0, 2.7, 3.4, 4.0, 4.7, 5.4];
  for (const a of spikeAngles) {
    const len = 6 + (a * 13 % 4);
    const bx = cx + Math.cos(a) * 8;
    const by = cy + Math.sin(a) * 8;
    g.fillStyle(0x3A2518);
    g.fillTriangle(bx, by,
      bx + Math.cos(a) * len, by + Math.sin(a) * len,
      bx + Math.cos(a + 0.5) * 2, by + Math.sin(a + 0.5) * 2);
  }
  // Glowing yellow eyes
  g.fillStyle(0xFFCC22);
  g.fillCircle(cx - 3, cy - 2, 2);
  g.fillCircle(cx + 3, cy - 2, 2);
  g.fillStyle(0x111111);
  g.fillCircle(cx - 3, cy - 2, 1);
  g.fillCircle(cx + 3, cy - 2, 1);
  g.generateTexture('enemy_briar', size, size);
  g.destroy();

  // Moth — wing spread silhouette
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Wings
  g.fillStyle(0xC4A882);
  g.fillEllipse(cx - 7, cy - 2, 14, 12);
  g.fillEllipse(cx + 7, cy - 2, 14, 12);
  // Lower wings
  g.fillStyle(0xB49872);
  g.fillEllipse(cx - 6, cy + 4, 10, 8);
  g.fillEllipse(cx + 6, cy + 4, 10, 8);
  // Wing patterns
  g.fillStyle(0xD4BC96);
  g.fillCircle(cx - 7, cy - 3, 3);
  g.fillCircle(cx + 7, cy - 3, 3);
  g.fillStyle(0xA48862);
  g.fillCircle(cx - 7, cy - 3, 1.5);
  g.fillCircle(cx + 7, cy - 3, 1.5);
  // Body
  g.fillStyle(0x6A5842);
  g.fillEllipse(cx, cy, 4, 12);
  // Feathered antennae
  g.lineStyle(1, 0x8A7862);
  g.lineBetween(cx - 1, cy - 6, cx - 5, cy - 13);
  g.lineBetween(cx + 1, cy - 6, cx + 5, cy - 13);
  g.lineBetween(cx - 5, cy - 13, cx - 8, cy - 14);
  g.lineBetween(cx - 5, cy - 13, cx - 4, cy - 16);
  g.lineBetween(cx + 5, cy - 13, cx + 8, cy - 14);
  g.lineBetween(cx + 5, cy - 13, cx + 4, cy - 16);
  // Eyes
  g.fillStyle(0xFF8844);
  g.fillCircle(cx - 2, cy - 5, 1);
  g.fillCircle(cx + 2, cy - 5, 1);
  g.generateTexture('enemy_moth', size, size);
  g.destroy();

  // Vine Crawler — mass of intertwined vines with red eye
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  g.fillStyle(0x2E5E1E);
  g.fillCircle(cx, cy, 12);
  // Vine tangles
  g.lineStyle(2, 0x3A7A28);
  const vineAngles = [0.2, 0.9, 1.6, 2.3, 3.0, 3.7, 4.4, 5.1, 5.8];
  for (const a of vineAngles) {
    const r = 8 + (a * 7 % 5);
    g.lineBetween(
      cx + Math.cos(a) * 4, cy + Math.sin(a) * 4,
      cx + Math.cos(a) * r, cy + Math.sin(a) * r,
    );
  }
  g.lineStyle(1, 0x4A9A38);
  for (const a of vineAngles) {
    const r = 6 + (a * 5 % 4);
    g.lineBetween(
      cx + Math.cos(a + 0.3) * 3, cy + Math.sin(a + 0.3) * 3,
      cx + Math.cos(a + 0.3) * r, cy + Math.sin(a + 0.3) * r,
    );
  }
  // Central dark opening
  g.fillStyle(0x1A0A0A);
  g.fillCircle(cx, cy, 4);
  // Red eye
  g.fillStyle(0xCC2222);
  g.fillCircle(cx, cy, 2.5);
  g.fillStyle(0xFF4444);
  g.fillCircle(cx - 0.5, cy - 0.5, 1);
  g.generateTexture('enemy_vine_crawler', size, size);
  g.destroy();
}

// ── Boss Texture (80x80) — imposing and terrifying ───────────────

function generateBossTexture(scene) {
  const size = 80;
  const g = scene.make.graphics({ add: false });
  const cx = 40;
  const cy = 40;

  // Outer corruption glow
  g.fillStyle(0x2A0A4E, 0.15);
  g.fillCircle(cx, cy, 38);

  // Dripping tendrils below
  g.lineStyle(3, 0x1A0A2E);
  for (let i = 0; i < 5; i++) {
    const tx = cx - 16 + i * 8;
    const len = 10 + (i * 7 % 5) * 2;
    g.lineBetween(tx, cy + 20, tx + (i % 2 ? 2 : -2), cy + 20 + len);
    g.fillStyle(0x2A0A4E);
    g.fillCircle(tx + (i % 2 ? 2 : -2), cy + 20 + len, 2);
  }

  // Main body
  g.fillStyle(0x12061E);
  g.fillCircle(cx, cy, 30);
  g.fillStyle(0x1A0A2E);
  g.fillCircle(cx, cy, 26);
  // Inner lighter core
  g.fillStyle(0x220E38);
  g.fillCircle(cx + 2, cy - 2, 18);

  // Wavy corruption veins
  g.lineStyle(2, 0x5A2A8E);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) {
    let vx = cx + Math.cos(a) * 10;
    let vy = cy + Math.sin(a) * 10;
    for (let s = 0; s < 3; s++) {
      const wave = Math.sin(a * 3 + s * 2) * 3;
      const nx = vx + Math.cos(a) * 7 + Math.cos(a + Math.PI / 2) * wave;
      const ny = vy + Math.sin(a) * 7 + Math.sin(a + Math.PI / 2) * wave;
      g.lineBetween(vx, vy, nx, ny);
      vx = nx;
      vy = ny;
    }
  }
  // Brighter inner veins
  g.lineStyle(1, 0x7A3ABE, 0.4);
  for (let a = Math.PI / 14; a < Math.PI * 2; a += Math.PI / 7) {
    g.lineBetween(
      cx + Math.cos(a) * 8, cy + Math.sin(a) * 8,
      cx + Math.cos(a) * 22, cy + Math.sin(a) * 22,
    );
  }

  // Thorny crown — more prominent and varied
  g.fillStyle(0x2D0E4A);
  const crownAngles = [-2.8, -2.4, -1.9, -1.5, -1.1, -0.7, -0.3];
  for (let i = 0; i < crownAngles.length; i++) {
    const a = crownAngles[i];
    const height = 8 + (i % 2) * 5;
    const bx = cx + Math.cos(a) * 26;
    const by = cy + Math.sin(a) * 26;
    g.fillTriangle(
      bx + Math.cos(a) * height, by + Math.sin(a) * height,
      bx + Math.cos(a + 0.3) * 3, by + Math.sin(a + 0.3) * 3,
      bx + Math.cos(a - 0.3) * 3, by + Math.sin(a - 0.3) * 3,
    );
  }
  // Crown highlight
  g.fillStyle(0x3D1E5A, 0.6);
  for (let i = 0; i < crownAngles.length; i += 2) {
    const a = crownAngles[i];
    const bx = cx + Math.cos(a) * 26;
    const by = cy + Math.sin(a) * 26;
    g.fillTriangle(
      bx + Math.cos(a) * 6, by + Math.sin(a) * 6,
      bx + Math.cos(a + 0.15) * 1.5, by + Math.sin(a + 0.15) * 1.5,
      bx + Math.cos(a - 0.15) * 1.5, by + Math.sin(a - 0.15) * 1.5,
    );
  }

  // Glowing eyes — menacing with glow halos
  g.fillStyle(0xFF0044, 0.2);
  g.fillCircle(cx - 10, cy - 6, 8);
  g.fillCircle(cx + 10, cy - 6, 8);
  g.fillStyle(0xFF0044);
  g.fillCircle(cx - 10, cy - 6, 5);
  g.fillCircle(cx + 10, cy - 6, 5);
  g.fillStyle(0xFF4488);
  g.fillCircle(cx - 10, cy - 6, 3);
  g.fillCircle(cx + 10, cy - 6, 3);
  g.fillStyle(0xFFAACC);
  g.fillCircle(cx - 11, cy - 7, 1.5);
  g.fillCircle(cx + 9, cy - 7, 1.5);

  // Mouth — jagged maw
  g.lineStyle(2, 0xFF0044);
  g.beginPath();
  g.arc(cx, cy + 6, 12, 0.2, Math.PI - 0.2);
  g.strokePath();
  // Teeth
  g.fillStyle(0xFF2266);
  for (let i = 0; i < 5; i++) {
    const ta = 0.4 + i * 0.45;
    const tx = cx + Math.cos(ta) * 11;
    const ty = cy + 6 + Math.sin(ta) * 11;
    g.fillTriangle(tx, ty, tx - 1.5, ty + 4, tx + 1.5, ty + 4);
  }

  // Orbiting corruption particles
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = cx + Math.cos(a) * 32;
    const py = cy + Math.sin(a) * 32;
    g.fillStyle(0x5A2A8E, 0.5);
    g.fillCircle(px, py, 2);
  }

  g.generateTexture('enemy_boss', size, size);
  g.destroy();
}

// ── Biome Enemy Textures (32x32) ─────────────────────────────────

function generateBiomeEnemyTextures(scene) {
  const size = 32;
  let g, cx, cy;

  // ── Forest: Bark Beetle (armored) ──────────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Thick shell plates
  g.fillStyle(0x4A2A12);
  g.fillCircle(cx, cy, 11);
  g.fillStyle(0x6B4226);
  g.fillCircle(cx, cy, 9);
  // Bark armor lines
  g.lineStyle(2, 0x3A1A08);
  g.lineBetween(cx, cy - 9, cx, cy + 9);
  g.lineBetween(cx - 5, cy - 7, cx - 8, cy + 3);
  g.lineBetween(cx + 5, cy - 7, cx + 8, cy + 3);
  // Heavy mandibles
  g.lineStyle(3, 0x8B5A30);
  g.lineBetween(cx - 3, cy - 10, cx - 7, cy - 15);
  g.lineBetween(cx + 3, cy - 10, cx + 7, cy - 15);
  // Legs
  g.lineStyle(1, 0x3A1A08);
  for (let i = 0; i < 3; i++) {
    const ly = cy - 2 + i * 5;
    g.lineBetween(cx - 9, ly, cx - 14, ly + 3);
    g.lineBetween(cx + 9, ly, cx + 14, ly + 3);
  }
  // Amber eyes
  g.fillStyle(0xFFAA00);
  g.fillCircle(cx - 4, cy - 4, 2.5);
  g.fillCircle(cx + 4, cy - 4, 2.5);
  g.fillStyle(0x111111);
  g.fillCircle(cx - 4, cy - 4, 1.2);
  g.fillCircle(cx + 4, cy - 4, 1.2);
  g.generateTexture('enemy_bark_beetle', size, size);
  g.destroy();

  // ── Forest: Tree Spirit (regenerating) ─────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Glowing body
  g.fillStyle(0x1A3A0A, 0.5);
  g.fillCircle(cx, cy, 12);
  g.fillStyle(0x2A5E1A);
  g.fillCircle(cx, cy, 9);
  g.fillStyle(0x3A7A28, 0.6);
  g.fillCircle(cx + 1, cy - 1, 6);
  // Branch arms
  g.lineStyle(3, 0x1A3A0A);
  g.lineBetween(cx - 9, cy, cx - 14, cy - 6);
  g.lineBetween(cx - 14, cy - 6, cx - 17, cy - 10);
  g.lineBetween(cx - 14, cy - 6, cx - 16, cy - 3);
  g.lineBetween(cx + 9, cy, cx + 14, cy - 6);
  g.lineBetween(cx + 14, cy - 6, cx + 17, cy - 10);
  g.lineBetween(cx + 14, cy - 6, cx + 16, cy - 3);
  // Regen glow ring
  g.lineStyle(1, 0x55FF55, 0.4);
  g.strokeCircle(cx, cy, 13);
  // Leaf-eye pair
  g.fillStyle(0x88FF88);
  g.fillEllipse(cx - 4, cy - 2, 5, 3);
  g.fillEllipse(cx + 4, cy - 2, 5, 3);
  g.fillStyle(0x1A1A1A);
  g.fillCircle(cx - 4, cy - 2, 1.5);
  g.fillCircle(cx + 4, cy - 2, 1.5);
  g.generateTexture('enemy_tree_spirit', size, size);
  g.destroy();

  // ── Forest: Woodland Creep ─────────────────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 18;
  g.fillStyle(0x3A5422);
  g.fillRect(cx - 1, cy + 1, 3, 8);
  g.fillStyle(0x557744);
  g.fillTriangle(cx, cy - 3, cx - 8, cy + 3, cx - 1, cy + 5);
  g.fillTriangle(cx, cy - 3, cx + 8, cy + 3, cx + 1, cy + 5);
  g.fillTriangle(cx, cy - 6, cx - 6, cy, cx, cy + 2);
  g.fillTriangle(cx, cy - 6, cx + 6, cy, cx, cy + 2);
  g.fillStyle(0x669955);
  g.fillTriangle(cx, cy - 11, cx - 3, cy - 4, cx + 3, cy - 4);
  g.fillStyle(0xAA2222);
  g.fillCircle(cx - 2, cy - 1, 1.2);
  g.fillCircle(cx + 2, cy - 1, 1.2);
  g.generateTexture('enemy_woodland_creep', size, size);
  g.destroy();

  // ── Underroot: Cave Fungus (explosive) ────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 18;
  // Stem
  g.fillStyle(0x5A3A66);
  g.fillRect(cx - 3, cy, 6, 8);
  // Cap
  g.fillStyle(0x7744AA);
  g.fillEllipse(cx, cy - 2, 22, 14);
  g.fillStyle(0x9966BB);
  g.fillEllipse(cx - 1, cy - 4, 18, 10);
  // Spots (spore pockets)
  g.fillStyle(0xFFDD55, 0.7);
  for (let i = 0; i < 5; i++) {
    const sx = cx - 8 + i * 4;
    const sy = cy - 3 + (i % 2) * 3;
    g.fillCircle(sx, sy, 1.5);
  }
  // Glow
  g.lineStyle(1, 0xFFAA00, 0.4);
  g.strokeEllipse(cx, cy - 2, 22, 14);
  // Eye
  g.fillStyle(0xFF6600);
  g.fillCircle(cx, cy - 4, 3);
  g.fillStyle(0x111111);
  g.fillCircle(cx + 0.5, cy - 4, 1.5);
  g.generateTexture('enemy_cave_fungus', size, size);
  g.destroy();

  // ── Underroot: Mycelium Creep (swarm) ─────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Tiny blob
  g.fillStyle(0xAA7722);
  g.fillCircle(cx, cy, 5);
  g.fillStyle(0xCC9933);
  g.fillCircle(cx - 0.5, cy - 0.5, 4);
  // Thread tendrils
  g.lineStyle(1, 0xEEBB44, 0.6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.lineBetween(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5,
      cx + Math.cos(a) * 9, cy + Math.sin(a) * 9);
  }
  g.fillStyle(0xFF8800);
  g.fillCircle(cx - 1.5, cy - 1, 1.2);
  g.fillCircle(cx + 1.5, cy - 1, 1.2);
  g.generateTexture('enemy_mycelium_creep', size, size);
  g.destroy();

  // ── Underroot: Blind Crawler (armored) ────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Heavy carapace
  g.fillStyle(0x332211);
  g.fillCircle(cx, cy, 12);
  g.fillStyle(0x554433);
  g.fillCircle(cx, cy, 10);
  g.fillStyle(0x443322);
  g.fillCircle(cx, cy, 8);
  // Armor ridges
  g.lineStyle(2, 0x221100);
  for (let i = -1; i <= 1; i++) {
    g.lineBetween(cx + i * 4, cy - 9, cx + i * 3, cy + 9);
  }
  // No eyes (blind)
  g.fillStyle(0x221100);
  g.fillEllipse(cx - 4, cy - 3, 5, 3);
  g.fillEllipse(cx + 4, cy - 3, 5, 3);
  // Claws
  g.lineStyle(3, 0x443322);
  g.lineBetween(cx - 10, cy, cx - 15, cy - 4);
  g.lineBetween(cx - 10, cy, cx - 15, cy + 4);
  g.lineBetween(cx + 10, cy, cx + 15, cy - 4);
  g.lineBetween(cx + 10, cy, cx + 15, cy + 4);
  g.generateTexture('enemy_blind_crawler', size, size);
  g.destroy();

  // ── The Rot: Rot Slug (regenerating) ──────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 19;
  g.fillStyle(0x5A3A22, 0.35);
  g.fillEllipse(cx - 5, cy + 2, 10, 4);
  // Dripping body
  g.fillStyle(0x6B3E2A);
  g.fillEllipse(cx, cy, 20, 11);
  g.fillStyle(0x8B5E3C);
  g.fillEllipse(cx + 1, cy - 1.5, 16, 8);
  // Rot blotches
  g.fillStyle(0xAA4422, 0.5);
  g.fillCircle(cx - 4, cy, 3);
  g.fillCircle(cx + 3, cy - 1, 2);
  // Antennae
  g.lineStyle(1, 0x9BAA7A);
  g.lineBetween(cx + 6, cy - 4, cx + 10, cy - 9);
  g.lineBetween(cx + 7, cy - 3, cx + 12, cy - 7);
  g.fillStyle(0xCCAA88);
  g.fillCircle(cx + 10, cy - 9, 1.5);
  g.fillCircle(cx + 12, cy - 7, 1.5);
  // Regen glow
  g.lineStyle(1, 0x55FF44, 0.3);
  g.strokeEllipse(cx, cy, 21, 12);
  g.fillStyle(0x331111);
  g.fillCircle(cx + 5, cy - 2.5, 1.5);
  g.generateTexture('enemy_rot_slug', size, size);
  g.destroy();

  // ── The Rot: Blight Walker (corrupted) ────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Warped body
  g.fillStyle(0x4A1A4A);
  g.fillCircle(cx, cy, 10);
  g.fillStyle(0x7A2C7A);
  g.fillCircle(cx, cy, 8);
  g.fillStyle(0x9A3C8A, 0.5);
  g.fillCircle(cx + 1, cy - 1, 5);
  // Corruption veins
  g.lineStyle(1, 0xDD44DD, 0.5);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    g.lineBetween(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4,
      cx + Math.cos(a) * 9, cy + Math.sin(a) * 9);
  }
  // Limbs
  g.lineStyle(2, 0x4A1A4A);
  g.lineBetween(cx - 8, cy - 2, cx - 13, cy - 7);
  g.lineBetween(cx - 8, cy + 2, cx - 13, cy + 5);
  g.lineBetween(cx + 8, cy - 2, cx + 13, cy - 7);
  g.lineBetween(cx + 8, cy + 2, cx + 13, cy + 5);
  // Blight eyes
  g.fillStyle(0xFF22FF);
  g.fillCircle(cx - 3, cy - 2, 2);
  g.fillCircle(cx + 3, cy - 2, 2);
  g.fillStyle(0x220022);
  g.fillCircle(cx - 3, cy - 2, 1);
  g.fillCircle(cx + 3, cy - 2, 1);
  g.generateTexture('enemy_blight_walker', size, size);
  g.destroy();

  // ── The Rot: Decay Moth (flying) ──────────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Tattered wings
  g.fillStyle(0x7A5530, 0.5);
  g.fillEllipse(cx - 9, cy - 2, 14, 8);
  g.fillEllipse(cx + 9, cy - 2, 14, 8);
  g.fillStyle(0xAA7744, 0.7);
  g.fillEllipse(cx - 8, cy - 3, 11, 6);
  g.fillEllipse(cx + 8, cy - 3, 11, 6);
  // Wing tear marks
  g.lineStyle(1, 0x331100, 0.4);
  g.lineBetween(cx - 12, cy - 1, cx - 8, cy + 1);
  g.lineBetween(cx + 12, cy - 1, cx + 8, cy + 1);
  // Body
  g.fillStyle(0x6A4422);
  g.fillEllipse(cx, cy, 7, 14);
  g.fillStyle(0x8A6444);
  g.fillEllipse(cx, cy - 1, 5, 10);
  // Rot-stained eyes
  g.fillStyle(0xDD6622);
  g.fillCircle(cx - 2, cy - 4, 2);
  g.fillCircle(cx + 2, cy - 4, 2);
  g.fillStyle(0x110000);
  g.fillCircle(cx - 2, cy - 4, 1);
  g.fillCircle(cx + 2, cy - 4, 1);
  g.generateTexture('enemy_decay_moth', size, size);
  g.destroy();

  // ── Canopy: Swarm Moth (tiny, flying) ─────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  g.fillStyle(0xBB8844, 0.5);
  g.fillEllipse(cx - 6, cy - 1, 9, 5);
  g.fillEllipse(cx + 6, cy - 1, 9, 5);
  g.fillStyle(0xDDAA66, 0.8);
  g.fillEllipse(cx - 5, cy - 2, 7, 4);
  g.fillEllipse(cx + 5, cy - 2, 7, 4);
  g.fillStyle(0xAA8844);
  g.fillEllipse(cx, cy, 5, 9);
  g.fillStyle(0xFFDD99);
  g.fillCircle(cx - 1.5, cy - 3, 1.2);
  g.fillCircle(cx + 1.5, cy - 3, 1.2);
  g.generateTexture('enemy_swarm_moth', size, size);
  g.destroy();

  // ── Canopy: Leaf Hopper (flying) ──────────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Green body
  g.fillStyle(0x3A7722);
  g.fillEllipse(cx, cy, 10, 14);
  g.fillStyle(0x66AA44);
  g.fillEllipse(cx - 0.5, cy - 1, 8, 11);
  // Wings (transparent)
  g.fillStyle(0x88CC66, 0.4);
  g.fillEllipse(cx - 8, cy - 3, 12, 7);
  g.fillEllipse(cx + 8, cy - 3, 12, 7);
  // Long hind legs for hopping
  g.lineStyle(2, 0x3A7722);
  g.lineBetween(cx - 4, cy + 5, cx - 8, cy + 10);
  g.lineBetween(cx - 8, cy + 10, cx - 6, cy + 14);
  g.lineBetween(cx + 4, cy + 5, cx + 8, cy + 10);
  g.lineBetween(cx + 8, cy + 10, cx + 6, cy + 14);
  // Antennae
  g.lineStyle(1, 0x88CC44);
  g.lineBetween(cx - 2, cy - 7, cx - 5, cy - 13);
  g.lineBetween(cx + 2, cy - 7, cx + 5, cy - 13);
  // Bright eyes
  g.fillStyle(0xFFFF55);
  g.fillCircle(cx - 3, cy - 3, 2);
  g.fillCircle(cx + 3, cy - 3, 2);
  g.fillStyle(0x111111);
  g.fillCircle(cx - 3, cy - 3, 1);
  g.fillCircle(cx + 3, cy - 3, 1);
  g.generateTexture('enemy_leaf_hopper', size, size);
  g.destroy();

  // ── Canopy: Wind Sprite (flying, ranged) ──────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Wispy form
  g.fillStyle(0x5588AA, 0.2);
  g.fillCircle(cx, cy, 11);
  g.fillStyle(0x6699BB, 0.4);
  g.fillCircle(cx, cy, 8);
  g.fillStyle(0x88CCFF, 0.6);
  g.fillCircle(cx, cy, 5);
  g.fillStyle(0xCCEEFF);
  g.fillCircle(cx, cy, 3);
  // Wind swirls
  g.lineStyle(1, 0x99DDFF, 0.5);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.lineBetween(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6,
      cx + Math.cos(a + 0.8) * 11, cy + Math.sin(a + 0.8) * 11);
  }
  // Glowing eyes
  g.fillStyle(0xAAEEFF);
  g.fillCircle(cx - 2, cy - 1, 1.5);
  g.fillCircle(cx + 2, cy - 1, 1.5);
  g.generateTexture('enemy_wind_sprite', size, size);
  g.destroy();

  // ── Emergent: Root Golem (armored, large) ─────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Stone base
  g.fillStyle(0x2A4A1A);
  g.fillCircle(cx, cy, 13);
  g.fillStyle(0x4A7A2E);
  g.fillCircle(cx, cy, 11);
  g.fillStyle(0x5A8A3E, 0.5);
  g.fillCircle(cx + 1, cy - 1, 8);
  // Root tendrils sticking out
  g.lineStyle(4, 0x2A4A1A);
  const angles = [Math.PI * 0.1, Math.PI * 0.4, Math.PI * 0.7, Math.PI * 1.1, Math.PI * 1.5, Math.PI * 1.8];
  for (const a of angles) {
    g.lineBetween(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10,
      cx + Math.cos(a) * 15, cy + Math.sin(a) * 15);
  }
  // Armor cracks
  g.lineStyle(1, 0x1A2A0A);
  g.lineBetween(cx - 4, cy - 8, cx - 2, cy + 4);
  g.lineBetween(cx + 3, cy - 7, cx + 5, cy + 2);
  // Stone eyes
  g.fillStyle(0xAAFF44);
  g.fillCircle(cx - 4, cy - 2, 2.5);
  g.fillCircle(cx + 4, cy - 2, 2.5);
  g.fillStyle(0x111111);
  g.fillCircle(cx - 4, cy - 2, 1.2);
  g.fillCircle(cx + 4, cy - 2, 1.2);
  g.generateTexture('enemy_root_golem', size, size);
  g.destroy();

  // ── Emergent: Crystal Crawler (piercing) ──────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Crystal body
  g.fillStyle(0x335566);
  g.fillRect(cx - 8, cy - 5, 16, 10);
  g.fillStyle(0x5588AA);
  g.fillRect(cx - 7, cy - 4, 14, 8);
  g.fillStyle(0x77AACC, 0.6);
  g.fillRect(cx - 5, cy - 3, 10, 5);
  // Crystal spikes (the piercing part)
  g.fillStyle(0x99CCEE);
  g.fillTriangle(cx - 7, cy - 5, cx - 11, cy - 10, cx - 4, cy - 5);
  g.fillTriangle(cx, cy - 5, cx - 1, cy - 11, cx + 3, cy - 5);
  g.fillTriangle(cx + 6, cy - 5, cx + 9, cy - 10, cx + 11, cy - 3);
  // Crystal shimmer
  g.lineStyle(1, 0xCCEEFF, 0.5);
  g.lineBetween(cx - 6, cy - 3, cx - 2, cy + 3);
  g.lineBetween(cx, cy - 3, cx + 2, cy + 3);
  g.lineBetween(cx + 4, cy - 3, cx + 6, cy + 2);
  // Legs
  g.lineStyle(1, 0x335566);
  for (let i = 0; i < 3; i++) {
    const ly = cy - 2 + i * 4;
    g.lineBetween(cx - 8, ly, cx - 13, ly + 2);
    g.lineBetween(cx + 8, ly, cx + 13, ly + 2);
  }
  // Glowing eye
  g.fillStyle(0x44BBFF);
  g.fillCircle(cx - 3, cy - 1, 2);
  g.fillCircle(cx + 3, cy - 1, 2);
  g.fillStyle(0xFFFFFF);
  g.fillCircle(cx - 3.5, cy - 1.5, 0.8);
  g.fillCircle(cx + 2.5, cy - 1.5, 0.8);
  g.generateTexture('enemy_crystal_crawler', size, size);
  g.destroy();

  // ── Emergent: Emerald Briar (elite) ───────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 16; cy = 16;
  // Thick glowing stem
  g.fillStyle(0x1A4A1A);
  g.fillRect(cx - 3, cy + 2, 6, 10);
  g.fillStyle(0x2A7A2A);
  // Aggressive pointed leaves
  g.fillTriangle(cx, cy - 6, cx - 12, cy + 1, cx - 2, cy + 3);
  g.fillTriangle(cx, cy - 6, cx + 12, cy + 1, cx + 2, cy + 3);
  g.fillTriangle(cx, cy - 10, cx - 9, cy - 3, cx, cy);
  g.fillTriangle(cx, cy - 10, cx + 9, cy - 3, cx, cy);
  // Glowing green spikes
  g.fillStyle(0x44DD44);
  g.fillTriangle(cx, cy - 15, cx - 3, cy - 8, cx + 3, cy - 8);
  // Side spikes
  g.fillStyle(0x33BB33);
  g.fillTriangle(cx - 13, cy, cx - 9, cy - 3, cx - 8, cy + 3);
  g.fillTriangle(cx + 13, cy, cx + 9, cy - 3, cx + 8, cy + 3);
  // Glowing veins
  g.lineStyle(1, 0x55FF55, 0.5);
  g.lineBetween(cx - 2, cy - 12, cx - 9, cy - 2);
  g.lineBetween(cx + 2, cy - 12, cx + 9, cy - 2);
  // Bright eyes
  g.fillStyle(0xFFFF44);
  g.fillCircle(cx - 3, cy - 2, 1.5);
  g.fillCircle(cx + 3, cy - 2, 1.5);
  g.generateTexture('enemy_emerald_briar', size, size);
  g.destroy();
}

// ── Biome Boss Textures (80x80) ───────────────────────────────────

function generateBiomeBossTextures(scene) {
  const size = 80;
  let g, cx, cy;

  // ── Garden Golem (armored, green rock) ────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 40; cy = 40;
  // Base glow
  g.fillStyle(0x1A3A0A, 0.2);
  g.fillCircle(cx, cy, 36);
  // Boulder body
  g.fillStyle(0x1E3A0E);
  g.fillCircle(cx, cy, 30);
  g.fillStyle(0x336622);
  g.fillCircle(cx, cy, 27);
  g.fillStyle(0x448833, 0.5);
  g.fillCircle(cx + 3, cy - 3, 18);
  // Rock plates
  g.lineStyle(3, 0x1A2A0A);
  g.lineBetween(cx - 15, cy - 20, cx + 15, cy - 20);
  g.lineBetween(cx - 22, cy - 5, cx + 22, cy - 5);
  g.lineBetween(cx - 22, cy + 8, cx + 22, cy + 8);
  g.lineBetween(cx - 18, cy + 20, cx + 18, cy + 20);
  g.lineStyle(2, 0x1A2A0A);
  g.lineBetween(cx - 10, cy - 20, cx - 18, cy + 20);
  g.lineBetween(cx + 10, cy - 20, cx + 18, cy + 20);
  // Root tendril arms
  g.lineStyle(5, 0x1E3A0E);
  g.lineBetween(cx - 27, cy - 5, cx - 38, cy - 18);
  g.lineBetween(cx - 38, cy - 18, cx - 43, cy - 10);
  g.lineBetween(cx - 38, cy - 18, cx - 42, cy - 24);
  g.lineBetween(cx + 27, cy - 5, cx + 38, cy - 18);
  g.lineBetween(cx + 38, cy - 18, cx + 43, cy - 10);
  g.lineBetween(cx + 38, cy - 18, cx + 42, cy - 24);
  // Glowing eyes
  g.fillStyle(0x88FF44);
  g.fillEllipse(cx - 9, cy - 8, 10, 7);
  g.fillEllipse(cx + 9, cy - 8, 10, 7);
  g.fillStyle(0x1A1A1A);
  g.fillCircle(cx - 9, cy - 8, 3);
  g.fillCircle(cx + 9, cy - 8, 3);
  g.fillStyle(0xCCFF88);
  g.fillCircle(cx - 10.5, cy - 9.5, 1.2);
  g.fillCircle(cx + 7.5, cy - 9.5, 1.2);
  // Mouth / crack
  g.lineStyle(3, 0x1A1A1A);
  g.lineBetween(cx - 8, cy + 8, cx + 8, cy + 8);
  g.lineBetween(cx - 5, cy + 8, cx - 3, cy + 12);
  g.lineBetween(cx + 5, cy + 8, cx + 3, cy + 12);
  g.generateTexture('enemy_garden_golem', size, size);
  g.destroy();

  // ── Ancient Oak (armored + regenerating) ──────────────────────
  g = scene.make.graphics({ add: false });
  cx = 40; cy = 40;
  g.fillStyle(0x1A2A0A, 0.3);
  g.fillCircle(cx, cy, 36);
  // Trunk base
  g.fillStyle(0x1A2E0A);
  g.fillRect(cx - 18, cy - 10, 36, 30);
  g.fillStyle(0x2A5020);
  g.fillRect(cx - 15, cy - 8, 30, 28);
  // Bark texture
  g.lineStyle(2, 0x1A2E0A);
  for (let i = 0; i < 5; i++) {
    const bx = cx - 12 + i * 6;
    g.lineBetween(bx, cy - 7, bx + (i % 2 ? 2 : -2), cy + 18);
  }
  // Massive canopy
  g.fillStyle(0x1E4A10, 0.8);
  g.fillCircle(cx, cy - 16, 26);
  g.fillStyle(0x2E6A18);
  g.fillCircle(cx, cy - 18, 22);
  g.fillStyle(0x3E7A22, 0.6);
  g.fillCircle(cx - 5, cy - 22, 14);
  g.fillCircle(cx + 7, cy - 20, 12);
  // Regen aura
  g.lineStyle(1, 0x55FF55, 0.25);
  g.strokeCircle(cx, cy, 37);
  // Eyes (in bark)
  g.fillStyle(0xFFAA22);
  g.fillEllipse(cx - 8, cy + 5, 8, 6);
  g.fillEllipse(cx + 8, cy + 5, 8, 6);
  g.fillStyle(0x110000);
  g.fillCircle(cx - 8, cy + 5, 2.5);
  g.fillCircle(cx + 8, cy + 5, 2.5);
  g.fillStyle(0xFFDD88);
  g.fillCircle(cx - 9.5, cy + 3.5, 1);
  g.fillCircle(cx + 6.5, cy + 3.5, 1);
  g.generateTexture('enemy_ancient_oak', size, size);
  g.destroy();

  // ── Deep Mycelium (explosive, glowing) ────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 40; cy = 40;
  g.fillStyle(0x3A2A0A, 0.2);
  g.fillCircle(cx, cy, 36);
  // Cap
  g.fillStyle(0x6A4A12);
  g.fillEllipse(cx, cy - 8, 60, 38);
  g.fillStyle(0xAA7722);
  g.fillEllipse(cx, cy - 10, 52, 32);
  g.fillStyle(0xCC9933, 0.6);
  g.fillEllipse(cx - 3, cy - 14, 36, 22);
  // Stem
  g.fillStyle(0x7A5518);
  g.fillRect(cx - 12, cy + 6, 24, 22);
  g.fillStyle(0x9A7728);
  g.fillRect(cx - 9, cy + 7, 18, 20);
  // Glowing spore pockets
  g.fillStyle(0xFFDD44, 0.6);
  for (let i = 0; i < 7; i++) {
    const sx = cx - 22 + i * 7;
    const sy = cy - 10 + (i % 3) * 6;
    g.fillCircle(sx, sy, 3);
  }
  // Explosive glow
  g.lineStyle(2, 0xFFAA00, 0.4);
  g.strokeEllipse(cx, cy - 8, 62, 40);
  // Eyes
  g.fillStyle(0xFF6600);
  g.fillCircle(cx - 10, cy - 10, 5);
  g.fillCircle(cx + 10, cy - 10, 5);
  g.fillStyle(0x111111);
  g.fillCircle(cx - 10, cy - 10, 2.5);
  g.fillCircle(cx + 10, cy - 10, 2.5);
  g.fillStyle(0xFFDD00);
  g.fillCircle(cx - 11.5, cy - 11.5, 1.2);
  g.fillCircle(cx + 8.5, cy - 11.5, 1.2);
  g.generateTexture('enemy_deep_mycelium', size, size);
  g.destroy();

  // ── Blight Lord (corrupted, regen) ───────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 40; cy = 40;
  g.fillStyle(0x2A0A2E, 0.2);
  g.fillCircle(cx, cy, 36);
  g.fillStyle(0x3A0A3A);
  g.fillCircle(cx, cy, 29);
  g.fillStyle(0x6A1A6A);
  g.fillCircle(cx, cy, 25);
  g.fillStyle(0x7A2C7A, 0.5);
  g.fillCircle(cx + 3, cy - 3, 16);
  // Corruption tendrils
  g.lineStyle(3, 0xDD44DD, 0.4);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
    g.lineBetween(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20,
      cx + Math.cos(a) * 34, cy + Math.sin(a) * 34);
  }
  // Drip effects below
  g.lineStyle(2, 0x6A1A6A);
  for (let i = 0; i < 5; i++) {
    const dx = cx - 14 + i * 7;
    const len = 8 + (i * 3 % 6);
    g.lineBetween(dx, cy + 22, dx + (i % 2 ? 2 : -2), cy + 22 + len);
    g.fillStyle(0x8A2A8A);
    g.fillCircle(dx + (i % 2 ? 2 : -2), cy + 22 + len, 2.5);
  }
  // Large blight eyes
  g.fillStyle(0xFF44FF);
  g.fillEllipse(cx - 10, cy - 7, 12, 9);
  g.fillEllipse(cx + 10, cy - 7, 12, 9);
  g.fillStyle(0x110011);
  g.fillCircle(cx - 10, cy - 7, 3.5);
  g.fillCircle(cx + 10, cy - 7, 3.5);
  g.fillStyle(0xFF88FF);
  g.fillCircle(cx - 12, cy - 9, 1.5);
  g.fillCircle(cx + 8, cy - 9, 1.5);
  // Corruption mouth
  g.lineStyle(2, 0xDD22DD);
  g.lineBetween(cx - 10, cy + 8, cx + 10, cy + 8);
  for (let i = 0; i < 5; i++) {
    const tx = cx - 8 + i * 4;
    g.lineBetween(tx, cy + 8, tx + 1, cy + 12);
  }
  g.generateTexture('enemy_blight_lord', size, size);
  g.destroy();

  // ── Canopy Queen (flying, purple) ────────────────────────────
  g = scene.make.graphics({ add: false });
  cx = 40; cy = 40;
  // Large wing pair
  g.fillStyle(0x4422AA, 0.4);
  g.fillEllipse(cx - 22, cy - 5, 36, 24);
  g.fillEllipse(cx + 22, cy - 5, 36, 24);
  g.fillStyle(0x6633CC, 0.7);
  g.fillEllipse(cx - 20, cy - 7, 28, 18);
  g.fillEllipse(cx + 20, cy - 7, 28, 18);
  // Wing veins
  g.lineStyle(1, 0x9955EE, 0.5);
  g.lineBetween(cx - 8, cy - 4, cx - 32, cy - 8);
  g.lineBetween(cx - 8, cy - 2, cx - 28, cy + 3);
  g.lineBetween(cx + 8, cy - 4, cx + 32, cy - 8);
  g.lineBetween(cx + 8, cy - 2, cx + 28, cy + 3);
  // Lower smaller wings
  g.fillStyle(0x5533BB, 0.5);
  g.fillEllipse(cx - 16, cy + 8, 22, 14);
  g.fillEllipse(cx + 16, cy + 8, 22, 14);
  // Body
  g.fillStyle(0x331177);
  g.fillEllipse(cx, cy, 16, 28);
  g.fillStyle(0x8855CC);
  g.fillEllipse(cx - 1, cy - 2, 13, 22);
  // Crown
  g.fillStyle(0xBB88FF);
  g.fillTriangle(cx, cy - 22, cx - 4, cy - 14, cx + 4, cy - 14);
  g.fillTriangle(cx - 5, cy - 20, cx - 9, cy - 13, cx - 2, cy - 13);
  g.fillTriangle(cx + 5, cy - 20, cx + 9, cy - 13, cx + 2, cy - 13);
  // Eyes
  g.fillStyle(0xFFDD55);
  g.fillEllipse(cx - 5, cy - 5, 8, 6);
  g.fillEllipse(cx + 5, cy - 5, 8, 6);
  g.fillStyle(0x110000);
  g.fillCircle(cx - 5, cy - 5, 2.5);
  g.fillCircle(cx + 5, cy - 5, 2.5);
  g.fillStyle(0xFFFFAA);
  g.fillCircle(cx - 6.5, cy - 6.5, 1);
  g.fillCircle(cx + 3.5, cy - 6.5, 1);
  g.generateTexture('enemy_canopy_queen', size, size);
  g.destroy();

  // ── World Root (final boss — crystalline roots) ───────────────
  g = scene.make.graphics({ add: false });
  cx = 40; cy = 40;
  // Dark aura
  g.fillStyle(0x05050F, 0.4);
  g.fillCircle(cx, cy, 38);
  // Main body
  g.fillStyle(0x0A0A1E);
  g.fillCircle(cx, cy, 30);
  g.fillStyle(0x1A1A2E);
  g.fillCircle(cx, cy, 26);
  g.fillStyle(0x2A2A44, 0.5);
  g.fillCircle(cx + 2, cy - 2, 17);
  // Crystal root spikes radiating out
  g.fillStyle(0x3355AA);
  const spikeAngles = [0, Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4, Math.PI, Math.PI * 5 / 4, Math.PI * 3 / 2, Math.PI * 7 / 4];
  for (const a of spikeAngles) {
    const sx = cx + Math.cos(a) * 24;
    const sy = cy + Math.sin(a) * 24;
    const ex = cx + Math.cos(a) * 38;
    const ey = cy + Math.sin(a) * 38;
    const px = cx + Math.cos(a + 0.25) * 28;
    const py = cy + Math.sin(a + 0.25) * 28;
    g.fillTriangle(sx, sy, ex, ey, px, py);
  }
  // Inner veins
  g.lineStyle(2, 0x4466CC, 0.5);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    g.lineBetween(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10,
      cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
  }
  // Core glow
  g.fillStyle(0x3355AA, 0.3);
  g.fillCircle(cx, cy, 12);
  g.fillStyle(0x5577CC, 0.5);
  g.fillCircle(cx, cy, 8);
  // Cosmic eyes
  g.fillStyle(0x88AAFF);
  g.fillEllipse(cx - 9, cy - 6, 12, 8);
  g.fillEllipse(cx + 9, cy - 6, 12, 8);
  g.fillStyle(0x000011);
  g.fillCircle(cx - 9, cy - 6, 3.5);
  g.fillCircle(cx + 9, cy - 6, 3.5);
  g.fillStyle(0xCCDDFF);
  g.fillCircle(cx - 10.5, cy - 7.5, 1.5);
  g.fillCircle(cx + 7.5, cy - 7.5, 1.5);
  // Ancient mouth
  g.lineStyle(2, 0x4466BB);
  g.lineBetween(cx - 10, cy + 9, cx + 10, cy + 9);
  g.lineStyle(1, 0x4466BB);
  for (let i = 0; i < 6; i++) {
    const mx = cx - 9 + i * 4;
    g.lineBetween(mx, cy + 9, mx + 1, cy + 14);
  }
  g.generateTexture('enemy_world_root', size, size);
  g.destroy();
}

// ── Projectile & Particle Textures ───────────────────────────────

function generateProjectileTexture(scene) {
  // Main projectile — glowing orb with halo
  let g = scene.make.graphics({ add: false });
  g.fillStyle(0xFFFF44, 0.2);
  g.fillCircle(6, 6, 6);
  g.fillStyle(0xFFFF88, 0.5);
  g.fillCircle(6, 6, 4);
  g.fillStyle(0xFFFF88);
  g.fillCircle(6, 6, 3);
  g.fillStyle(0xFFFFCC);
  g.fillCircle(5, 5, 1.5);
  g.generateTexture('projectile', 12, 12);
  g.destroy();

  // Trail particle
  g = scene.make.graphics({ add: false });
  g.fillStyle(0xFFFF88, 0.5);
  g.fillCircle(3, 3, 3);
  g.fillStyle(0xFFFFAA, 0.3);
  g.fillCircle(3, 3, 2);
  g.generateTexture('particle_trail', 6, 6);
  g.destroy();

  // Spore particle
  g = scene.make.graphics({ add: false });
  g.fillStyle(0xBB77EE, 0.4);
  g.fillCircle(4, 4, 4);
  g.fillStyle(0xAA66DD);
  g.fillCircle(4, 4, 3);
  g.fillStyle(0xCC88FF);
  g.fillCircle(3, 3, 1);
  g.generateTexture('spore_particle', 8, 8);
  g.destroy();
}

function generateParticleTextures(scene) {
  // Hit particle — star burst
  let g = scene.make.graphics({ add: false });
  g.fillStyle(0xFFFFFF);
  g.fillCircle(4, 4, 2);
  g.lineStyle(1, 0xFFFFFF, 0.6);
  g.lineBetween(1, 4, 7, 4);
  g.lineBetween(4, 1, 4, 7);
  g.generateTexture('particle_hit', 8, 8);
  g.destroy();

  // Heal particle — plus sign
  g = scene.make.graphics({ add: false });
  g.fillStyle(0x66FF66);
  g.fillCircle(4, 4, 2);
  g.fillStyle(0x88FF88);
  g.fillRect(3, 1, 2, 6);
  g.fillRect(1, 3, 6, 2);
  g.generateTexture('particle_heal', 8, 8);
  g.destroy();

  // Poison particle
  g = scene.make.graphics({ add: false });
  g.fillStyle(0x88FF44);
  g.fillCircle(3, 3, 3);
  g.fillStyle(0xAAFF66);
  g.fillCircle(2, 2, 1.5);
  g.generateTexture('particle_poison', 6, 6);
  g.destroy();

  // Death particle — small square fragment
  g = scene.make.graphics({ add: false });
  g.fillStyle(0xFFFFFF);
  g.fillRect(0, 0, 3, 3);
  g.generateTexture('particle_death', 3, 3);
  g.destroy();

  // Ambient particle — tiny soft glow
  g = scene.make.graphics({ add: false });
  g.fillStyle(0x88CC88, 0.3);
  g.fillCircle(3, 3, 3);
  g.fillStyle(0xAAEEAA, 0.5);
  g.fillCircle(3, 3, 1.5);
  g.generateTexture('particle_ambient', 6, 6);
  g.destroy();
}

// ── Status Effect Icons (10x10) ──────────────────────────────────

function generateStatusIcons(scene) {
  const s = 10;

  // Poison — green droplet
  let g = scene.make.graphics({ add: false });
  g.fillStyle(0x88FF44);
  g.fillCircle(5, 6, 3);
  g.fillTriangle(5, 1, 3, 5, 7, 5);
  g.fillStyle(0xAAFF88);
  g.fillCircle(4, 5, 1);
  g.generateTexture('status_poison', s, s);
  g.destroy();

  // Bleed — red slash marks
  g = scene.make.graphics({ add: false });
  g.lineStyle(2, 0xFF4444);
  g.lineBetween(2, 2, 5, 8);
  g.lineBetween(5, 2, 8, 8);
  g.lineStyle(1, 0xFF8888);
  g.lineBetween(3, 2, 6, 8);
  g.generateTexture('status_bleed', s, s);
  g.destroy();

  // Burn — orange flame
  g = scene.make.graphics({ add: false });
  g.fillStyle(0xFF6622);
  g.fillTriangle(5, 1, 2, 9, 8, 9);
  g.fillStyle(0xFFAA44);
  g.fillTriangle(5, 3, 3, 8, 7, 8);
  g.fillStyle(0xFFDD66);
  g.fillCircle(5, 7, 1.5);
  g.generateTexture('status_burn', s, s);
  g.destroy();

  // Slow — blue downward arrow
  g = scene.make.graphics({ add: false });
  g.fillStyle(0x88CCFF);
  g.fillRect(4, 1, 2, 5);
  g.fillTriangle(5, 9, 1, 4, 9, 4);
  g.generateTexture('status_slow', s, s);
  g.destroy();

  // Frozen — cyan crystal
  g = scene.make.graphics({ add: false });
  g.lineStyle(2, 0xAADDFF);
  g.lineBetween(5, 1, 5, 9);
  g.lineBetween(1, 5, 9, 5);
  g.lineStyle(1, 0xDDEEFF);
  g.lineBetween(2, 2, 8, 8);
  g.lineBetween(8, 2, 2, 8);
  g.generateTexture('status_frozen', s, s);
  g.destroy();

  // Root — brown root lines
  g = scene.make.graphics({ add: false });
  g.lineStyle(2, 0x886633);
  g.lineBetween(5, 1, 5, 5);
  g.lineBetween(5, 5, 2, 9);
  g.lineBetween(5, 5, 8, 9);
  g.lineStyle(1, 0xAA8855);
  g.lineBetween(2, 9, 1, 9);
  g.lineBetween(8, 9, 9, 9);
  g.generateTexture('status_root', s, s);
  g.destroy();

  // Armor break — broken shield
  g = scene.make.graphics({ add: false });
  g.lineStyle(2, 0xCCAA44);
  g.lineBetween(2, 2, 2, 7);
  g.lineBetween(2, 7, 5, 9);
  g.lineBetween(8, 2, 8, 7);
  g.lineBetween(8, 7, 5, 9);
  g.lineStyle(1, 0xFF6644);
  g.lineBetween(4, 3, 6, 6);
  g.generateTexture('status_armor_break', s, s);
  g.destroy();

  // Regen suppress — purple X
  g = scene.make.graphics({ add: false });
  g.fillStyle(0x44CC44, 0.5);
  g.fillCircle(5, 5, 3);
  g.lineStyle(2, 0xCC88FF);
  g.lineBetween(2, 2, 8, 8);
  g.lineBetween(8, 2, 2, 8);
  g.generateTexture('status_regen_suppress', s, s);
  g.destroy();

  // --- Player debuff icons ---

  // Venom — dark purple droplet
  g = scene.make.graphics({ add: false });
  g.fillStyle(0x8844AA);
  g.fillCircle(5, 6, 3);
  g.fillTriangle(5, 1, 3, 5, 7, 5);
  g.fillStyle(0xAA66CC);
  g.fillCircle(4, 5, 1);
  g.generateTexture('status_venom', s, s);
  g.destroy();

  // Wither — brown wilting leaf
  g = scene.make.graphics({ add: false });
  g.lineStyle(2, 0x997744);
  g.lineBetween(5, 2, 5, 8);
  g.lineStyle(1, 0x886633);
  g.lineBetween(5, 4, 2, 2);
  g.lineBetween(5, 4, 8, 2);
  g.lineBetween(5, 6, 2, 8);
  g.lineBetween(5, 6, 8, 8);
  g.generateTexture('status_wither', s, s);
  g.destroy();

  // Corrode — yellow-green acid bubbles
  g = scene.make.graphics({ add: false });
  g.fillStyle(0xAACC22);
  g.fillCircle(3, 6, 2.5);
  g.fillCircle(7, 5, 2);
  g.fillCircle(5, 3, 1.5);
  g.fillStyle(0xCCEE44);
  g.fillCircle(3, 5, 1);
  g.generateTexture('status_corrode', s, s);
  g.destroy();

  // Entangle — dark green vine wrap
  g = scene.make.graphics({ add: false });
  g.lineStyle(2, 0x448822);
  g.lineBetween(2, 8, 5, 4);
  g.lineBetween(5, 4, 8, 6);
  g.lineBetween(8, 6, 5, 2);
  g.fillStyle(0x66AA33);
  g.fillTriangle(5, 1, 4, 3, 6, 3);
  g.generateTexture('status_entangle', s, s);
  g.destroy();

  // Attack slow — red clock with down arrow
  g = scene.make.graphics({ add: false });
  g.lineStyle(1.5, 0xFF8844);
  g.strokeCircle(5, 4, 3);
  g.lineBetween(5, 2, 5, 4);
  g.lineBetween(5, 4, 7, 4);
  g.fillStyle(0xFF6622);
  g.fillTriangle(5, 10, 3, 7, 7, 7);
  g.generateTexture('status_attack_slow', s, s);
  g.destroy();
}

// ── Category Icons (16x16) ───────────────────────────────────────

function generateCategoryIcons(scene) {
  const iconSize = 16;
  const cx = 8, cy = 8;

  // Root icon — branching lines
  let g = scene.make.graphics({ add: false });
  g.lineStyle(2, CATEGORY_COLORS.root);
  g.lineBetween(cx, 2, cx, 10);
  g.lineBetween(cx, 10, cx - 4, 14);
  g.lineBetween(cx, 10, cx + 4, 14);
  g.lineStyle(1, brightenColor(CATEGORY_COLORS.root, 30));
  g.lineBetween(cx - 4, 14, cx - 6, 15);
  g.lineBetween(cx + 4, 14, cx + 6, 15);
  g.generateTexture('icon_root', iconSize, iconSize);
  g.destroy();

  // Thorn icon — spike
  g = scene.make.graphics({ add: false });
  g.fillStyle(CATEGORY_COLORS.thorn);
  g.fillTriangle(cx, 1, cx - 4, 14, cx + 4, 14);
  g.fillStyle(brightenColor(CATEGORY_COLORS.thorn, 40));
  g.fillTriangle(cx, 1, cx - 1, 14, cx + 2, 14);
  g.generateTexture('icon_thorn', iconSize, iconSize);
  g.destroy();

  // Spore icon — 3-dot cluster
  g = scene.make.graphics({ add: false });
  g.fillStyle(CATEGORY_COLORS.spore);
  g.fillCircle(cx, cy - 3, 3);
  g.fillCircle(cx - 3, cy + 3, 3);
  g.fillCircle(cx + 3, cy + 3, 3);
  g.fillStyle(brightenColor(CATEGORY_COLORS.spore, 40));
  g.fillCircle(cx, cy - 3, 1.5);
  g.fillCircle(cx - 3, cy + 3, 1.5);
  g.fillCircle(cx + 3, cy + 3, 1.5);
  g.generateTexture('icon_spore', iconSize, iconSize);
  g.destroy();

  // Bloom icon — 5-petal flower
  g = scene.make.graphics({ add: false });
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
    g.fillStyle(CATEGORY_COLORS.bloom);
    g.fillCircle(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, 3);
  }
  g.fillStyle(0xFFEE44);
  g.fillCircle(cx, cy, 2);
  g.generateTexture('icon_bloom', iconSize, iconSize);
  g.destroy();

  // Vine icon — wavy line with leaf
  g = scene.make.graphics({ add: false });
  g.lineStyle(2, CATEGORY_COLORS.vine);
  g.lineBetween(2, 14, 6, 8);
  g.lineBetween(6, 8, 10, 10);
  g.lineBetween(10, 10, 14, 4);
  g.fillStyle(brightenColor(CATEGORY_COLORS.vine, 25));
  g.fillTriangle(14, 4, 12, 2, 14, 1);
  g.generateTexture('icon_vine', iconSize, iconSize);
  g.destroy();
}

// ── UI Textures ──────────────────────────────────────────────────

function generateUITextures(scene) {
  // Heart icon for HP bar
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xFF4466);
  g.fillCircle(4, 4, 3);
  g.fillCircle(8, 4, 3);
  g.fillTriangle(1, 5, 11, 5, 6, 11);
  g.fillStyle(0xFF8899);
  g.fillCircle(4, 3, 1.5);
  g.generateTexture('icon_heart', 12, 12);
  g.destroy();
}
