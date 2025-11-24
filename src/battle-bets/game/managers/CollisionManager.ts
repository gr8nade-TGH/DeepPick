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
import { collisionDebugger } from '../debug/CollisionDebugger';

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
   * Get debug snapshot for a specific game
   */
  public getDebugSnapshot(gameId: string): string {
    const getDefenseDots = this.battleDefenseDotSources.get(gameId) ?? this.getDefenseDotsFromStore;
    const defenseDots = getDefenseDots ? getDefenseDots() : new Map();

    return collisionDebugger.generateSnapshot(gameId, this.activeProjectiles, defenseDots);
  }

  /**
   * Check collisions for a specific projectile
   * Returns what it collided with, or null if no collision
   *
   * COLLISION PRIORITY:
   * 1. Projectile-to-projectile (mid-air collision when they cross paths)
   * 2. Defense dot collision (blocks projectile)
   * 3. No collision (projectile continues)
   */
  public checkCollisions(projectile: BaseProjectile): 'projectile' | 'defense' | null {
    // Priority 1: Check for projectile-to-projectile collision (if enabled for this projectile type)
    if (projectile.typeConfig.canCollideWithProjectiles) {
      // Simple path-crossing logic: projectiles on same row traveling toward each other
      // Left projectiles travel right (X increasing), right projectiles travel left (X decreasing)
      // When they cross paths (left.x >= right.x), they collide!

      const opposingSide = projectile.side === 'left' ? 'right' : 'left';

      for (const [id, other] of this.activeProjectiles) {
        // Skip self
        if (id === projectile.id) continue;

        // Skip if already collided
        if (other.collided) continue;

        // Must be same stat row (same Y position) and opposite side
        if (other.stat !== projectile.stat || other.side !== opposingSide) continue;

        // Check if they've crossed paths
        let hasCrossed = false;
        if (projectile.side === 'left') {
          // Left projectile traveling right: has it reached or passed the right projectile?
          hasCrossed = projectile.position.x >= other.position.x;
        } else {
          // Right projectile traveling left: has it reached or passed the left projectile?
          hasCrossed = projectile.position.x <= other.position.x;
        }

        if (hasCrossed) {
          // COLLISION! Mark both projectiles as collided
          other.collided = true;
          other.collidedWith = 'projectile';

          console.log(`⚔️ [PROJECTILE COLLISION] ${projectile.id} (X=${projectile.position.x.toFixed(1)}) ↔ ${other.id} (X=${other.position.x.toFixed(1)})`);

          // Emit PROJECTILE_COLLISION event for both sides
          battleEventBus.emit('PROJECTILE_COLLISION', {
            side: projectile.side,
            opponentSide: other.side,
            quarter: 1, // TODO: Track actual quarter
            battleId: projectile.gameId,
            gameId: projectile.gameId,
            projectileId: projectile.id,
            otherProjectileId: other.id,
            lane: projectile.stat
          } as ProjectileCollisionPayload);

          battleEventBus.emit('PROJECTILE_COLLISION', {
            side: other.side,
            opponentSide: projectile.side,
            quarter: 1, // TODO: Track actual quarter
            battleId: other.gameId,
            gameId: other.gameId,
            projectileId: other.id,
            otherProjectileId: projectile.id,
            lane: other.stat
          } as ProjectileCollisionPayload);

          return 'projectile';
        }
      }
    }

    // Priority 2: GRID-BASED defense orb collision
    // ONLY check for defense orbs when projectile is in the OPPONENT's defense zone!
    const targetSide = projectile.side === 'left' ? 'right' : 'left'; // Projectile hits OPPONENT's defense

    // Get defense zone boundaries from GridManager
    const layout = gridManager.getLayout();
    const leftDefenseEnd = layout.leftDefenseStart + (layout.defenseCells * layout.cellWidth);
    const rightDefenseStart = layout.rightDefenseStart;

    // Check if projectile is in the opponent's defense zone
    let inDefenseZone = false;
    if (projectile.side === 'left') {
      // Left projectile traveling right → check if in RIGHT defense zone
      inDefenseZone = projectile.position.x >= rightDefenseStart;
    } else {
      // Right projectile traveling left → check if in LEFT defense zone
      inDefenseZone = projectile.position.x <= leftDefenseEnd;
    }

    if (!inDefenseZone) {
      // Projectile not in defense zone yet - no collision check needed
      return null;
    }

    // Projectile IS in defense zone - check for defense orb collision
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

        // Log collision event
        collisionDebugger.logCollisionCheck(projectile, cell.id, true, true);

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
      } else {
        // Cell has no orb - log as MISS
        collisionDebugger.logCollisionCheck(projectile, cell.id, false, false);
      }
    } else {
      // Projectile in defense zone but not in a valid cell (shouldn't happen)
      console.warn(`⚠️ Projectile ${projectile.id} in defense zone but no cell found at X=${projectile.position.x.toFixed(1)}`);
      collisionDebugger.logCollisionCheck(projectile, null, false, false);
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

    // DEBUG: Log what we're searching for
    console.log(`🔍 [CELL SEARCH] Looking for cellId="${cellId}" in ${freshDots.size} dots`);

    // DEBUG: Log first 3 dots to see their cellIds
    let count = 0;
    for (const [dotId, dot] of freshDots.entries()) {
      if (count < 3) {
        console.log(`  Sample dot: id="${dotId}", cellId="${dot.cellId}", alive=${dot.alive}`);
        count++;
      }
    }

    // Find a dot with matching cellId
    for (const [dotId, dot] of freshDots.entries()) {
      if (dot.cellId === cellId && dot.alive) {
        console.log(`✅ [CELL SEARCH] FOUND! cellId="${cellId}" matches dot="${dotId}"`);
        return dot;
      }
    }

    console.log(`❌ [CELL SEARCH] NOT FOUND! No dot with cellId="${cellId}"`);
    return null;
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

