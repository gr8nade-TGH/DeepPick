/**
 * Test Data Generator for Battle Bets
 * Generates realistic NBA quarter stats based on typical ranges
 */

export interface QuarterStatRanges {
  pts: { min: number; max: number };
  reb: { min: number; max: number };
  ast: { min: number; max: number };
  blk: { min: number; max: number };
  '3pm': { min: number; max: number };
}

export interface QuarterStats {
  pts: number;
  reb: number;
  ast: number;
  blk: number;
  '3pm': number;
}

export interface TeamQuarterData {
  q1: QuarterStats;
  q2: QuarterStats;
  q3: QuarterStats;
  q4: QuarterStats;
}

/**
 * Realistic NBA stat ranges per quarter
 */
export const NBA_QUARTER_RANGES: Record<string, QuarterStatRanges> = {
  q1: {
    pts: { min: 25, max: 35 },
    reb: { min: 9, max: 14 },
    ast: { min: 5, max: 9 },
    blk: { min: 0, max: 3 },
    '3pm': { min: 2, max: 5 },
  },
  q2: {
    pts: { min: 23, max: 33 },
    reb: { min: 8, max: 13 },
    ast: { min: 4, max: 8 },
    blk: { min: 0, max: 3 },
    '3pm': { min: 2, max: 5 },
  },
  q3: {
    pts: { min: 24, max: 34 },
    reb: { min: 8, max: 13 },
    ast: { min: 4, max: 8 },
    blk: { min: 0, max: 3 },
    '3pm': { min: 2, max: 6 },
  },
  q4: {
    pts: { min: 22, max: 36 },
    reb: { min: 7, max: 12 },
    ast: { min: 4, max: 8 },
    blk: { min: 0, max: 3 },
    '3pm': { min: 2, max: 6 },
  },
};

/**
 * Generate random integer within range (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random quarter stats based on ranges
 */
function generateQuarterStats(ranges: QuarterStatRanges): QuarterStats {
  return {
    pts: randomInt(ranges.pts.min, ranges.pts.max),
    reb: randomInt(ranges.reb.min, ranges.reb.max),
    ast: randomInt(ranges.ast.min, ranges.ast.max),
    blk: randomInt(ranges.blk.min, ranges.blk.max),
    '3pm': randomInt(ranges['3pm'].min, ranges['3pm'].max),
  };
}

/**
 * Generate full game stats for one team (all 4 quarters)
 */
export function generateTeamGameStats(): TeamQuarterData {
  return {
    q1: generateQuarterStats(NBA_QUARTER_RANGES.q1),
    q2: generateQuarterStats(NBA_QUARTER_RANGES.q2),
    q3: generateQuarterStats(NBA_QUARTER_RANGES.q3),
    q4: generateQuarterStats(NBA_QUARTER_RANGES.q4),
  };
}

/**
 * Generate full game stats for both teams
 */
export function generateFullGameStats(): {
  team1: TeamQuarterData;
  team2: TeamQuarterData;
} {
  return {
    team1: generateTeamGameStats(),
    team2: generateTeamGameStats(),
  };
}

/**
 * Calculate total game stats from all quarters
 */
export function calculateGameTotals(teamData: TeamQuarterData): QuarterStats {
  return {
    pts: teamData.q1.pts + teamData.q2.pts + teamData.q3.pts + teamData.q4.pts,
    reb: teamData.q1.reb + teamData.q2.reb + teamData.q3.reb + teamData.q4.reb,
    ast: teamData.q1.ast + teamData.q2.ast + teamData.q3.ast + teamData.q4.ast,
    blk: teamData.q1.blk + teamData.q2.blk + teamData.q3.blk + teamData.q4.blk,
    '3pm': teamData.q1['3pm'] + teamData.q2['3pm'] + teamData.q3['3pm'] + teamData.q4['3pm'],
  };
}

/**
 * Pretty print quarter stats
 */
export function formatQuarterStats(stats: QuarterStats): string {
  return `PTS ${stats.pts} | REB ${stats.reb} | AST ${stats.ast} | BLK ${stats.blk} | 3PM ${stats['3pm']}`;
}

/**
 * Pretty print full game data
 */
export function printGameData(gameData: { team1: TeamQuarterData; team2: TeamQuarterData }): void {
  console.log('\n🏀 GENERATED GAME DATA\n');
  
  console.log('TEAM 1:');
  console.log(`  Q1: ${formatQuarterStats(gameData.team1.q1)}`);
  console.log(`  Q2: ${formatQuarterStats(gameData.team1.q2)}`);
  console.log(`  Q3: ${formatQuarterStats(gameData.team1.q3)}`);
  console.log(`  Q4: ${formatQuarterStats(gameData.team1.q4)}`);
  const team1Totals = calculateGameTotals(gameData.team1);
  console.log(`  TOTAL: ${formatQuarterStats(team1Totals)}`);
  
  console.log('\nTEAM 2:');
  console.log(`  Q1: ${formatQuarterStats(gameData.team2.q1)}`);
  console.log(`  Q2: ${formatQuarterStats(gameData.team2.q2)}`);
  console.log(`  Q3: ${formatQuarterStats(gameData.team2.q3)}`);
  console.log(`  Q4: ${formatQuarterStats(gameData.team2.q4)}`);
  const team2Totals = calculateGameTotals(gameData.team2);
  console.log(`  TOTAL: ${formatQuarterStats(team2Totals)}`);
  
  console.log(`\nFINAL SCORE: Team 1 ${team1Totals.pts} - Team 2 ${team2Totals.pts}`);
  console.log('');
}

/**
 * Generate specific quarter stats (for manual testing)
 */
export function generateSpecificQuarter(
  quarter: 'q1' | 'q2' | 'q3' | 'q4'
): { team1: QuarterStats; team2: QuarterStats } {
  const ranges = NBA_QUARTER_RANGES[quarter];
  return {
    team1: generateQuarterStats(ranges),
    team2: generateQuarterStats(ranges),
  };
}

/**
 * Create custom quarter stats (for precise testing)
 */
export function createCustomQuarterStats(
  pts: number,
  reb: number,
  ast: number,
  blk: number,
  threepm: number
): QuarterStats {
  return {
    pts,
    reb,
    ast,
    blk,
    '3pm': threepm,
  };
}

