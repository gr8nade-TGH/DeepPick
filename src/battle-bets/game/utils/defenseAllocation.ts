/**
 * Defense Dot Allocation System
 * Converts capper unit records into defense dot distribution
 */

import type { StatType } from '../../types/game';

/**
 * Defense dot distribution percentages per stat row
 */
export const DEFENSE_DISTRIBUTION = {
  pts: 0.60,  // 60%
  reb: 0.20,  // 20%
  ast: 0.10,  // 10%
  stl: 0.05,  // 5%
  '3pt': 0.05, // 5%
} as const;

/**
 * Conversion rate: units to defense dots
 * Every +1 unit = 1 defense dot (1:1 ratio)
 */
export const UNITS_PER_DEFENSE_DOT = 1;

/**
 * Calculate total defense dots from unit record
 * Formula: 1 unit = 1 defense dot (1:1 ratio)
 * Minimum: 0 (negative units = 0 dots)
 */
export function calculateTotalDefenseDots(units: number): number {
  if (units <= 0) return 0;
  return Math.floor(units / UNITS_PER_DEFENSE_DOT);
}

/**
 * Distribute defense dots across stat rows
 *
 * System:
 * 1. Each stat gets 1 base defense dot (5 dots total baseline)
 * 2. Remaining dots distributed using 60/20/10/5/5 percentages
 * 3. MAX 10 DOTS PER STAT ROW (grid limitation)
 *
 * Returns object with defense dot count per stat
 */
export function distributeDefenseDots(totalDots: number): Record<StatType, number> {
  const MAX_DOTS_PER_STAT = 10; // Grid has 10 cells per stat row

  if (totalDots <= 0) {
    return {
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      '3pt': 0,
    };
  }

  // Each stat gets 1 base defense dot
  const BASE_DOTS_PER_STAT = 1;
  const NUM_STATS = 5;
  const baseDots = NUM_STATS * BASE_DOTS_PER_STAT; // 5 dots

  // If we don't have enough for base allocation, distribute what we have evenly
  if (totalDots < baseDots) {
    const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
    const distribution: Record<StatType, number> = {
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      '3pt': 0,
    };
    for (let i = 0; i < totalDots; i++) {
      distribution[stats[i]] = 1;
    }
    return distribution;
  }

  // Start with base allocation
  let ptsTotal = BASE_DOTS_PER_STAT;
  let rebTotal = BASE_DOTS_PER_STAT;
  let astTotal = BASE_DOTS_PER_STAT;
  let stlTotal = BASE_DOTS_PER_STAT;
  let threePtTotal = BASE_DOTS_PER_STAT;

  // Calculate remaining dots to distribute
  let remainingDots = totalDots - baseDots;

  if (remainingDots > 0) {
    // Distribute remaining dots using 60/20/10/5/5 percentages
    const ptsDots = remainingDots * DEFENSE_DISTRIBUTION.pts;
    const rebDots = remainingDots * DEFENSE_DISTRIBUTION.reb;
    const astDots = remainingDots * DEFENSE_DISTRIBUTION.ast;
    const stlDots = remainingDots * DEFENSE_DISTRIBUTION.stl;
    const threePtDots = remainingDots * DEFENSE_DISTRIBUTION['3pt'];

    // Round down for each stat
    let ptsRounded = Math.floor(ptsDots);
    let rebRounded = Math.floor(rebDots);
    let astRounded = Math.floor(astDots);
    let stlRounded = Math.floor(stlDots);
    let threePtRounded = Math.floor(threePtDots);

    // Apply MAX cap (10 dots per stat)
    const ptsAvailable = MAX_DOTS_PER_STAT - ptsTotal;
    const rebAvailable = MAX_DOTS_PER_STAT - rebTotal;
    const astAvailable = MAX_DOTS_PER_STAT - astTotal;
    const stlAvailable = MAX_DOTS_PER_STAT - stlTotal;
    const threePtAvailable = MAX_DOTS_PER_STAT - threePtTotal;

    ptsRounded = Math.min(ptsRounded, ptsAvailable);
    rebRounded = Math.min(rebRounded, rebAvailable);
    astRounded = Math.min(astRounded, astAvailable);
    stlRounded = Math.min(stlRounded, stlAvailable);
    threePtRounded = Math.min(threePtRounded, threePtAvailable);

    // Calculate remainder (due to rounding and capping)
    const allocated = ptsRounded + rebRounded + astRounded + stlRounded + threePtRounded;
    let remainder = remainingDots - allocated;

    // Distribute remainder to stats with largest fractional parts (that aren't capped)
    const fractionalParts = [
      { stat: 'pts' as StatType, index: 0, fraction: ptsDots - Math.floor(ptsDots), value: ptsRounded, available: ptsAvailable },
      { stat: 'reb' as StatType, index: 1, fraction: rebDots - Math.floor(rebDots), value: rebRounded, available: rebAvailable },
      { stat: 'ast' as StatType, index: 2, fraction: astDots - Math.floor(astDots), value: astRounded, available: astAvailable },
      { stat: 'stl' as StatType, index: 3, fraction: stlDots - Math.floor(stlDots), value: stlRounded, available: stlAvailable },
      { stat: '3pt' as StatType, index: 4, fraction: threePtDots - Math.floor(threePtDots), value: threePtRounded, available: threePtAvailable },
    ];

    // Sort by fractional part (descending), with index as tiebreaker
    fractionalParts.sort((a, b) => {
      if (b.fraction !== a.fraction) {
        return b.fraction - a.fraction;
      }
      return a.index - b.index; // Lower index (higher priority stat) wins ties
    });

    // Add remainder dots to stats with largest fractional parts (that aren't capped)
    for (let i = 0; i < fractionalParts.length && remainder > 0; i++) {
      const item = fractionalParts[i];
      // Only add if this stat has room (not capped)
      if (item.value < item.available) {
        item.value++;
        remainder--;
      }
    }

    // Add distributed dots to base allocation
    ptsTotal += fractionalParts.find(item => item.stat === 'pts')!.value;
    rebTotal += fractionalParts.find(item => item.stat === 'reb')!.value;
    astTotal += fractionalParts.find(item => item.stat === 'ast')!.value;
    stlTotal += fractionalParts.find(item => item.stat === 'stl')!.value;
    threePtTotal += fractionalParts.find(item => item.stat === '3pt')!.value;
  }

  // Final cap enforcement (just in case)
  ptsTotal = Math.min(ptsTotal, MAX_DOTS_PER_STAT);
  rebTotal = Math.min(rebTotal, MAX_DOTS_PER_STAT);
  astTotal = Math.min(astTotal, MAX_DOTS_PER_STAT);
  stlTotal = Math.min(stlTotal, MAX_DOTS_PER_STAT);
  threePtTotal = Math.min(threePtTotal, MAX_DOTS_PER_STAT);

  return {
    pts: ptsTotal,
    reb: rebTotal,
    ast: astTotal,
    stl: stlTotal,
    '3pt': threePtTotal,
  };
}

/**
 * Get defense dot count for a specific stat
 */
export function getDefenseDotsForStat(units: number, stat: StatType): number {
  const totalDots = calculateTotalDefenseDots(units);
  const distribution = distributeDefenseDots(totalDots);
  return distribution[stat];
}

/**
 * Format unit record for display
 * Example: +32 units → "+32 UNITS"
 * Example: -5 units → "-5 UNITS"
 * Example: 0 units → "0 UNITS"
 */
export function formatUnitRecord(units: number): string {
  const sign = units > 0 ? '+' : '';
  return `${sign}${units} UNITS`;
}

/**
 * Example calculations for testing (NEW SYSTEM with base dots):
 *
 * +40 units:
 *   Total dots: 40 × 1 = 40 dots
 *   Base: [1, 1, 1, 1, 1] = 5 dots
 *   Remaining: 40 - 5 = 35 dots
 *   Distribution of 35 dots:
 *     PTS: 35 × 0.60 = 21.0 → 21 dots
 *     REB: 35 × 0.20 = 7.0 → 7 dots
 *     AST: 35 × 0.10 = 3.5 → 4 dots (after rounding)
 *     BLK: 35 × 0.05 = 1.75 → 2 dots (after rounding)
 *     3PT: 35 × 0.05 = 1.75 → 1 dot (after rounding)
 *   Final: PTS=22, REB=8, AST=5, BLK=3, 3PT=2
 *
 * +30 units:
 *   Total dots: 30 × 1 = 30 dots
 *   Base: [1, 1, 1, 1, 1] = 5 dots
 *   Remaining: 30 - 5 = 25 dots
 *   Distribution of 25 dots:
 *     PTS: 25 × 0.60 = 15.0 → 15 dots
 *     REB: 25 × 0.20 = 5.0 → 5 dots
 *     AST: 25 × 0.10 = 2.5 → 3 dots (after rounding)
 *     BLK: 25 × 0.05 = 1.25 → 1 dot (after rounding)
 *     3PT: 25 × 0.05 = 1.25 → 1 dot (after rounding)
 *   Final: PTS=16, REB=6, AST=4, BLK=2, 3PT=2
 *
 * +4 units:
 *   Total dots: 4 × 1 = 4 dots
 *   Base: Can't afford full base (need 5), so distribute evenly
 *   Final: PTS=1, REB=1, AST=1, BLK=1, 3PT=0
 *
 * -10 units:
 *   Total dots: 0 (negative units)
 *   Final: PTS=0, REB=0, AST=0, BLK=0, 3PT=0
 */

