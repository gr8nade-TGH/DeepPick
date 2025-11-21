/**
 * PixiManager - Global reference to PixiJS apps and containers for projectile rendering
 * Supports multiple simultaneous battles by tracking a container per battleId.
 */

import * as PIXI from 'pixi.js';

class PixiManager {
  private static instance: PixiManager;

  // Backwards-compatible "default" app/container (used by legacy single-game flows)
  private app: PIXI.Application | null = null;
  private container: PIXI.Container | null = null;

  // Multi-battle support: track app + container per battleId
  private apps: Map<string, PIXI.Application> = new Map();
  private containers: Map<string, PIXI.Container> = new Map();

  private constructor() { }

  public static getInstance(): PixiManager {
    if (!PixiManager.instance) {
      PixiManager.instance = new PixiManager();
    }
    return PixiManager.instance;
  }

  /**
   * Register a PixiJS app for a battle.
   * Also updates the default app reference for legacy callers.
   */
  public setApp(app: PIXI.Application, battleId?: string): void {
    if (battleId) {
      this.apps.set(battleId, app);
    }
    this.app = app;
    console.log(`✅ PixiManager: App reference set${battleId ? ` for battle ${battleId}` : ''}`);
  }

  /**
   * Get PixiJS app for a specific battle or the default app.
   */
  public getApp(battleId?: string): PIXI.Application | null {
    if (battleId) {
      const app = this.apps.get(battleId) || null;
      if (app) return app;
    }
    return this.app;
  }

  /**
   * Register a container for a battle.
   * Also updates the default container reference for legacy callers.
   */
  public setContainer(container: PIXI.Container, battleId?: string): void {
    if (battleId) {
      this.containers.set(battleId, container);
    }
    this.container = container;
    console.log(`✅ PixiManager: Container reference set${battleId ? ` for battle ${battleId}` : ''}`);
  }

  /**
   * Get container for a specific battle or the default container.
   */
  public getContainer(battleId?: string): PIXI.Container | null {
    if (battleId) {
      return this.containers.get(battleId) || null;
    }
    return this.container;
  }

  /**
   * Add a sprite to the appropriate container.
   * If battleId is omitted, falls back to the default container.
   */
  public addSprite(sprite: PIXI.Container, name?: string, battleId?: string): void {
    const container = this.getContainer(battleId);
    if (!container) {
      console.error('❌ PixiManager: No container set! Cannot add sprite.');
      return;
    }

    if (name) {
      sprite.name = name;
    }

    container.addChild(sprite);
    console.log(`✅ PixiManager: Added sprite ${name || sprite.name || 'unnamed'} to container${battleId ? ` for battle ${battleId}` : ''}`);
  }

  /**
   * Remove a sprite from the appropriate container.
   * If battleId is omitted, falls back to the default container.
   */
  public removeSprite(sprite: PIXI.Container, battleId?: string): void {
    const container = this.getContainer(battleId);
    if (!container) {
      console.error('❌ PixiManager: No container set! Cannot remove sprite.');
      return;
    }

    container.removeChild(sprite);
  }

  /**
   * Clear stored references for a specific battle (does NOT destroy the app).
   * The owning React component is responsible for destroying the Pixi app.
   */
  public clearBattle(battleId: string): void {
    const container = this.containers.get(battleId) || null;
    const app = this.apps.get(battleId) || null;

    if (container) {
      this.containers.delete(battleId);
      if (this.container === container) {
        this.container = null;
      }
    }

    if (app) {
      this.apps.delete(battleId);
      if (this.app === app) {
        this.app = null;
      }
    }

    console.log(`🧹 PixiManager: Cleared references for battle ${battleId}`);
  }

  /**
   * Clear all stored references (used in rare full-reset scenarios).
   */
  public reset(): void {
    this.apps.clear();
    this.containers.clear();
    this.app = null;
    this.container = null;
    console.log('🧹 PixiManager: Reset all apps and containers');
  }
}

export const pixiManager = PixiManager.getInstance();
