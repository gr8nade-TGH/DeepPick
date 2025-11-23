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
import type { Position, StatType } from '../../types/game';
import { battleEventBus } from '../events/EventBus';
import type { DefenseOrbDestroyedPayload, OpponentOrbDestroyedPayload, ProjectileCollisionPayload } from '../events/types';
import { gridManager } from './GridManager';

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

          // Emit PROJECTILE_COLLISION event for both sides
          battleEventBus.emit('PROJECTILE_COLLISION', {
            side: projectile.side,
            opponentSide: opposingProjectile.side,
            quarter: 1, // TODO: Track actual quarter
            battleId: projectile.gameId,
            gameId: projectile.gameId,
            projectileId: projectile.id,
            otherProjectileId: opposingProjectile.id,
            lane: projectile.stat
          } as ProjectileCollisionPayload);

          battleEventBus.emit('PROJECTILE_COLLISION', {
            side: opposingProjectile.side,
            opponentSide: projectile.side,
            quarter: 1, // TODO: Track actual quarter
            battleId: opposingProjectile.gameId,
            gameId: opposingProjectile.gameId,
            projectileId: opposingProjectile.id,
            otherProjectileId: projectile.id,
            lane: opposingProjectile.stat
          } as ProjectileCollisionPayload);

          return 'projectile';
        }
      }
    }

    // Priority 2: GRID-BASED defense orb collision
    // Get which defense cell the projectile is currently in
    const targetSide = projectile.side === 'left' ? 'right' : 'left'; // Projectile hits OPPONENT's defense
    const cell = gridManager.getDefenseCellAtPosition(
      projectile.position.x,
      projectile.position.y,
      projectile.stat as StatType,
      targetSide
    );

    if (cell) {
      console.log(`🎯 [GRID CHECK] Projectile ${projectile.id} is in cell ${cell.id} at X=${projectile.position.x.toFixed(1)}`);

      // Check if this cell has a defense orb
      const targetDot = this.findDefenseDotInCell(projectile.gameId, cell.id);

      if (targetDot && targetDot.alive) {
        console.log(`💥 [COLLISION!] Projectile ${projectile.id} hit defense orb ${targetDot.id} in cell ${cell.id}`);

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

        // Emit DEFENSE_ORB_DESTROYED event if orb was destroyed
        if (hpAfter === 0) {
          const dotSide = targetDot.side;
          const opponentSide = dotSide === 'left' ? 'right' : 'left';

          // Emit for the side that LOST the orb
          battleEventBus.emit('DEFENSE_ORB_DESTROYED', {
            side: dotSide,
            opponentSide,
            quarter: 1, // TODO: Track actual quarter
            battleId: projectile.gameId,
            gameId: projectile.gameId,
            lane: projectile.stat,
            orbId: targetDot.id,
            destroyedByProjectileId: projectile.id
          } as DefenseOrbDestroyedPayload);

          // Emit for the side that DESTROYED the orb
          battleEventBus.emit('OPPONENT_ORB_DESTROYED', {
            side: opponentSide,
            opponentSide: dotSide,
            quarter: 1, // TODO: Track actual quarter
            battleId: projectile.gameId,
            gameId: projectile.gameId,
            lane: projectile.stat,
            orbId: targetDot.id,
            destroyedByProjectileId: projectile.id
          } as OpponentOrbDestroyedPayload);
        }

        return 'defense';
      }
    }

    return null; // No collision
  }

  /**
   * Find a defense dot in a specific grid cell
   * Much simpler than distance-based collision!
   */
  private findDefenseDotInCell(gameId: string, cellId: string): DefenseDot | null {
    const getDotsForGame =
      this.battleDefenseDotSources.get(gameId) ?? this.getDefenseDotsFromStore;

    if (!getDotsForGame) {
      console.warn(`⚠️ getDefenseDotsFromStore callback not set for gameId=${gameId}!`);
      return null;
    }

    const freshDots = getDotsForGame();

    // Find a dot with matching cellId
    for (const [dotId, dot] of freshDots.entries()) {
      if (dot.cellId === cellId && dot.alive) {
        return dot;
      }
    }

    return null;
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

    // 🔍 DEBUG: Log projectile position and all defense orbs
    console.log(`🎯 [FIND DOT] Projectile ${projectile.id} at X=${projectile.position.x.toFixed(1)}, Y=${projectile.position.y.toFixed(1)} | Side=${projectile.side}, Stat=${projectile.stat}`);

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

    // Only log if we have issues finding dots
    if (!targetDot && aliveDots > 0) {
      console.warn(`⚠️ [FIND DOT] ${projectile.id} (${projectile.side}, X=${projectile.position.x.toFixed(1)}) | ${aliveDots} alive dots but NONE in path! | Eligible: [${eligibleDots.join(', ')}] | Behind: ${behindProjectile}`);
    } else if (targetDot) {
      const distance = Math.abs(projectile.position.x - targetDot.position.x);
      if (distance > 50) {
        console.warn(`⚠️ [FIND DOT] ${projectile.id} (${projectile.side}, X=${projectile.position.x.toFixed(1)}) | Found ${targetDot.id} but it's ${distance.toFixed(1)}px away! | Eligible: [${eligibleDots.join(', ')}]`);
      }
    }

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

