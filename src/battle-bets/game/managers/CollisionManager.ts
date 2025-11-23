/**
 * Collision Manager - Handles real-time collision detection between projectiles and targets
 *
 * ARCHITECTURE:
 * - Projectiles register themselves for collision tracking
 * - Defense dots are fetched FRESH from store on every collision check (not cached)
 * - Damage is applied IMMEDIATELY when collision is detected
 * - Store is the single source of truth for defense dot HP and alive status
 */

import type { BaseProjectile } from '../entities/projectiles/BaseProjectile';
import type { DefenseDot } from '../entities/DefenseDot';
import type { Position } from '../../types/game';

/**
 * Collision detection manager
 */
class CollisionManager {
  // Active projectiles being tracked
  private activeProjectiles: Map<string, BaseProjectile> = new Map();

  // Legacy single-store callbacks (kept for backwards compatibility)
  public onDefenseDotHit?: (dotId: string, damage: number) => void;
  public getDefenseDotsFromStore?: () => Map<string, DefenseDot>;

  // Per-battle callbacks keyed by gameId/battleId
  private battleDefenseHitHandlers: Map<string, (dotId: string, damage: number) => void> = new Map();
  private battleDefenseDotSources: Map<string, () => Map<string, DefenseDot>> = new Map();

  /**
   * Register per-battle collision callbacks
   */
  public registerBattle(
    gameId: string,
    getDefenseDots: () => Map<string, DefenseDot>,
    onDefenseDotHit: (dotId: string, damage: number) => void
  ): void {
    this.battleDefenseDotSources.set(gameId, getDefenseDots);
    this.battleDefenseHitHandlers.set(gameId, onDefenseDotHit);
  }

  /**
   * Unregister per-battle collision callbacks
   */
  public unregisterBattle(gameId: string): void {
    this.battleDefenseDotSources.delete(gameId);
    this.battleDefenseHitHandlers.delete(gameId);
  }

  /**
   * Register a projectile for collision tracking
   */
  public registerProjectile(projectile: BaseProjectile): void {
    this.activeProjectiles.set(projectile.id, projectile);

    // Set the collision check callback
    projectile.onCollisionCheck = (proj) => this.checkCollisions(proj);
  }

  /**
   * Unregister a projectile (when it's destroyed or pooled)
   */
  public unregisterProjectile(projectileId: string): void {
    this.activeProjectiles.delete(projectileId);
  }

  /**
   * Check collisions for a specific projectile
   * Returns what it collided with, or null if no collision
   *
   * COLLISION PRIORITY:
   * 1. Projectile-to-projectile (mid-air collision)
   * 2. Defense dot collision (blocks projectile)
   * 3. No collision (projectile continues)
   */
  public checkCollisions(projectile: BaseProjectile): 'projectile' | 'defense' | null {
    // Priority 1: Check for projectile-to-projectile collision (if enabled for this projectile type)
    if (projectile.typeConfig.canCollideWithProjectiles) {
      const opposingProjectile = this.findOpposingProjectile(projectile);
      if (opposingProjectile) {
        const distance = this.getDistance(projectile.position, opposingProjectile.position);
        const combinedRadius = projectile.typeConfig.collisionRadius + opposingProjectile.typeConfig.collisionRadius;

        if (distance <= combinedRadius) {
          // Mark both projectiles as collided
          opposingProjectile.collided = true;
          opposingProjectile.collidedWith = 'projectile';

          console.log(`⚔️ [PROJECTILE COLLISION] ${projectile.id} ↔ ${opposingProjectile.id}`);
          return 'projectile';
        }
      }
    }

    // Priority 2: Check for defense dot collision
    const targetDot = this.findNearestDefenseDot(projectile);

    if (targetDot) {
      const distance = this.getDistance(projectile.position, targetDot.position);
      // Add a small visual fudge factor so slight overlaps still count as hits
      const collisionRadius = projectile.typeConfig.collisionRadius + targetDot.radius + 4;

      // DEBUG: Log distance calculation details
      const dx = Math.abs(projectile.position.x - targetDot.position.x);
      const dy = Math.abs(projectile.position.y - targetDot.position.y);
      console.log(`📏 [DISTANCE] ${projectile.id} → ${targetDot.id} | dX=${dx.toFixed(1)}, dY=${dy.toFixed(1)}, total=${distance.toFixed(1)}, threshold=${collisionRadius} | ${distance <= collisionRadius ? '✅ HIT!' : '❌ MISS'}`);

      if (distance <= collisionRadius) {
        // Get HP BEFORE damage for accurate logging
        const hpBefore = targetDot.hp;
        const hpAfter = Math.max(0, hpBefore - projectile.typeConfig.damage);

        // IMMEDIATELY apply damage to the store (single source of truth)
        const hitHandler =
          this.battleDefenseHitHandlers.get(projectile.gameId) ?? this.onDefenseDotHit;

        if (hitHandler) {
          hitHandler(targetDot.id, projectile.typeConfig.damage);
        } else {
          console.error(`❌ [COLLISION] onDefenseDotHit callback NOT SET for gameId=${projectile.gameId}!`);
        }

        // Log collision with HP change
        const status = hpAfter === 0 ? '💀 DESTROYED' : `${hpAfter}/${targetDot.maxHp} HP remaining`;
        console.log(`🛡️ [DEFENSE HIT] ${projectile.id} → ${targetDot.id} | ${hpBefore} → ${hpAfter} HP | ${status}`);

        return 'defense';
      }
    }

    return null; // No collision
  }

  /**
   * Find an opposing projectile (same stat, opposite side)
   */
  private findOpposingProjectile(projectile: BaseProjectile): BaseProjectile | null {
    const opposingSide = projectile.side === 'left' ? 'right' : 'left';

    for (const [id, other] of this.activeProjectiles) {
      // Skip self
      if (id === projectile.id) continue;

      // Skip if already collided
      if (other.collided) continue;

      // Must be same stat row and opposite side
      if (other.stat === projectile.stat && other.side === opposingSide) {
        return other;
      }
    }

    return null;
  }

  /**
   * Find the FIRST alive defense dot IN THE PROJECTILE'S PATH
   *
   * CRITICAL: Always gets FRESH data from store to ensure we see latest HP values
   * This is the key to making defense dots work correctly:
   * - Store is the single source of truth for HP and alive status
   * - We query the store on EVERY collision check (not cached)
   * - This ensures we see HP changes from other projectiles immediately
   *
   * LOGIC:
   * - Left projectiles travel RIGHT (increasing X), so find the dot with smallest X that's ahead
   * - Right projectiles travel LEFT (decreasing X), so find the dot with largest X that's ahead
   */
  private findNearestDefenseDot(projectile: BaseProjectile): DefenseDot | null {
    // Get FRESH defense dots from store (not cached copy)
    const getDotsForGame =
      this.battleDefenseDotSources.get(projectile.gameId) ?? this.getDefenseDotsFromStore;

    if (!getDotsForGame) {
      console.warn(
        `⚠️ getDefenseDotsFromStore callback not set for gameId=${projectile.gameId}! Cannot check defense dot collisions.`,
      );
      return null;
    }

    const freshDots = getDotsForGame();
    const targetSide = projectile.side === 'left' ? 'right' : 'left';
    let targetDot: DefenseDot | null = null;
    let targetX = projectile.side === 'left' ? Infinity : -Infinity;

    let totalChecked = 0;
    let aliveDots = 0;
    let deadDots = 0;
    let wrongSide = 0;
    let wrongStat = 0;
    let behindProjectile = 0;

    // DEBUG: Log ALL alive dots for this stat/side to see their X positions
    const eligibleDots: string[] = [];

    for (const [id, dot] of freshDots) {
      totalChecked++;

      // Must be on the target side and same stat row
      if (dot.side !== targetSide) {
        wrongSide++;
        continue;
      }
      if (dot.stat !== projectile.stat) {
        wrongStat++;
        continue;
      }

      // CRITICAL: Must be alive AND have HP > 0
      // This check uses the FRESH data from store, so we see HP changes immediately
      if (!dot.alive || dot.hp <= 0) {
        deadDots++;
        continue;
      }

      aliveDots++;
      eligibleDots.push(`${dot.id}(X:${dot.position.x.toFixed(0)})`);

      // Find the FIRST dot in the projectile's path
      if (projectile.side === 'left') {
        // Left projectile travels RIGHT (increasing X) → find dot with SMALLEST X that's ahead
        if (dot.position.x > projectile.position.x) {
          if (dot.position.x < targetX) {
            targetX = dot.position.x;
            targetDot = dot;
          }
        } else {
          behindProjectile++;
        }
      } else {
        // Right projectile travels LEFT (decreasing X) → find dot with LARGEST X that's ahead
        if (dot.position.x < projectile.position.x) {
          if (dot.position.x > targetX) {
            targetX = dot.position.x;
            targetDot = dot;
          }
        } else {
          behindProjectile++;
        }
      }
    }

    console.log(`🔍 [FIND DOT] ${projectile.id} (${projectile.side}, X=${projectile.position.x.toFixed(1)}) | Eligible dots: [${eligibleDots.join(', ')}] | Found: ${targetDot ? `${targetDot.id} (HP: ${targetDot.hp}, X: ${targetDot.position.x.toFixed(1)})` : 'NONE'}`);

    return targetDot;
  }

  /**
   * Calculate distance between two positions
   */
  private getDistance(pos1: Position, pos2: Position): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Clear all tracked entities (for reset)
   */
  public clear(): void {
    this.activeProjectiles.clear();
    this.battleDefenseDotSources.clear();
    this.battleDefenseHitHandlers.clear();
  }

  /**
   * Get collision info for debugging
   */
  public getDebugInfo(): {
    projectileCount: number;
    defenseDotCount: number;
  } {
    let defenseDotCount = 0;

    if (this.getDefenseDotsFromStore) {
      defenseDotCount = this.getDefenseDotsFromStore().size;
    } else {
      for (const getDots of this.battleDefenseDotSources.values()) {
        defenseDotCount += getDots().size;
      }
    }

    return {
      projectileCount: this.activeProjectiles.size,
      defenseDotCount,
    };
  }
}

// Singleton instance
export const collisionManager = new CollisionManager();

