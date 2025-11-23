/**
 * BattleStateManager - Centralized coordinator for all battle systems
 * 
 * PURPOSE:
 * - Single entry point for all battle operations
 * - Coordinates between store, managers, and entities
 * - Provides unified API for common operations
 * - Makes it easy to add new systems and features
 * 
 * BENEFITS:
 * - Clear data flow and dependencies
 * - Easier debugging (all operations go through here)
 * - Better testing (mock this instead of multiple managers)
 * - Future-proof for new features (items, buffs, stages)
 */

import type { Game } from '../../types/game';
import { useMultiGameStore } from '../../store/multiGameStore';
import { castleManager } from '../managers/CastleManager';
import { gridManager } from '../managers/GridManager';
import { collisionManager } from '../managers/CollisionManager';
import { pixiManager } from '../managers/PixiManager';
import { projectilePool } from '../entities/projectiles/ProjectilePool';
import type { BaseProjectile } from '../entities/projectiles/BaseProjectile';

/**
 * Context for a single battle - all systems needed to run it
 */
interface BattleSystemsContext {
  battleId: string;
  game: Game;
  initialized: boolean;
}

/**
 * Centralized battle state manager
 */
class BattleStateManager {
  private battles: Map<string, BattleSystemsContext> = new Map();

  /**
   * Register a new battle with all its systems
   */
  registerBattle(battleId: string, game: Game): void {
    if (this.battles.has(battleId)) {
      console.warn(`[BattleStateManager] Battle ${battleId} already registered`);
      return;
    }

    const context: BattleSystemsContext = {
      battleId,
      game,
      initialized: false,
    };

    this.battles.set(battleId, context);
    console.log(`[BattleStateManager] Registered battle: ${battleId}`);
  }

  /**
   * Initialize all systems for a battle
   * Called after PixiJS container is ready
   */
  initializeBattle(battleId: string): void {
    const context = this.battles.get(battleId);
    if (!context) {
      console.error(`[BattleStateManager] Battle ${battleId} not registered`);
      return;
    }

    if (context.initialized) {
      console.warn(`[BattleStateManager] Battle ${battleId} already initialized`);
      return;
    }

    // Initialize battle in store (creates HP tracking and defense dots)
    const store = useMultiGameStore.getState();
    store.initializeBattle(battleId, context.game);

    context.initialized = true;
    console.log(`[BattleStateManager] Initialized battle: ${battleId}`);
  }

  /**
   * Get battle context
   */
  getBattle(battleId: string): BattleSystemsContext | undefined {
    return this.battles.get(battleId);
  }

  /**
   * Check if battle is registered
   */
  hasBattle(battleId: string): boolean {
    return this.battles.has(battleId);
  }

  /**
   * Check if battle is initialized
   */
  isBattleInitialized(battleId: string): boolean {
    return this.battles.get(battleId)?.initialized ?? false;
  }

  /**
   * Unregister a battle and clean up all systems
   */
  unregisterBattle(battleId: string): void {
    const context = this.battles.get(battleId);
    if (!context) return;

    // Clean up store
    const store = useMultiGameStore.getState();
    store.resetBattle(battleId);

    // Clean up collision manager
    collisionManager.unregisterBattle(battleId);

    // Remove from battles map
    this.battles.delete(battleId);

    console.log(`[BattleStateManager] Unregistered battle: ${battleId}`);
  }

  /**
   * Get all active battles
   */
  getAllBattles(): BattleSystemsContext[] {
    return Array.from(this.battles.values());
  }

  /**
   * Get battle count
   */
  getBattleCount(): number {
    return this.battles.size;
  }
}

// Export singleton instance
export const battleStateManager = new BattleStateManager();

