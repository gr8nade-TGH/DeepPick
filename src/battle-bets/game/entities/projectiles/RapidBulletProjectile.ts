/**
 * Rapid Fire Bullet Projectile - POINTS stat
 * Fast, straight-line bullets that can fire in rapid succession
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { BaseProjectile, type BaseProjectileConfig } from './BaseProjectile';
import { gridManager } from '../../managers/GridManager';

export class RapidBulletProjectile extends BaseProjectile {
  constructor(config: BaseProjectileConfig) {
    super(config);
  }

  /**
   * Create sharp, fast bullet sprite
   */
  protected createSprite(): PIXI.Container {
    const container = new PIXI.Container();
    const { width, height } = this.typeConfig.size;
    const { color, glowColor } = this.typeConfig;

    // Outer glow (elongated for speed effect)
    const outerGlow = new PIXI.Graphics();
    outerGlow.roundRect(-width / 2 - 3, -height / 2 - 2, width + 6, height + 4, 3);
    outerGlow.fill({ color: glowColor, alpha: 0.25 });
    container.addChild(outerGlow);

    // Middle glow
    const middleGlow = new PIXI.Graphics();
    middleGlow.roundRect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2, 2);
    middleGlow.fill({ color: glowColor, alpha: 0.4 });
    container.addChild(middleGlow);

    // Main bullet body (sharp, pointed)
    const body = new PIXI.Graphics();

    // Draw pointed bullet shape
    body.moveTo(width / 2, 0); // Point
    body.lineTo(-width / 2, -height / 2); // Top back
    body.lineTo(-width / 2, height / 2); // Bottom back
    body.lineTo(width / 2, 0); // Back to point
    body.fill({ color, alpha: 1.0 });
    body.stroke({ width: 1.5, color: 0xFFFFFF, alpha: 0.7 });
    container.addChild(body);

    // Inner highlight (sharp line)
    const highlight = new PIXI.Graphics();
    highlight.moveTo(width / 2 - 2, 0);
    highlight.lineTo(-width / 2 + 2, -height / 4);
    highlight.lineTo(-width / 2 + 2, height / 4);
    highlight.lineTo(width / 2 - 2, 0);
    highlight.fill({ color: 0xFFFFFF, alpha: 0.5 });
    container.addChild(highlight);

    // Speed trail (elongated glow behind)
    const trail = new PIXI.Graphics();
    trail.roundRect(-width / 2 - 8, -height / 2, 8, height, 2);
    trail.fill({ color: this.typeConfig.trailColor, alpha: 0.3 });
    container.addChild(trail);

    // Set position
    container.x = this.position.x;
    container.y = this.position.y;

    // Set rotation based on side
    if (this.side === 'left') {
      container.rotation = 0; // Pointing right
    } else {
      container.rotation = Math.PI; // Pointing left
    }

    return container;
  }

  /**
   * Animate bullet in straight line to target (FAST)
   * Checks for collisions during flight
   */
  public async animateToTarget(): Promise<void> {
    return new Promise((resolve) => {
      // Calculate distance to target
      const dx = this.targetPosition.x - this.position.x;
      const dy = this.targetPosition.y - this.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Calculate duration based on grid-based speed system
      const cellWidth = gridManager.getCellWidth();
      const duration = this.calculateFlightDuration(distance, cellWidth);

      // Muzzle flash effect at start
      this.createMuzzleFlash();

      // Log initial position for debugging Y offset
      console.log(`🚀 [PROJECTILE START] ${this.id} | Start: (${this.sprite.x.toFixed(1)}, ${this.sprite.y.toFixed(1)}) → Target: (${this.targetPosition.x.toFixed(1)}, ${this.targetPosition.y.toFixed(1)})`);

      // Straight line animation with collision detection
      this.animation = gsap.timeline()
        .to(this.sprite, {
          x: this.targetPosition.x,
          y: this.targetPosition.y,
          duration,
          ease: 'none', // Constant speed
          onUpdate: () => {
            // Update position for collision detection
            this.position.x = this.sprite.x;
            this.position.y = this.sprite.y;

            // Debug: Log collision check attempt (sample 1% to avoid spam)
            if (Math.random() < 0.01) {
              console.log(`🔄 [ON UPDATE] ${this.id} | collided: ${this.collided}, hasCallback: ${!!this.onCollisionCheck}`);
            }

            // Check for collisions during flight
            if (!this.collided && this.onCollisionCheck) {
              const collisionType = this.onCollisionCheck(this);

              if (collisionType) {
                // Collision detected! Stop the animation
                this.collided = true;
                this.collidedWith = collisionType;

                // Kill the animation immediately
                if (this.animation) {
                  this.animation.kill();
                }

                // Create impact effect at collision point
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
   * Create subtle muzzle flash effect when bullet fires
   */
  private createMuzzleFlash(): void {
    const flash = new PIXI.Graphics();

    // Small, subtle flash
    flash.circle(0, 0, 5);
    flash.fill({ color: this.typeConfig.glowColor, alpha: 0.5 });

    flash.x = this.sprite.x;
    flash.y = this.sprite.y;

    // Add to parent
    if (this.sprite.parent) {
      this.sprite.parent.addChild(flash);
    }

    // Quick, subtle animation
    gsap.timeline()
      .to(flash.scale, {
        x: 1.5,
        y: 1.5,
        duration: 0.08,
        ease: 'power2.out',
      })
      .to(flash, {
        alpha: 0,
        duration: 0.1,
      }, '-=0.04')
      .call(() => {
        flash.destroy();
      });
  }

  /**
   * Override impact effect for bullets (subtle, professional)
   */
  protected createImpactEffect(): void {
    const impact = new PIXI.Graphics();

    // Subtle ring pulse (smaller, cleaner)
    impact.circle(0, 0, 4);
    impact.fill({ color: this.typeConfig.glowColor, alpha: 0.6 });

    // Thin outer ring
    impact.circle(0, 0, 6);
    impact.stroke({ width: 1, color: this.typeConfig.color, alpha: 0.5 });

    impact.x = this.sprite.x;
    impact.y = this.sprite.y;

    // Add to parent
    if (this.sprite.parent) {
      this.sprite.parent.addChild(impact);
    }

    // Quick, subtle animation
    gsap.timeline()
      .to(impact.scale, {
        x: 1.8,
        y: 1.8,
        duration: 0.15,
        ease: 'power2.out',
      })
      .to(impact, {
        alpha: 0,
        duration: 0.1,
      }, '-=0.05')
      .call(() => {
        impact.destroy();
      });
  }
}

