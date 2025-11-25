/**
 * STARTER_Shortsword.ts
 *
 * Shortsword - Starter Weapon Item
 *
 * Description:
 * Every 3 to 8 projectiles fired from the PTS row, fire 1 to 3 projectiles
 * from the REB, AST, STL, 3PT rows.
 *
 * Projectile Speed Boost:
 * - PTS projectiles: +10% to +25% speed
 * - One random stat (REB, AST, STL, or 3PT): +10% to +25% speed
 *
 * Roll Ranges:
 * - ptsThreshold: 3-8 projectiles (how many PTS projectiles before triggering)
 * - bonusProjectiles: 1-3 projectiles (how many bonus projectiles to fire)
 * - ptsSpeedBoost: 10-25% (projectile speed increase for PTS)
 * - bonusStatSpeedBoost: 10-25% (projectile speed increase for random stat)
 * - bonusStat: Randomly selected from ['reb', 'ast', 'stl', '3pt']
 *
 * Quality Tiers:
 * - Warped: Low rolls (e.g., 7-8 PTS threshold, +1 bonus projectile, +10% speed)
 * - Balanced: Average rolls (e.g., 5-6 PTS threshold, +2 bonus projectiles, +17% speed)
 * - Honed: Good rolls (e.g., 4-5 PTS threshold, +2-3 bonus projectiles, +22% speed)
 * - Masterwork: Perfect rolls (e.g., 3 PTS threshold, +3 bonus projectiles, +25% speed)
 */

import { battleEventBus } from '../../events/EventBus';
import { itemEffectRegistry } from '../ItemEffectRegistry';
import type { ItemRuntimeContext } from '../ItemEffectRegistry';
import type { ItemDefinition } from '../ItemRollSystem';
import type { ProjectileFiredPayload } from '../../events/types';
import { useMultiGameStore } from '../../../store/multiGameStore';
import { gridManager } from '../../managers/GridManager';
import { collisionManager } from '../../managers/CollisionManager';
import { pixiManager } from '../../managers/PixiManager';
import { projectilePool } from '../../entities/projectiles/ProjectilePool';
import { getProjectileType } from '../../../types/projectileTypes';
import type { StatType } from '../../../types/game';
import { attackNodeQueueManager } from '../../managers/AttackNodeQueueManager';

/**
 * Item definition for Shortsword
 */
export const STARTER_SHORTSWORD_DEFINITION: ItemDefinition = {
  id: 'STARTER_wpn_shortsword',
  team: 'STARTER',
  teamName: 'Starter Equipment',
  slot: 'weapon',
  name: 'Shortsword',
  description: 'Every 3 to 8 projectiles fired from the PTS row, fire 1 to 3 projectiles from the REB, AST, STL, 3PT rows. Increases projectile speed for PTS and one random stat.',
  icon: '⚔️',
  rollRanges: {
    ptsThreshold: { min: 3, max: 8, step: 1 },
    bonusProjectiles: { min: 1, max: 3, step: 1 },
    ptsSpeedBoost: { min: 10, max: 25, step: 1 }, // 10-25% speed boost for PTS
    bonusStatSpeedBoost: { min: 10, max: 25, step: 1 }, // 10-25% speed boost for random stat
  },
};

/**
 * Register Shortsword effect
 *
 * This function is called when the item is activated in a battle.
 * It sets up event listeners for:
 * 1. PROJECTILE_FIRED - Count PTS projectiles and trigger bonus projectiles
 * 2. PROJECTILE_CREATED - Apply speed boosts to PTS and bonus stat projectiles
 */
export function registerShortswordEffect(context: ItemRuntimeContext): void {
  const { itemInstanceId, gameId, side, rolls } = context;
  const { ptsThreshold, bonusProjectiles, ptsSpeedBoost, bonusStatSpeedBoost } = rolls;

  // Randomly select bonus stat for speed boost (REB, AST, STL, or 3PT)
  const bonusStatOptions: StatType[] = ['reb', 'ast', 'stl', '3pt'];
  const bonusStat = bonusStatOptions[Math.floor(Math.random() * bonusStatOptions.length)];

  console.log(`⚔️⚔️⚔️ [Shortsword] REGISTERING EFFECT for ${side} side in game ${gameId}`);
  console.log(`⚔️ [Shortsword] PTS Threshold: ${ptsThreshold}, Bonus Projectiles: ${bonusProjectiles}`);
  console.log(`⚔️ [Shortsword] Speed Boosts: PTS +${ptsSpeedBoost}%, ${bonusStat.toUpperCase()} +${bonusStatSpeedBoost}%`);

  // Initialize counter for PTS projectiles fired
  itemEffectRegistry.setCounter(itemInstanceId, 'ptsFired', 0);

  // PROJECTILE_FIRED: Count PTS projectiles and trigger bonus projectiles
  battleEventBus.on('PROJECTILE_FIRED', (payload: ProjectileFiredPayload) => {
    // Filter by gameId and side
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    // Only count PTS projectiles from BASE source (not item-generated projectiles)
    if (payload.lane !== 'pts') return;
    if (payload.source === 'ITEM') return; // Don't count item-generated projectiles

    // Increment PTS counter
    const ptsFired = itemEffectRegistry.incrementCounter(itemInstanceId, 'ptsFired', 1);
    console.log(`⚔️ [Shortsword] PTS projectile fired! Count: ${ptsFired}/${ptsThreshold}`);

    // Check if threshold reached
    if (ptsFired >= ptsThreshold) {
      console.log(`⚔️⚔️⚔️ [Shortsword] THRESHOLD REACHED! Queueing ${bonusProjectiles} bonus projectiles from each stat row!`);

      // Reset counter
      itemEffectRegistry.setCounter(itemInstanceId, 'ptsFired', 0);

      // Queue bonus projectiles from REB, AST, STL, 3PT rows
      const bonusLanes: StatType[] = ['reb', 'ast', 'stl', '3pt'];

      bonusLanes.forEach((lane) => {
        for (let i = 0; i < bonusProjectiles; i++) {
          // Enqueue projectile to attack node queue (0.5s interval enforced)
          attackNodeQueueManager.enqueueProjectile(
            gameId,
            side,
            lane,
            () => fireBonusProjectile(gameId, side, lane),
            'ITEM',
            STARTER_SHORTSWORD_DEFINITION.id
          );
        }
      });

      // Track total bonus projectiles queued
      const totalBonusFired = bonusProjectiles * bonusLanes.length;
      const totalBonus = itemEffectRegistry.incrementCounter(itemInstanceId, 'totalBonusProjectiles', totalBonusFired);
      console.log(`✅ [Shortsword] Queued ${totalBonusFired} bonus projectiles! Total bonus projectiles: ${totalBonus}`);
    }
  });

  // PROJECTILE_FIRED: Apply speed boosts to PTS and bonus stat projectiles
  battleEventBus.on('PROJECTILE_FIRED', (payload: ProjectileFiredPayload) => {
    // Filter by gameId and side
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    // Get the projectile from the store
    const projectile = multiStore.getState().games[gameId]?.projectiles.find(p => p.id === payload.projectileId);
    if (!projectile) return;

    // Apply speed boost to PTS projectiles
    if (payload.lane === 'pts') {
      const speedMultiplier = 1 + (ptsSpeedBoost / 100);
      projectile.setSpeedMultiplier(speedMultiplier);
      console.log(`⚔️ [Shortsword] Applied +${ptsSpeedBoost}% speed boost to PTS projectile (multiplier: ${speedMultiplier})`);
    }

    // Apply speed boost to bonus stat projectiles
    if (payload.lane === bonusStat) {
      const speedMultiplier = 1 + (bonusStatSpeedBoost / 100);
      projectile.setSpeedMultiplier(speedMultiplier);
      console.log(`⚔️ [Shortsword] Applied +${bonusStatSpeedBoost}% speed boost to ${bonusStat.toUpperCase()} projectile (multiplier: ${speedMultiplier})`);
    }
  });

  console.log(`✅ [Shortsword] Effect registered for ${side} (${itemInstanceId})`);
}

/**
 * Helper function to fire a bonus projectile from a stat row
 */
async function fireBonusProjectile(
  gameId: string,
  side: 'left' | 'right',
  lane: StatType
): Promise<void> {
  console.log(`⚔️ [Shortsword] Firing bonus projectile from ${lane.toUpperCase()} on ${side} side`);

  const multiStore = useMultiGameStore.getState();
  const targetSide = side === 'left' ? 'right' : 'left';

  // Get weapon slot positions
  const startPosition = gridManager.getWeaponSlotPosition(lane, side);
  const targetPosition = gridManager.getWeaponSlotPosition(lane, targetSide);

  // Create projectile with standard config
  const projectileId = `shortsword-${lane}-${side}-${Date.now()}`;
  const typeConfig = getProjectileType(lane);

  const config = {
    id: projectileId,
    gameId,
    stat: lane,
    side,
    startPosition,
    targetPosition,
    typeConfig,
  };

  const projectile = projectilePool.acquire(config);

  // Set collision check callback
  projectile.onCollisionCheck = (proj) => collisionManager.checkCollisions(proj);

  // Register projectile
  collisionManager.registerProjectile(projectile);
  multiStore.addProjectile(gameId, projectile);

  // Add sprite to PixiJS container
  pixiManager.addSprite(projectile.sprite, 'projectile', gameId);

  console.log(`⚔️ [Shortsword] Fired bonus projectile from ${lane.toUpperCase()}`);

  // Emit PROJECTILE_FIRED event
  battleEventBus.emit('PROJECTILE_FIRED', {
    side,
    opponentSide: targetSide,
    quarter: 1, // TODO: Track actual quarter number
    battleId: gameId,
    gameId,
    lane,
    projectileId,
    source: 'ITEM',
    isExtraFromItem: true,
    itemId: STARTER_SHORTSWORD_DEFINITION.id,
  } as ProjectileFiredPayload);

  // Animate projectile to target
  await projectile.animateToTarget();

  // Hide sprite
  projectile.sprite.visible = false;

  // Handle impact
  if (projectile.collidedWith === 'defense') {
    // Hit defense dot - damage already applied
    console.log(`⚔️ [Shortsword] Bonus projectile hit defense dot`);
  } else if (!projectile.collidedWith) {
    // Hit weapon slot - damage capper HP
    multiStore.applyDamageToCapperHP(gameId, targetSide, 1);
    console.log(`⚔️ [Shortsword] Bonus projectile hit weapon slot - 1 HP damage`);
  }

  // Cleanup
  pixiManager.removeSprite(projectile.sprite);
  multiStore.removeProjectile(gameId, projectile.id);
  collisionManager.unregisterProjectile(projectile.id);
  projectilePool.release(projectile);
}

/**
 * Auto-register this item effect
 */
itemEffectRegistry.registerEffect(
  STARTER_SHORTSWORD_DEFINITION.id,
  registerShortswordEffect
);

console.log(`📦 [Shortsword] Item effect registered: ${STARTER_SHORTSWORD_DEFINITION.id}`);

