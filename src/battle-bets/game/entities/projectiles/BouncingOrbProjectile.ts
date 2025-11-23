/**
 * Bouncing Orb Projectile - REB stat
 * Arc trajectory projectiles that bounce to adjacent targets
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { BaseProjectile, type BaseProjectileConfig } from './BaseProjectile';
import { gridManager } from '../../managers/GridManager';

export class BouncingOrbProjectile extends BaseProjectile {
  private bounceCount: number = 0;
  private maxBounces: number;

  constructor(config: BaseProjectileConfig) {
    super(config);
    this.maxBounces = config.typeConfig.bounces ?? 2;
  }

  /**
   * Create spherical orb sprite with glow
   */
  protected createSprite(): PIXI.Container {
    const container = new PIXI.Container();
    const { width } = this.typeConfig.size;
    const radius = width / 2; // Orb is circular
    const { color, glowColor } = this.typeConfig;

    // Outer glow (largest)
    const outerGlow = new PIXI.Graphics();
    outerGlow.circle(0, 0, radius + 4);
    outerGlow.fill({ color: glowColor, alpha: 0.2 });
    container.addChild(outerGlow);

    // Middle glow
    const middleGlow = new PIXI.Graphics();
    middleGlow.circle(0, 0, radius + 2);
    middleGlow.fill({ color: glowColor, alpha: 0.4 });
    container.addChild(middleGlow);

    // Main orb body
    const body = new PIXI.Graphics();
    body.circle(0, 0, radius);
    body.fill({ color, alpha: 1.0 });
    body.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.7 });
    container.addChild(body);

    // Inner highlight (top-left for 3D effect)
    const highlight = new PIXI.Graphics();
    highlight.circle(-radius * 0.3, -radius * 0.3, radius * 0.4);
    highlight.fill({ color: 0xFFFFFF, alpha: 0.5 });
    container.addChild(highlight);

    // Energy core (pulsing center)
    const core = new PIXI.Graphics();
    core.circle(0, 0, radius * 0.3);
    core.fill({ color: 0xFFFFFF, alpha: 0.8 });
    container.addChild(core);

    // Set position
    container.x = this.position.x;
    container.y = this.position.y;

    // Add rotation animation for orb spin
    gsap.to(container, {
      rotation: Math.PI * 2,
      duration: 1.5,
      repeat: -1,
      ease: 'none',
    });

    // Add pulse animation to container
    gsap.to(container.scale, {
      x: 1.15,
      y: 1.15,
      duration: 0.3,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    return container;
  }

  /**
   * Animate orb in straight line (stays in lane)
   * REB projectiles travel horizontally in their designated lane (Y=75)
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

      // Register with debugger
      projectileDebugger.registerProjectile(
        this.gameId,
        this.id,
        this.side,
        this.position.x,
        this.position.y,
        this.targetPosition.x,
        this.targetPosition.y,
        this.getEffectiveSpeed()
      );

      // Straight line animation (stays in lane)
      this.animation = gsap
        .timeline()
        .to(this.sprite, {
          x: this.targetPosition.x,
          y: this.targetPosition.y,
          duration,
          ease: 'sine.inOut',
          onUpdate: () => {
            // Update position for collision detection
            this.position.x = this.sprite.x;
            this.position.y = this.sprite.y;

            // Update debugger
            projectileDebugger.updateProjectile(this.gameId, this.id, this.sprite.x, this.sprite.y);

            // Check for collisions during flight
            if (!this.collided && this.onCollisionCheck) {
              const collisionType = this.onCollisionCheck(this);

              if (collisionType) {
                this.collided = true;
                this.collidedWith = collisionType;

                if (this.animation) {
                  this.animation.kill();
                }

                // Mark collision in debugger
                projectileDebugger.markCollision(
                  this.gameId,
                  this.id,
                  this.sprite.x,
                  this.sprite.y,
                  collisionType === 'projectile' ? 'PROJ' : 'DEF'
                );

                this.createImpactEffect();
                resolve();
              }
            }
          },
        })
        .call(() => {
          if (!this.collided) {
            // Mark reaching target as collision with castle
            projectileDebugger.markCollision(this.gameId, this.id, this.sprite.x, this.sprite.y, 'TARGET');
            this.createImpactEffect();
          }
          resolve();
        });
    });
  }

  /**
   * Override impact effect for bouncing orbs (ripple effect)
   */
  protected createImpactEffect(): void {
    const impact = new PIXI.Graphics();

    // Ripple rings
    for (let i = 0; i < 3; i++) {
      const ring = new PIXI.Graphics();
      ring.circle(0, 0, 10 + (i * 5));
      ring.stroke({ width: 2, color: this.typeConfig.color, alpha: 0.8 - (i * 0.2) });
      impact.addChild(ring);
    }

    // Center burst
    impact.circle(0, 0, 8);
    impact.fill({ color: this.typeConfig.glowColor, alpha: 0.9 });

    impact.x = this.sprite.x;
    impact.y = this.sprite.y;

    // Add to parent
    if (this.sprite.parent) {
      this.sprite.parent.addChild(impact);
    }

    // Animate ripple expansion
    gsap.timeline()
      .to(impact.scale, {
        x: 2.5,
        y: 2.5,
        duration: 0.4,
        ease: 'power2.out',
      })
      .to(impact, {
        alpha: 0,
        duration: 0.3,
      }, '-=0.2')
      .call(() => {
        impact.destroy();
      });
  }

  /**
   * Bounce to adjacent target (for future implementation)
   * This would require finding adjacent defense dots and creating a new animation
   */
  public async bounceToAdjacentTarget(adjacentPosition: { x: number; y: number }): Promise<void> {
    if (this.bounceCount >= this.maxBounces) {
      return;
    }

    this.bounceCount++;
    this.targetPosition.x = adjacentPosition.x;
    this.targetPosition.y = adjacentPosition.y;

    // Smaller, faster bounce (60% of normal flight duration)
    const dx = adjacentPosition.x - this.position.x;
    const dy = adjacentPosition.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const cellWidth = gridManager.getCellWidth();
    const baseDuration = this.calculateFlightDuration(distance, cellWidth);
    const duration = baseDuration * 0.6;

    return new Promise((resolve) => {
      const startX = this.sprite.x;
      const startY = this.sprite.y;
      const endX = adjacentPosition.x;
      const endY = adjacentPosition.y;

      // Smaller arc for bounce
      const midX = (startX + endX) / 2;
      const midY = Math.min(startY, endY) - 25; // Smaller arc

      this.animation = gsap
        .timeline()
        .to(this.sprite, {
          motionPath: {
            path: [
              { x: startX, y: startY },
              { x: midX, y: midY },
              { x: endX, y: endY },
            ],
            curviness: 1.5,
          },
          duration,
          ease: 'sine.inOut',
          onUpdate: () => {
            this.position.x = this.sprite.x;
            this.position.y = this.sprite.y;
          },
        })
        .call(() => {
          this.createImpactEffect();
          resolve();
        });
    });
  }
}

