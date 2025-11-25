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
  public readonly radius: number = 10; // Shield size - bigger for detail

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
    const w = this.radius * 1.8; // 18px wide
    const h = this.radius * 2.2; // 22px tall (taller than wide)

    // Outer glow (team color, soft)
    const glowAlpha = 0.3 + (hpPercent * 0.3);
    this.drawShieldOutline(graphics, w + 6, h + 6, shieldColor, glowAlpha);

    // Dark blue/teal border (outer 3D edge)
    this.drawShieldOutline(graphics, w, h, 0x1a5f7a, 1.0);

    // Lighter teal border (inner 3D highlight)
    this.drawShieldOutline(graphics, w - 2, h - 2, 0x2a9d8f, 1.0);

    // Black background
    this.drawShieldOutline(graphics, w - 3.5, h - 3.5, 0x000000, 1.0);

    // Draw 3 VERTICAL curved segments
    this.drawCurvedSegments(graphics, w - 4, h - 4, shieldColor, currentHP);
  }

  /**
   * Draw 3 curved vertical segments that taper with the shield shape
   */
  private drawCurvedSegments(
    graphics: PIXI.Graphics,
    width: number,
    height: number,
    baseColor: number,
    currentHP: number
  ): void {
    // Each segment is a curved polygon that follows shield contour
    const topY = -height / 2;
    const midY = 0;
    const bottomY = height / 2;

    // Top width (narrower)
    const topWidth = width * 0.75;
    const topSegW = topWidth / 3;

    // Middle width (widest)
    const midWidth = width;
    const midSegW = midWidth / 3;

    // Bottom width (narrowest - converges to point)
    const bottomWidth = width * 0.4;
    const bottomSegW = bottomWidth / 3;

    // Draw each of the 3 segments
    for (let i = 0; i < 3; i++) {
      const isFilled = i < currentHP;

      // Calculate X positions for this segment at each Y level
      const topLeft = -topWidth / 2 + (i * topSegW);
      const topRight = topLeft + topSegW;

      const midLeft = -midWidth / 2 + (i * midSegW);
      const midRight = midLeft + midSegW;

      const bottomLeft = -bottomWidth / 2 + (i * bottomSegW);
      const bottomRight = bottomLeft + bottomSegW;

      if (isFilled) {
        // Draw curved segment with gradient
        const lightColor = this.lightenColor(baseColor, 1.3);
        const darkColor = this.darkenColor(baseColor, 0.75);

        // Top half (lighter)
        graphics.moveTo(topLeft, topY);
        graphics.lineTo(topRight, topY);
        graphics.lineTo(midRight, midY);
        graphics.lineTo(midLeft, midY);
        graphics.lineTo(topLeft, topY);
        graphics.fill({ color: lightColor, alpha: 1.0 });

        // Bottom half (darker)
        graphics.moveTo(midLeft, midY);
        graphics.lineTo(midRight, midY);
        graphics.lineTo(bottomRight, bottomY);
        graphics.lineTo(bottomLeft, bottomY);
        graphics.lineTo(midLeft, midY);
        graphics.fill({ color: darkColor, alpha: 1.0 });

        // Glossy highlight on left edge
        if (i === 0) {
          graphics.moveTo(topLeft + 0.5, topY + 1);
          graphics.lineTo(topLeft + 1.5, topY + 1);
          graphics.lineTo(midLeft + 1.5, midY);
          graphics.lineTo(midLeft + 0.5, midY);
          graphics.fill({ color: 0xffffff, alpha: 0.4 });
        }
      } else {
        // Empty segment - dark
        graphics.moveTo(topLeft, topY);
        graphics.lineTo(topRight, topY);
        graphics.lineTo(midRight, midY);
        graphics.lineTo(bottomRight, bottomY);
        graphics.lineTo(bottomLeft, bottomY);
        graphics.lineTo(midLeft, midY);
        graphics.lineTo(topLeft, topY);
        graphics.fill({ color: 0x0a0a0a, alpha: 0.95 });
      }

      // Black divider line between segments
      if (i < 2) {
        graphics.moveTo(topRight, topY);
        graphics.lineTo(midRight, midY);
        graphics.lineTo(bottomRight, bottomY);
        graphics.stroke({ width: 1.2, color: 0x000000, alpha: 1.0 });
      }
    }
  }

  /**
   * Draw classic medieval shield outline - wider at top, curves in, pointed bottom
   */
  private drawShieldOutline(
    graphics: PIXI.Graphics,
    width: number,
    height: number,
    color: number,
    alpha: number
  ): void {
    const topY = -height / 2;
    const midY = 0; // Widest point
    const bottomY = height / 2;

    const topWidth = width * 0.75; // Narrower at top
    const midWidth = width; // Widest at middle
    const bottomWidth = width * 0.4; // Narrow at bottom (converges to point)

    // Start at top-left
    graphics.moveTo(-topWidth / 2, topY);

    // Top edge (slightly curved)
    graphics.bezierCurveTo(
      -topWidth / 2, topY - 0.5,
      topWidth / 2, topY - 0.5,
      topWidth / 2, topY
    );

    // Right side: top to middle (curves outward)
    graphics.bezierCurveTo(
      topWidth / 2 + 1, topY + height * 0.15,
      midWidth / 2, midY - height * 0.1,
      midWidth / 2, midY
    );

    // Right side: middle to bottom (curves inward to point)
    graphics.bezierCurveTo(
      midWidth / 2, midY + height * 0.15,
      bottomWidth / 2 + 1, bottomY - height * 0.2,
      0, bottomY
    );

    // Left side: bottom to middle (curves inward from point)
    graphics.bezierCurveTo(
      -bottomWidth / 2 - 1, bottomY - height * 0.2,
      -midWidth / 2, midY + height * 0.15,
      -midWidth / 2, midY
    );

    // Left side: middle to top (curves outward)
    graphics.bezierCurveTo(
      -midWidth / 2, midY - height * 0.1,
      -topWidth / 2 - 1, topY + height * 0.15,
      -topWidth / 2, topY
    );

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

