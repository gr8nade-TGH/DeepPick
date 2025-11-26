/**
 * Quarter Simulation Logic
 * Handles the battle simulation for each quarter with projectile firing
 *
 * MECHANICS:
 * 1. Retrieve actual NBA stats for both teams for the quarter
 * 2. Display stats gained: POINTS, REB, AST
 * 3. Fire projectiles sequentially: POINTS → REB → AST
 * 4. Each stat point = 1 projectile from weapon slot ball
 * 5. Both teams fire simultaneously
 * 6. Projectiles collide mid-battlefield and cancel out
 * 7. Remaining projectiles hit defense dots
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { projectilePool } from '../entities/projectiles/ProjectilePool';
import { useMultiGameStore } from '../../store/multiGameStore';
import type { StatType } from '../../types/game';
import { getBattlefieldCenter, getDefenseCellPosition } from '../utils/positioning';
import { pixiManager } from '../managers/PixiManager';
import { gridManager } from '../managers/GridManager';
import { collisionManager } from '../managers/CollisionManager';
import { screenShake } from '../effects/ScreenShake';
import {
  animateStatCounter,
  animateWeaponActivation,
  getWeaponBall,
  getStatLabelPosition
} from '../rendering/statCounterAnimation';
import { PROJECTILE_TYPES } from '../../types/projectileTypes';
import { regenerateDefenseDots } from './shieldRegeneration';
import { getItemById } from '../../types/inventory';
import { battleEventBus } from '../events/EventBus';
import type { QuarterStartPayload, QuarterEndPayload, ProjectileFiredPayload } from '../events/types';
import { debugGridPositions } from '../debug/positionDebug';
import { battleEventEmitter } from '../items/EventEmitter';
import { attackNodeQueueManager } from '../managers/AttackNodeQueueManager';

/**
 * Quarter stats for both teams
 */
interface QuarterStats {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  threePointers: number;
}

/**
 * Fetch real quarter stats from MySportsFeeds API
 * Falls back to random stats if API fails or data is unavailable
 */
async function fetchRealQuarterStats(
  gameId: string,
  quarter: number,
  leftTeam: string,
  rightTeam: string
): Promise<{ left: QuarterStats; right: QuarterStats } | null> {
  try {
    console.log(`[Quarter Stats] Fetching real data for ${gameId} Q${quarter}...`);

    // Call the existing sync-quarter-stats API endpoint
    const response = await fetch(`/api/battle-bets/sync-quarter-stats?gameId=${gameId}&quarter=${quarter}`);

    if (!response.ok) {
      console.warn(`[Quarter Stats] API returned ${response.status}, falling back to random stats`);
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.quarterStats) {
      console.warn('[Quarter Stats] No quarter stats in response, falling back to random stats');
      return null;
    }

    const stats = data.quarterStats;

    // Convert API response to QuarterStats format
    // Note: API returns team scores, we need to aggregate player stats
    const leftStats: QuarterStats = {
      points: stats.leftScore || 0,
      rebounds: aggregatePlayerStat(stats.leftPlayers, 'rebounds'),
      assists: aggregatePlayerStat(stats.leftPlayers, 'assists'),
      steals: aggregatePlayerStat(stats.leftPlayers, 'steals') || (Math.floor(Math.random() * 3) + 1), // Fallback: 1-3 steals
      threePointers: aggregatePlayerStat(stats.leftPlayers, 'threePointers')
    };

    const rightStats: QuarterStats = {
      points: stats.rightScore || 0,
      rebounds: aggregatePlayerStat(stats.rightPlayers, 'rebounds'),
      assists: aggregatePlayerStat(stats.rightPlayers, 'assists'),
      steals: aggregatePlayerStat(stats.rightPlayers, 'steals') || (Math.floor(Math.random() * 3) + 1), // Fallback: 1-3 steals
      threePointers: aggregatePlayerStat(stats.rightPlayers, 'threePointers')
    };

    console.log(`[Quarter Stats] Real data fetched: ${leftTeam} ${leftStats.points}-${rightStats.points} ${rightTeam}`);

    return { left: leftStats, right: rightStats };
  } catch (error) {
    console.error('[Quarter Stats] Failed to fetch real stats:', error);
    return null;
  }
}

/**
 * Aggregate a specific stat from player array
 */
function aggregatePlayerStat(players: any[], statName: string): number {
  if (!players || !Array.isArray(players)) return 0;
  return players.reduce((sum, player) => sum + (player[statName] || 0), 0);
}

/**
 * Check if a capper has the Fire Orb equipped and calculate bonus FIRE projectiles
 * Fire Orb: For every 5 POINTS projectiles, fire 1 bonus FIRE projectile
 *
 * NOTE: This function now reads from the multi-battle store. The `gameId` here is
 * the same as the `battleId` used in useMultiGameStore.
 */
function calculateFireOrbBonus(gameId: string, side: 'left' | 'right', pointsCount: number): number {
  const multiStore = useMultiGameStore.getState();
  const battle = multiStore.getBattle(gameId);
  if (!battle) return 0;

  const capper = side === 'left' ? battle.game.leftCapper : battle.game.rightCapper;
  if (!capper.equippedItems) return 0;

  // Check all 3 item slots for Fire Orb
  const slots = [capper.equippedItems.slot1, capper.equippedItems.slot2, capper.equippedItems.slot3];

  for (const itemId of slots) {
    if (!itemId) continue;

    const item = getItemById(itemId);
    if (item && item.id === 'fire-orb' && item.effect?.fireOrbRatio) {
      // Calculate bonus FIRE projectiles
      const bonusFireProjectiles = Math.floor(pointsCount / item.effect.fireOrbRatio);

      if (bonusFireProjectiles > 0) {
        console.log(`🔴 Fire Orb activated for ${side}! ${pointsCount} POINTS → ${bonusFireProjectiles} bonus FIRE projectiles`);
      }

      return bonusFireProjectiles;
    }
  }

  return 0;
}

/**
 * Simulate a quarter of the battle
 * Returns the quarter stats for score tracking
 */
export async function simulateQuarter(
  battleId: string,
  quarterNumber: number
): Promise<{
  left: QuarterStats;
  right: QuarterStats;
}> {
  console.log(`\n🎮 Q${quarterNumber} START (battleId=${battleId})`);

  const multiStore = useMultiGameStore.getState();

  // Set battle in progress flag
  multiStore.setBattleInProgress(battleId, true);
  console.log(`🎬 Battle animation started for Q${quarterNumber}`);

  // Debug grid positions on first quarter
  if (quarterNumber === 1) {
    debugGridPositions();

    // Emit BATTLE_START events for both sides (only on Q1)
    console.log(`🎬 [EventEmitter] Emitting BATTLE_START events for battle ${battleId}`);

    // Old event bus (for item system - battleEventBus)
    battleEventBus.emit('BATTLE_START', {
      side: 'left',
      opponentSide: 'right',
      quarter: 1,
      battleId,
      gameId: battleId,
    });

    battleEventBus.emit('BATTLE_START', {
      side: 'right',
      opponentSide: 'left',
      quarter: 1,
      battleId,
      gameId: battleId,
    });

    // New event emitter (battleEventEmitter)
    await battleEventEmitter.emit({
      type: 'BATTLE_START',
      payload: {
        side: 'left',
        opponentSide: 'right',
        quarter: 1,
        battleId,
        gameId: battleId,
      },
    });

    await battleEventEmitter.emit({
      type: 'BATTLE_START',
      payload: {
        side: 'right',
        opponentSide: 'left',
        quarter: 1,
        battleId,
        gameId: battleId,
      },
    });
  }

  const battle = multiStore.getBattle(battleId);

  if (!battle) {
    console.error(`[simulateQuarter] No battle found for id=${battleId}`);
    multiStore.setBattleInProgress(battleId, false);
    return getQuarterData(quarterNumber);
  }

  const gameId = battleId; // In multi-store, we use battleId as gameId for dots/projectiles

  // Wire collision manager for this battle
  collisionManager.registerBattle(
    gameId,
    () => {
      const state = useMultiGameStore.getState();
      const currentBattle = state.getBattle(battleId);
      const dots = currentBattle?.defenseDots ?? new Map();
      // Debug: Log defense dots count periodically
      if (Math.random() < 0.01) { // 1% chance to log (reduce spam)
        console.log(`🔍 [Collision Callback] getDots for ${battleId}: ${dots.size} dots`);
      }
      return dots;
    },
    (dotId: string, damage: number) => {
      const state = useMultiGameStore.getState();
      state.applyDamage(battleId, dotId, damage);
    },
  );

  console.log(`✅ Collision manager callbacks configured for battle ${battleId}`);

  // Try to get real quarter stats from MySportsFeeds API
  // Fall back to random stats if API fails or data is unavailable
  let quarterData: { left: QuarterStats; right: QuarterStats };

  // Check if we have a real game ID (format: YYYYMMDD-AWAY-HOME)
  const gameIdForAPI = battle.game.id || battle.game.gameId;
  const hasRealGameId = gameIdForAPI && gameIdForAPI.includes('-');

  if (hasRealGameId) {
    console.log(`🌐 Attempting to fetch real quarter stats from MySportsFeeds for game ${gameIdForAPI}...`);
    const realData = await fetchRealQuarterStats(
      gameIdForAPI,
      quarterNumber,
      battle.game.leftTeam.abbreviation,
      battle.game.rightTeam.abbreviation
    );

    if (realData) {
      quarterData = realData;
      console.log(`✅ Using REAL MySportsFeeds data for Q${quarterNumber}`);
    } else {
      quarterData = getQuarterData(quarterNumber);
      console.log(`⚠️ MySportsFeeds data unavailable, using RANDOM stats for Q${quarterNumber}`);
    }
  } else {
    quarterData = getQuarterData(quarterNumber);
    console.log(`⚠️ No real game ID found, using RANDOM stats for Q${quarterNumber}`);
  }

  console.log(
    `📊 ${battle.game.leftTeam.abbreviation}: PTS=${quarterData.left.points} REB=${quarterData.left.rebounds} AST=${quarterData.left.assists} STL=${quarterData.left.steals} 3PM=${quarterData.left.threePointers}`
  );
  console.log(
    `📊 ${battle.game.rightTeam.abbreviation}: PTS=${quarterData.right.points} REB=${quarterData.right.rebounds} AST=${quarterData.right.assists} STL=${quarterData.right.steals} 3PM=${quarterData.right.threePointers}`
  );

  // Update cumulative scores (add this quarter's points to existing score)
  const currentLeftScore = battle.game.leftScore || 0;
  const currentRightScore = battle.game.rightScore || 0;
  const newLeftScore = currentLeftScore + quarterData.left.points;
  const newRightScore = currentRightScore + quarterData.right.points;

  multiStore.updateScore(battleId, newLeftScore, newRightScore);
  console.log(`📊 SCORE UPDATE: ${battle.game.leftTeam.abbreviation} ${newLeftScore} - ${newRightScore} ${battle.game.rightTeam.abbreviation}`);

  // Emit QUARTER_START events for both sides
  const prevQuarterStats = quarterNumber > 1 ? {
    pts: 0, // TODO: Track actual previous quarter stats
    reb: 0,
    ast: 0,
    blk: 0,
    stl: 0,
    threesMade: 0
  } : null;

  // Old event bus (keep for backward compatibility)
  battleEventBus.emit('QUARTER_START', {
    side: 'left',
    opponentSide: 'right',
    quarter: quarterNumber as 1 | 2 | 3 | 4,
    battleId,
    gameId,
    prevQuarterStats
  } as QuarterStartPayload);

  battleEventBus.emit('QUARTER_START', {
    side: 'right',
    opponentSide: 'left',
    quarter: quarterNumber as 1 | 2 | 3 | 4,
    battleId,
    gameId,
    prevQuarterStats
  } as QuarterStartPayload);

  // New event emitter (for item system)
  console.log(`🎬 [EventEmitter] Emitting QUARTER_START events for Q${quarterNumber}`);
  await battleEventEmitter.emit({
    type: 'QUARTER_START',
    payload: {
      side: 'left',
      opponentSide: 'right',
      quarter: quarterNumber as 1 | 2 | 3 | 4,
      battleId,
      gameId,
      prevQuarterStats,
    },
  });

  await battleEventEmitter.emit({
    type: 'QUARTER_START',
    payload: {
      side: 'right',
      opponentSide: 'left',
      quarter: quarterNumber as 1 | 2 | 3 | 4,
      battleId,
      gameId,
      prevQuarterStats,
    },
  });

  // Fire all stat rows SIMULTANEOUSLY (all at once): PTS, REB, AST, STL, 3PT
  // Use fireStatRowForMultiBattle (the working version from auto-start mode)
  // Triple projectile counts for better visual effect (3x multiplier)
  // BUT display shows actual stat values (not multiplied)
  try {
    const statRowPromises = [
      fireStatRowForMultiBattle(battleId, gameId, 'pts', quarterData.left.points, quarterData.right.points, quarterData.left.points * 3, quarterData.right.points * 3),
      fireStatRowForMultiBattle(battleId, gameId, 'reb', quarterData.left.rebounds, quarterData.right.rebounds, quarterData.left.rebounds * 3, quarterData.right.rebounds * 3),
      fireStatRowForMultiBattle(battleId, gameId, 'ast', quarterData.left.assists, quarterData.right.assists, quarterData.left.assists * 3, quarterData.right.assists * 3),
      fireStatRowForMultiBattle(battleId, gameId, 'stl', quarterData.left.steals, quarterData.right.steals, quarterData.left.steals * 3, quarterData.right.steals * 3),
      fireStatRowForMultiBattle(battleId, gameId, '3pt', quarterData.left.threePointers, quarterData.right.threePointers, quarterData.left.threePointers * 3, quarterData.right.threePointers * 3),
    ];

    // Wait for all stat rows to complete
    const results = await Promise.all(statRowPromises);

    // Check if any stat row ended the battle
    if (results.some(result => result === false)) {
      console.log('⚠️ Battle ended during quarter simulation');
      return quarterData;
    }
  } catch (error: any) {
    console.error('❌ Error during stat row firing:', error?.message || error);
  }

  // SHIELD REGENERATION: Activate at end of quarter
  try {
    await regenerateDefenseDots(battleId);
  } catch (error: any) {
    console.error('❌ Regen error:', error?.message || error);
  }

  console.log(`✅ Q${quarterNumber} COMPLETE (battleId=${battleId})\n`);

  // Emit QUARTER_END events for both sides
  const leftScore = battle.capperHP.get('left')?.currentHP ?? 0;
  const rightScore = battle.capperHP.get('right')?.currentHP ?? 0;

  battleEventBus.emit('QUARTER_END', {
    side: 'left',
    opponentSide: 'right',
    quarter: quarterNumber as 1 | 2 | 3 | 4,
    battleId,
    gameId,
    score: { self: leftScore, opponent: rightScore },
    quarterStats: {
      pts: quarterData.left.points,
      reb: quarterData.left.rebounds,
      ast: quarterData.left.assists,
      blk: 0, // Deprecated - using STL now
      stl: quarterData.left.steals,
      threesMade: quarterData.left.threePointers
    }
  } as QuarterEndPayload);

  battleEventBus.emit('QUARTER_END', {
    side: 'right',
    opponentSide: 'left',
    quarter: quarterNumber as 1 | 2 | 3 | 4,
    battleId,
    gameId,
    score: { self: rightScore, opponent: leftScore },
    quarterStats: {
      pts: quarterData.right.points,
      reb: quarterData.right.rebounds,
      ast: quarterData.right.assists,
      blk: 0, // Deprecated - using STL now
      stl: quarterData.right.steals,
      threesMade: quarterData.right.threePointers
    }
  } as QuarterEndPayload);

  // DON'T cleanup collision callbacks here - projectiles may still be in flight!
  // Callbacks will be cleaned up when the entire battle ends or when a new battle starts
  // collisionManager.unregisterBattle(gameId);

  // Mark battle as complete and quarter as complete
  multiStore.setBattleInProgress(battleId, false);
  multiStore.markQuarterComplete(battleId, quarterNumber);
  console.log(`✅ Battle animation complete for Q${quarterNumber}`);

  return quarterData;
}

/**
 * Fire projectiles for a single stat row (POINTS, REB, or AST)
 * NEW TURN-BASED SYSTEM:
 * PHASE 1: Animate stat counters
 * PHASE 2: Activate weapon slots
 * PHASE 3: LEFT SIDE attacks (all projectiles hit right HP bar)
 * PHASE 4: RIGHT SIDE attacks (all projectiles hit left HP bar)
 * Returns true if battle should continue, false if a castle is destroyed
 *
 * EXPORTED for use in final blow system
 */
export async function fireStatRow(
  stat: StatType,
  leftCount: number,
  rightCount: number,
  gameId: string
): Promise<boolean> {
  const statName = stat.toUpperCase();
  console.log(`⚔️ ${statName}: L${leftCount} vs R${rightCount} (gameId=${gameId})`);

  // PHASE 1: Animate stat counters for both sides
  const container = pixiManager.getContainer();
  if (container) {
    const counterPromises: Promise<void>[] = [];

    if (leftCount > 0) {
      const leftLabelPos = getStatLabelPosition(stat, 'left');
      counterPromises.push(
        animateStatCounter(container, {
          stat,
          side: 'left',
          value: leftCount,
          rowY: leftLabelPos.y,
          labelX: leftLabelPos.x,
        })
      );
    }

    if (rightCount > 0) {
      const rightLabelPos = getStatLabelPosition(stat, 'right');
      counterPromises.push(
        animateStatCounter(container, {
          stat,
          side: 'right',
          value: rightCount,
          rowY: rightLabelPos.y,
          labelX: rightLabelPos.x,
        })
      );
    }

    await Promise.all(counterPromises);
  }

  // PHASE 2: Activate weapon slots
  if (container) {
    const activationPromises: Promise<void>[] = [];

    if (leftCount > 0) {
      const leftWeaponBall = getWeaponBall(container, stat, 'left');
      if (leftWeaponBall) {
        activationPromises.push(animateWeaponActivation(leftWeaponBall, stat));
      }
    }

    if (rightCount > 0) {
      const rightWeaponBall = getWeaponBall(container, stat, 'right');
      if (rightWeaponBall) {
        activationPromises.push(animateWeaponActivation(rightWeaponBall, stat));
      }
    }

    await Promise.all(activationPromises);
  }

  // PHASE 3: PROJECTILES FIRE WITH STAGGER DELAY (creates spacing between projectiles)
  const maxCount = Math.max(leftCount, rightCount);
  const STAGGER_DELAY = 1000; // Increased from 600ms to 1000ms for much slower, more spaced out projectiles

  const projectilePromises: Promise<void>[] = [];

  for (let i = 0; i < maxCount; i++) {
    const hasLeftProjectile = i < leftCount;
    const hasRightProjectile = i < rightCount;

    const projectilePromise = (async () => {
      await sleep(i * STAGGER_DELAY);

      if (hasLeftProjectile && hasRightProjectile) {
        await fireSimultaneousProjectiles(gameId, stat, i);
      } else if (hasLeftProjectile) {
        await fireProjectileAtHPBar(gameId, stat, 'left', i);
      } else if (hasRightProjectile) {
        await fireProjectileAtHPBar(gameId, stat, 'right', i);
      }
    })();

    projectilePromises.push(projectilePromise);
  }

  await Promise.all(projectilePromises);

  if (checkBattleEnd(gameId)) {
    console.log('⚠️ Battle ended!');
    return false;
  }

  return true;
}

/**
 * Fire simultaneous projectiles from both sides
 * BOTH projectiles target the BATTLEFIELD CENTER so they travel equal distances
 * and collide in the middle. Collision detection will handle hitting defense dots.
 */
async function fireSimultaneousProjectiles(
  gameId: string,
  stat: StatType,
  projectileIndex: number
): Promise<void> {
  // NOTE: No need to update store here - CollisionManager and multiGameStore
  // handle defense dot and HP updates based on projectile collisions.

  // Get weapon slot positions for both sides
  const leftWeaponPos = getWeaponSlotPosition(stat, 'left');
  const rightWeaponPos = getWeaponSlotPosition(stat, 'right');

  // When BOTH sides fire simultaneously, they target the BATTLEFIELD CENTER
  // Collision detection will handle hitting defense dots during flight
  const battlefieldCenter = gridManager.getBattlefieldCenter();
  const statIndex = getStatIndex(stat);
  const statY = statIndex * gridManager.getCellHeight() + gridManager.getCellHeight() / 2;

  const leftTarget = { x: battlefieldCenter.x, y: statY };
  const rightTarget = { x: battlefieldCenter.x, y: statY };

  console.log(`🎯 [SIMULTANEOUS] Firing ${stat} projectile ${projectileIndex}:`);
  console.log(`   Left weapon: (${leftWeaponPos.x.toFixed(1)}, ${leftWeaponPos.y.toFixed(1)}) → Target: (${leftTarget.x.toFixed(1)}, ${leftTarget.y.toFixed(1)})`);
  console.log(`   Right weapon: (${rightWeaponPos.x.toFixed(1)}, ${rightWeaponPos.y.toFixed(1)}) → Target: (${rightTarget.x.toFixed(1)}, ${rightTarget.y.toFixed(1)})`);

  // Create both projectiles
  const leftProjectileId = `projectile-${stat}-left-${projectileIndex}-${Date.now()}`;
  const rightProjectileId = `projectile-${stat}-right-${projectileIndex}-${Date.now()}-r`;

  const typeConfig = getProjectileTypeConfig(stat);

  const leftConfig = {
    id: leftProjectileId,
    gameId,
    stat,
    side: 'left' as const,
    startPosition: leftWeaponPos,
    targetPosition: leftTarget,
    typeConfig,
  };

  const rightConfig = {
    id: rightProjectileId,
    gameId,
    stat,
    side: 'right' as const,
    startPosition: rightWeaponPos,
    targetPosition: rightTarget,
    typeConfig,
  };

  const leftProjectile = projectilePool.acquire(leftConfig);
  const rightProjectile = projectilePool.acquire(rightConfig);

  // Set collision check callback on each projectile
  leftProjectile.onCollisionCheck = projectile => collisionManager.checkCollisions(projectile);
  rightProjectile.onCollisionCheck = projectile => collisionManager.checkCollisions(projectile);

  // Register projectiles with collision manager
  collisionManager.registerProjectile(leftProjectile);
  collisionManager.registerProjectile(rightProjectile);

  // Add sprites to PixiJS container
  pixiManager.addSprite(leftProjectile.sprite, 'projectile');
  pixiManager.addSprite(rightProjectile.sprite, 'projectile');

  // Animate both projectiles simultaneously
  await Promise.all([
    leftProjectile.animateToTarget(),
    rightProjectile.animateToTarget(),
  ]);

  // Handle collision results
  if (leftProjectile.collidedWith === 'projectile' && rightProjectile.collidedWith === 'projectile') {
    // Both collided with each other - create collision effect at midpoint
    const midX = (leftProjectile.position.x + rightProjectile.position.x) / 2;
    const midY = (leftProjectile.position.y + rightProjectile.position.y) / 2;
    createCollisionEffect(midX, midY, leftProjectile.typeConfig.color);
    screenShake.shake(gameId, 'medium');
  } else {
    // Defense dot damage is now applied IMMEDIATELY in CollisionManager
    // Just trigger screen shake for visual feedback
    if (leftProjectile.collidedWith === 'defense') {
      screenShake.shake(gameId, 'small');
    }
    if (rightProjectile.collidedWith === 'defense') {
      screenShake.shake(gameId, 'small');
    }
  }

  // Hide both projectiles
  leftProjectile.sprite.visible = false;
  rightProjectile.sprite.visible = false;

  // Keep effects visible briefly
  await sleep(100);

  // Clean up both projectiles
  pixiManager.removeSprite(leftProjectile.sprite);
  pixiManager.removeSprite(rightProjectile.sprite);
  collisionManager.unregisterProjectile(leftProjectile.id);
  collisionManager.unregisterProjectile(rightProjectile.id);
  projectilePool.release(leftProjectile);
  projectilePool.release(rightProjectile);
}

/**
 * Fire a single projectile (when only one side has projectiles remaining)
 *
 * CRITICAL FIX: Projectiles now target the OPPOSING WEAPON SLOT (far side of defense grid)
 * This allows the collision manager to dynamically find defense dots during flight.
 *
 * OLD BUG: All projectiles pre-targeted the same defense dot at launch, so when the first
 * projectile destroyed it, the remaining projectiles were locked onto a dead dot's position
 * and bypassed all remaining defense.
 *
 * NEW BEHAVIOR: Projectiles fly toward the opposing weapon slot, and the collision manager
 * intercepts them with alive defense dots during flight. This ensures each projectile
 * targets the CURRENT nearest alive dot, not a stale target from launch time.
 */
export async function fireProjectileAtHPBar(
  gameId: string,
  stat: StatType,
  side: 'left' | 'right',
  projectileIndex: number
): Promise<void> {
  // Get weapon slot position (center of weapon slot cell)
  const startPosition = getWeaponSlotPosition(stat, side);

  const targetSide = side === 'left' ? 'right' : 'left';
  const targetPosition = getWeaponSlotPosition(stat, targetSide);

  const projectileId = `projectile-${stat}-${side}-${projectileIndex}-${Date.now()}`;

  const config = {
    id: projectileId,
    gameId,
    stat,
    side,
    startPosition,
    targetPosition,
    typeConfig: getProjectileTypeConfig(stat),
  };

  const projectile = projectilePool.acquire(config);

  projectile.onCollisionCheck = proj => collisionManager.checkCollisions(proj);

  collisionManager.registerProjectile(projectile);

  pixiManager.addSprite(projectile.sprite, 'projectile');

  await projectile.animateToTarget();

  projectile.sprite.visible = false;

  if (projectile.collidedWith === 'defense') {
    screenShake.shake(gameId, 'medium');
  } else if (!projectile.collidedWith) {
    // Reached target without collision - hit weapon slot and deduct capper HP
    useMultiGameStore.getState().applyDamageToCapperHP(gameId, targetSide, 1);
    screenShake.shake(gameId, 'large');
  }

  createCollisionEffect(projectile.sprite.x, projectile.sprite.y, projectile.typeConfig.color);

  await sleep(150);

  pixiManager.removeSprite(projectile.sprite);

  collisionManager.unregisterProjectile(projectile.id);
  projectilePool.release(projectile);
}

/**
 * Get stat index from stat type
 */
function getStatIndex(stat: StatType): number {
  const statOrder: StatType[] = ['pts', 'reb', 'ast', 'blk', '3pt'];
  return statOrder.indexOf(stat);
}

/**
 * Get weapon slot position for a stat row (using Grid Manager)
 */
function getWeaponSlotPosition(stat: StatType, side: 'left' | 'right'): { x: number; y: number } {
  return gridManager.getWeaponSlotPosition(stat, side);
}

/**
 * Find the next alive defense dot for a stat and side
 * LEFT SIDE: Returns the dot closest to battlefield (rightmost = highest index)
 * RIGHT SIDE: Returns the dot closest to battlefield (leftmost = highest index)
 */
function findNextAliveDefenseDot(
  gameId: string,
  stat: StatType,
  side: 'left' | 'right'
): { id: string; dot: any } | null {
  const multiStore = useMultiGameStore.getState();
  const battle = multiStore.getBattle(gameId);
  if (!battle) return null;

  const aliveDots: Array<{ id: string; dot: any }> = [];
  battle.defenseDots.forEach((dot, dotId) => {
    if (
      dot.stat === stat &&
      dot.side === side &&
      dot.alive
    ) {
      aliveDots.push({ id: dotId, dot });
    }
  });

  if (aliveDots.length === 0) return null;

  // Sort by index (ascending)
  aliveDots.sort((a, b) => a.dot.index - b.dot.index);

  // LEFT SIDE: Cell 1 (index 0) = leftmost, Cell 10 (index 9) = rightmost (closest to battlefield)
  // RIGHT SIDE: Cell 1 (index 0) = rightmost, Cell 10 (index 9) = leftmost (closest to battlefield)
  // BOTH SIDES: Target the HIGHEST index (closest to battlefield)
  return aliveDots[aliveDots.length - 1];
}

/**
 * Get projectile type config based on stat
 */
function getProjectileTypeConfig(stat: StatType) {
  return PROJECTILE_TYPES[stat];
}

/**
 * Generate random realistic NBA quarter stats based on quarter number
 * Ranges per quarter:
 * Q1: PTS 25-35 | REB 9-14 | AST 5-9 | STL 0-3 | 3PM 2-5
 * Q2: PTS 23-33 | REB 8-13 | AST 4-8 | STL 0-3 | 3PM 2-5
 * Q3: PTS 24-34 | REB 8-13 | AST 4-8 | STL 0-3 | 3PM 2-6
 * Q4: PTS 22-36 | REB 7-12 | AST 4-8 | STL 0-3 | 3PM 2-6
 */
function generateRandomQuarterStats(quarter: number): QuarterStats {
  const ranges = {
    1: { pts: [25, 35], reb: [9, 14], ast: [5, 9], stl: [1, 4], tpm: [2, 5] }, // Changed STL from [0,3] to [1,4]
    2: { pts: [23, 33], reb: [8, 13], ast: [4, 8], stl: [1, 4], tpm: [2, 5] }, // Changed STL from [0,3] to [1,4]
    3: { pts: [24, 34], reb: [8, 13], ast: [4, 8], stl: [1, 4], tpm: [2, 6] }, // Changed STL from [0,3] to [1,4]
    4: { pts: [22, 36], reb: [7, 12], ast: [4, 8], stl: [1, 4], tpm: [2, 6] }, // Changed STL from [0,3] to [1,4]
  };

  const range = ranges[quarter as keyof typeof ranges] || ranges[1];

  return {
    points: Math.floor(Math.random() * (range.pts[1] - range.pts[0] + 1)) + range.pts[0],
    rebounds: Math.floor(Math.random() * (range.reb[1] - range.reb[0] + 1)) + range.reb[0],
    assists: Math.floor(Math.random() * (range.ast[1] - range.ast[0] + 1)) + range.ast[0],
    steals: Math.floor(Math.random() * (range.stl[1] - range.stl[0] + 1)) + range.stl[0],
    threePointers: Math.floor(Math.random() * (range.tpm[1] - range.tpm[0] + 1)) + range.tpm[0],
  };
}

/**
 * Get quarter data for both teams with randomized stats
 */
function getQuarterData(quarter: number): {
  left: QuarterStats;
  right: QuarterStats;
} {
  return {
    left: generateRandomQuarterStats(quarter),
    right: generateRandomQuarterStats(quarter),
  };
}

/**
 * Sleep utility for async delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if battle should end (either castle HP <= 0)
 * Returns true if battle should end, false if it should continue
 */
function checkBattleEnd(gameId: string): boolean {
  const multiStore = useMultiGameStore.getState();
  const battle = multiStore.getBattle(gameId);
  if (!battle) return false;

  const leftHP = battle.capperHP.get('left')?.currentHP ?? 0;
  const rightHP = battle.capperHP.get('right')?.currentHP ?? 0;

  // Battle ends if either castle is destroyed
  return leftHP <= 0 || rightHP <= 0;
}

/**
 * Create collision effect when projectiles collide mid-battlefield (legacy version without battleId)
 * Size varies by collision type:
 * - 'projectile': smallest (two projectiles colliding mid-air)
 * - 'defense': medium (projectile hitting defense orb)
 * - 'castle': largest (projectile hitting attack node, dealing castle damage)
 */
function createCollisionEffect(
  x: number,
  y: number,
  color: number,
  collisionType: 'castle' | 'defense' | 'projectile' = 'projectile'
): void {
  const container = pixiManager.getContainer();
  if (!container) return;

  const collision = new PIXI.Graphics();

  // Size based on collision type
  const sizeMap = {
    projectile: 8,   // Smallest - mid-air collision
    defense: 14,     // Medium - hit defense orb
    castle: 22,      // Largest - dealt castle damage
  };
  const size = sizeMap[collisionType];

  // Animation scale based on collision type
  const scaleMap = {
    projectile: 1.2,
    defense: 1.5,
    castle: 2.0,
  };
  const maxScale = scaleMap[collisionType];

  // Soft colored glow
  collision.circle(0, 0, size);
  collision.fill({ color, alpha: 0.6 });

  // Inner bright core
  collision.circle(0, 0, size * 0.4);
  collision.fill({ color: 0xFFFFFF, alpha: 0.8 });

  // Add extra ring for castle hits
  if (collisionType === 'castle') {
    collision.circle(0, 0, size * 1.3);
    collision.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.5 });
  }

  collision.x = x;
  collision.y = y;

  container.addChild(collision);

  // Animation timing based on collision type
  const durationMap = {
    projectile: 0.1,
    defense: 0.15,
    castle: 0.25,
  };
  const duration = durationMap[collisionType];

  // Quick pop animation
  gsap.timeline()
    .to(collision.scale, {
      x: maxScale,
      y: maxScale,
      duration: duration,
      ease: 'power2.out',
    })
    .to(collision, {
      alpha: 0,
      duration: duration * 0.8,
    }, `-=${duration * 0.3}`)
    .call(() => {
      collision.destroy();
    });
}
/**
 * DEBUG: Run a single-quarter random battle for a multi-game store battle.
 * This is used by /battle-arena?debug=1 so each Pixi canvas can actually fire projectiles.
 */
export async function runDebugBattleForMultiStore(battleId: string): Promise<void> {
  const multiStore = useMultiGameStore.getState();
  const battle = multiStore.getBattle(battleId);

  if (!battle) {
    console.warn(`[MultiBattleDebug] Battle not found for id=${battleId}`);
    return;
  }

  const gameId = battleId; // multi-store uses battleId as gameId on DefenseDots / projectiles
  console.log(`\n🎮 [MultiBattleDebug] Starting debug simulation for battle ${battleId}`);

  // Wire collision manager to use multi-game store for this battle (per-battle callbacks)
  collisionManager.registerBattle(
    gameId,
    () => {
      const state = useMultiGameStore.getState();
      const currentBattle = state.getBattle(battleId);
      return currentBattle?.defenseDots ?? new Map();
    },
    (dotId: string, damage: number) => {
      const state = useMultiGameStore.getState();
      state.applyDamage(battleId, dotId, damage);
    },
  );

  const statsOrder: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];

  // Run all 4 quarters sequentially so battles progress like a real game
  for (let quarterNumber = 1; quarterNumber <= 4; quarterNumber++) {
    const quarterData = getQuarterData(quarterNumber);

    console.log(`[MultiBattleDebug] Q${quarterNumber} stats for ${battleId}:`, {
      left: quarterData.left,
      right: quarterData.right,
    });

    // Fire all stat rows simultaneously instead of one by one
    const statRowPromises = statsOrder.map(async (stat) => {
      const leftCount = getCountForStatFromQuarter(stat, quarterData.left);
      const rightCount = getCountForStatFromQuarter(stat, quarterData.right);

      if (leftCount === 0 && rightCount === 0) {
        return true; // No projectiles for this stat, continue
      }

      const shouldContinue = await fireStatRowForMultiBattle(
        battleId,
        gameId,
        stat,
        leftCount,
        rightCount
      );

      return shouldContinue;
    });

    // Wait for all stat rows to complete
    const results = await Promise.all(statRowPromises);

    // Check if any stat row ended the battle
    if (results.some(result => result === false)) {
      console.log(
        `🏁 [MultiBattleDebug] Battle ended during Q${quarterNumber} for ${battleId}`
      );
      collisionManager.unregisterBattle(gameId);
      return;
    }

    // Slightly longer pause between quarters so you can visually see transitions
    if (quarterNumber < 4) {
      console.log(`⏸ [MultiBattleDebug] Pause between Q${quarterNumber} and Q${quarterNumber + 1} for ${battleId}`);
      await sleep(1500);
    }
  }

  console.log(`✅ [MultiBattleDebug] Full 4-quarter debug simulation complete for battle ${battleId}`);

  // Cleanup collision callbacks for this battle
  collisionManager.unregisterBattle(gameId);
}

/**
 * Map StatType to the quarter stat counts
 * Returns 2x the stat value to create more projectiles for better visual effect
 */
function getCountForStatFromQuarter(stat: StatType, stats: QuarterStats): number {
  let baseCount = 0;

  switch (stat) {
    case 'pts':
      baseCount = stats.points;
      break;
    case 'reb':
      baseCount = stats.rebounds;
      break;
    case 'ast':
      baseCount = stats.assists;
      break;
    case 'stl':
      baseCount = stats.steals;
      break;
    case '3pt':
      baseCount = stats.threePointers;
      break;
    default:
      baseCount = 0;
  }

  // Double the projectile count for better visual effect
  return baseCount * 2;
}

/**
 * Fire one stat row worth of projectiles for a multi-game battle.
 * Returns false if the battle should end, true to continue.
 *
 * @param leftCount - Display value for left side (shown in UI)
 * @param rightCount - Display value for right side (shown in UI)
 * @param leftProjectileCount - Actual number of projectiles to fire (optional, defaults to leftCount)
 * @param rightProjectileCount - Actual number of projectiles to fire (optional, defaults to rightCount)
 */
async function fireStatRowForMultiBattle(
  battleId: string,
  gameId: string,
  stat: StatType,
  leftCount: number,
  rightCount: number,
  leftProjectileCount?: number,
  rightProjectileCount?: number
): Promise<boolean> {
  const statName = stat.toUpperCase();

  // Use provided projectile counts or fall back to display counts
  const leftProj = leftProjectileCount ?? leftCount;
  const rightProj = rightProjectileCount ?? rightCount;

  console.log(`⚔️ [MultiBattleDebug] ${statName}: L${leftCount} vs R${rightCount} (projectiles: L${leftProj} vs R${rightProj})`);

  const container = pixiManager.getContainer(battleId);
  if (!container) {
    console.warn(`[MultiBattleDebug] No container registered for battle ${battleId}`);
    return true;
  }

  // PHASE 1: Simple stat counter animations above each weapon
  try {
    const counterPromises: Promise<void>[] = [];

    if (leftCount > 0) {
      counterPromises.push(
        animateStatCounter(container, {
          stat,
          side: 'left',
          value: leftCount,
          rowY: getStatLabelPosition(stat, 'left').y,
          labelX: getStatLabelPosition(stat, 'left').x,
        })
      );
    }

    if (rightCount > 0) {
      counterPromises.push(
        animateStatCounter(container, {
          stat,
          side: 'right',
          value: rightCount,
          rowY: getStatLabelPosition(stat, 'right').y,
          labelX: getStatLabelPosition(stat, 'right').x,
        })
      );
    }

    await Promise.all(counterPromises);
  } catch (error: any) {
    console.error('❌ [MultiBattleDebug] Error during stat counter animation:', error?.message || error);
  }

  // PHASE 2: Weapon activation glow
  try {
    const leftBall = getWeaponBall(container, stat, 'left');
    const rightBall = getWeaponBall(container, stat, 'right');

    const activationPromises: Promise<void>[] = [];
    if (leftCount > 0 && leftBall) activationPromises.push(animateWeaponActivation(leftBall, stat));
    if (rightCount > 0 && rightBall) activationPromises.push(animateWeaponActivation(rightBall, stat));

    await Promise.all(activationPromises);
  } catch (error: any) {
    console.error('❌ [MultiBattleDebug] Error during weapon activation:', error?.message || error);
  }

  // PHASE 3: Queue projectiles for attack nodes (0.5s interval enforced by queue manager)
  // Use projectile counts (which may be 3x the display count)
  console.log(`🎯 [MultiBattleDebug] Queueing ${leftProj} left and ${rightProj} right projectiles for ${statName}`);

  // Queue all left side projectiles
  for (let i = 0; i < leftProj; i++) {
    // Capture the index in a closure to avoid variable capture issues
    const projectileIndex = i;
    attackNodeQueueManager.enqueueProjectile(
      gameId,
      'left',
      stat,
      () => fireSingleProjectileForMultiBattle(battleId, gameId, stat, 'left', projectileIndex),
      'BASE'
    );
  }

  // Queue all right side projectiles
  for (let i = 0; i < rightProj; i++) {
    // Capture the index in a closure to avoid variable capture issues
    const projectileIndex = i;
    attackNodeQueueManager.enqueueProjectile(
      gameId,
      'right',
      stat,
      () => fireSingleProjectileForMultiBattle(battleId, gameId, stat, 'right', projectileIndex),
      'BASE'
    );
  }

  // Wait for all projectiles to START firing from the queues
  // Calculate time needed for all projectiles to be LAUNCHED (not completed)
  // Each attack node fires at 0.5s intervals, so max projectiles * 0.5s
  const maxCount = Math.max(leftProj, rightProj);
  const launchTime = maxCount * 500; // 500ms per projectile to launch
  console.log(`⏳ [MultiBattleDebug] Waiting ${launchTime}ms for ${maxCount} projectiles to launch from queues`);
  await sleep(launchTime);

  // Add extra time for projectiles to travel and collide (projectiles take ~1-2s to complete)
  console.log(`⏳ [MultiBattleDebug] Waiting for projectiles to complete their flight...`);
  await sleep(2000); // 2 second buffer for projectiles to finish traveling

  // After the row resolves, check HP for this battle
  const state = useMultiGameStore.getState();
  const battle = state.getBattle(battleId);
  if (!battle) return true;

  const leftHP = battle.capperHP.get('left')?.currentHP ?? 0;
  const rightHP = battle.capperHP.get('right')?.currentHP ?? 0;
  const shouldContinue = leftHP > 0 && rightHP > 0;

  if (!shouldContinue) {
    console.log(
      `💥 [MultiBattleDebug] Castle destroyed after ${statName} row (LHP=${leftHP}, RHP=${rightHP})`
    );
  }

  return shouldContinue;
}

/**
 * Fire a single projectile for one side in a multi-game battle.
 */
async function fireSingleProjectileForMultiBattle(
  battleId: string,
  gameId: string,
  stat: StatType,
  side: 'left' | 'right',
  projectileIndex: number
): Promise<void> {
  const startPosition = getWeaponSlotPosition(stat, side);
  const targetSide = side === 'left' ? 'right' : 'left';

  // Projectiles MUST fly all the way across to the opposite weapon slot
  // This ensures they travel THROUGH the defense zone where collision detection can catch them
  // Collision detection will stop the projectile when it hits a defense dot
  const targetPosition = getWeaponSlotPosition(stat, targetSide);

  const projectileId = `multi-${battleId}-${stat}-${side}-${projectileIndex}-${Date.now()}`;

  const config = {
    id: projectileId,
    gameId,
    stat,
    side,
    startPosition,
    targetPosition,
    typeConfig: getProjectileTypeConfig(stat),
  };

  const projectile = projectilePool.acquire(config);

  // Route collision checks through the shared collision manager
  projectile.onCollisionCheck = (proj) => collisionManager.checkCollisions(proj);

  // Register with collision manager and store
  collisionManager.registerProjectile(projectile);
  useMultiGameStore.getState().addProjectile(battleId, projectile);

  // Add sprite to this battle's Pixi container
  pixiManager.addSprite(projectile.sprite, 'projectile', battleId);

  // Emit PROJECTILE_FIRED event (BEFORE animation so items can modify speed)
  battleEventBus.emit('PROJECTILE_FIRED', {
    side,
    opponentSide: targetSide,
    quarter: 1, // TODO: Track actual quarter number
    battleId,
    gameId,
    lane: stat,
    projectileId,
    source: 'BASE',
    isExtraFromItem: false
  } as ProjectileFiredPayload);

  // Small delay to allow event handlers to apply speed modifiers
  await new Promise(resolve => setTimeout(resolve, 50));

  console.log(`🚀 [QuarterSim] Animating projectile ${projectileId} with speed multiplier: ${projectile.speedMultiplier}`);

  // Animate towards target; collisions are checked during flight
  await projectile.animateToTarget();

  // Hide projectile sprite immediately after impact
  projectile.sprite.visible = false;

  // If it reached target without hitting a defense dot, damage the opposing capper HP
  console.log(`🎯 [Attack Node Check] Projectile ${projectile.id} finished - collidedWith: ${projectile.collidedWith || 'NONE'}`);
  if (!projectile.collidedWith) {
    console.log(`💥 [CASTLE DAMAGE] Projectile ${projectile.id} hit attack node! Damaging ${targetSide} castle HP by 1`);
    useMultiGameStore.getState().applyDamageToCapperHP(battleId, targetSide, 1);
    screenShake.shake(battleId, 'large');
  } else if (projectile.collidedWith === 'defense') {
    console.log(`🛡️ [Defense Hit] Projectile ${projectile.id} was blocked by defense orb`);
    screenShake.shake(battleId, 'medium');
  } else if (projectile.collidedWith === 'projectile') {
    console.log(`⚔️ [Projectile Collision] Projectile ${projectile.id} collided with another projectile`);
  }

  // Impact effect at final position - size varies by collision type
  // No collision (hit attack node/castle) = largest, defense dot = medium, projectile = smallest
  const collisionType: 'castle' | 'defense' | 'projectile' =
    !projectile.collidedWith ? 'castle' :
      projectile.collidedWith === 'defense' ? 'defense' : 'projectile';
  createCollisionEffectForBattle(battleId, projectile.sprite.x, projectile.sprite.y, projectile.typeConfig.color, collisionType);

  await sleep(150);

  // Cleanup: remove from container & store, unregister, and return to pool
  pixiManager.removeSprite(projectile.sprite, battleId);
  useMultiGameStore.getState().removeProjectile(battleId, projectile.id);
  collisionManager.unregisterProjectile(projectile.id);
  projectilePool.release(projectile);
}

/**
 * Create collision effect scoped to a specific battle's Pixi container.
 * Size varies by collision type:
 * - 'projectile': smallest (two projectiles colliding mid-air)
 * - 'defense': medium (projectile hitting defense orb)
 * - 'castle': largest (projectile hitting attack node, dealing castle damage)
 */
function createCollisionEffectForBattle(
  battleId: string,
  x: number,
  y: number,
  color: number,
  collisionType: 'castle' | 'defense' | 'projectile' = 'projectile'
): void {
  const container = pixiManager.getContainer(battleId);
  if (!container) return;

  const collision = new PIXI.Graphics();

  // Size based on collision type
  const sizeMap = {
    projectile: 8,   // Smallest - mid-air collision
    defense: 14,     // Medium - hit defense orb
    castle: 22,      // Largest - dealt castle damage
  };
  const size = sizeMap[collisionType];

  // Animation scale based on collision type
  const scaleMap = {
    projectile: 1.2,
    defense: 1.5,
    castle: 2.0,
  };
  const maxScale = scaleMap[collisionType];

  // Soft colored glow
  collision.circle(0, 0, size);
  collision.fill({ color, alpha: 0.6 });

  // Inner bright core
  collision.circle(0, 0, size * 0.4);
  collision.fill({ color: 0xFFFFFF, alpha: 0.8 });

  // Add extra ring for castle hits
  if (collisionType === 'castle') {
    collision.circle(0, 0, size * 1.3);
    collision.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.5 });
  }

  collision.x = x;
  collision.y = y;

  container.addChild(collision);

  // Animation timing based on collision type
  const durationMap = {
    projectile: 0.1,
    defense: 0.15,
    castle: 0.25,
  };
  const duration = durationMap[collisionType];

  // Quick pop animation
  gsap.timeline()
    .to(collision.scale, {
      x: maxScale,
      y: maxScale,
      duration: duration,
      ease: 'power2.out',
    })
    .to(collision, {
      alpha: 0,
      duration: duration * 0.8,
    }, `-=${duration * 0.3}`)
    .call(() => {
      collision.destroy();
    });
}


