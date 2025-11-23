/**
 * Explosive Fireball Projectile - FIRE stat
 * Slow, powerful fireballs with area-of-effect explosion damage
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { BaseProjectile, type BaseProjectileConfig } from './BaseProjectile';
import { gridManager } from '../../managers/GridManager';

export class ExplosiveFireballProjectile extends BaseProjectile {
  constructor(config: BaseProjectileConfig) {
    super(config);
  }

  /**
   * Create fireball sprite with flames and particles
   */
  protected createSprite(): PIXI.Container {
    const container = new PIXI.Container();
    const { width } = this.typeConfig.size;
    const radius = width / 2; // Fireball is circular
    const { color } = this.typeConfig;

    // Outer flame glow (orange/yellow)
    const outerFlame = new PIXI.Graphics();
    outerFlame.circle(0, 0, radius + 6);
    outerFlame.fill({ color: 0xFFAA00, alpha: 0.3 });
    container.addChild(outerFlame);

    // Middle flame
    const middleFlame = new PIXI.Graphics();
    middleFlame.circle(0, 0, radius + 3);
    middleFlame.fill({ color: 0xFF6600, alpha: 0.5 });
    container.addChild(middleFlame);

    // Main fireball body (red)
    const body = new PIXI.Graphics();
    body.circle(0, 0, radius);
    body.fill({ color, alpha: 1.0 });
    body.stroke({ width: 2, color: 0xFF8800, alpha: 0.8 });
    container.addChild(body);

    // Inner core (bright yellow/white)
    const core = new PIXI.Graphics();
    core.circle(0, 0, radius * 0.5);
    core.fill({ color: 0xFFFF00, alpha: 0.9 });
    container.addChild(core);

    // Bright center
    const center = new PIXI.Graphics();
    center.circle(0, 0, radius * 0.25);
    center.fill({ color: 0xFFFFFF, alpha: 1.0 });
    container.addChild(center);

    // Create fire particles trailing behind
    this.createFireParticles(container, radius);

    // Set position
    container.x = this.position.x;
    container.y = this.position.y;

    // Add pulsing flame animation
    gsap.to([outerFlame.scale, middleFlame.scale], {
      x: 1.2,
      y: 1.2,
      duration: 0.4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    // Add rotation for swirling effect
    gsap.to(container, {
      rotation: Math.PI * 2,
      duration: 2,
      repeat: -1,
      ease: 'none',
    });

    return container;
  }

  /**
   * Create fire particle trail
   */
  private createFireParticles(container: PIXI.Container, radius: number): void {
    const particleCount = 5;

    for (let i = 0; i < particleCount; i++) {
      const particle = new PIXI.Graphics();
      const particleSize = 3 - (i * 0.4);

      particle.circle(0, 0, particleSize);

      // Gradient from yellow to red to black
      const colors = [0xFFFF00, 0xFF8800, 0xFF3838, 0x880000, 0x000000];
      const colorIndex = Math.min(i, colors.length - 1);
      particle.fill({ color: colors[colorIndex], alpha: 0.8 - (i * 0.15) });

      // Position behind fireball
      particle.x = -radius - 5 - (i * 4);
      particle.y = (Math.random() - 0.5) * 6; // Random vertical offset

      container.addChild(particle);

      // Animate particle (fade and drift)
      gsap.to(particle, {
        x: particle.x - 8,
        y: particle.y + (Math.random() - 0.5) * 4,
        alpha: 0,
        duration: 0.6,
        repeat: -1,
        delay: i * 0.1,
        ease: 'power2.out',
      });
    }
  }

  /**
   * Animate fireball in straight line (slow and powerful)
   */
  public async animateToTarget(): Promise<void> {
    return new Promise((resolve) => {
      // Calculate distance to target
      const dx = this.targetPosition.x - this.position.x;
      const dy = this.targetPosition.y - this.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Calculate duration based on grid-based speed system
      const cellWidth = gridManager.getCellWidth();
      const baseDuration = this.calculateFlightDuration(distance, cellWidth);
      const duration = baseDuration * 1.4; // Slightly slower & heavier than standard

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

      // Straight line animation (slow and menacing)
      this.animation = gsap
        .timeline()
        .to(this.sprite, {
          x: this.targetPosition.x,
          y: this.targetPosition.y,
          duration,
          ease: 'power1.in', // Accelerates slightly
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

                this.createExplosionEffect();
                resolve();
              }
            }
          },
        })
        .call(() => {
          if (!this.collided) {
            projectileDebugger.markCollision(this.gameId, this.id, this.sprite.x, this.sprite.y, 'TARGET');
            this.createExplosionEffect();
          }
          resolve();
        });
    });
  }

  /**
   * Create massive explosion effect with AoE
   */
  private createExplosionEffect(): void {
    const explosion = new PIXI.Container();
    explosion.x = this.sprite.x;
    explosion.y = this.sprite.y;

    // Add to parent
    if (this.sprite.parent) {
      this.sprite.parent.addChild(explosion);
    }

    // Multiple explosion rings
    const ringCount = 4;
    for (let i = 0; i < ringCount; i++) {
      const ring = new PIXI.Graphics();
      const baseRadius = 15 + (i * 8);

      ring.circle(0, 0, baseRadius);

      // Color gradient from white to yellow to red
      const colors = [0xFFFFFF, 0xFFFF00, 0xFF8800, 0xFF3838];
      ring.fill({ color: colors[i], alpha: 0.8 - (i * 0.15) });

      explosion.addChild(ring);

      // Animate ring expansion
      gsap.timeline()
        .to(ring.scale, {
          x: 3,
          y: 3,
          duration: 0.5 + (i * 0.1),
          ease: 'power2.out',
        })
        .to(ring, {
          alpha: 0,
          duration: 0.3,
        }, '-=0.2');
    }

    // Center flash
    const flash = new PIXI.Graphics();
    flash.circle(0, 0, 20);
    flash.fill({ color: 0xFFFFFF, alpha: 1.0 });
    explosion.addChild(flash);

    gsap.to(flash, {
      alpha: 0,
      duration: 0.2,
      ease: 'power2.out',
    });

    // Fire particles burst
    this.createExplosionParticles(explosion);

    // Screen shake effect (would need camera reference)
    // For now, just log it
    console.log('💥 EXPLOSION! Screen shake effect');

    // Cleanup after animation
    setTimeout(() => {
      explosion.destroy({ children: true });
    }, 1000);
  }

  /**
   * Create explosion particle burst
   */
  private createExplosionParticles(container: PIXI.Container): void {
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
      const particle = new PIXI.Graphics();
      const angle = (i / particleCount) * Math.PI * 2;
      const distance = 30 + Math.random() * 20;

      particle.circle(0, 0, 3 + Math.random() * 2);

      // Random fire colors
      const colors = [0xFFFF00, 0xFF8800, 0xFF3838];
      const color = colors[Math.floor(Math.random() * colors.length)];
      particle.fill({ color, alpha: 0.9 });

      container.addChild(particle);

      // Animate particle outward
      gsap.timeline()
        .to(particle, {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          duration: 0.4 + Math.random() * 0.2,
          ease: 'power2.out',
        })
        .to(particle, {
          alpha: 0,
          duration: 0.3,
        }, '-=0.2');
    }
  }

  /**
   * Override base impact effect (we use explosion instead)
   */
  protected createImpactEffect(): void {
    // Explosion effect is created in createExplosionEffect()
    // This override prevents the base impact from showing
  }
}

