/**
 * KnightDefender entity - A roaming defender in the battlefield zone
 * 
 * - Spawns in the middle battlefield area on owner's side
 * - Roams up and down between stat rows
 * - Deflects projectiles (1 second cooldown)
 * - Has 20 HP
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { gridManager } from '../managers/GridManager';
import { DEFAULT_GRID_CONFIG } from '../../types/game';

export interface KnightDefenderConfig {
  id: string;
  gameId: string;
  side: 'left' | 'right';
  hp?: number;
  teamColor: number;
}

export class KnightDefender {
  // Identity
  public readonly id: string;
  public readonly gameId: string;
  public readonly side: 'left' | 'right';

  // State
  public hp: number;
  public readonly maxHp: number = 20;
  public alive: boolean = true;
  public lastDeflectTime: number = 0;
  public readonly deflectCooldown: number = 1000; // 1 second in ms

  // Visual
  public sprite: PIXI.Container;
  public readonly teamColor: number;
  private knightGraphics: PIXI.Graphics;

  // Position & Movement
  public position: { x: number; y: number };
  private patrolTween: gsap.core.Tween | null = null;
  private readonly patrolSpeed: number = 2000; // ms to move between rows

  // Collision
  public readonly collisionRadius: number = 20;

  constructor(config: KnightDefenderConfig) {
    this.id = config.id;
    this.gameId = config.gameId;
    this.side = config.side;
    this.hp = config.hp ?? this.maxHp;
    this.teamColor = config.teamColor;

    // Calculate starting position in battlefield zone
    this.position = this.calculateStartPosition();

    // Create sprite
    this.sprite = new PIXI.Container();
    this.knightGraphics = this.createKnightGraphics();
    this.sprite.addChild(this.knightGraphics);
    this.sprite.x = this.position.x;
    this.sprite.y = this.position.y;

    console.log(`🐴 [KnightDefender] Created for ${this.side} at (${this.position.x}, ${this.position.y})`);
  }

  /**
   * Calculate starting position in the battlefield zone
   */
  private calculateStartPosition(): { x: number; y: number } {
    const layout = gridManager.getLayout();
    const cellHeight = DEFAULT_GRID_CONFIG.cellHeight;

    // Middle of battlefield, offset to owner's side
    const battlefieldCenter = (layout.battlefieldStart + layout.battlefieldEnd) / 2;
    const offset = 30; // Offset from center toward owner's side

    const x = this.side === 'left'
      ? battlefieldCenter - offset
      : battlefieldCenter + offset;

    // Start at middle row (AST row = row 2, 0-indexed)
    const y = cellHeight * 2 + cellHeight / 2;

    return { x, y };
  }

  /**
   * Create knight graphics (simple horseman shape)
   */
  private createKnightGraphics(): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const size = 24;

    // Draw a simple knight on horse silhouette
    const color = this.teamColor;

    // Horse body (ellipse)
    g.ellipse(0, 4, size * 0.6, size * 0.35);
    g.fill({ color, alpha: 1 });

    // Horse head
    const headX = this.side === 'left' ? size * 0.4 : -size * 0.4;
    g.ellipse(headX, -2, size * 0.2, size * 0.15);
    g.fill({ color, alpha: 1 });

    // Knight body (on top of horse)
    g.ellipse(0, -8, size * 0.25, size * 0.35);
    g.fill({ color, alpha: 1 });

    // Knight head
    g.circle(0, -18, size * 0.18);
    g.fill({ color, alpha: 1 });

    // Lance
    const lanceDir = this.side === 'left' ? 1 : -1;
    g.moveTo(0, -12);
    g.lineTo(lanceDir * size * 0.8, -25);
    g.stroke({ width: 2, color, alpha: 1 });

    // Lance tip
    g.circle(lanceDir * size * 0.8, -25, 3);
    g.fill({ color: 0xCCCCCC, alpha: 1 });

    // Outline glow
    g.circle(0, 0, size * 0.8);
    g.stroke({ width: 2, color: this.teamColor, alpha: 0.3 });

    return g;
  }

  /**
   * Start roaming patrol
   */
  public startPatrol(): void {
    this.patrol();
  }

  /**
   * Patrol up and down randomly
   */
  private patrol(): void {
    if (!this.alive) return;

    const cellHeight = DEFAULT_GRID_CONFIG.cellHeight;
    const minY = cellHeight / 2; // Top of PTS row
    const maxY = cellHeight * 4 + cellHeight / 2; // Bottom of 3PT row

    // Pick random target Y
    const targetY = minY + Math.random() * (maxY - minY);
    const distance = Math.abs(targetY - this.position.y);
    const duration = (distance / (maxY - minY)) * this.patrolSpeed / 1000;

    this.patrolTween = gsap.to(this.sprite, {
      y: targetY,
      duration: Math.max(0.5, duration),
      ease: 'sine.inOut',
      onUpdate: () => {
        this.position.y = this.sprite.y;
      },
      onComplete: () => {
        // Small pause then patrol again
        gsap.delayedCall(0.3 + Math.random() * 0.5, () => this.patrol());
      },
    });
  }

  /**
   * Check if knight can deflect (cooldown elapsed)
   */
  public canDeflect(): boolean {
    const now = Date.now();
    return now - this.lastDeflectTime >= this.deflectCooldown;
  }

  /**
   * Deflect a projectile (no damage taken)
   */
  public deflect(): void {
    this.lastDeflectTime = Date.now();
    console.log(`🛡️ [KnightDefender] ${this.id} DEFLECTED a projectile!`);

    // Visual feedback - flash
    gsap.timeline()
      .to(this.sprite, { alpha: 0.3, duration: 0.05 })
      .to(this.sprite, { alpha: 1, duration: 0.1 });

    // Scale pulse
    gsap.timeline()
      .to(this.sprite.scale, { x: 1.3, y: 1.3, duration: 0.1, ease: 'power2.out' })
      .to(this.sprite.scale, { x: 1, y: 1, duration: 0.2, ease: 'elastic.out(1, 0.5)' });
  }

  /**
   * Take damage (when hit during cooldown)
   */
  public takeDamage(amount: number = 1): void {
    if (!this.alive) return;

    const hpBefore = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    console.log(`💥 [KnightDefender] ${this.id} took ${amount} damage | ${hpBefore} → ${this.hp} HP`);

    if (this.hp <= 0) {
      this.destroy();
    } else {
      // Damage flash (red tint)
      gsap.timeline()
        .to(this.knightGraphics, { alpha: 0.5, duration: 0.1 })
        .to(this.knightGraphics, { alpha: 1, duration: 0.15 });
    }
  }

  /**
   * Destroy the knight
   */
  private destroy(): void {
    this.alive = false;
    console.log(`💀 [KnightDefender] ${this.id} DESTROYED!`);

    // Stop patrol
    if (this.patrolTween) {
      this.patrolTween.kill();
    }

    // Death animation
    gsap.timeline()
      .to(this.sprite.scale, { x: 1.5, y: 1.5, duration: 0.15, ease: 'power2.out' })
      .to(this.sprite, { alpha: 0, duration: 0.3, ease: 'power2.in' }, '-=0.1')
      .to(this.sprite.scale, { x: 0.5, y: 0.5, duration: 0.3 }, '-=0.3')
      .call(() => {
        this.sprite.visible = false;
      });
  }

  /**
   * Check collision with a projectile position
   */
  public checkCollision(projectileX: number, projectileY: number, projectileRadius: number = 5): boolean {
    if (!this.alive) return false;

    const dx = projectileX - this.position.x;
    const dy = projectileY - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < (this.collisionRadius + projectileRadius);
  }

  /**
   * Handle projectile collision
   * Returns true if projectile should be destroyed
   */
  public handleProjectileHit(): boolean {
    if (!this.alive) return false;

    if (this.canDeflect()) {
      this.deflect();
      return true; // Projectile destroyed
    } else {
      this.takeDamage(1);
      return true; // Projectile still destroyed, but knight takes damage
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.patrolTween) {
      this.patrolTween.kill();
    }
    gsap.killTweensOf(this.sprite);
    gsap.killTweensOf(this.sprite.scale);
    gsap.killTweensOf(this.knightGraphics);
    this.sprite.destroy({ children: true });
  }
}

