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
  public readonly radius: number = 8; // Shield size

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
   * Draw HP segments as a shield (using original pie-chart approach but shield-shaped)
   */
  private drawHPSegments(graphics: PIXI.Graphics, shieldColor: number, currentHP: number): void {
    graphics.clear();

    const hpPercent = currentHP / this.maxHp;
    const size = this.radius * 2; // 16px

    // Outer glow (team color)
    const glowAlpha = 0.25 + (hpPercent * 0.25);
    this.drawShieldOutline(graphics, size + 4, size + 4, shieldColor, glowAlpha);

    // Dark blue border
    this.drawShieldOutline(graphics, size + 1, size + 1, 0x1a5f7a, 1.0);

    // Lighter teal border
    this.drawShieldOutline(graphics, size, size, 0x2a9d8f, 1.0);

    // Draw HP pie segments inside shield shape
    this.drawShieldPieSegments(graphics, size - 2, shieldColor, currentHP);
  }

  /**
   * Draw pie segments inside shield shape (like original orb design but shield-shaped)
   */
  private drawShieldPieSegments(
    graphics: PIXI.Graphics,
    size: number,
    baseColor: number,
    currentHP: number
  ): void {
    const centerX = 0;
    const centerY = 0;

    // Draw 3 pie segments (120 degrees each)
    const segmentAngle = (Math.PI * 2) / 3; // 120 degrees in radians
    const startAngle = -Math.PI / 2; // Start at top

    for (let i = 0; i < this.maxHp; i++) {
      const isFilled = i < currentHP;
      const angle1 = startAngle + (i * segmentAngle);
      const angle2 = angle1 + segmentAngle;

      if (isFilled) {
        // Filled segment - team color with gradient
        const lightColor = this.lightenColor(baseColor, 1.2);
        const darkColor = this.darkenColor(baseColor, 0.8);

        // Draw pie segment clipped to shield shape
        this.drawShieldPieSegment(graphics, size, angle1, angle2, lightColor, darkColor);
      } else {
        // Empty segment - dark
        this.drawShieldPieSegment(graphics, size, angle1, angle2, 0x1a1a1a, 0x0a0a0a);
      }
    }
  }

  /**
   * Draw a single pie segment clipped to shield shape
   */
  private drawShieldPieSegment(
    graphics: PIXI.Graphics,
    size: number,
    startAngle: number,
    endAngle: number,
    color1: number,
    color2: number
  ): void {
    const steps = 20;
    const angleStep = (endAngle - startAngle) / steps;

    // Create shield-shaped pie segment
    graphics.moveTo(0, 0); // Center

    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (i * angleStep);
      const point = this.getShieldPointAtAngle(angle, size);
      graphics.lineTo(point.x, point.y);
    }

    graphics.lineTo(0, 0); // Back to center

    // Use gradient color (interpolate between color1 and color2)
    const midColor = this.interpolateColor(color1, color2, 0.5);
    graphics.fill({ color: midColor, alpha: 1.0 });

    // Draw black border between segments
    graphics.moveTo(0, 0);
    const endPoint = this.getShieldPointAtAngle(endAngle, size);
    graphics.lineTo(endPoint.x, endPoint.y);
    graphics.stroke({ width: 1, color: 0x000000, alpha: 0.8 });
  }

  /**
   * Get point on shield outline at given angle
   */
  private getShieldPointAtAngle(angle: number, size: number): { x: number; y: number } {
    // Convert angle to Y position
    const circleY = Math.sin(angle) * (size / 2);
    const circleX = Math.cos(angle) * (size / 2);

    // Get shield width at this Y position
    const shieldWidth = this.getShieldWidthAtY(circleY, size);

    // Scale X based on shield width vs circle width
    const scale = shieldWidth / size;
    const x = circleX * scale;
    const y = circleY;

    return { x, y };
  }

  /**
   * Get shield width at given Y position
   */
  private getShieldWidthAtY(y: number, size: number): number {
    const halfSize = size / 2;
    const normalizedY = y / halfSize; // -1 to 1

    // Shield shape: narrower at top and bottom, wider in middle
    if (normalizedY < 0) {
      // Top half: 70% to 100%
      const t = (normalizedY + 1); // 0 to 1
      return size * (0.7 + (0.3 * t));
    } else {
      // Bottom half: 100% to 40%
      const t = normalizedY; // 0 to 1
      return size * (1.0 - (0.6 * t));
    }
  }

  /**
   * Interpolate between two colors
   */
  private interpolateColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;

    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return (r << 16) | (g << 8) | b;
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

