/**
 * CastleManager - Manages castle entities for all cappers in the game
 */

import * as PIXI from 'pixi.js';
import { Castle } from '../entities/Castle';
import type { CastleData } from '../../types/game';

export class CastleManager {
  private castles: Map<string, Castle> = new Map();
  private container: PIXI.Container | null = null;

  /**
   * Set the PixiJS container for rendering castles
   */
  public setContainer(container: PIXI.Container): void {
    this.container = container;
  }

  /**
   * Create and add a castle to the scene
   */
  public async addCastle(config: CastleData): Promise<Castle | null> {
    if (!this.container) {
      console.error('❌ CastleManager: Container not set');
      return null;
    }

    // Check if castle already exists
    if (this.castles.has(config.id)) {
      console.warn(`⚠️ Castle ${config.id} already exists`);
      return this.castles.get(config.id) || null;
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

    // Add castle container to scene
    this.container.addChild(castle.container);

    // Store castle reference
    this.castles.set(config.id, castle);

    console.log(`✅ Castle ${config.id} added to scene`);
    return castle;
  }

  /**
   * Get castle by ID
   */
  public getCastle(id: string): Castle | undefined {
    return this.castles.get(id);
  }

  /**
   * Get castle by capper ID
   */
  public getCastleByCapperId(capperId: string): Castle | undefined {
    for (const castle of this.castles.values()) {
      if (castle.capperId === capperId) {
        return castle;
      }
    }
    return undefined;
  }

  /**
   * Update castle HP
   */
  public damageCastle(castleId: string, damage: number): void {
    const castle = this.castles.get(castleId);
    if (castle) {
      castle.takeDamage(damage);
    }
  }

  /**
   * Heal castle
   */
  public healCastle(castleId: string, amount: number): void {
    const castle = this.castles.get(castleId);
    if (castle) {
      castle.heal(amount);
    }
  }

  /**
   * Remove castle from scene
   */
  public removeCastle(id: string): void {
    const castle = this.castles.get(id);
    if (castle) {
      castle.cleanup();
      this.castles.delete(id);
      console.log(`🗑️ Castle ${id} removed`);
    }
  }

  /**
   * Remove all castles
   */
  public clear(): void {
    for (const castle of this.castles.values()) {
      castle.cleanup();
    }
    this.castles.clear();
    console.log('🗑️ All castles cleared');
  }

  /**
   * Get all castles
   */
  public getAllCastles(): Castle[] {
    return Array.from(this.castles.values());
  }
}

// Singleton instance
export const castleManager = new CastleManager();

