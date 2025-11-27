/**
 * CastleManager - Manages castle entities for all cappers in the game
 */

import * as PIXI from 'pixi.js';
import { Castle } from '../entities/Castle';
import type { CastleData } from '../../types/game';
import { debugLogger } from '../debug/DebugLogger';

interface BattleCastleMap {
  [castleId: string]: Castle;
}

export class CastleManager {
  // Per-battle castle collections so multiple battles can render at once
  private battles: Map<string, BattleCastleMap> = new Map();
  // Per-battle Pixi containers (similar pattern to PixiManager)
  private containers: Map<string, PIXI.Container> = new Map();

  /**
   * Register the PixiJS container for a specific battle
   */
  public setContainer(container: PIXI.Container, battleId: string): void {
    this.containers.set(battleId, container);
  }

  /**
   * Create and add a castle to the scene for a specific battle
   */
  public async addCastle(battleId: string, config: CastleData): Promise<Castle | null> {
    const container = this.containers.get(battleId);
    if (!container) {
      console.error(`❌ CastleManager: Container not set for battle ${battleId}`);
      return null;
    }

    // Ensure battle map exists
    let battleCastles = this.battles.get(battleId);
    if (!battleCastles) {
      battleCastles = {};
      this.battles.set(battleId, battleCastles);
    }

    // Check if castle already exists
    if (battleCastles[config.id]) {
      console.warn(`⚠️ Castle ${config.id} already exists in battle ${battleId}`);
      return battleCastles[config.id];
    }

    // Create castle instance
    const castle = new Castle({
      id: config.id,
      capperId: config.capperId,
      capperName: config.capperName || 'Unknown',
      capperRank: config.capperRank,
      capperLevel: config.capperLevel,
      position: config.position || { x: 0, y: 0 },
      maxHP: config.maxHP,
      currentHP: config.currentHP,
      scale: config.scale,
      boxWidth: config.boxWidth,
      side: config.side,
    });

    // Load castle sprite
    await castle.load();

    // Add castle container to the correct battle container
    container.addChild(castle.container);

    // Store castle reference
    battleCastles[config.id] = castle;

    console.log(`✅ Castle ${config.id} added to scene for battle ${battleId}`);
    return castle;
  }

  /**
   * Get a castle by ID for a given battle
   */
  public getCastle(battleId: string, id: string): Castle | undefined {
    const battleCastles = this.battles.get(battleId);
    return battleCastles ? battleCastles[id] : undefined;
  }

  /**
   * Update castle HP for a given battle
   */
  public damageCastle(battleId: string, castleId: string, damage: number): void {
    const callMsg = `Called with battleId=${battleId}, castleId=${castleId}, damage=${damage}`;
    console.log(`🏰 [CastleManager.damageCastle] ${callMsg}`);
    debugLogger.log('castle-manager', `damageCastle: ${callMsg}`);

    const castle = this.getCastle(battleId, castleId);
    if (castle) {
      const foundMsg = `Castle found! Calling takeDamage(${damage})`;
      console.log(`✅ [CastleManager.damageCastle] ${foundMsg}`);
      debugLogger.log('castle-manager', foundMsg, { battleId, castleId, damage, castleHP: castle.currentHP });
      castle.takeDamage(damage);
    } else {
      const notFoundMsg = `Castle NOT FOUND for battleId=${battleId}, castleId=${castleId}`;
      console.error(`❌ [CastleManager.damageCastle] ${notFoundMsg}`);
      debugLogger.log('castle-manager', `ERROR: ${notFoundMsg}`);

      const availableBattles = Array.from(this.battles.keys());
      console.error(`   Available battles:`, availableBattles);
      debugLogger.log('castle-manager', `Available battles: ${JSON.stringify(availableBattles)}`);

      const battleCastles = this.battles.get(battleId);
      if (battleCastles) {
        const availableCastles = Object.keys(battleCastles);
        console.error(`   Available castles in battle ${battleId}:`, availableCastles);
        debugLogger.log('castle-manager', `Available castles in battle ${battleId}: ${JSON.stringify(availableCastles)}`);
      }
    }
  }

  /**
   * Heal castle for a given battle
   */
  public healCastle(battleId: string, castleId: string, amount: number): void {
    const castle = this.getCastle(battleId, castleId);
    if (castle) {
      castle.heal(amount);
    }
  }

  /**
   * Set castle HP (used by Castle item to override default HP)
   */
  public setCastleHP(battleId: string, castleId: string, hp: number): void {
    const castle = this.getCastle(battleId, castleId);
    if (castle) {
      console.log(`🏰 [CastleManager.setCastleHP] Setting HP for ${castleId} in battle ${battleId} to ${hp}`);
      castle.setHP(hp);
    } else {
      console.warn(`⚠️ [CastleManager.setCastleHP] Castle ${castleId} not found in battle ${battleId}`);
    }
  }

  /**
   * Remove a single castle from a specific battle
   */
  public removeCastle(battleId: string, id: string): void {
    const battleCastles = this.battles.get(battleId);
    if (!battleCastles) return;

    const castle = battleCastles[id];
    if (castle) {
      castle.cleanup();
      delete battleCastles[id];
      console.log(`🗑️ Castle ${id} removed from battle ${battleId}`);
    }
  }

  /**
   * Remove all castles for a specific battle
   */
  public clearBattle(battleId: string): void {
    const battleCastles = this.battles.get(battleId);
    if (battleCastles) {
      Object.values(battleCastles).forEach(castle => castle.cleanup());
      this.battles.delete(battleId);
    }

    const container = this.containers.get(battleId);
    if (container) {
      container.children
        .filter(child => child.name === 'castle')
        .forEach(child => container.removeChild(child));
      this.containers.delete(battleId);
    }

    console.log(`🗑️ All castles cleared for battle ${battleId}`);
  }

  /**
   * Remove all castles for all battles (used on global cleanup)
   */
  public clear(): void {
    this.battles.forEach((battleCastles, battleId) => {
      Object.values(battleCastles).forEach(castle => castle.cleanup());
      console.log(`🗑️ Cleared castles for battle ${battleId}`);
    });
    this.battles.clear();
    this.containers.clear();
    console.log('🗑️ All castles cleared');
  }

  /**
   * Get all castles for a given battle
   */
  public getAllCastles(battleId: string): Castle[] {
    const battleCastles = this.battles.get(battleId);
    return battleCastles ? Object.values(battleCastles) : [];
  }
}

// Singleton instance
export const castleManager = new CastleManager();

