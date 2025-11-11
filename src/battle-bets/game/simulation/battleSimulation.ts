/**
 * Full Battle Simulation - Runs all 4 quarters automatically
 * Checks HP after each attack and ends battle when a castle is destroyed
 */

import { simulateQuarter, fireStatRow } from './quarterSimulation';
import { useGameStore } from '../../store/gameStore';
import { TreasureChest } from '../entities/TreasureChest';
import { getBattlefieldCenter } from '../utils/positioning';
import { pixiManager } from '../managers/PixiManager';
import { orbDistributionAnimator } from '../animation/OrbDistributionAnimator';
import type { StatType } from '../../types/game';

/**
 * Simulate a full battle (all 4 quarters)
 * Stops early if a castle is destroyed
 */
export async function simulateFullBattle(): Promise<{
  winner: 'left' | 'right' | 'draw';
  quarterEnded: number;
}> {
  console.log('\n🎮 ========== FULL BATTLE SIMULATION START ==========');
  
  const store = useGameStore.getState();
  const game = store.games[0];
  
  if (!game) {
    console.error('❌ No game found!');
    throw new Error('No game found');
  }

  const leftKey = `${game.id}-left`;
  const rightKey = `${game.id}-right`;

  console.log(`⚔️  ${game.leftCapper.name} (${game.leftTeam.abbreviation}) vs ${game.rightCapper.name} (${game.rightTeam.abbreviation})`);
  console.log(`📊 Starting HP: Left=${store.capperHP.get(leftKey)?.currentHP}, Right=${store.capperHP.get(rightKey)?.currentHP}`);
  console.log(`📊 Spread: ${game.leftTeam.abbreviation} ${game.spread}`);

  // STEP 1: Animate defense orb distribution ONCE before Q1
  console.log(`\n🎬 Animating defense orb distribution before Q1...`);
  const currentDefenseDots = store.defenseDots;
  const newDefenseDots = await orbDistributionAnimator.animateDistribution(game, currentDefenseDots);
  useGameStore.setState({ defenseDots: newDefenseDots });
  console.log(`✅ Defense dots distributed (${newDefenseDots.size} total)`);

  // Track scores for final blow determination
  let leftTotalScore = 0;
  let rightTotalScore = 0;

  // Simulate each quarter
  for (let quarter = 1; quarter <= 4; quarter++) {
    console.log(`\n\n🏀 ========== QUARTER ${quarter} ==========`);

    // Update current quarter in store
    store.setCurrentQuarter(quarter);

    // Update game status
    const statusMap: Record<number, 'SCHEDULED' | '1Q' | '2Q' | '3Q' | '4Q' | 'OT' | 'OT2' | 'OT3' | 'OT4' | 'FINAL'> = {
      1: '1Q',
      2: '2Q',
      3: '3Q',
      4: '4Q',
    };
    store.updateGameStatus(statusMap[quarter]);

    // Simulate the quarter battle and get stats
    const quarterStats = await simulateQuarter(quarter);

    // Track scores
    leftTotalScore += quarterStats.left.points;
    rightTotalScore += quarterStats.right.points;

    // Update live score in store
    store.updateScore(leftTotalScore, rightTotalScore);

    // Check HP after quarter
    const leftHP = store.capperHP.get(leftKey)?.currentHP || 0;
    const rightHP = store.capperHP.get(rightKey)?.currentHP || 0;

    console.log(`\n📊 After Q${quarter}: Left HP=${leftHP}, Right HP=${rightHP}`);
    console.log(`📊 Score: ${game.leftTeam.abbreviation} ${leftTotalScore} - ${game.rightTeam.abbreviation} ${rightTotalScore}`);
    
    // Check for battle end
    if (leftHP <= 0 && rightHP <= 0) {
      console.log('\n🏆 ========== BATTLE ENDED: DRAW ==========');
      console.log('Both castles destroyed!');
      await spawnTreasureChest('draw');
      return { winner: 'draw', quarterEnded: quarter };
    } else if (leftHP <= 0) {
      console.log('\n🏆 ========== BATTLE ENDED: RIGHT WINS ==========');
      console.log(`${game.rightCapper.name} (${game.rightTeam.abbreviation}) is victorious!`);
      await spawnTreasureChest('right');
      return { winner: 'right', quarterEnded: quarter };
    } else if (rightHP <= 0) {
      console.log('\n🏆 ========== BATTLE ENDED: LEFT WINS ==========');
      console.log(`${game.leftCapper.name} (${game.leftTeam.abbreviation}) is victorious!`);
      await spawnTreasureChest('left');
      return { winner: 'left', quarterEnded: quarter };
    }
    
    // Pause between quarters (if not the last quarter)
    if (quarter < 4) {
      console.log(`\n⏸️  Pausing before Q${quarter + 1}...`);
      await sleep(500); // Faster for testing
    }
  }

  // All 4 quarters complete - check for overtime or final blow
  console.log('\n🏁 ========== END OF REGULATION ==========');
  console.log(`Final Score: ${game.leftTeam.abbreviation} ${leftTotalScore} - ${game.rightTeam.abbreviation} ${rightTotalScore}`);
  console.log(`Spread: ${game.leftTeam.abbreviation} ${game.spread}`);

  // Check if game is tied - go to overtime
  let overtimeCount = 0;
  while (leftTotalScore === rightTotalScore && overtimeCount < 4) {
    overtimeCount++;
    const otStatus: ('OT' | 'OT2' | 'OT3' | 'OT4')[] = ['OT', 'OT2', 'OT3', 'OT4'];

    console.log(`\n⏰ ========== OVERTIME ${overtimeCount} ==========`);
    console.log('Scores are tied! Going to overtime...');

    // Update game status
    store.updateGameStatus(otStatus[overtimeCount - 1]);

    // Simulate overtime quarter
    const overtimeStats = await simulateQuarter(5 + overtimeCount - 1); // Quarter 5+ = OT
    leftTotalScore += overtimeStats.left.points;
    rightTotalScore += overtimeStats.right.points;

    // Update live score after OT
    store.updateScore(leftTotalScore, rightTotalScore);

    console.log(`\n📊 After OT${overtimeCount}: ${game.leftTeam.abbreviation} ${leftTotalScore} - ${game.rightTeam.abbreviation} ${rightTotalScore}`);
  }

  // Determine who made the correct pick based on spread
  // Spread is from LEFT team's perspective (e.g., -4.5 means LAL favored by 4.5)
  // Score differential = left score - right score
  const scoreDifferential = leftTotalScore - rightTotalScore;

  // Left capper picked left team with the spread
  // Example: LAL -4.5 means LAL must win by MORE than 4.5 (i.e., 5+)
  // So if spread is -4.5, left covers if scoreDifferential > 4.5
  const leftCoveredSpread = scoreDifferential > Math.abs(game.spread);

  // Right capper picked right team with opposite spread
  // Example: MEM +4.5 means MEM can lose by UP TO 4.5 (or win)
  // So if spread is -4.5, right covers if scoreDifferential < 4.5
  const rightCoveredSpread = scoreDifferential < Math.abs(game.spread);

  console.log(`\n📊 Spread Analysis:`);
  console.log(`   Final Score: ${game.leftTeam.abbreviation} ${leftTotalScore} - ${game.rightTeam.abbreviation} ${rightTotalScore}`);
  console.log(`   Score Differential: ${scoreDifferential > 0 ? '+' : ''}${scoreDifferential}`);
  console.log(`   ${game.leftCapper.name} picked ${game.leftTeam.abbreviation} ${game.spread}: ${leftCoveredSpread ? 'COVERED ✅' : 'DID NOT COVER ❌'}`);
  console.log(`   ${game.rightCapper.name} picked ${game.rightTeam.abbreviation} +${Math.abs(game.spread)}: ${rightCoveredSpread ? 'COVERED ✅' : 'DID NOT COVER ❌'}`);

  // Fire final blow for team(s) that covered the spread
  if (leftCoveredSpread && rightCoveredSpread) {
    console.log('\n💥 BOTH TEAMS COVERED! Both cappers fire final blow!');
    await fireFinalBlow('left', game.id);
    await sleep(500);
    await fireFinalBlow('right', game.id);
  } else if (leftCoveredSpread) {
    console.log(`\n💥 ${game.leftCapper.name} made the correct pick! Firing final blow!`);
    await fireFinalBlow('left', game.id);
  } else if (rightCoveredSpread) {
    console.log(`\n💥 ${game.rightCapper.name} made the correct pick! Firing final blow!`);
    await fireFinalBlow('right', game.id);
  } else {
    console.log('\n❌ Neither team covered the spread - no final blow!');
  }

  // Update game status to FINAL
  store.updateGameStatus('FINAL');

  // Determine winner by HP after final blow
  const finalLeftHP = store.capperHP.get(leftKey)?.currentHP || 0;
  const finalRightHP = store.capperHP.get(rightKey)?.currentHP || 0;

  console.log('\n🏁 ========== BATTLE COMPLETE ==========');
  console.log(`Final Score: ${game.leftTeam.abbreviation} ${leftTotalScore} - ${game.rightTeam.abbreviation} ${rightTotalScore}`);
  console.log(`Final HP: Left=${finalLeftHP}, Right=${finalRightHP}`);
  
  if (finalLeftHP > finalRightHP) {
    console.log(`🏆 ${game.leftCapper.name} (${game.leftTeam.abbreviation}) wins by HP!`);
    await spawnTreasureChest('left');
    return { winner: 'left', quarterEnded: 4 };
  } else if (finalRightHP > finalLeftHP) {
    console.log(`🏆 ${game.rightCapper.name} (${game.rightTeam.abbreviation}) wins by HP!`);
    await spawnTreasureChest('right');
    return { winner: 'right', quarterEnded: 4 };
  } else {
    console.log('🤝 Battle ends in a draw!');
    await spawnTreasureChest('draw');
    return { winner: 'draw', quarterEnded: 4 };
  }
}

/**
 * Spawn treasure chest in the center of the battlefield (over VS text)
 */
async function spawnTreasureChest(winner: 'left' | 'right' | 'draw'): Promise<void> {
  console.log('🎁 Spawning treasure chest...');

  const app = pixiManager.getApp();
  if (!app) {
    console.error('❌ No PixiJS app found!');
    return;
  }

  // Get battlefield center position from GridManager (more reliable)
  const center = gridManager.getBattlefieldCenter();

  // Create treasure chest
  const chest = new TreasureChest({
    position: center,
    winner,
  });

  // Add to stage
  app.stage.addChild(chest.sprite);

  // Animate entrance
  await chest.animateEntrance();

  // Wait a moment
  await sleep(1000);

  // Open chest
  await chest.animateOpen();

  console.log('✅ Treasure chest spawned and opened!');
}

/**
 * Fire the final blow - 6 projectiles from each stat row simultaneously
 * Only fires for the team that made the correct pick
 */
async function fireFinalBlow(side: 'left' | 'right', gameId: string): Promise<void> {
  console.log(`\n💥 ========== FINAL BLOW: ${side.toUpperCase()} SIDE ==========`);

  const stats: StatType[] = ['pts', 'reb', 'ast', 'blk', '3pt'];

  console.log(`🎯 Firing 6 projectiles from each stat row for ${side} side...`);

  // Fire all stat rows with 6 projectiles each
  const leftCount = side === 'left' ? 6 : 0;
  const rightCount = side === 'right' ? 6 : 0;

  // Fire each stat row sequentially
  for (const stat of stats) {
    console.log(`💥 Final Blow: ${stat.toUpperCase()} firing 6 projectiles from ${side} side`);
    const shouldContinue = await fireStatRow(stat, leftCount, rightCount, gameId);

    // If a castle is destroyed, stop firing
    if (!shouldContinue) {
      console.log(`⚠️ Castle destroyed during final blow! Stopping...`);
      break;
    }

    await sleep(300); // Small delay between stat rows
  }

  console.log(`✅ Final blow complete!`);
}

/**
 * Sleep utility for async delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

