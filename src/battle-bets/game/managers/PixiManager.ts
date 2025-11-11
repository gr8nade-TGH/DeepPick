/**
 * PixiManager - Global reference to PixiJS container for projectile rendering
 * This allows the simulation system to add projectile sprites directly to the container
 */

import * as PIXI from 'pixi.js';

class PixiManager {
  private static instance: PixiManager;
  private container: PIXI.Container | null = null;
  private app: PIXI.Application | null = null;

  private constructor() {}

  public static getInstance(): PixiManager {
    if (!PixiManager.instance) {
      PixiManager.instance = new PixiManager();
    }
    return PixiManager.instance;
  }

  public setApp(app: PIXI.Application): void {
    this.app = app;
    console.log('✅ PixiManager: App reference set');
  }

  public getApp(): PIXI.Application | null {
    return this.app;
  }

  public setContainer(container: PIXI.Container): void {
    this.container = container;
    console.log('✅ PixiManager: Container reference set');
  }

  public getContainer(): PIXI.Container | null {
    return this.container;
  }

  public addSprite(sprite: PIXI.Container, name?: string): void {
    if (!this.container) {
      console.error('❌ PixiManager: No container set! Cannot add sprite.');
      return;
    }

    if (name) {
      sprite.name = name;
    }

    this.container.addChild(sprite);
    console.log(`✅ PixiManager: Added sprite ${name || sprite.name || 'unnamed'} to container`);
  }

  public removeSprite(sprite: PIXI.Container): void {
    if (!this.container) {
      console.error('❌ PixiManager: No container set! Cannot remove sprite.');
      return;
    }

    this.container.removeChild(sprite);
  }
}

export const pixiManager = PixiManager.getInstance();

