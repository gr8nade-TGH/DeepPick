/**
 * DefenseDot entity - Represents a defense dot in the battle grid
 * Now uses Figma-designed SVG sprites instead of hand-coded Graphics
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import type { DefenseDotConfig, Position, Team } from '../../types/game';
import { loadDefenseOrbTexture } from '../assets/IconTextureLoader';

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
  public sprite: PIXI.Container; // Container holding the SVG sprite
  private iconSprite: PIXI.Sprite | null = null; // The actual icon sprite
  public readonly radius: number = 16; // Icon size (32px / 2)

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

    // Create sprite (async loading handled internally)
    this.sprite = this.createSprite();
  }

  /**
   * Create Figma SVG sprite with HP visualization
   * - Uses loadDefenseOrbTexture to get team-colored icon
   * - Opacity and scale based on HP
   */
  private createSprite(): PIXI.Container {
    const container = new PIXI.Container();
    container.x = this.position.x;
    container.y = this.position.y;

    // Load the icon texture asynchronously
    this.loadIcon();

    return container;
  }

  /**
   * Load the defense orb icon texture with team color
   */
  private async loadIcon(): Promise<void> {
    try {
      // Convert team color number to hex string
      const teamColorHex = `#${this.team.color.toString(16).padStart(6, '0')}`;

      // Load texture
      const texture = await loadDefenseOrbTexture(teamColorHex);

      // Create sprite
      this.iconSprite = new PIXI.Sprite(texture);
      this.iconSprite.anchor.set(0.5, 0.5); // Center the sprite
      this.iconSprite.width = 32; // Match SVG viewBox
      this.iconSprite.height = 32;

      // Add to container
      this.sprite.addChild(this.iconSprite);

      // Update visuals based on current HP
      this.updateVisuals();

      console.log(`✅ [DefenseDot] Loaded icon for ${this.id}`);
    } catch (error) {
      console.error(`❌ [DefenseDot] Failed to load icon for ${this.id}:`, error);

      // Fallback: create a simple circle
      const fallback = new PIXI.Graphics();
      fallback.circle(0, 0, 16);
      fallback.fill({ color: this.team.color });
      this.sprite.addChild(fallback);
    }
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
   * Adjusts opacity and scale based on HP percentage
   */
  private updateVisuals(): void {
    if (!this.iconSprite) return;

    // Opacity based on HP (30% → 100%)
    const hpPercent = this.hp / this.maxHp;
    this.iconSprite.alpha = 0.3 + (hpPercent * 0.7);

    // Slight size scaling based on HP (85% → 100% size)
    const sizeScale = 0.85 + (hpPercent * 0.15);
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

