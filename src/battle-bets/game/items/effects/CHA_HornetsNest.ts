/**
 * CHA_HornetsNest.ts
 *
 * Hornets' Nest - Charlotte Hornets Power Item (Defense)
 *
 * Description:
 * When one of your defense orbs is destroyed, fire 1-3 retaliatory projectiles
 * from that stat row. If that was the LAST orb in that row, fire an additional
 * 1-5 bonus projectiles on top.
 *
 * Roll Ranges:
 * - retaliationSize: 1-3 (projectiles per orb destroyed)
 * - lastOrbBonus: 1-5 (extra projectiles when last orb in row destroyed)
 *
 * Quality Tiers:
 * - Warped: Low rolls (e.g., 1 retaliation, +1 last-orb)
 * - Balanced: Average rolls (e.g., 2 retaliation, +3 last-orb)
 * - Honed: Good rolls (e.g., 2-3 retaliation, +4 last-orb)
 * - Masterwork: Perfect rolls (e.g., 3 retaliation, +5 last-orb)
 */

import { battleEventBus } from '../../events/EventBus';
import { itemEffectRegistry } from '../ItemEffectRegistry';
import type { ItemRuntimeContext } from '../ItemEffectRegistry';
import type { ItemDefinition } from '../ItemRollSystem';
import type { DefenseOrbDestroyedPayload } from '../../events/types';
import { useMultiGameStore } from '../../../store/multiGameStore';
import { gridManager } from '../../managers/GridManager';
import { collisionManager } from '../../managers/CollisionManager';
import { pixiManager } from '../../managers/PixiManager';
import { projectilePool } from '../../entities/projectiles/ProjectilePool';
import { getProjectileType } from '../../../types/projectileTypes';
import type { StatType } from '../../../types/game';
import { attackNodeQueueManager } from '../../managers/AttackNodeQueueManager';

/**
 * Item definition for CHA Hornets' Nest
 */
export const CHA_HORNETS_NEST_DEFINITION: ItemDefinition = {
  id: 'CHA_def_hornets_nest',
  team: 'CHA',
  teamName: 'Charlotte Hornets',
  slot: 'defense',
  name: "Hornets' Nest",
  description: "When a defense orb is destroyed, fire 1-3 retaliatory projectiles from that row. If it's the last orb in that row, fire an additional 1-5 projectiles.",
  icon: '🐝',
  rollRanges: {
    retaliationSize: { min: 1, max: 3, step: 1 },
    lastOrbBonus: { min: 1, max: 5, step: 1 },
  },
};

/**
 * Register Hornets' Nest effect
 */
export function registerHornetsNestEffect(context: ItemRuntimeContext): void {
  const { itemInstanceId, gameId, side, rolls } = context;
  const { retaliationSize, lastOrbBonus } = rolls;

  console.log(`🐝🐝🐝 [HornetsNest] REGISTERING EFFECT for ${side} side in game ${gameId}`);
  console.log(`🐝 [HornetsNest] Retaliation: ${retaliationSize} projectiles, Last-Orb Bonus: +${lastOrbBonus}`);

  // DEFENSE_ORB_DESTROYED: Fire retaliatory projectiles
  battleEventBus.on('DEFENSE_ORB_DESTROYED', (payload: DefenseOrbDestroyedPayload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    const lane = payload.lane as StatType;
    console.log(`🐝 [HornetsNest] Defense orb destroyed in ${lane.toUpperCase()} row! Firing retaliation...`);

    // Count remaining alive orbs in this lane BEFORE this orb was destroyed
    // (The orb is already marked as dead when we receive this event)
    const battle = useMultiGameStore.getState().battles.get(gameId);
    if (!battle) {
      console.error(`❌ [HornetsNest] Battle not found: ${gameId}`);
      return;
    }

    // Count alive orbs in this lane
    const aliveOrbsInLane = Array.from(battle.defenseDots.values()).filter(
      dot => dot.stat === lane && dot.side === side && dot.alive
    ).length;

    const isLastOrb = aliveOrbsInLane === 0;
    console.log(`🐝 [HornetsNest] Remaining orbs in ${lane}: ${aliveOrbsInLane} (isLastOrb: ${isLastOrb})`);

    // Calculate total projectiles to fire
    let totalProjectiles = retaliationSize;
    if (isLastOrb) {
      totalProjectiles += lastOrbBonus;
      console.log(`🐝🐝🐝 [HornetsNest] LAST ORB DESTROYED! Firing ${retaliationSize} + ${lastOrbBonus} = ${totalProjectiles} projectiles!`);
    }

    // Queue retaliatory projectiles
    for (let i = 0; i < totalProjectiles; i++) {
      attackNodeQueueManager.enqueueProjectile(
        gameId,
        side,
        lane,
        () => fireRetaliationProjectile(gameId, side, lane),
        'ITEM',
        CHA_HORNETS_NEST_DEFINITION.id
      );
    }

    // Track total retaliation projectiles
    const totalFired = itemEffectRegistry.incrementCounter(itemInstanceId, 'totalRetaliationFired', totalProjectiles);
    console.log(`✅ [HornetsNest] Queued ${totalProjectiles} retaliation projectiles! Total fired: ${totalFired}`);
  });

  console.log(`✅ [HornetsNest] Effect registered for ${side} (${itemInstanceId})`);
}

/**
 * Fire a single retaliation projectile
 */
async function fireRetaliationProjectile(
  gameId: string,
  side: 'left' | 'right',
  lane: StatType
): Promise<void> {
  console.log(`🐝 [HornetsNest] Firing retaliation projectile from ${lane.toUpperCase()} on ${side}`);

  const multiStore = useMultiGameStore.getState();
  const targetSide = side === 'left' ? 'right' : 'left';

  const startPosition = gridManager.getWeaponSlotPosition(lane, side);
  const targetPosition = gridManager.getWeaponSlotPosition(lane, targetSide);

  const projectileId = `hornets-${lane}-${side}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const typeConfig = getProjectileType(lane);

  const config = { id: projectileId, gameId, stat: lane, side, startPosition, targetPosition, typeConfig };
  const projectile = projectilePool.acquire(config);

  projectile.onCollisionCheck = (proj) => collisionManager.checkCollisions(proj);
  collisionManager.registerProjectile(projectile);
  multiStore.addProjectile(gameId, projectile);
  pixiManager.addSprite(projectile.sprite, 'projectile', gameId);

  battleEventBus.emit('PROJECTILE_FIRED', {
    side, opponentSide: targetSide, quarter: 1, battleId: gameId, gameId, lane,
    projectileId, source: 'ITEM', isExtraFromItem: true, itemId: CHA_HORNETS_NEST_DEFINITION.id,
  });

  await new Promise(resolve => setTimeout(resolve, 50));
  await projectile.animateToTarget();
  projectile.sprite.visible = false;

  if (!projectile.collidedWith) {
    multiStore.applyDamageToCapperHP(gameId, targetSide, 1);
    console.log(`🐝 [HornetsNest] Retaliation hit castle - 1 HP damage!`);
  }

  pixiManager.removeSprite(projectile.sprite);
  multiStore.removeProjectile(gameId, projectile.id);
  collisionManager.unregisterProjectile(projectile.id);
  projectilePool.release(projectile);
}

/**
 * Auto-register this item effect
 */
itemEffectRegistry.registerEffect(
  CHA_HORNETS_NEST_DEFINITION.id,
  registerHornetsNestEffect
);

console.log(`📦 [HornetsNest] Item effect registered: ${CHA_HORNETS_NEST_DEFINITION.id}`);

