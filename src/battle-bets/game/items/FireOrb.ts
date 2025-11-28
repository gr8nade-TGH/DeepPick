/**
 * Fire Orb Item System - VERSION 4.0
 *
 * Triggers when any of your team's stat rows loses all defense dots.
 * Effect: Fires projectiles from ALL 5 stat rows simultaneously, each dealing 2 damage.
 */

import type { StatType } from '../../types/game';
import { pixiManager } from '../managers/PixiManager';
import { gridManager } from '../managers/GridManager';
import { projectilePool } from '../entities/projectiles/ProjectilePool';
import { collisionManager } from '../managers/CollisionManager';
import { useMultiGameStore } from '../../store/multiGameStore';
import { getProjectileType } from '../../types/projectileTypes';
import * as PIXI from 'pixi.js';

const FIRE_ORB_VERSION = '4.0-FINAL';

/**
 * Fire projectiles from all 5 stat rows when Fire Orb is triggered
 * RENAMED TO BREAK CACHE
 */
export async function fireFireOrbProjectilesV4(side: 'left' | 'right'): Promise<void> {
  console.log(` [FIRE ORB ${FIRE_ORB_VERSION}] Firing from all stat rows on ${side} side`);

  // Step 1: Make the Fire Orb glow in inventory
  await glowFireOrbInInventory(side);

  // Step 2: Fire projectiles from all 5 stat rows simultaneously
  const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
  console.log(` [${FIRE_ORB_VERSION}] Stats array:`, stats);

  // Fire all projectiles at once (not sequentially)
  const projectilePromises = stats.map(stat => {
    console.log(` [${FIRE_ORB_VERSION}] Firing projectile for stat: ${stat}`);
    return fireFireProjectile(stat, side);
  });

  // Wait for all projectiles to complete
  await Promise.all(projectilePromises);

  console.log(` [${FIRE_ORB_VERSION}] Fire Orb: All projectiles fired from ${side} side`);
}

/**
 * Make the Fire Orb item glow in the inventory before firing
 */
async function glowFireOrbInInventory(side: 'left' | 'right'): Promise<void> {
  console.log(` Fire Orb glowing on ${side} side...`);

  // Dispatch custom event to trigger React component pulsing animation
  const event = new CustomEvent('fire-orb-activated', { detail: { side } });
  window.dispatchEvent(event);

  const container = pixiManager.getContainer();
  if (!container) return;

  // Find the castle to get its position
  const castleId = side === 'left' ? 'castle-left' : 'castle-right';
  const castle = container.getChildByName(castleId);
  if (!castle) {
    console.error(`❌ Castle ${castleId} not found`);
    return;
  }

  // Calculate Fire Orb item slot position
  // Fire Orb is in slot2 (index 1), which is the middle slot
  // Slot positions relative to castle center:
  // - Left castle: x = -135, Right castle: x = 105
  // - Slot 1 (Fire Orb): y = -50 (relative to castle center)
  const slotOffsetX = side === 'left' ? -135 : 105;
  const slotOffsetY = -50; // Slot 1 (Fire Orb) position

  const x = castle.x + slotOffsetX;
  const y = castle.y + slotOffsetY;

  // Create a glowing effect overlay
  const glowEffect = new PIXI.Graphics();
  glowEffect.circle(0, 0, 20);
  glowEffect.fill({ color: 0xff4444, alpha: 0 });
  glowEffect.name = `fire-orb-glow-${side}`;

  glowEffect.position.set(x, y);
  container.addChild(glowEffect);

  // Animate the glow (fade in and pulse)
  const startTime = Date.now();
  const duration = 500; // 500ms glow animation

  return new Promise<void>((resolve) => {
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Pulse effect: fade in, then pulse
      const alpha = Math.sin(progress * Math.PI * 4) * 0.6 + 0.4;
      const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.3;

      glowEffect.clear();
      glowEffect.circle(0, 0, 20 * scale);
      glowEffect.fill({ color: 0xff4444, alpha });
      glowEffect.stroke({ width: 2, color: 0xff8844, alpha: alpha * 0.8 });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Remove glow effect
        container.removeChild(glowEffect);
        glowEffect.destroy();
        resolve();
      }
    };

    animate();
  });
}

/**
 * Fire a single Fire projectile from a stat row
 * Deals 2 damage (breaks 2/3 of a defense orb, or destroys 1 orb if it's down to 1/3 HP)
 */
async function fireFireProjectile(stat: StatType, side: 'left' | 'right'): Promise<void> {
  console.log(` [${FIRE_ORB_VERSION}] fireFireProjectile called with stat='${stat}', side='${side}'`);

  const multiStore = useMultiGameStore.getState();
  // For now, Fire Orb uses the first available battle as its context.
  const [battleId] = Array.from(multiStore.battles.keys());
  if (!battleId) {
    console.warn(`[${FIRE_ORB_VERSION}] No active battles found; skipping Fire Orb projectile.`);
    return;
  }

  const gameId = battleId;

  // Get weapon slot positions
  console.log(` [${FIRE_ORB_VERSION}] Getting weapon slot position for stat='${stat}', side='${side}'`);
  const startPosition = gridManager.getWeaponSlotPosition(stat, side);
  const targetSide = side === 'left' ? 'right' : 'left';
  console.log(` [${FIRE_ORB_VERSION}] Getting target weapon slot position for stat='${stat}', side='${targetSide}'`);
  const targetPosition = gridManager.getWeaponSlotPosition(stat, targetSide);

  // Create Fire projectile with custom config
  const projectileId = `fire-orb-${stat}-${side}-${Date.now()}`;
  const typeConfig = getProjectileType(stat);

  // Guard against undefined typeConfig (should never happen with correct stats array)
  if (!typeConfig) {
    console.error(` [${FIRE_ORB_VERSION}] No projectile type config found for stat: ${stat}`);
    return;
  }

  // Override type config for Fire Orb (2 damage, red color, larger size, slow speed)
  const fireOrbConfig = {
    ...typeConfig,
    damage: 2, // Fire Orb deals 2 damage
    color: 0xff4444, // Red/orange fire color
    glowColor: 0xff8844,
    trailColor: 0xffaa77,
    size: { width: 24, height: 12 }, // Bigger fire projectiles
    baseSpeed: 8, // Slow, consistent speed for all fire projectiles (8 grid cells/sec)
  };

  const config = {
    id: projectileId,
    gameId,
    stat,
    side,
    startPosition,
    targetPosition,
    typeConfig: fireOrbConfig,
  };

  const projectile = projectilePool.acquire(config);

  // Set collision check callback
  projectile.onCollisionCheck = (proj) => collisionManager.checkCollisions(proj);

  // Register projectile
  collisionManager.registerProjectile(projectile);
  multiStore.addProjectile(gameId, projectile);

  // Add sprite to PixiJS container
  pixiManager.addSprite(projectile.sprite, 'projectile');

  console.log(` Fired Fire projectile from ${stat} row (${side} side) - 2 damage`);

  // Animate projectile to target
  await projectile.animateToTarget();

  // Hide sprite
  projectile.sprite.visible = false;

  // Handle impact
  if (projectile.collidedWith === 'defense') {
    // Hit defense dot - damage already applied
    console.log(` Fire projectile hit defense dot`);
  } else if (!projectile.collidedWith) {
    // Hit weapon slot - damage capper HP
    multiStore.applyDamageToCapperHP(gameId, targetSide, 2); // Fire Orb deals 2 damage to HP
    console.log(` Fire projectile hit weapon slot - 2 HP damage`);
  }

  // Create impact effect
  createCollisionEffect(projectile.sprite.x, projectile.sprite.y, fireOrbConfig.color);

  // Keep impact visible briefly
  await new Promise(resolve => setTimeout(resolve, 150));

  // Cleanup
  pixiManager.removeSprite(projectile.sprite);
  multiStore.removeProjectile(gameId, projectile.id);
  collisionManager.unregisterProjectile(projectile.id);
  projectilePool.release(projectile);
}

/**
 * Create collision effect (X mark) when projectile hits
 */
function createCollisionEffect(x: number, y: number, color: number): void {
  const container = pixiManager.getContainer();
  if (!container) return;

  const collision = new PIXI.Graphics();

  // Draw X mark
  collision.moveTo(-5, -5);
  collision.lineTo(5, 5);
  collision.moveTo(5, -5);
  collision.lineTo(-5, 5);
  collision.stroke({ width: 2, color, alpha: 0.8 });

  collision.position.set(x, y);
  container.addChild(collision);

  // Fade out and remove
  setTimeout(() => {
    container.removeChild(collision);
    collision.destroy();
  }, 200);
}
