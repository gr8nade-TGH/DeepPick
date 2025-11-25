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
    const w = this.radius * 2; // 20px wide
    const h = this.radius * 2.4; // 24px tall

    // Outer glow (team color, soft)
    const glowAlpha = 0.3 + (hpPercent * 0.3);
    this.drawShieldOutline(graphics, w + 6, h + 6, shieldColor, glowAlpha);

    // Dark blue border (outer edge - like reference)
    this.drawShieldOutline(graphics, w + 1, h + 1, 0x1a5f7a, 1.0);

    // Lighter blue/teal border (3D highlight)
    this.drawShieldOutline(graphics, w - 0.5, h - 0.5, 0x2a9d8f, 1.0);

    // Black inner background
    this.drawShieldOutline(graphics, w - 2, h - 2, 0x000000, 1.0);

    // Draw 3 curved vertical segments that follow shield shape
    this.drawCurvedVerticalSegments(graphics, w - 3, h - 3, shieldColor, currentHP);
  }

  /**
   * Draw 3 curved vertical segments using bezier curves to match shield contour
   */
  private drawCurvedVerticalSegments(
    graphics: PIXI.Graphics,
    width: number,
    height: number,
    baseColor: number,
    currentHP: number
  ): void {
    const topY = -height / 2;
    const midY = 0;
    const bottomY = height / 2;

    // Shield width at different heights
    const topW = width * 0.7;
    const midW = width;
    const bottomW = width * 0.35;

    // Segment positions (left, center, right)
    const segments = [
      { // Left segment
        topL: -topW / 2,
        topR: -topW / 6,
        midL: -midW / 2,
        midR: -midW / 6,
        bottomL: -bottomW / 2,
        bottomR: 0,
      },
      { // Center segment
        topL: -topW / 6,
        topR: topW / 6,
        midL: -midW / 6,
        midR: midW / 6,
        bottomL: 0,
        bottomR: 0,
      },
      { // Right segment
        topL: topW / 6,
        topR: topW / 2,
        midL: midW / 6,
        midR: midW / 2,
        bottomL: 0,
        bottomR: bottomW / 2,
      }
    ];

    for (let i = 0; i < 3; i++) {
      const seg = segments[i];
      const isFilled = i < currentHP;

      if (isFilled) {
        const lightColor = this.lightenColor(baseColor, 1.35);
        const darkColor = this.darkenColor(baseColor, 0.7);

        // Top half (lighter) - use bezier curves
        graphics.moveTo(seg.topL, topY);
        graphics.bezierCurveTo(
          seg.topL, topY + height * 0.1,
          seg.midL, midY - height * 0.1,
          seg.midL, midY
        );
        graphics.lineTo(seg.midR, midY);
        graphics.bezierCurveTo(
          seg.midR, midY - height * 0.1,
          seg.topR, topY + height * 0.1,
          seg.topR, topY
        );
        graphics.lineTo(seg.topL, topY);
        graphics.fill({ color: lightColor, alpha: 1.0 });

        // Bottom half (darker) - use bezier curves
        graphics.moveTo(seg.midL, midY);
        graphics.bezierCurveTo(
          seg.midL, midY + height * 0.15,
          seg.bottomL, bottomY - height * 0.15,
          seg.bottomL === 0 ? 0 : seg.bottomL, bottomY
        );
        if (seg.bottomR === 0 && seg.bottomL === 0) {
          // Center segment converges to single point
          graphics.lineTo(0, bottomY);
        } else {
          graphics.lineTo(seg.bottomR === 0 ? 0 : seg.bottomR, bottomY);
        }
        graphics.bezierCurveTo(
          seg.bottomR === 0 ? 0 : seg.bottomR, bottomY - height * 0.15,
          seg.midR, midY + height * 0.15,
          seg.midR, midY
        );
        graphics.lineTo(seg.midL, midY);
        graphics.fill({ color: darkColor, alpha: 1.0 });

        // Glossy highlight on left edge
        if (i === 0) {
          graphics.moveTo(seg.topL + 1, topY + 2);
          graphics.bezierCurveTo(
            seg.topL + 1, topY + height * 0.15,
            seg.midL + 1, midY - height * 0.1,
            seg.midL + 1, midY
          );
          graphics.lineTo(seg.midL + 0.5, midY);
          graphics.bezierCurveTo(
            seg.midL + 0.5, midY - height * 0.1,
            seg.topL + 0.5, topY + height * 0.15,
            seg.topL + 0.5, topY + 2
          );
          graphics.fill({ color: 0xffffff, alpha: 0.35 });
        }
      } else {
        // Empty segment - dark with curves
        graphics.moveTo(seg.topL, topY);
        graphics.bezierCurveTo(
          seg.topL, topY + height * 0.1,
          seg.midL, midY - height * 0.1,
          seg.midL, midY
        );
        graphics.bezierCurveTo(
          seg.midL, midY + height * 0.15,
          seg.bottomL === 0 ? 0 : seg.bottomL, bottomY - height * 0.15,
          seg.bottomL === 0 ? 0 : seg.bottomL, bottomY
        );
        if (seg.bottomR !== 0) {
          graphics.lineTo(seg.bottomR, bottomY);
        }
        graphics.bezierCurveTo(
          seg.bottomR === 0 ? 0 : seg.bottomR, bottomY - height * 0.15,
          seg.midR, midY + height * 0.15,
          seg.midR, midY
        );
        graphics.bezierCurveTo(
          seg.midR, midY - height * 0.1,
          seg.topR, topY + height * 0.1,
          seg.topR, topY
        );
        graphics.lineTo(seg.topL, topY);
        graphics.fill({ color: 0x0a0a0a, alpha: 0.95 });
      }

      // Black curved divider line between segments
      if (i < 2) {
        const nextSeg = segments[i + 1];
        graphics.moveTo(seg.topR, topY);
        graphics.bezierCurveTo(
          seg.topR, topY + height * 0.1,
          seg.midR, midY - height * 0.1,
          seg.midR, midY
        );
        graphics.bezierCurveTo(
          seg.midR, midY + height * 0.15,
          seg.bottomR === 0 ? 0 : seg.bottomR, bottomY - height * 0.15,
          seg.bottomR === 0 ? 0 : seg.bottomR, bottomY
        );
        graphics.stroke({ width: 1.5, color: 0x000000, alpha: 1.0 });
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

