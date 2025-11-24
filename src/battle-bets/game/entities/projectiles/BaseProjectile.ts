/**
 * Base Projectile Class - Foundation for all projectile types
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import type { Position, StatType } from '../../../types/game';
import type { ProjectileTypeConfig } from '../../../types/projectileTypes';

export interface BaseProjectileConfig {
  id: string;
  gameId: string;
  stat: StatType;
  side: 'left' | 'right';
  startPosition: Position;
  targetPosition: Position;
  typeConfig: ProjectileTypeConfig;
}

/**
 * Base Projectile class - simple straight-line projectile
 */
export class BaseProjectile {
  // Identity
  public id: string;
  public gameId: string;
  public stat: StatType;
  public side: 'left' | 'right';

  // Type configuration
  public typeConfig: ProjectileTypeConfig;

  // State
  public position: Position;
  public targetPosition: Position;
  public active: boolean = true;
  public collided: boolean = false; // Has this projectile collided with something?
  public collidedWith: 'projectile' | 'defense' | null = null; // What did it collide with?

  // Speed modifiers (can be affected by items/buffs)
  public speedMultiplier: number = 1.0; // 1.0 = normal speed, 1.5 = 50% faster, etc.
  public baseSpeed: number; // Base speed from typeConfig (in grid cells per second)

  // Visual
  public sprite: PIXI.Container;
  public readonly radius: number = 4;

  // Animation
  protected animation: gsap.core.Timeline | null = null;

  // Collision detection callback (set by simulation system)
  public onCollisionCheck?: (projectile: BaseProjectile) => 'projectile' | 'defense' | null;

  constructor(config: BaseProjectileConfig) {
    this.id = config.id;
    this.gameId = config.gameId;
    this.stat = config.stat;
    this.side = config.side;
    this.position = { ...config.startPosition };
    this.targetPosition = config.targetPosition;
    this.typeConfig = config.typeConfig;
    this.baseSpeed = config.typeConfig.baseSpeed;

    // Create sprite
    this.sprite = this.createSprite();
  }

  /**
   * Reset projectile state for object pooling
   * Reuses the sprite instead of creating a new one
   */
  public reset(config: BaseProjectileConfig): void {
    this.id = config.id;
    this.gameId = config.gameId;
    this.stat = config.stat;
    this.side = config.side;
    this.position = { ...config.startPosition };
    this.targetPosition = config.targetPosition;
    this.typeConfig = config.typeConfig;
    this.baseSpeed = config.typeConfig.baseSpeed;
    this.active = true;
    this.collided = false;
    this.collidedWith = null;
    this.speedMultiplier = 1.0;
    this.onCollisionCheck = undefined;

    // Reset sprite state
    this.sprite.x = config.startPosition.x;
    this.sprite.y = config.startPosition.y;
    this.sprite.alpha = 1;
    this.sprite.visible = true;
    // Set scale based on side (flip horizontally for right side)
    this.sprite.scale.set(config.side === 'left' ? 1 : -1, 1);
    this.sprite.rotation = 0;

    // Kill any existing animations
    if (this.animation) {
      this.animation.kill();
      this.animation = null;
    }
    gsap.killTweensOf(this.sprite);
    gsap.killTweensOf(this.sprite.scale);
  }

  /**
   * Cleanup for returning to pool (doesn't destroy sprite)
   */
  public cleanup(): void {
    // Stop animations
    if (this.animation) {
      this.animation.kill();
      this.animation = null;
    }
    gsap.killTweensOf(this.sprite);
    gsap.killTweensOf(this.sprite.scale);

    // Hide sprite
    this.sprite.visible = false;
    this.active = false;

    // Remove from parent but don't destroy
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
  }

  /**
   * Create the visual sprite for this projectile
   * Must be implemented by subclasses
   */
  protected abstract createSprite(): PIXI.Container;

  /**
   * Calculate flight duration based on distance and speed
   * Uses grid-based speed system (cells per second)
   * @param distance - Distance in pixels
   * @param cellWidth - Width of one grid cell in pixels (default 30)
   * @returns Duration in seconds
   */
  public calculateFlightDuration(distance: number, cellWidth: number = 30): number {
    // Convert pixel distance to grid cells
    const distanceInCells = distance / cellWidth;

    // Calculate effective speed (cells per second, modified by multiplier)
    const effectiveSpeed = this.baseSpeed * this.speedMultiplier;

    // Duration = distance / speed
    const duration = distanceInCells / effectiveSpeed;

    return Math.max(0.1, duration); // Minimum 0.1s to prevent instant travel
  }

  /**
   * Get effective speed in cells per second (modified by multiplier)
   */
  public getEffectiveSpeed(): number {
    return this.baseSpeed * this.speedMultiplier;
  }

  /**
   * Set speed multiplier (can be called by items/buffs)
   * 1.0 = normal, 1.5 = 50% faster, 0.5 = 50% slower
   */
  public setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, multiplier); // Minimum 0.1x to prevent instant travel
  }

  /**
   * Animate projectile to target (straight line)
   */
  public async animateToTarget(): Promise<void> {
    return new Promise((resolve) => {
      // Calculate distance to target
      const dx = this.targetPosition.x - this.position.x;
      const dy = this.targetPosition.y - this.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Calculate duration based on grid-based speed system
      const cellWidth = 30; // Standard cell width
      const duration = this.calculateFlightDuration(distance, cellWidth);

      // Straight line animation
      this.animation = gsap
        .timeline()
        .to(this.sprite, {
          x: this.targetPosition.x,
          y: this.targetPosition.y,
          duration,
          ease: 'none',
          onUpdate: () => {
            // Update position for collision detection
            this.position.x = this.sprite.x;
            this.position.y = this.sprite.y;

            // Check for collisions during flight
            if (!this.collided && this.onCollisionCheck) {
              const collisionType = this.onCollisionCheck(this);

              if (collisionType) {
                // Collision detected! Stop the animation
                this.collided = true;
                this.collidedWith = collisionType;

                if (this.animation) {
                  this.animation.kill();
                }

                this.createImpactEffect();
                resolve();
              }
            }
          },
        })
        .call(() => {
          // Only create impact if we haven't collided yet (reached target)
          if (!this.collided) {
            this.createImpactEffect();
          }
          resolve();
        });
    });
  }

  /**
   * Create impact effect when projectile hits target
   */
  protected createImpactEffect(): void {
    const impact = new PIXI.Graphics();

    // Outer explosion ring
    impact.circle(0, 0, 15);
    impact.fill({ color: this.typeConfig.color, alpha: 0.6 });

    // Inner explosion
    impact.circle(0, 0, 8);
    impact.fill({ color: this.typeConfig.glowColor, alpha: 0.8 });

    impact.x = this.sprite.x;
    impact.y = this.sprite.y;

    // Add to parent container
    if (this.sprite.parent) {
      this.sprite.parent.addChild(impact);
    }

    // Animate explosion
    gsap.timeline()
      .to(impact.scale, {
        x: 2,
        y: 2,
        duration: 0.3,
        ease: 'power2.out',
      })
      .to(impact, {
        alpha: 0,
        duration: 0.2,
      }, '-=0.1')
      .call(() => {
        impact.destroy();
      });
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.animation) {
      this.animation.kill();
      this.animation = null;
    }

    gsap.killTweensOf(this.sprite);
    gsap.killTweensOf(this.sprite.scale);

    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }

    this.sprite.destroy({ children: true });
    this.active = false;
  }

  /**
   * Helper: Create basic projectile shape
   */
  protected createBasicShape(container: PIXI.Container): void {
    const { width, height } = this.typeConfig.size;
    const { color, glowColor } = this.typeConfig;

    // Outer glow
    const outerGlow = new PIXI.Graphics();
    outerGlow.roundRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, 3);
    outerGlow.fill({ color: glowColor, alpha: 0.3 });
    container.addChild(outerGlow);

    // Middle glow
    const middleGlow = new PIXI.Graphics();
    middleGlow.roundRect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2, 2);
    middleGlow.fill({ color: glowColor, alpha: 0.5 });
    container.addChild(middleGlow);

    // Main body
    const body = new PIXI.Graphics();
    body.roundRect(-width / 2, -height / 2, width, height, 2);
    body.fill({ color, alpha: 1.0 });
    body.stroke({ width: 1.5, color: 0xFFFFFF, alpha: 0.6 });
    container.addChild(body);

    // Inner highlight
    const highlight = new PIXI.Graphics();
    highlight.roundRect(-width / 2 + 2, -height / 2 + 1, width - 4, height / 2, 1);
    highlight.fill({ color: 0xFFFFFF, alpha: 0.4 });
    container.addChild(highlight);
  }

  /**
   * Helper: Add pulse animation to sprite
   */
  protected addPulseAnimation(): void {
    gsap.to(this.sprite.scale, {
      x: 1.15,
      y: 1.15,
      duration: 0.3,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }

  /**
   * Helper: Calculate angle to target
   */
  protected getAngleToTarget(): number {
    const dx = this.targetPosition.x - this.position.x;
    const dy = this.targetPosition.y - this.position.y;
    return Math.atan2(dy, dx);
  }

  /**
   * Helper: Set rotation based on direction
   */
  protected setRotation(): void {
    if (this.side === 'left') {
      this.sprite.rotation = 0; // Pointing right
    } else {
      this.sprite.rotation = Math.PI; // Pointing left
    }
  }
}

