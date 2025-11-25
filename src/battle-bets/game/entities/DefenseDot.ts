/**
 * DefenseDot entity - Represents a defense dot in the battle grid
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import type { DefenseDotConfig, Position, Team } from '../../types/game';

export class DefenseDot {
  // Identity
  public readonly id: string;
  public readonly gameId: string;
  public readonly stat: string;
  public readonly side: 'left' | 'right';
  public readonly index: number;
  public readonly cellId: string; // Unique cell identifier (e.g., "Points_Left_Cell1")

  // State
  public hp: number;
  public readonly maxHp: number;
  public alive: boolean;
  public readonly isRegenerated: boolean; // True if this is a gold regeneration dot

  // Visual
  public readonly team: Team;
  public readonly position: Position;
  public sprite: PIXI.Graphics; // Back to Graphics for custom shapes
  public readonly radius: number = 8; // Defense icon size - smaller and cleaner

  constructor(config: DefenseDotConfig) {
    this.id = config.id;
    this.gameId = config.gameId;
    this.stat = config.stat;
    this.side = config.side;
    this.index = config.index;
    this.cellId = config.cellId;
    this.position = config.position;
    this.team = config.team;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    this.alive = true;
    this.isRegenerated = config.isRegenerated ?? false;

    // Create sprite
    this.sprite = this.createSprite();
  }

  /**
   * Create pixel-art style shield with HP visualization
   * - Shield shape with 3 horizontal segments (3 HP)
   * - Glow intensity based on HP
   * - Slight size scaling on damage
   */
  private createSprite(): PIXI.Graphics {
    const graphics = new PIXI.Graphics();

    // All shields use team color
    const shieldColor = this.team.color;

    // Draw HP segments and glow
    this.drawHPSegments(graphics, shieldColor, this.hp);

    // Set position
    graphics.x = this.position.x;
    graphics.y = this.position.y;

    return graphics;
  }

  /**
   * Draw HP segments as a professional shield with 3 VERTICAL curved segments
   * Matches the reference image: smooth curves, 3D depth, glossy appearance
   */
  private drawHPSegments(graphics: PIXI.Graphics, shieldColor: number, currentHP: number): void {
    graphics.clear();

    const hpPercent = currentHP / this.maxHp;
    const width = this.radius * 2.4; // 19.2px wide
    const height = this.radius * 2.6; // 20.8px tall

    // Outer glow (team color, soft)
    const glowAlpha = 0.3 + (hpPercent * 0.3);
    this.drawShieldShape(graphics, width + 8, height + 8, shieldColor, glowAlpha, true);

    // Dark blue/teal border (3D outer edge)
    this.drawShieldShape(graphics, width, height, 0x1a5f7a, 1.0, true);

    // Lighter blue/teal inner border (3D depth effect)
    this.drawShieldShape(graphics, width - 2, height - 2, 0x2a9d8f, 1.0, true);

    // Black inner outline
    this.drawShieldShape(graphics, width - 4, height - 4, 0x000000, 1.0, true);

    // Draw 3 VERTICAL curved segments that follow shield shape
    this.drawVerticalSegments(graphics, width - 6, height - 6, shieldColor, currentHP);
  }

  /**
   * Draw 3 vertical segments with curved edges and gradient shading
   */
  private drawVerticalSegments(
    graphics: PIXI.Graphics,
    width: number,
    height: number,
    baseColor: number,
    currentHP: number
  ): void {
    const segmentWidth = width / 3;
    const startX = -width / 2;
    const startY = -height / 2;

    for (let i = 0; i < 3; i++) {
      const isFilled = i < currentHP;
      const x = startX + (i * segmentWidth);

      if (isFilled) {
        // Create gradient: lighter at top-left, darker at bottom-right
        const lightColor = this.lightenColor(baseColor, 1.4);
        const midColor = baseColor;
        const darkColor = this.darkenColor(baseColor, 0.7);

        // Top half (lighter gradient)
        graphics.rect(x, startY, segmentWidth, height / 2);
        graphics.fill({ color: lightColor, alpha: 1.0 });

        // Bottom half (darker gradient)
        graphics.rect(x, startY + height / 2, segmentWidth, height / 2);
        graphics.fill({ color: darkColor, alpha: 1.0 });

        // Add highlight on left edge of segment (glossy effect)
        if (i === 0 || i === 1) {
          graphics.rect(x + 1, startY + 2, 1.5, height - 4);
          graphics.fill({ color: 0xffffff, alpha: 0.3 });
        }

        // Add shadow on right edge of segment
        graphics.rect(x + segmentWidth - 1.5, startY + 2, 1.5, height - 4);
        graphics.fill({ color: 0x000000, alpha: 0.4 });
      } else {
        // Empty segment - very dark with subtle gradient
        graphics.rect(x, startY, segmentWidth, height / 2);
        graphics.fill({ color: 0x1a1a1a, alpha: 0.9 });

        graphics.rect(x, startY + height / 2, segmentWidth, height / 2);
        graphics.fill({ color: 0x000000, alpha: 0.9 });
      }

      // Black divider line between segments
      if (i < 2) {
        graphics.rect(x + segmentWidth - 0.5, startY + 1, 1, height - 2);
        graphics.fill({ color: 0x000000, alpha: 0.9 });
      }
    }
  }

  /**
   * Draw smooth shield shape with rounded top and pointed bottom
   */
  private drawShieldShape(
    graphics: PIXI.Graphics,
    width: number,
    height: number,
    color: number,
    alpha: number,
    fill: boolean = true
  ): void {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const topWidth = width * 0.85; // Narrower at top
    const halfTopWidth = topWidth / 2;
    const shoulderHeight = height * 0.15; // Where it widens
    const pointHeight = height * 0.35; // Where it narrows to point

    graphics.moveTo(-halfTopWidth, -halfHeight);

    // Top edge (slightly curved)
    graphics.bezierCurveTo(
      -halfTopWidth, -halfHeight - 1,
      halfTopWidth, -halfHeight - 1,
      halfTopWidth, -halfHeight
    );

    // Right shoulder (curves outward)
    graphics.bezierCurveTo(
      halfTopWidth + 2, -halfHeight + shoulderHeight / 2,
      halfWidth, -halfHeight + shoulderHeight,
      halfWidth, -halfHeight + shoulderHeight
    );

    // Right side (straight down)
    graphics.lineTo(halfWidth, halfHeight - pointHeight);

    // Right diagonal to bottom point (curved)
    graphics.bezierCurveTo(
      halfWidth, halfHeight - pointHeight / 2,
      halfWidth / 2, halfHeight - 2,
      0, halfHeight
    );

    // Left diagonal from bottom point (curved)
    graphics.bezierCurveTo(
      -halfWidth / 2, halfHeight - 2,
      -halfWidth, halfHeight - pointHeight / 2,
      -halfWidth, halfHeight - pointHeight
    );

    // Left side (straight up)
    graphics.lineTo(-halfWidth, -halfHeight + shoulderHeight);

    // Left shoulder (curves outward)
    graphics.bezierCurveTo(
      -halfWidth, -halfHeight + shoulderHeight,
      -halfTopWidth - 2, -halfHeight + shoulderHeight / 2,
      -halfTopWidth, -halfHeight
    );

    if (fill) {
      graphics.fill({ color, alpha });
    } else {
      graphics.stroke({ width: 1, color, alpha });
    }
  }

  /**
   * Lighten a color by a factor
   */
  private lightenColor(color: number, factor: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) * factor);
    const g = Math.min(255, ((color >> 8) & 0xff) * factor);
    const b = Math.min(255, (color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Darken a color by a factor
   */
  private darkenColor(color: number, factor: number): number {
    const r = ((color >> 16) & 0xff) * factor;
    const g = ((color >> 8) & 0xff) * factor;
    const b = (color & 0xff) * factor;
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Apply damage to this defense dot
   *
   * CRITICAL: This is called by the store when a projectile hits
   * The HP change is immediate and visible to all collision checks
   */
  public takeDamage(amount: number): void {
    if (!this.alive) {
      console.warn(`⚠️ Attempted to damage dead defense dot: ${this.id}`);
      return;
    }

    const hpBefore = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    const hpAfter = this.hp;

    console.log(`🛡️ [DEFENSE DOT] ${this.id} took ${amount} damage | ${hpBefore} → ${hpAfter} HP`);

    if (this.hp <= 0) {
      this.destroy();
    } else {
      this.updateVisuals();
      this.animateDamage();
    }
  }

  /**
   * Update sprite visuals based on current HP
   * Redraws the segmented circle to show HP loss
   */
  private updateVisuals(): void {
    const dotColor = this.team.color;
    this.drawHPSegments(this.sprite, dotColor, this.hp);

    // Slight size scaling based on HP (100% → 85% size)
    const hpPercent = this.hp / this.maxHp;
    const sizeScale = 0.85 + (hpPercent * 0.15); // 85% at 0 HP, 100% at full HP
    this.sprite.scale.set(sizeScale, sizeScale);
  }

  /**
   * Animate damage effect
   */
  private animateDamage(): void {
    // Scale pulse animation
    gsap.timeline()
      .to(this.sprite.scale, {
        x: 1.3,
        y: 1.3,
        duration: 0.1,
        ease: 'power2.out',
      })
      .to(this.sprite.scale, {
        x: 1,
        y: 1,
        duration: 0.2,
        ease: 'elastic.out(1, 0.5)',
      });

    // Flash effect (keep full opacity - don't dim based on HP)
    gsap.timeline()
      .to(this.sprite, {
        alpha: 0.3,
        duration: 0.1,
      })
      .to(this.sprite, {
        alpha: 1.0, // Always return to full opacity
        duration: 0.2,
      });
  }

  /**
   * Destroy this defense dot with smooth, professional death animation
   *
   * CRITICAL: Sets alive = false IMMEDIATELY
   * This ensures the next collision check will filter out this dot
   */
  private destroy(): void {
    this.alive = false;

    console.log(`💀 [DEFENSE DOT DESTROYED] ${this.id} | HP: 0/${this.maxHp}`);

    // Smooth, subtle death animation
    gsap.timeline()
      // Quick pulse
      .to(this.sprite.scale, {
        x: 1.3,
        y: 1.3,
        duration: 0.1,
        ease: 'power2.out',
      })
      // Fade and shrink simultaneously
      .to(this.sprite, {
        alpha: 0,
        duration: 0.25,
        ease: 'power2.in',
      }, '-=0.05')
      .to(this.sprite.scale, {
        x: 0.3,
        y: 0.3,
        duration: 0.25,
        ease: 'power2.in',
      }, '-=0.25')
      // Cleanup
      .call(() => {
        this.sprite.visible = false;
        console.log(`✅ Defense dot animation complete: ${this.id}`);
      });
  }

  /**
   * Restore this defense dot to a specific state (for loading from database)
   */
  public restore(hp: number, alive: boolean): void {
    this.hp = hp;
    this.alive = alive;

    if (!alive) {
      this.sprite.visible = false;
      this.sprite.alpha = 0;
      this.sprite.scale.set(0, 0);
    } else {
      this.sprite.visible = true;
      this.sprite.alpha = 1.0; // Always full opacity regardless of HP
      this.sprite.scale.set(1, 1);
    }
  }

  /**
   * Get serializable state for saving to database
   */
  public getState(): {
    id: string;
    hp: number;
    alive: boolean;
  } {
    return {
      id: this.id,
      hp: this.hp,
      alive: this.alive,
    };
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    gsap.killTweensOf(this.sprite);
    gsap.killTweensOf(this.sprite.scale);
    this.sprite.destroy();
  }
}

