/**
 * Projectile entity - Represents a projectile/bullet in the battle
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import type { ProjectileConfig, Position, StatType } from '../../types/game';
import { STATS } from '../../types/game';

export class Projectile {
  // Identity
  public readonly id: string;
  public readonly gameId: string;
  public readonly stat: StatType;
  public readonly side: 'left' | 'right';

  // State
  public position: Position;
  public readonly targetPosition: Position;
  public readonly damage: number;
  public readonly speed: number;
  public active: boolean = true;

  // Visual
  public sprite: PIXI.Container;
  public readonly radius: number = 4; // Projectile radius for collision detection

  constructor(config: ProjectileConfig) {
    this.id = config.id;
    this.gameId = config.gameId;
    this.stat = config.stat;
    this.side = config.side;
    this.position = { ...config.startPosition };
    this.targetPosition = config.targetPosition;
    this.damage = config.damage;
    this.speed = config.speed;

    // Create sprite
    this.sprite = this.createSprite();
  }

  /**
   * Create the PixiJS sprite for this projectile with premium visual effects
   */
  private createSprite(): PIXI.Container {
    const container = new PIXI.Container();
    const statColor = STATS[this.stat].color;

    // Outer glow (largest, most transparent)
    const outerGlow = new PIXI.Graphics();
    outerGlow.roundRect(-12, -6, 24, 12, 6);
    outerGlow.fill({ color: statColor, alpha: 0.2 });
    container.addChild(outerGlow);

    // Middle glow
    const middleGlow = new PIXI.Graphics();
    middleGlow.roundRect(-11, -5, 22, 10, 5);
    middleGlow.fill({ color: statColor, alpha: 0.4 });
    container.addChild(middleGlow);

    // Main projectile body (crisp and sharp)
    const body = new PIXI.Graphics();
    body.roundRect(-10, -4, 20, 8, 4);
    body.fill({ color: statColor, alpha: 1.0 });

    // Border for definition
    body.roundRect(-10, -4, 20, 8, 4);
    body.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.5 });
    container.addChild(body);

    // Inner highlight for 3D effect
    const highlight = new PIXI.Graphics();
    highlight.roundRect(-8, -3, 12, 3, 2);
    highlight.fill({ color: 0xFFFFFF, alpha: 0.4 });
    container.addChild(highlight);

    // Trail effect (elongated glow behind)
    const trail = new PIXI.Graphics();
    trail.roundRect(-15, -2, 10, 4, 2);
    trail.fill({ color: statColor, alpha: 0.3 });
    container.addChild(trail);

    // Set position
    container.x = this.position.x;
    container.y = this.position.y;

    // Flip horizontally based on direction
    if (this.side === 'left') {
      container.scale.x = 1; // Pointing right (normal)
    } else {
      container.scale.x = -1; // Pointing left (flipped horizontally)
    }

    // Pulse animation for energy effect
    gsap.to(body.scale, {
      x: 1.15,
      y: 1.15,
      duration: 0.25,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    // Glow pulse animation
    gsap.to([outerGlow, middleGlow], {
      alpha: 0.6,
      duration: 0.3,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    return container;
  }

  /**
   * Animate projectile to target position
   */
  public async animateToTarget(): Promise<void> {
    return new Promise((resolve) => {
      const duration = this.speed;

      gsap.to(this.sprite, {
        x: this.targetPosition.x,
        y: this.targetPosition.y,
        duration: duration,
        ease: 'power2.inOut',
        onUpdate: () => {
          // Update position for collision detection
          this.position.x = this.sprite.x;
          this.position.y = this.sprite.y;
        },
        onComplete: () => {
          resolve();
        },
      });
    });
  }

  /**
   * Create impact explosion effect at current position
   */
  public createImpactEffect(): void {
    const impact = new PIXI.Graphics();
    const statColor = STATS[this.stat].color;

    impact.beginFill(statColor, 0.8);
    impact.drawCircle(0, 0, 10);
    impact.endFill();

    impact.x = this.position.x;
    impact.y = this.position.y;

    // Add to same parent as projectile
    if (this.sprite.parent) {
      this.sprite.parent.addChild(impact);
    }

    // Animate explosion
    gsap.timeline()
      .to(impact.scale, {
        x: 3,
        y: 3,
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

    // Create particles
    this.createParticles();
  }

  /**
   * Create particle burst effect
   */
  private createParticles(): void {
    const particleCount = 8;
    const statColor = STATS[this.stat].color;

    for (let i = 0; i < particleCount; i++) {
      const particle = new PIXI.Graphics();
      particle.beginFill(statColor);
      particle.drawCircle(0, 0, 3);
      particle.endFill();

      particle.x = this.position.x;
      particle.y = this.position.y;

      if (this.sprite.parent) {
        this.sprite.parent.addChild(particle);
      }

      // Random direction
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = 30 + Math.random() * 20;
      const targetX = this.position.x + Math.cos(angle) * distance;
      const targetY = this.position.y + Math.sin(angle) * distance;

      // Animate particle
      gsap.timeline()
        .to(particle, {
          x: targetX,
          y: targetY,
          duration: 0.4,
          ease: 'power2.out',
        })
        .to(particle, {
          alpha: 0,
          duration: 0.2,
        }, '-=0.2')
        .call(() => {
          particle.destroy();
        });
    }
  }

  /**
   * Deactivate this projectile (after collision or reaching target)
   */
  public deactivate(): void {
    this.active = false;
    this.createImpactEffect();

    // Fade out and remove
    gsap.to(this.sprite, {
      alpha: 0,
      duration: 0.2,
      onComplete: () => {
        this.sprite.visible = false;
      },
    });
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    gsap.killTweensOf(this.sprite);
    this.sprite.destroy({ children: true });
  }
}

