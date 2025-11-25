/**
 * AttackNode entity - Represents an attack node (weapon ball) in the battle grid
 * Uses Figma-designed SVG sprite for visual representation
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import type { Position, Team, StatType } from '../../types/game';
import { loadAttackNodeTexture } from '../assets/IconTextureLoader';

export interface AttackNodeConfig {
  id: string;
  gameId: string;
  stat: StatType;
  side: 'left' | 'right';
  position: Position;
  team: Team;
}

export class AttackNode {
  // Identity
  public readonly id: string;
  public readonly gameId: string;
  public readonly stat: StatType;
  public readonly side: 'left' | 'right';

  // Visual
  public readonly team: Team;
  public readonly position: Position;
  public sprite: PIXI.Container; // Container holding the SVG sprite
  private iconSprite: PIXI.Sprite | null = null; // The actual icon sprite
  public readonly radius: number = 16; // Icon size (32px / 2)

  constructor(config: AttackNodeConfig) {
    this.id = config.id;
    this.gameId = config.gameId;
    this.stat = config.stat;
    this.side = config.side;
    this.position = config.position;
    this.team = config.team;

    // Create sprite (async loading handled internally)
    this.sprite = this.createSprite();
  }

  /**
   * Create Figma SVG sprite for attack node
   */
  private createSprite(): PIXI.Container {
    const container = new PIXI.Container();
    container.x = this.position.x;
    container.y = this.position.y;

    // Load the icon texture asynchronously
    this.loadIcon();

    return container;
  }

  /**
   * Load the attack node icon texture with team color
   */
  private async loadIcon(): Promise<void> {
    try {
      // Convert team color number to hex string
      const teamColorHex = `#${this.team.color.toString(16).padStart(6, '0')}`;

      // Load texture
      const texture = await loadAttackNodeTexture(teamColorHex);

      // Create sprite
      this.iconSprite = new PIXI.Sprite(texture);
      this.iconSprite.anchor.set(0.5, 0.5); // Center the sprite
      this.iconSprite.width = 24; // Slightly smaller than defense orbs
      this.iconSprite.height = 24;

      // Add to container
      this.sprite.addChild(this.iconSprite);

      console.log(`✅ [AttackNode] Loaded icon for ${this.id}`);
    } catch (error) {
      console.error(`❌ [AttackNode] Failed to load icon for ${this.id}:`, error);

      // Fallback: create a simple circle (original weapon ball design)
      const fallback = this.createFallbackGraphics();
      this.sprite.addChild(fallback);
    }
  }

  /**
   * Create fallback graphics if SVG fails to load
   */
  private createFallbackGraphics(): PIXI.Graphics {
    const graphics = new PIXI.Graphics();
    const ballRadius = 10;
    const color = this.team.color;

    // Outer glow
    graphics.circle(0, 0, ballRadius + 4);
    graphics.fill({ color: color, alpha: 0.3 });

    // Middle layer
    graphics.circle(0, 0, ballRadius + 2);
    graphics.fill({ color: color, alpha: 0.6 });

    // Core
    graphics.circle(0, 0, ballRadius);
    graphics.fill({ color: color, alpha: 1.0 });

    // Inner highlight
    graphics.circle(-2, -2, ballRadius / 3);
    graphics.fill({ color: 0xffffff, alpha: 0.6 });

    return graphics;
  }

  /**
   * Animate activation (when firing projectile)
   */
  public animateActivation(): void {
    if (!this.iconSprite) return;

    // Pulse animation
    gsap.timeline()
      .to(this.sprite.scale, {
        x: 1.3,
        y: 1.3,
        duration: 0.15,
        ease: 'power2.out',
      })
      .to(this.sprite.scale, {
        x: 1,
        y: 1,
        duration: 0.2,
        ease: 'elastic.out(1, 0.5)',
      });

    // Glow flash
    gsap.timeline()
      .to(this.iconSprite, {
        alpha: 1.5,
        duration: 0.1,
      })
      .to(this.iconSprite, {
        alpha: 1.0,
        duration: 0.2,
      });
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    gsap.killTweensOf(this.sprite);
    gsap.killTweensOf(this.sprite.scale);
    if (this.iconSprite) {
      gsap.killTweensOf(this.iconSprite);
    }
    this.sprite.destroy();
  }
}

