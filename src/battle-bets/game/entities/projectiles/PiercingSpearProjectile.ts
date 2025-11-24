/**
 * Piercing Spear Projectile - SHIELD stat
 * Heavy, slow spears that pierce through targets
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { BaseProjectile, type BaseProjectileConfig } from './BaseProjectile';
import { gridManager } from '../../managers/GridManager';

export class PiercingSpearProjectile extends BaseProjectile {
  private hasCharged: boolean = false;

  constructor(config: BaseProjectileConfig) {
    super(config);
  }

  /**
   * Create spear sprite with energy trail
   */
  protected createSprite(): PIXI.Container {
    const container = new PIXI.Container();
    const { width, height } = this.typeConfig.size;
    const { color, glowColor } = this.typeConfig;

    // Energy trail (behind spear)
    const trail = new PIXI.Graphics();
    trail.roundRect(-width / 2 - 10, -height / 2, 12, height, 2);
    trail.fill({ color: this.typeConfig.trailColor, alpha: 0.4 });
    container.addChild(trail);

    // Outer glow
    const outerGlow = new PIXI.Graphics();
    outerGlow.roundRect(-width / 2 - 3, -height / 2 - 3, width + 6, height + 6, 3);
    outerGlow.fill({ color: glowColor, alpha: 0.25 });
    container.addChild(outerGlow);

    // Middle glow
    const middleGlow = new PIXI.Graphics();
    middleGlow.roundRect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2, 2);
    middleGlow.fill({ color: glowColor, alpha: 0.4 });
    container.addChild(middleGlow);

    // Main spear body
    const body = new PIXI.Graphics();

    // Draw spear shape (pointed tip, shaft, fins)
    // Tip
    body.moveTo(width / 2, 0); // Point
    body.lineTo(width / 2 - 4, -height / 2); // Top of tip
    body.lineTo(width / 2 - 6, -height / 2); // Top of shaft

    // Top fin
    body.lineTo(width / 2 - 8, -height / 2 - 2); // Fin top
    body.lineTo(width / 2 - 10, -height / 2); // Fin back

    // Shaft top
    body.lineTo(-width / 2 + 2, -height / 2 + 1);
    body.lineTo(-width / 2, -height / 2 + 2);

    // Back end top
    body.lineTo(-width / 2, -height / 4);
    body.lineTo(-width / 2 - 2, -height / 4 + 1);
    body.lineTo(-width / 2, -height / 4 + 2);

    // Middle
    body.lineTo(-width / 2, height / 4 - 2);
    body.lineTo(-width / 2 - 2, height / 4 - 1);
    body.lineTo(-width / 2, height / 4);

    // Back end bottom
    body.lineTo(-width / 2, height / 2 - 2);
    body.lineTo(-width / 2 + 2, height / 2 - 1);

    // Shaft bottom
    body.lineTo(width / 2 - 10, height / 2);

    // Bottom fin
    body.lineTo(width / 2 - 8, height / 2 + 2);
    body.lineTo(width / 2 - 6, height / 2);

    // Bottom of shaft
    body.lineTo(width / 2 - 4, height / 2);

    // Back to point
    body.lineTo(width / 2, 0);

    body.fill({ color, alpha: 1.0 });
    body.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.8 });
    container.addChild(body);

    // Inner highlight (energy core)
    const highlight = new PIXI.Graphics();
    highlight.moveTo(width / 2 - 3, 0);
    highlight.lineTo(-width / 2 + 4, -height / 3);
    highlight.lineTo(-width / 2 + 4, height / 3);
    highlight.lineTo(width / 2 - 3, 0);
    highlight.fill({ color: 0xFFFFFF, alpha: 0.6 });
    container.addChild(highlight);

    // Energy sparkles
    this.createEnergySparkles(container, width, height);

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
   * Create energy sparkles along spear
   */
  private createEnergySparkles(container: PIXI.Container, width: number, height: number): void {
    const sparkleCount = 4;

    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = new PIXI.Graphics();
      sparkle.circle(0, 0, 1.5);
      sparkle.fill({ color: 0xFFFFFF, alpha: 0.9 });

      // Position along spear shaft
      sparkle.x = -width / 2 + (i * (width / sparkleCount));
      sparkle.y = (Math.random() - 0.5) * height * 0.6;

      container.addChild(sparkle);

      // Animate sparkle (twinkle)
      gsap.to(sparkle, {
        alpha: 0.2,
        duration: 0.3 + Math.random() * 0.2,
        repeat: -1,
        yoyo: true,
        delay: i * 0.1,
        ease: 'sine.inOut',
      });
    }
  }

  /**
   * Animate spear with charge-up then fast pierce
   */
  public async animateToTarget(): Promise<void> {
    return new Promise((resolve) => {
      // Calculate distance to target
      const dx = this.targetPosition.x - this.position.x;
      const dy = this.targetPosition.y - this.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const cellWidth = gridManager.getCellWidth();
      const totalDuration = this.calculateFlightDuration(distance, cellWidth);

      // Split total duration into charge + pierce phases
      const chargeDuration = Math.min(0.3, totalDuration * 0.4); // Up to 40% of time
      const pierceDuration = Math.max(0.1, totalDuration - chargeDuration);

      // Create charge-up effect
      this.createChargeEffect();

      // Animation timeline: charge up, then pierce
      this.animation = gsap
        .timeline()
        // Charge-up (pull back slightly)
        .to(this.sprite, {
          x: this.sprite.x - (this.side === 'left' ? 10 : -10),
          duration: chargeDuration,
          ease: 'power2.in',
        })
        // Pierce forward (fast and powerful)
        .to(this.sprite, {
          x: this.targetPosition.x,
          y: this.targetPosition.y,
          duration: pierceDuration,
          ease: 'power3.out',
          onUpdate: () => {
            // Update position for collision detection
            this.position.x = this.sprite.x;
            this.position.y = this.sprite.y;

            // Check for collisions during flight
            if (!this.collided && this.onCollisionCheck) {
              const collisionType = this.onCollisionCheck(this);

              if (collisionType) {
                this.collided = true;
                this.collidedWith = collisionType;

                if (this.animation) {
                  this.animation.kill();
                }

                this.createPiercingImpact();
                resolve();
              }
            }
          },
        })
        .call(() => {
          if (!this.collided) {
            this.createPiercingImpact();
          }
          resolve();
        });
    });
  }

  /**
   * Create charge-up energy effect
   */
  private createChargeEffect(): void {
    if (this.hasCharged) return;
    this.hasCharged = true;

    const charge = new PIXI.Graphics();

    // Energy rings
    for (let i = 0; i < 3; i++) {
      const ring = new PIXI.Graphics();
      ring.circle(0, 0, 8 + (i * 4));
      ring.stroke({ width: 2, color: this.typeConfig.color, alpha: 0.7 - (i * 0.2) });
      charge.addChild(ring);
    }

    charge.x = this.sprite.x;
    charge.y = this.sprite.y;

    // Add to parent
    if (this.sprite.parent) {
      this.sprite.parent.addChild(charge);
    }

    // Animate charge rings
    gsap.timeline()
      .to(charge.scale, {
        x: 1.5,
        y: 1.5,
        duration: 0.3,
        ease: 'power2.in',
      })
      .to(charge, {
        alpha: 0,
        duration: 0.1,
      }, '-=0.05')
      .call(() => {
        charge.destroy();
      });
  }

  /**
   * Create piercing impact effect (continues through target)
   */
  private createPiercingImpact(): void {
    const impact = new PIXI.Graphics();

    // Shatter effect (sharp fragments)
    const fragmentCount = 8;
    for (let i = 0; i < fragmentCount; i++) {
      const angle = (i / fragmentCount) * Math.PI * 2;
      const length = 12 + Math.random() * 6;

      // Sharp fragment line
      impact.moveTo(0, 0);
      impact.lineTo(
        Math.cos(angle) * length,
        Math.sin(angle) * length
      );
    }
    impact.stroke({ width: 3, color: this.typeConfig.color, alpha: 0.9 });

    // Center pierce point
    impact.circle(0, 0, 6);
    impact.fill({ color: 0xFFFFFF, alpha: 1.0 });

    // Outer shockwave
    impact.circle(0, 0, 12);
    impact.stroke({ width: 2, color: this.typeConfig.glowColor, alpha: 0.8 });

    impact.x = this.sprite.x;
    impact.y = this.sprite.y;

    // Add to parent
    if (this.sprite.parent) {
      this.sprite.parent.addChild(impact);
    }

    // Animate shatter
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
      }, '-=0.15')
      .call(() => {
        impact.destroy();
      });

    // Lightning effect
    this.createLightningEffect();
  }

  /**
   * Create lightning effect on pierce
   */
  private createLightningEffect(): void {
    const lightning = new PIXI.Graphics();

    // Jagged lightning bolt
    const segments = 5;
    let currentX = 0;
    let currentY = 0;

    lightning.moveTo(currentX, currentY);

    for (let i = 0; i < segments; i++) {
      currentX += 8 + Math.random() * 4;
      currentY += (Math.random() - 0.5) * 10;
      lightning.lineTo(currentX, currentY);
    }

    lightning.stroke({ width: 2, color: 0x00FFFF, alpha: 0.9 });

    lightning.x = this.sprite.x;
    lightning.y = this.sprite.y;

    // Add to parent
    if (this.sprite.parent) {
      this.sprite.parent.addChild(lightning);
    }

    // Flash and fade
    gsap.to(lightning, {
      alpha: 0,
      duration: 0.2,
      ease: 'power2.out',
      onComplete: () => {
        lightning.destroy();
      },
    });
  }
}

