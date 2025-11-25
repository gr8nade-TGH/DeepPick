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
   * Draw HP segments as a shield with 3 VERTICAL segments (like the reference image)
   * Each vertical segment represents 1 HP (max 3 segments)
   */
  private drawHPSegments(graphics: PIXI.Graphics, shieldColor: number, currentHP: number): void {
    graphics.clear();

    const hpPercent = currentHP / this.maxHp;
    const size = this.radius * 2.2; // 17.6px base size (slightly bigger for shield shape)

    // Outer glow (team color)
    const glowAlpha = 0.3 + (hpPercent * 0.4);
    const glowSize = size + 6;
    this.drawShieldOutline(graphics, glowSize, shieldColor, glowAlpha);

    // Blue/teal border (like the reference image)
    const borderColor = 0x2a9d8f; // Teal/cyan border
    this.drawShieldOutline(graphics, size, borderColor, 1.0);

    // Inner shield area (slightly smaller)
    const innerSize = size - 3;

    // Draw 3 VERTICAL segments (left, middle, right)
    const segmentWidth = (innerSize * 0.7) / 3; // 70% of width divided by 3
    const segmentHeight = innerSize * 0.85; // 85% of height
    const startX = -segmentWidth * 1.5; // Start from left
    const startY = -segmentHeight / 2 + 2; // Slightly below top

    for (let i = 0; i < this.maxHp; i++) {
      const isFilled = i < currentHP;
      const segmentX = startX + (i * segmentWidth);

      if (isFilled) {
        // Filled segment - team color with gradient (lighter left, darker right)
        const lightColor = this.lightenColor(shieldColor, 1.2);
        const darkColor = this.darkenColor(shieldColor, 0.8);

        // Create vertical gradient effect with two rectangles
        // Left half (lighter)
        graphics.rect(segmentX, startY, segmentWidth / 2, segmentHeight);
        graphics.fill({ color: lightColor, alpha: 1.0 });

        // Right half (darker)
        graphics.rect(segmentX + segmentWidth / 2, startY, segmentWidth / 2, segmentHeight);
        graphics.fill({ color: darkColor, alpha: 1.0 });

        // Vertical divider line between segments (black)
        if (i < this.maxHp - 1) {
          graphics.rect(segmentX + segmentWidth - 0.5, startY, 1, segmentHeight);
          graphics.fill({ color: 0x000000, alpha: 0.8 });
        }
      } else {
        // Empty segment - very dark
        graphics.rect(segmentX, startY, segmentWidth, segmentHeight);
        graphics.fill({ color: 0x000000, alpha: 0.7 });

        // Vertical divider line
        if (i < this.maxHp - 1) {
          graphics.rect(segmentX + segmentWidth - 0.5, startY, 1, segmentHeight);
          graphics.fill({ color: 0x000000, alpha: 0.8 });
        }
      }
    }
  }

  /**
   * Draw shield outline shape (pointed bottom, rounded top)
   */
  private drawShieldOutline(
    graphics: PIXI.Graphics,
    size: number,
    color: number,
    alpha: number
  ): void {
    const halfSize = size / 2;
    const topWidth = size * 0.75;
    const halfTopWidth = topWidth / 2;

    // Shield shape (pointed bottom like reference image)
    graphics.moveTo(-halfTopWidth, -halfSize); // Top-left
    graphics.lineTo(halfTopWidth, -halfSize); // Top-right
    graphics.lineTo(halfSize, -halfSize * 0.2); // Right shoulder
    graphics.lineTo(halfSize, halfSize * 0.4); // Right side
    graphics.lineTo(0, halfSize); // Bottom point
    graphics.lineTo(-halfSize, halfSize * 0.4); // Left side
    graphics.lineTo(-halfSize, -halfSize * 0.2); // Left shoulder
    graphics.lineTo(-halfTopWidth, -halfSize); // Back to top-left
    graphics.fill({ color, alpha });
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

