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
import { projectileDebugger } from '../debug/ProjectileDebugger';

/**
 * Quarter stats for both teams
 */
interface QuarterStats {
  points: number;
  rebounds: number;
  assists: number;
  blocks: number;
  threePointers: number;
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
  const battle = multiStore.getBattle(battleId);

  if (!battle) {
    console.error(`[simulateQuarter] No battle found for id=${battleId}`);
    return getQuarterData(quarterNumber);
  }

  const gameId = battleId; // In multi-store, we use battleId as gameId for dots/projectiles

  // Wire collision manager for this battle
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

  console.log(`✅ Collision manager callbacks configured for battle ${battleId}`);

  // Get quarter stats for both teams
  const quarterData = getQuarterData(quarterNumber);

  console.log(
    `📊 ${battle.game.leftTeam.abbreviation}: PTS=${quarterData.left.points} REB=${quarterData.left.rebounds} AST=${quarterData.left.assists} BLK=${quarterData.left.blocks} 3PM=${quarterData.left.threePointers}`
  );
  console.log(
    `📊 ${battle.game.rightTeam.abbreviation}: PTS=${quarterData.right.points} REB=${quarterData.right.rebounds} AST=${quarterData.right.assists} BLK=${quarterData.right.blocks} 3PM=${quarterData.right.threePointers}`
  );

  // Fire ALL stat rows SIMULTANEOUSLY (not sequentially)
  try {
    const statRowPromises = [
      fireStatRow('pts', quarterData.left.points, quarterData.right.points, gameId),
      fireStatRow('reb', quarterData.left.rebounds, quarterData.right.rebounds, gameId),
      fireStatRow('ast', quarterData.left.assists, quarterData.right.assists, gameId),
      fireStatRow('blk', quarterData.left.blocks, quarterData.right.blocks, gameId),
      fireStatRow('3pt', quarterData.left.threePointers, quarterData.right.threePointers, gameId),
    ];

    const results = await Promise.all(statRowPromises);

    if (results.some(result => !result)) {
      console.log('⚠️ Battle ended during stat row firing');
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

  projectileDebugger.printSummary();

  console.log(`✅ Q${quarterNumber} COMPLETE (battleId=${battleId})\n`);

  // Cleanup collision callbacks for this battle
  collisionManager.unregisterBattle(gameId);

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
  const STAGGER_DELAY = 400; // ms

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
    screenShake.shake('medium');
  } else {
    // Defense dot damage is now applied IMMEDIATELY in CollisionManager
    // Just trigger screen shake for visual feedback
    if (leftProjectile.collidedWith === 'defense') {
      screenShake.shake('small');
    }
    if (rightProjectile.collidedWith === 'defense') {
      screenShake.shake('small');
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
    screenShake.shake('medium');
  } else if (!projectile.collidedWith) {
    // Reached target without collision - hit weapon slot and deduct capper HP
    useMultiGameStore.getState().applyDamageToCapperHP(gameId, targetSide, 1);
    screenShake.shake('large');
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
 * Q1: PTS 25-35 | REB 9-14 | AST 5-9 | BLK 0-3 | 3PM 2-5
 * Q2: PTS 23-33 | REB 8-13 | AST 4-8 | BLK 0-3 | 3PM 2-5
 * Q3: PTS 24-34 | REB 8-13 | AST 4-8 | BLK 0-3 | 3PM 2-6
 * Q4: PTS 22-36 | REB 7-12 | AST 4-8 | BLK 0-3 | 3PM 2-6
 */
function generateRandomQuarterStats(quarter: number): QuarterStats {
  const ranges = {
    1: { pts: [25, 35], reb: [9, 14], ast: [5, 9], blk: [0, 3], tpm: [2, 5] },
    2: { pts: [23, 33], reb: [8, 13], ast: [4, 8], blk: [0, 3], tpm: [2, 5] },
    3: { pts: [24, 34], reb: [8, 13], ast: [4, 8], blk: [0, 3], tpm: [2, 6] },
    4: { pts: [22, 36], reb: [7, 12], ast: [4, 8], blk: [0, 3], tpm: [2, 6] },
  };

  const range = ranges[quarter as keyof typeof ranges] || ranges[1];

  return {
    points: Math.floor(Math.random() * (range.pts[1] - range.pts[0] + 1)) + range.pts[0],
    rebounds: Math.floor(Math.random() * (range.reb[1] - range.reb[0] + 1)) + range.reb[0],
    assists: Math.floor(Math.random() * (range.ast[1] - range.ast[0] + 1)) + range.ast[0],
    blocks: Math.floor(Math.random() * (range.blk[1] - range.blk[0] + 1)) + range.blk[0],
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
 * Create collision effect (X mark) when projectiles collide mid-battlefield
 */
function createCollisionEffect(x: number, y: number, color: number): void {
  const container = pixiManager.getContainer();
  if (!container) return;

  const collision = new PIXI.Graphics();

  // Draw X mark (two diagonal lines)
  const size = 20;

  // Line 1: top-left to bottom-right
  collision.moveTo(-size, -size);
  collision.lineTo(size, size);

  // Line 2: top-right to bottom-left
  collision.moveTo(size, -size);
  collision.lineTo(-size, size);

  collision.stroke({ width: 4, color: 0xFFFFFF, alpha: 0.9 });

  // Add colored glow circle
  collision.circle(0, 0, size);
  collision.fill({ color, alpha: 0.3 });

  collision.x = x;
  collision.y = y;

  container.addChild(collision);

  // Animate collision effect
  gsap.timeline()
    .to(collision.scale, {
      x: 1.5,
      y: 1.5,
      duration: 0.2,
      ease: 'power2.out',
    })
    .to(collision, {
      alpha: 0,
      duration: 0.3,
    }, '-=0.1')
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

  // Enable projectile debugger overlay & tracking during debug runs
  const container = pixiManager.getContainer(gameId);
  if (container) {
    projectileDebugger.initialize(battleId, container);
    projectileDebugger.setEnabled(true);
  }

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

  const statsOrder: StatType[] = ['pts', 'reb', 'ast', 'blk', '3pt'];

  // Run all 4 quarters sequentially so battles progress like a real game
  for (let quarterNumber = 1; quarterNumber <= 4; quarterNumber++) {
    const quarterData = getQuarterData(quarterNumber);

    console.log(`[MultiBattleDebug] Q${quarterNumber} stats for ${battleId}:`, {
      left: quarterData.left,
      right: quarterData.right,
    });

    for (const stat of statsOrder) {
      const leftCount = getCountForStatFromQuarter(stat, quarterData.left);
      const rightCount = getCountForStatFromQuarter(stat, quarterData.right);

      if (leftCount === 0 && rightCount === 0) {
        continue;
      }

      const shouldContinue = await fireStatRowForMultiBattle(
        battleId,
        gameId,
        stat,
        leftCount,
        rightCount
      );

      if (!shouldContinue) {
        console.log(
          `🏁 [MultiBattleDebug] Battle ended during Q${quarterNumber} ${stat.toUpperCase()} row for ${battleId}`
        );
        collisionManager.unregisterBattle(gameId);
        return;
      }

      // Small pause between stat rows so the action is readable
      await sleep(500);
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
 */
function getCountForStatFromQuarter(stat: StatType, stats: QuarterStats): number {
  switch (stat) {
    case 'pts':
      return stats.points;
    case 'reb':
      return stats.rebounds;
    case 'ast':
      return stats.assists;
    case 'blk':
      return stats.blocks;
    case '3pt':
      return stats.threePointers;
    default:
      return 0;
  }
}

/**
 * Fire one stat row worth of projectiles for a multi-game battle.
 * Returns false if the battle should end, true to continue.
 */
async function fireStatRowForMultiBattle(
  battleId: string,
  gameId: string,
  stat: StatType,
  leftCount: number,
  rightCount: number
): Promise<boolean> {
  const statName = stat.toUpperCase();
  console.log(`⚔️ [MultiBattleDebug] ${statName}: L${leftCount} vs R${rightCount}`);

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

  // PHASE 3: Fire projectiles from both sides with staggered timing
  const maxCount = Math.max(leftCount, rightCount);
  const projectilePromises: Promise<void>[] = [];
  const STAGGER_DELAY = 220;

  for (let i = 0; i < maxCount; i++) {
    const delay = i * STAGGER_DELAY;

    if (i < leftCount) {
      projectilePromises.push(
        (async () => {
          await sleep(delay);
          await fireSingleProjectileForMultiBattle(battleId, gameId, stat, 'left', i);
        })()
      );
    }

    if (i < rightCount) {
      projectilePromises.push(
        (async () => {
          await sleep(delay);
          await fireSingleProjectileForMultiBattle(battleId, gameId, stat, 'right', i);
        })()
      );
    }
  }

  await Promise.all(projectilePromises);

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

  // Projectiles ALWAYS target the weapon slot on the opposite side
  // Collision detection will handle hitting defense dots or projectiles that are "in the way"
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

  // Animate towards target; collisions are checked during flight
  await projectile.animateToTarget();

  // Hide projectile sprite immediately after impact
  projectile.sprite.visible = false;

  // If it reached target without hitting a defense dot, damage the opposing capper HP
  if (!projectile.collidedWith) {
    useMultiGameStore.getState().applyDamageToCapperHP(battleId, targetSide, 1);
    screenShake.shake('large');
  } else if (projectile.collidedWith === 'defense') {
    screenShake.shake('medium');
  }

  // Impact effect at final position
  createCollisionEffectForBattle(battleId, projectile.sprite.x, projectile.sprite.y, projectile.typeConfig.color);

  await sleep(150);

  // Cleanup: remove from container & store, unregister, and return to pool
  pixiManager.removeSprite(projectile.sprite, battleId);
  useMultiGameStore.getState().removeProjectile(battleId, projectile.id);
  collisionManager.unregisterProjectile(projectile.id);
  projectilePool.release(projectile);
}

/**
 * Create a collision effect scoped to a specific battle's Pixi container.
 */
function createCollisionEffectForBattle(
  battleId: string,
  x: number,
  y: number,
  color: number
): void {
  const container = pixiManager.getContainer(battleId);
  if (!container) return;

  const collision = new PIXI.Graphics();

  const size = 20;

  collision.moveTo(-size, -size);
  collision.lineTo(size, size);

  collision.moveTo(size, -size);
  collision.lineTo(-size, size);

  collision.stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
  collision.circle(0, 0, size);
  collision.fill({ color, alpha: 0.3 });

  collision.x = x;
  collision.y = y;

  container.addChild(collision);

  gsap
    .timeline()
    .to(collision.scale, {
      x: 1.5,
      y: 1.5,
      duration: 0.2,
      ease: 'power2.out',
    })
    .to(
      collision,
      {
        alpha: 0,
        duration: 0.3,
      },
      '-=0.1'
    )
    .call(() => {
      collision.destroy();
    });
}


