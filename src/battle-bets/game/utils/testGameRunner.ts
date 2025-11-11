/**
 * Test Game Runner
 * Runs a full 4-quarter game simulation with realistic NBA stats
 */

import { generateFullGameStats, printGameData, type TeamQuarterData, type QuarterStats } from './testDataGenerator';

export interface GameSimulationResult {
  gameData: {
    team1: TeamQuarterData;
    team2: TeamQuarterData;
  };
  quarterResults: Array<{
    quarter: number;
    team1Stats: QuarterStats;
    team2Stats: QuarterStats;
    team1Score: number;
    team2Score: number;
    winner: 'team1' | 'team2' | 'tie';
  }>;
  finalScore: {
    team1: number;
    team2: number;
  };
  winner: 'team1' | 'team2' | 'tie';
}

/**
 * Run a full game simulation with generated stats
 */
export function runTestGame(): GameSimulationResult {
  // Generate realistic game data
  const gameData = generateFullGameStats();
  
  // Print the generated data
  printGameData(gameData);
  
  // Calculate quarter-by-quarter results
  const quarterResults = [];
  let team1RunningScore = 0;
  let team2RunningScore = 0;
  
  const quarters: Array<'q1' | 'q2' | 'q3' | 'q4'> = ['q1', 'q2', 'q3', 'q4'];
  
  for (let i = 0; i < quarters.length; i++) {
    const quarter = quarters[i];
    const team1Stats = gameData.team1[quarter];
    const team2Stats = gameData.team2[quarter];
    
    team1RunningScore += team1Stats.pts;
    team2RunningScore += team2Stats.pts;
    
    const winner = team1Stats.pts > team2Stats.pts ? 'team1' : 
                   team2Stats.pts > team1Stats.pts ? 'team2' : 'tie';
    
    quarterResults.push({
      quarter: i + 1,
      team1Stats,
      team2Stats,
      team1Score: team1RunningScore,
      team2Score: team2RunningScore,
      winner,
    });
  }
  
  // Determine final winner
  const finalWinner = team1RunningScore > team2RunningScore ? 'team1' :
                      team2RunningScore > team1RunningScore ? 'team2' : 'tie';
  
  return {
    gameData,
    quarterResults,
    finalScore: {
      team1: team1RunningScore,
      team2: team2RunningScore,
    },
    winner: finalWinner,
  };
}

/**
 * Print detailed game simulation results
 */
export function printGameResults(result: GameSimulationResult): void {
  console.log('\n📊 GAME SIMULATION RESULTS\n');
  
  result.quarterResults.forEach(qr => {
    console.log(`Q${qr.quarter}:`);
    console.log(`  Team 1: ${qr.team1Stats.pts} pts (Running: ${qr.team1Score})`);
    console.log(`  Team 2: ${qr.team2Stats.pts} pts (Running: ${qr.team2Score})`);
    console.log(`  Quarter Winner: ${qr.winner.toUpperCase()}`);
    console.log('');
  });
  
  console.log('FINAL SCORE:');
  console.log(`  Team 1: ${result.finalScore.team1}`);
  console.log(`  Team 2: ${result.finalScore.team2}`);
  console.log(`  WINNER: ${result.winner.toUpperCase()}`);
  console.log('');
}

/**
 * Convert quarter stats to the format expected by quarterSimulation.ts
 */
export function convertToQuarterData(stats: QuarterStats): {
  points: number;
  rebounds: number;
  assists: number;
  blocks: number;
  threePointers: number;
} {
  return {
    points: stats.pts,
    rebounds: stats.reb,
    assists: stats.ast,
    blocks: stats.blk,
    threePointers: stats['3pm'],
  };
}

/**
 * Get quarter data for simulation
 */
export function getQuarterDataForSimulation(
  gameData: { team1: TeamQuarterData; team2: TeamQuarterData },
  quarter: 1 | 2 | 3 | 4
): {
  left: ReturnType<typeof convertToQuarterData>;
  right: ReturnType<typeof convertToQuarterData>;
} {
  const quarterKey = `q${quarter}` as 'q1' | 'q2' | 'q3' | 'q4';
  
  return {
    left: convertToQuarterData(gameData.team1[quarterKey]),
    right: convertToQuarterData(gameData.team2[quarterKey]),
  };
}

