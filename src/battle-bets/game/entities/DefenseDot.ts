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
    const w = this.radius * 2.2; // 22px wide
    const h = this.radius * 2.6; // 26px tall

    // Outer glow (team color, soft)
    const glowAlpha = 0.25 + (hpPercent * 0.35);
    this.drawShieldOutline(graphics, w + 5, h + 5, shieldColor, glowAlpha);

    // Dark blue border (outer edge)
    this.drawShieldOutline(graphics, w + 1.5, h + 1.5, 0x1a5f7a, 1.0);

    // Lighter teal border (3D highlight)
    this.drawShieldOutline(graphics, w, h, 0x2a9d8f, 1.0);

    // Black background fill
    this.drawShieldOutline(graphics, w - 1.5, h - 1.5, 0x000000, 1.0);

    // Draw 3 curved vertical segments using clipping
    this.drawShieldSegments(graphics, w - 2, h - 2, shieldColor, currentHP);
  }

  /**
   * Draw 3 shield segments - each segment is a curved path following shield outline
   */
  private drawShieldSegments(
    graphics: PIXI.Graphics,
    width: number,
    height: number,
    baseColor: number,
    currentHP: number
  ): void {
    // Get shield curve points at different Y levels
    const points = this.getShieldCurvePoints(width, height);

    // Calculate X positions for 3 vertical dividers
    const divider1X = -width * 0.2; // Left divider
    const divider2X = width * 0.2;  // Right divider

    // Draw each segment with proper curved edges
    for (let segmentIndex = 0; segmentIndex < 3; segmentIndex++) {
      const isFilled = segmentIndex < currentHP;

      // Determine left and right X bounds for this segment
      let leftBound: (y: number) => number;
      let rightBound: (y: number) => number;

      if (segmentIndex === 0) {
        // Left segment: shield left edge to divider1
        leftBound = (y: number) => this.getShieldXAtY(y, width, height, 'left');
        rightBound = (y: number) => divider1X;
      } else if (segmentIndex === 1) {
        // Center segment: divider1 to divider2
        leftBound = (y: number) => divider1X;
        rightBound = (y: number) => divider2X;
      } else {
        // Right segment: divider2 to shield right edge
        leftBound = (y: number) => divider2X;
        rightBound = (y: number) => this.getShieldXAtY(y, width, height, 'right');
      }

      // Draw segment with gradient (lighter top, darker bottom)
      if (isFilled) {
        const lightColor = this.lightenColor(baseColor, 1.4);
        const darkColor = this.darkenColor(baseColor, 0.65);

        // Top half (lighter)
        this.drawSegmentHalf(graphics, leftBound, rightBound, -height / 2, 0, lightColor);

        // Bottom half (darker)
        this.drawSegmentHalf(graphics, leftBound, rightBound, 0, height / 2, darkColor);

        // Add glossy highlight on left edge of left segment
        if (segmentIndex === 0) {
          this.drawSegmentHighlight(graphics, leftBound, -height / 2, height / 2);
        }
      } else {
        // Empty segment - dark
        this.drawSegmentHalf(graphics, leftBound, rightBound, -height / 2, height / 2, 0x0a0a0a);
      }
    }

    // Draw black divider lines
    this.drawDividerLine(graphics, divider1X, width, height);
    this.drawDividerLine(graphics, divider2X, width, height);
  }

  /**
   * Get X coordinate of shield edge at given Y position
   */
  private getShieldXAtY(y: number, width: number, height: number, side: 'left' | 'right'): number {
    const topY = -height / 2;
    const midY = 0;
    const bottomY = height / 2;

    const topW = width * 0.65;
    const midW = width;
    const bottomW = width * 0.3;

    let w: number;

    if (y <= midY) {
      // Top half: interpolate between topW and midW
      const t = (y - topY) / (midY - topY);
      w = topW + (midW - topW) * t;
    } else {
      // Bottom half: interpolate between midW and bottomW
      const t = (y - midY) / (bottomY - midY);
      w = midW + (bottomW - midW) * t;
    }

    return side === 'left' ? -w / 2 : w / 2;
  }

  /**
   * Get shield curve points for reference
   */
  private getShieldCurvePoints(width: number, height: number) {
    const topY = -height / 2;
    const midY = 0;
    const bottomY = height / 2;

    return {
      top: { y: topY, width: width * 0.65 },
      mid: { y: midY, width: width },
      bottom: { y: bottomY, width: width * 0.3 }
    };
  }

  /**
   * Draw half of a segment (top or bottom) with curved edges
   */
  private drawSegmentHalf(
    graphics: PIXI.Graphics,
    leftBound: (y: number) => number,
    rightBound: (y: number) => number,
    startY: number,
    endY: number,
    color: number
  ): void {
    const steps = 8; // Number of curve steps
    const stepSize = (endY - startY) / steps;

    // Start at top-left
    graphics.moveTo(leftBound(startY), startY);

    // Draw left edge (curved)
    for (let i = 1; i <= steps; i++) {
      const y = startY + (stepSize * i);
      graphics.lineTo(leftBound(y), y);
    }

    // Draw bottom edge
    graphics.lineTo(rightBound(endY), endY);

    // Draw right edge (curved, going back up)
    for (let i = steps - 1; i >= 0; i--) {
      const y = startY + (stepSize * i);
      graphics.lineTo(rightBound(y), y);
    }

    // Close path
    graphics.lineTo(leftBound(startY), startY);
    graphics.fill({ color, alpha: 1.0 });
  }

  /**
   * Draw glossy highlight on left edge
   */
  private drawSegmentHighlight(
    graphics: PIXI.Graphics,
    leftBound: (y: number) => number,
    startY: number,
    endY: number
  ): void {
    const steps = 8;
    const stepSize = (endY - startY) / steps;
    const highlightWidth = 2;

    graphics.moveTo(leftBound(startY) + 0.5, startY + 2);

    for (let i = 1; i <= steps; i++) {
      const y = startY + (stepSize * i);
      graphics.lineTo(leftBound(y) + 0.5, y);
    }

    for (let i = steps - 1; i >= 0; i--) {
      const y = startY + (stepSize * i);
      graphics.lineTo(leftBound(y) + highlightWidth, y);
    }

    graphics.fill({ color: 0xffffff, alpha: 0.3 });
  }

  /**
   * Draw vertical divider line that follows shield curve
   */
  private drawDividerLine(
    graphics: PIXI.Graphics,
    x: number,
    width: number,
    height: number
  ): void {
    const steps = 12;
    const startY = -height / 2;
    const endY = height / 2;
    const stepSize = (endY - startY) / steps;

    graphics.moveTo(x, startY);

    for (let i = 1; i <= steps; i++) {
      const y = startY + (stepSize * i);
      graphics.lineTo(x, y);
    }

    graphics.stroke({ width: 1.8, color: 0x000000, alpha: 1.0 });
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

