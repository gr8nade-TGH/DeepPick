/**
 * Homing Missile Projectile - AST stat
 * Smart-targeting missiles that curve toward their target
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { BaseProjectile, type BaseProjectileConfig } from './BaseProjectile';

export class HomingMissileProjectile extends BaseProjectile {
  constructor(config: BaseProjectileConfig) {
    super(config);
  }

  /**
   * Create missile sprite with fins and exhaust
   */
  protected createSprite(): PIXI.Container {
    const container = new PIXI.Container();
    const { width, height } = this.typeConfig.size;
    const { color, glowColor } = this.typeConfig;

    // Exhaust glow (behind missile)
    const exhaustGlow = new PIXI.Graphics();
    exhaustGlow.roundRect(-width/2 - 6, -height/2 - 1, 8, height + 2, 2);
    exhaustGlow.fill({ color: 0xFFAA00, alpha: 0.4 });
    container.addChild(exhaustGlow);

    // Outer glow
    const outerGlow = new PIXI.Graphics();
    outerGlow.roundRect(-width/2 - 2, -height/2 - 2, width + 4, height + 4, 3);
    outerGlow.fill({ color: glowColor, alpha: 0.3 });
    container.addChild(outerGlow);

    // Middle glow
    const middleGlow = new PIXI.Graphics();
    middleGlow.roundRect(-width/2 - 1, -height/2 - 1, width + 2, height + 2, 2);
    middleGlow.fill({ color: glowColor, alpha: 0.5 });
    container.addChild(middleGlow);

    // Main missile body
    const body = new PIXI.Graphics();
    
    // Draw missile shape (pointed front, fins)
    body.moveTo(width/2, 0); // Nose
    body.lineTo(-width/2 + 3, -height/2); // Top back
    body.lineTo(-width/2, -height/2 + 1); // Top fin
    body.lineTo(-width/2 - 2, -height/4); // Top fin tip
    body.lineTo(-width/2, -height/4 + 1); // Back to body
    body.lineTo(-width/2, height/4 - 1); // Bottom body
    body.lineTo(-width/2 - 2, height/4); // Bottom fin tip
    body.lineTo(-width/2, height/4 + 1); // Back to body
    body.lineTo(-width/2, height/2 - 1); // Bottom fin
    body.lineTo(-width/2 + 3, height/2); // Bottom back
    body.lineTo(width/2, 0); // Back to nose
    body.fill({ color, alpha: 1.0 });
    body.stroke({ width: 1.5, color: 0xFFFFFF, alpha: 0.7 });
    container.addChild(body);

    // Inner highlight
    const highlight = new PIXI.Graphics();
    highlight.moveTo(width/2 - 2, 0);
    highlight.lineTo(-width/2 + 4, -height/4);
    highlight.lineTo(-width/2 + 4, height/4);
    highlight.lineTo(width/2 - 2, 0);
    highlight.fill({ color: 0xFFFFFF, alpha: 0.5 });
    container.addChild(highlight);

    // Exhaust particles (animated)
    this.createExhaustParticles(container);

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
   * Create animated exhaust particles
   */
  private createExhaustParticles(container: PIXI.Container): void {
    const particleCount = 3;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = new PIXI.Graphics();
      particle.circle(0, 0, 2);
      particle.fill({ color: 0xFFAA00, alpha: 0.8 });
      
      // Position behind missile
      particle.x = -this.typeConfig.size.width/2 - 4 - (i * 3);
      particle.y = 0;
      
      container.addChild(particle);
      
      // Animate particle (fade and move back)
      gsap.to(particle, {
        x: particle.x - 10,
        alpha: 0,
        duration: 0.5,
        repeat: -1,
        delay: i * 0.15,
        ease: 'power2.out',
      });
    }
  }

  /**
   * Animate missile with homing behavior (bezier curve)
   */
  public async animateToTarget(): Promise<void> {
    return new Promise((resolve) => {
      const duration = this.typeConfig.speed; // 0.9s - slower due to homing

      // Calculate homing path (bezier curve that homes in)
      const startX = this.sprite.x;
      const startY = this.sprite.y;
      const endX = this.targetPosition.x;
      const endY = this.targetPosition.y;

      // Create curved path with multiple control points for smooth homing
      const dx = endX - startX;
      const dy = endY - startY;
      
      // Control points for bezier curve
      const cp1X = startX + dx * 0.3;
      const cp1Y = startY + dy * 0.1; // Start mostly straight
      
      const cp2X = startX + dx * 0.7;
      const cp2Y = startY + dy * 0.6; // Curve toward target
      
      // Lock-on indicator before firing
      this.createLockOnIndicator();

      // Animate with bezier curve
      this.animation = gsap.timeline()
        .to(this.sprite, {
          motionPath: {
            path: [
              { x: startX, y: startY },
              { x: cp1X, y: cp1Y },
              { x: cp2X, y: cp2Y },
              { x: endX, y: endY },
            ],
            curviness: 1.5,
            autoRotate: true, // Rotate missile to face direction of travel
          },
          duration,
          ease: 'power1.inOut',
          onUpdate: () => {
            // Update position for collision detection
            this.position.x = this.sprite.x;
            this.position.y = this.sprite.y;
          },
        })
        .call(() => {
          // Impact effect
          this.createImpactEffect();
          resolve();
        });
    });
  }

  /**
   * Create lock-on indicator at target
   */
  private createLockOnIndicator(): void {
    const indicator = new PIXI.Graphics();
    
    // Targeting reticle
    const size = 15;
    
    // Outer circle
    indicator.circle(0, 0, size);
    indicator.stroke({ width: 2, color: this.typeConfig.color, alpha: 0.8 });
    
    // Crosshairs
    indicator.moveTo(-size, 0);
    indicator.lineTo(-size/2, 0);
    indicator.moveTo(size/2, 0);
    indicator.lineTo(size, 0);
    indicator.moveTo(0, -size);
    indicator.lineTo(0, -size/2);
    indicator.moveTo(0, size/2);
    indicator.lineTo(0, size);
    indicator.stroke({ width: 2, color: this.typeConfig.color, alpha: 0.8 });
    
    indicator.x = this.targetPosition.x;
    indicator.y = this.targetPosition.y;
    
    // Add to parent
    if (this.sprite.parent) {
      this.sprite.parent.addChild(indicator);
    }
    
    // Animate lock-on
    gsap.timeline()
      .to(indicator.scale, {
        x: 1.3,
        y: 1.3,
        duration: 0.3,
        repeat: 2,
        yoyo: true,
        ease: 'power2.inOut',
      })
      .to(indicator, {
        alpha: 0,
        duration: 0.2,
      })
      .call(() => {
        indicator.destroy();
      });
  }

  /**
   * Override impact effect for missiles (explosion)
   */
  protected createImpactEffect(): void {
    const impact = new PIXI.Graphics();
    
    // Explosion burst (star pattern)
    const points = 8;
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const length = 15;
      
      impact.moveTo(0, 0);
      impact.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
    }
    impact.stroke({ width: 3, color: this.typeConfig.color, alpha: 0.9 });
    
    // Center explosion
    impact.circle(0, 0, 10);
    impact.fill({ color: this.typeConfig.glowColor, alpha: 1.0 });
    
    // Outer ring
    impact.circle(0, 0, 15);
    impact.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.8 });
    
    impact.x = this.sprite.x;
    impact.y = this.sprite.y;
    
    // Add to parent
    if (this.sprite.parent) {
      this.sprite.parent.addChild(impact);
    }
    
    // Animate explosion
    gsap.timeline()
      .to(impact.scale, {
        x: 2,
        y: 2,
        duration: 0.25,
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
}

