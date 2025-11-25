/**
 * ItemRollSystem.ts
 * 
 * Handles randomized item stat rolling with quality tiers.
 * Similar to Diablo/Path of Exile item system.
 */

export type QualityTier = 'Warped' | 'Balanced' | 'Honed' | 'Masterwork';

export interface StatRollRange {
  min: number;
  max: number;
  step?: number; // Optional: round to nearest step (e.g., 0.5)
}

export interface ItemDefinition {
  id: string;
  team: string;
  teamName: string;
  slot: 'attack' | 'defense' | 'weapon';
  name: string;
  description: string;
  icon?: string; // Optional emoji icon for display
  rollRanges: Record<string, StatRollRange>;
}

export interface RolledItemStats {
  itemId: string;
  rolls: Record<string, number>;
  qualityTier: QualityTier;
  qualityScore: number; // 0-100, used to determine tier
}

/**
 * Roll a random value within a range
 */
function rollStat(range: StatRollRange): number {
  const { min, max, step } = range;
  const raw = min + Math.random() * (max - min);

  if (step) {
    return Math.round(raw / step) * step;
  }

  // Round to 1 decimal place by default
  return Math.round(raw * 10) / 10;
}

/**
 * Calculate quality score (0-100) based on how close rolls are to max
 */
function calculateQualityScore(
  rolls: Record<string, number>,
  ranges: Record<string, StatRollRange>
): number {
  const statKeys = Object.keys(rolls);
  if (statKeys.length === 0) return 50; // Default to Balanced

  let totalScore = 0;

  for (const key of statKeys) {
    const value = rolls[key];
    const range = ranges[key];

    if (!range) continue;

    // Calculate percentage of max (0-100)
    const percentage = ((value - range.min) / (range.max - range.min)) * 100;
    totalScore += percentage;
  }

  // Average across all stats
  return totalScore / statKeys.length;
}

/**
 * Determine quality tier based on score
 * - Warped: 0-25 (bottom 25%)
 * - Balanced: 25-60 (middle 35%)
 * - Honed: 60-85 (upper 25%)
 * - Masterwork: 85-100 (top 15%)
 */
function determineQualityTier(score: number): QualityTier {
  if (score >= 85) return 'Masterwork';
  if (score >= 60) return 'Honed';
  if (score >= 25) return 'Balanced';
  return 'Warped';
}

/**
 * Roll stats for an item
 */
export function rollItem(definition: ItemDefinition): RolledItemStats {
  const rolls: Record<string, number> = {};

  // Roll each stat
  for (const [key, range] of Object.entries(definition.rollRanges)) {
    rolls[key] = rollStat(range);
  }

  // Calculate quality
  const qualityScore = calculateQualityScore(rolls, definition.rollRanges);
  const qualityTier = determineQualityTier(qualityScore);

  console.log(`🎲 [ItemRollSystem] Rolled ${definition.name}:`, {
    rolls,
    qualityScore: qualityScore.toFixed(1),
    qualityTier,
  });

  return {
    itemId: definition.id,
    rolls,
    qualityTier,
    qualityScore,
  };
}

/**
 * Roll a specific item by ID (for testing)
 */
export function rollItemById(
  itemId: string,
  itemDefinitions: ItemDefinition[]
): RolledItemStats | null {
  const definition = itemDefinitions.find((def) => def.id === itemId);

  if (!definition) {
    console.error(`❌ [ItemRollSystem] Item definition not found: ${itemId}`);
    return null;
  }

  return rollItem(definition);
}

/**
 * Force a specific quality tier (for testing)
 */
export function rollItemWithTier(
  definition: ItemDefinition,
  targetTier: QualityTier
): RolledItemStats {
  const rolls: Record<string, number> = {};

  // Determine target score range for tier
  let targetScore: number;
  switch (targetTier) {
    case 'Masterwork':
      targetScore = 90 + Math.random() * 10; // 90-100
      break;
    case 'Honed':
      targetScore = 70 + Math.random() * 15; // 70-85
      break;
    case 'Balanced':
      targetScore = 40 + Math.random() * 20; // 40-60
      break;
    case 'Warped':
      targetScore = Math.random() * 25; // 0-25
      break;
  }

  // Roll stats biased toward target score
  for (const [key, range] of Object.entries(definition.rollRanges)) {
    const { min, max } = range;
    const targetValue = min + (max - min) * (targetScore / 100);
    // Add some randomness (±10%)
    const variance = (max - min) * 0.1;
    const value = targetValue + (Math.random() - 0.5) * variance;
    rolls[key] = Math.max(min, Math.min(max, value));
  }

  const qualityScore = calculateQualityScore(rolls, definition.rollRanges);
  const qualityTier = determineQualityTier(qualityScore);

  return {
    itemId: definition.id,
    rolls,
    qualityTier,
    qualityScore,
  };
}

