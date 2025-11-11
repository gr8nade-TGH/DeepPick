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
import { useGameStore } from '../../store/gameStore';
import type { StatType } from '../../types/game';
import { getBattlefieldCenter } from '../utils/positioning';
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
 */
function calculateFireOrbBonus(gameId: string, side: 'left' | 'right', pointsCount: number): number {
  const store = useGameStore.getState();
  const game = store.games.find(g => g.id === gameId);
  if (!game) return 0;

  const capper = side === 'left' ? game.leftCapper : game.rightCapper;
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
export async function simulateQuarter(quarterNumber: number): Promise<{
  left: QuarterStats;
  right: QuarterStats;
}> {
  console.log(`\n🎮 Q${quarterNumber} START`);

  const store = useGameStore.getState();

  // Set up collision manager callbacks
  // 1. Apply damage IMMEDIATELY when defense dot is hit
  collisionManager.onDefenseDotHit = (dotId: string, damage: number) => {
    store.applyDamage(dotId, damage);
  };

  // 2. Get FRESH defense dots from store (so we always see latest HP values)
  collisionManager.getDefenseDotsFromStore = () => {
    const dots = useGameStore.getState().defenseDots;
    // Log every 20th call to avoid spam
    if (Math.random() < 0.05) {
      console.log(`📦 [CALLBACK] getDefenseDotsFromStore called: ${dots.size} dots in store`);
    }
    return dots;
  };

  console.log(`✅ Collision manager callbacks configured`);
  console.log(`   - onDefenseDotHit: ${collisionManager.onDefenseDotHit ? 'SET' : 'NOT SET'}`);
  console.log(`   - getDefenseDotsFromStore: ${collisionManager.getDefenseDotsFromStore ? 'SET' : 'NOT SET'}`);

  // Reduced logging for cleaner output
  // console.log(`📦 Store state:`, {
  //   gamesCount: store.games.length,
  //   defenseDotsCount: store.defenseDots.size,
  //   projectilesCount: store.projectiles.length,
  // });

  const game = store.games[0];

  // Get quarter stats for both teams
  const quarterData = getQuarterData(quarterNumber);

  if (!game) {
    console.error('❌ No game found in store!');
    return quarterData; // Return empty stats if no game
  }

  console.log(`📊 ${game.leftTeam.abbreviation}: PTS=${quarterData.left.points} REB=${quarterData.left.rebounds} AST=${quarterData.left.assists} BLK=${quarterData.left.blocks} 3PM=${quarterData.left.threePointers}`);
  console.log(`📊 ${game.rightTeam.abbreviation}: PTS=${quarterData.right.points} REB=${quarterData.right.rebounds} AST=${quarterData.right.assists} BLK=${quarterData.right.blocks} 3PM=${quarterData.right.threePointers}`);

  // Fire ALL stat rows SIMULTANEOUSLY (not sequentially)
  // All stats fill at the same time, all projectiles fire at the same time
  try {
    // Fire all stat rows in parallel
    const statRowPromises = [
      fireStatRow('pts', quarterData.left.points, quarterData.right.points, game.id),
      fireStatRow('reb', quarterData.left.rebounds, quarterData.right.rebounds, game.id),
      fireStatRow('ast', quarterData.left.assists, quarterData.right.assists, game.id),
      fireStatRow('blk', quarterData.left.blocks, quarterData.right.blocks, game.id),
      fireStatRow('3pt', quarterData.left.threePointers, quarterData.right.threePointers, game.id),
    ];

    // Wait for all stat rows to complete
    const results = await Promise.all(statRowPromises);

    // Check if any stat row returned false (battle ended)
    if (results.some(result => !result)) {
      console.log('⚠️ Battle ended during stat row firing');
      return quarterData;
    }

    // NOTE: Fire Orb logic moved to defense dot destruction event (see CollisionManager)
    // Fire Orb now triggers when a team loses their last defense dot for a stat row
  } catch (error: any) {
    console.error('❌ Error during stat row firing:', error?.message || error);
  }

  // SHIELD REGENERATION: Activate at end of quarter
  try {
    await regenerateDefenseDots(game.id);
  } catch (error: any) {
    console.error('❌ Regen error:', error?.message || error);
  }

  // Print debug summary
  projectileDebugger.printSummary();

  console.log(`✅ Q${quarterNumber} COMPLETE\n`);

  // Return quarter stats for score tracking
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
  const store = useGameStore.getState();
  const statName = stat.toUpperCase();
  console.log(`⚔️ ${statName}: L${leftCount} vs R${rightCount}`);

  // PHASE 1: Animate stat counters for both sides
  const container = pixiManager.getContainer();
  if (container) {
    const counterPromises: Promise<void>[] = [];

    // Left counter
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

    // Right counter
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

    // Wait for counters to complete
    await Promise.all(counterPromises);
  }

  // PHASE 2: Activate weapon slots
  if (container) {
    const activationPromises: Promise<void>[] = [];

    // Left weapon activation
    if (leftCount > 0) {
      const leftWeaponBall = getWeaponBall(container, stat, 'left');
      if (leftWeaponBall) {
        activationPromises.push(animateWeaponActivation(leftWeaponBall, stat));
      }
    }

    // Right weapon activation
    if (rightCount > 0) {
      const rightWeaponBall = getWeaponBall(container, stat, 'right');
      if (rightWeaponBall) {
        activationPromises.push(animateWeaponActivation(rightWeaponBall, stat));
      }
    }

    // Wait for weapon activations to complete
    await Promise.all(activationPromises);
  }

  // PHASE 3: PROJECTILES FIRE WITH STAGGER DELAY (creates spacing between projectiles)
  const maxCount = Math.max(leftCount, rightCount);

  // Stagger delay creates visual spacing between projectiles in the same lane
  // At 3 cells/sec speed, 400ms delay creates ~3 projectile-widths of spacing
  const STAGGER_DELAY = 400; // 400ms delay between each projectile (creates ~3 projectile-widths spacing)

  // Launch projectiles with stagger delay
  const projectilePromises: Promise<void>[] = [];

  for (let i = 0; i < maxCount; i++) {
    const hasLeftProjectile = i < leftCount;
    const hasRightProjectile = i < rightCount;

    // Create a promise for this projectile pair with stagger delay
    const projectilePromise = (async () => {
      // Add stagger delay before firing (creates spacing)
      await sleep(i * STAGGER_DELAY);

      // NOTE: We don't need to refresh collision manager here anymore!
      // The collision manager now queries fresh defense dots from store on EVERY collision check
      // This ensures we always see the latest HP values, even during flight

      // SIMULTANEOUS FIRING: Both sides fire at the same time
      if (hasLeftProjectile && hasRightProjectile) {
        // Both sides have projectiles - they collide mid-battlefield
        await fireSimultaneousProjectiles(gameId, stat, i);
      } else if (hasLeftProjectile) {
        // Only left has projectile - hits right defense
        await fireProjectileAtHPBar(gameId, stat, 'left', i);
      } else if (hasRightProjectile) {
        // Only right has projectile - hits left defense
        await fireProjectileAtHPBar(gameId, stat, 'right', i);
      }
    })();

    projectilePromises.push(projectilePromise);
  }

  // Wait for ALL projectiles to complete
  await Promise.all(projectilePromises);

  // Check if battle should end after all projectiles
  if (checkBattleEnd(gameId)) {
    console.log('⚠️ Battle ended!');
    return false;
  }

  return true; // Battle continues
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
  const store = useGameStore.getState();

  // NOTE: No need to update collision manager - it queries fresh data from store on every check

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
  leftProjectile.onCollisionCheck = (projectile) => collisionManager.checkCollisions(projectile);
  rightProjectile.onCollisionCheck = (projectile) => collisionManager.checkCollisions(projectile);

  // Register projectiles with collision manager
  collisionManager.registerProjectile(leftProjectile);
  collisionManager.registerProjectile(rightProjectile);

  // Add both to store
  store.addProjectile(leftProjectile);
  store.addProjectile(rightProjectile);

  // Add sprites to PixiJS container
  pixiManager.addSprite(leftProjectile.sprite, 'projectile');
  pixiManager.addSprite(rightProjectile.sprite, 'projectile');

  // Animate both projectiles simultaneously
  await Promise.all([
    leftProjectile.animateToTarget(),
    rightProjectile.animateToTarget()
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
  store.removeProjectile(leftProjectile.id);
  store.removeProjectile(rightProjectile.id);
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
  const store = useGameStore.getState();

  // Get weapon slot position (center of weapon slot cell)
  const startPosition = getWeaponSlotPosition(stat, side);

  // Target is the opposing side
  const targetSide = side === 'left' ? 'right' : 'left';

  // CRITICAL FIX: Target the opposing weapon slot (far side of defense grid)
  // The collision manager will intercept with defense dots during flight
  // This ensures projectiles always target the CURRENT nearest alive dot, not a stale target
  const targetPosition = getWeaponSlotPosition(stat, targetSide);

  // Create projectile based on stat type (using object pool)
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

  // Set collision check callback on the projectile
  projectile.onCollisionCheck = (proj) => collisionManager.checkCollisions(proj);

  // NOTE: No need to update collision manager - it queries fresh data from store on every check

  // Register projectile with collision manager
  collisionManager.registerProjectile(projectile);

  // Add to store
  store.addProjectile(projectile);

  // CRITICAL: Add sprite to PixiJS container IMMEDIATELY before animation
  pixiManager.addSprite(projectile.sprite, 'projectile');

  // Animate projectile to target (collision detection happens during flight)
  await projectile.animateToTarget();

  // IMMEDIATELY hide the projectile sprite (impact effect is separate)
  projectile.sprite.visible = false;

  // Handle impact based on what it collided with
  if (projectile.collidedWith === 'defense') {
    // Hit defense dot - damage was already applied by collision manager
    screenShake.shake('medium');
  } else if (!projectile.collidedWith) {
    // Reached target without collision - hit weapon slot and deduct capper HP
    store.applyDamageToCapperHP(gameId, targetSide, 1);
    screenShake.shake('large');
  }

  // Create impact effect at final position
  createCollisionEffect(projectile.sprite.x, projectile.sprite.y, projectile.typeConfig.color);

  // Keep impact effect visible briefly
  await sleep(150);

  // Remove sprite from PixiJS container
  pixiManager.removeSprite(projectile.sprite);

  // Remove from store and return to pool
  store.removeProjectile(projectile.id);
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
  const store = useGameStore.getState();

  const aliveDots: Array<{ id: string; dot: any }> = [];
  store.defenseDots.forEach((dot, dotId) => {
    if (dot.gameId === gameId &&
        dot.stat === stat &&
        dot.side === side &&
        dot.alive) {
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
  const store = useGameStore.getState();
  const game = store.games.find(g => g.id === gameId);

  if (!game) return false;

  const leftKey = `${gameId}-left`;
  const rightKey = `${gameId}-right`;

  const leftHP = store.capperHP.get(leftKey)?.currentHP || 0;
  const rightHP = store.capperHP.get(rightKey)?.currentHP || 0;

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

