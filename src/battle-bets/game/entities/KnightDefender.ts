/**
 * KnightDefender entity - A smart roaming defender in the battlefield zone
 *
 * Features:
 * - Spawns in the middle battlefield area on owner's side
 * - Smart AI: evades heavy fire, prioritizes weak lanes
 * - Deflects projectiles with shield animation (1 second cooldown)
 * - Has HP bar and visual feedback
 * - Dramatic death animation
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

// Threat tracking for smart AI
interface ThreatInfo {
  row: number;
  count: number;
  lastUpdate: number;
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
  private knightSprite: PIXI.Sprite | PIXI.Graphics;
  private hpBarContainer: PIXI.Container;
  private hpBarFill: PIXI.Graphics;
  private hpBarBg: PIXI.Graphics;
  private shieldEffect: PIXI.Graphics;
  private glowEffect: PIXI.Graphics;

  // Position & Movement
  public position: { x: number; y: number };
  private patrolTween: gsap.core.Tween | null = null;
  private readonly patrolSpeed: number = 1500; // ms to move between rows (faster for evasion)

  // Smart AI
  private threatMap: Map<number, ThreatInfo> = new Map();
  private targetRow: number = 2; // Start at AST row

  // Collision
  public readonly collisionRadius: number = 25;

  // Stats
  public deflectCount: number = 0;
  public damageBlocked: number = 0;

  constructor(config: KnightDefenderConfig) {
    this.id = config.id;
    this.gameId = config.gameId;
    this.side = config.side;
    this.hp = config.hp ?? this.maxHp;
    this.teamColor = config.teamColor;

    // Calculate starting position in battlefield zone
    this.position = this.calculateStartPosition();

    // Create sprite container
    this.sprite = new PIXI.Container();

    // Create glow effect (behind knight)
    this.glowEffect = this.createGlowEffect();
    this.sprite.addChild(this.glowEffect);

    // Create knight visual - use fallback graphics first, then try to load SVG
    this.knightSprite = this.createKnightGraphics();
    this.sprite.addChild(this.knightSprite);

    // Try to load SVG sprite (async, will replace graphics when ready)
    this.loadSvgSprite();

    // Create shield effect (for deflections)
    this.shieldEffect = this.createShieldEffect();
    this.shieldEffect.visible = false;
    this.sprite.addChild(this.shieldEffect);

    // Create HP bar
    this.hpBarContainer = new PIXI.Container();
    this.hpBarBg = new PIXI.Graphics();
    this.hpBarFill = new PIXI.Graphics();
    this.createHpBar();
    this.sprite.addChild(this.hpBarContainer);

    this.sprite.x = this.position.x;
    this.sprite.y = this.position.y;

    // Start idle animation
    this.startIdleAnimation();

    console.log(`🐴 [KnightDefender] Created for ${this.side} at (${this.position.x}, ${this.position.y})`);
  }

  /**
   * Load SVG sprite and replace graphics
   */
  private async loadSvgSprite(): Promise<void> {
    try {
      const svgPath = this.side === 'left'
        ? '/battle-arena-v2/knight-left.svg'
        : '/battle-arena-v2/knight-right.svg';

      // Load SVG as texture
      const texture = await PIXI.Assets.load(svgPath);

      if (!this.alive) return; // Knight was destroyed while loading

      // Create sprite from texture
      const svgSprite = new PIXI.Sprite(texture);
      svgSprite.anchor.set(0.5);

      // Scale to appropriate size (64x64 SVG → ~50px height)
      const targetSize = 50;
      svgSprite.scale.set(targetSize / 64);

      // Apply team color tint
      svgSprite.tint = this.teamColor;

      // Get the index of current knight graphics
      const oldIndex = this.sprite.getChildIndex(this.knightSprite);

      // Remove old graphics
      this.sprite.removeChild(this.knightSprite);
      if (this.knightSprite instanceof PIXI.Graphics) {
        this.knightSprite.destroy();
      }

      // Add new sprite at same position
      this.knightSprite = svgSprite;
      this.sprite.addChildAt(this.knightSprite, oldIndex);

      console.log(`🐴 [KnightDefender] SVG sprite loaded for ${this.side}`);
    } catch (error) {
      console.warn(`🐴 [KnightDefender] Failed to load SVG, using fallback graphics:`, error);
      // Keep using the fallback graphics
    }
  }

  /**
   * Calculate starting position in the battlefield zone
   */
  private calculateStartPosition(): { x: number; y: number } {
    const layout = gridManager.getLayout();
    const cellHeight = DEFAULT_GRID_CONFIG.cellHeight;

    // Middle of battlefield, offset to owner's side
    const battlefieldCenter = (layout.battlefieldStart + layout.battlefieldEnd) / 2;
    const offset = 35; // Offset from center toward owner's side

    const x = this.side === 'left'
      ? battlefieldCenter - offset
      : battlefieldCenter + offset;

    // Start at middle row (AST row = row 2, 0-indexed)
    const y = cellHeight * 2 + cellHeight / 2;

    return { x, y };
  }

  /**
   * Create glow effect behind knight
   */
  private createGlowEffect(): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const color = this.teamColor;

    // Outer glow
    g.circle(0, 0, 35);
    g.fill({ color, alpha: 0.15 });

    // Inner glow
    g.circle(0, 0, 25);
    g.fill({ color, alpha: 0.1 });

    return g;
  }

  /**
   * Create knight graphics (detailed horseman)
   */
  private createKnightGraphics(): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const size = 20;
    const color = this.teamColor;
    const facing = this.side === 'left' ? 1 : -1;

    // Horse body (main ellipse)
    g.ellipse(0, 8, size * 0.8, size * 0.4);
    g.fill({ color: 0x8B4513, alpha: 1 });

    // Horse legs
    const legPositions = [-10, -4, 4, 10];
    legPositions.forEach(lx => {
      g.roundRect(lx - 2, 14, 4, 10, 2);
      g.fill({ color: 0x6B3510, alpha: 1 });
    });

    // Horse head
    g.ellipse(facing * 18, 2, 7, 5);
    g.fill({ color: 0x8B4513, alpha: 1 });

    // Horse nose
    g.ellipse(facing * 24, 0, 4, 3);
    g.fill({ color: 0x6B3510, alpha: 1 });

    // Horse ear
    g.poly([facing * 16, -6, facing * 18, -2, facing * 20, -6]);
    g.fill({ color: 0x8B4513, alpha: 1 });

    // Knight armor body
    g.ellipse(0, -4, 8, 10);
    g.fill({ color: 0xC0C0C0, alpha: 1 });

    // Knight armor shine
    g.ellipse(-2, -6, 3, 6);
    g.fill({ color: 0xE8E8E8, alpha: 0.5 });

    // Knight helmet
    g.circle(0, -16, 7);
    g.fill({ color: 0x808080, alpha: 1 });

    // Helmet visor
    g.roundRect(-5, -18, 10, 4, 1);
    g.fill({ color: 0x404040, alpha: 1 });

    // Helmet plume (team colored)
    g.moveTo(0, -23);
    g.quadraticCurveTo(facing * 8, -26, facing * 6, -20);
    g.fill({ color, alpha: 1 });

    // Shield (on opposite side of lance)
    g.ellipse(-facing * 10, -2, 5, 7);
    g.fill({ color, alpha: 1 });
    // Shield cross
    g.moveTo(-facing * 10, -8);
    g.lineTo(-facing * 10, 4);
    g.stroke({ width: 2, color: 0xFFD700, alpha: 1 });
    g.moveTo(-facing * 14, -2);
    g.lineTo(-facing * 6, -2);
    g.stroke({ width: 2, color: 0xFFD700, alpha: 1 });

    // Lance
    g.moveTo(facing * 8, -10);
    g.lineTo(facing * 32, -22);
    g.stroke({ width: 3, color: 0x8B4513, alpha: 1 });

    // Lance tip
    g.poly([facing * 32, -22, facing * 30, -26, facing * 36, -22]);
    g.fill({ color: 0xC0C0C0, alpha: 1 });

    return g;
  }

  /**
   * Create shield deflection effect
   */
  private createShieldEffect(): PIXI.Graphics {
    const g = new PIXI.Graphics();

    // Circular shield burst
    g.circle(0, 0, 40);
    g.stroke({ width: 3, color: 0x00FFFF, alpha: 0.8 });

    g.circle(0, 0, 35);
    g.fill({ color: 0x00FFFF, alpha: 0.2 });

    return g;
  }

  /**
   * Create HP bar above knight
   */
  private createHpBar(): void {
    const barWidth = 40;
    const barHeight = 6;
    const yOffset = -35;

    // Background (dark)
    this.hpBarBg.roundRect(-barWidth / 2, yOffset, barWidth, barHeight, 2);
    this.hpBarBg.fill({ color: 0x1a1a2e, alpha: 0.9 });
    this.hpBarBg.stroke({ width: 1, color: 0x444466, alpha: 1 });

    // Fill (green gradient effect via multiple rects)
    this.updateHpBar();

    this.hpBarContainer.addChild(this.hpBarBg);
    this.hpBarContainer.addChild(this.hpBarFill);
  }

  /**
   * Update HP bar fill
   */
  private updateHpBar(): void {
    const barWidth = 38;
    const barHeight = 4;
    const yOffset = -34;
    const hpPercent = this.hp / this.maxHp;
    const fillWidth = barWidth * hpPercent;

    // Color based on HP percentage
    let color: number;
    if (hpPercent > 0.6) {
      color = 0x00FF00; // Green
    } else if (hpPercent > 0.3) {
      color = 0xFFAA00; // Orange
    } else {
      color = 0xFF4444; // Red
    }

    this.hpBarFill.clear();
    if (fillWidth > 0) {
      this.hpBarFill.roundRect(-barWidth / 2 + 1, yOffset + 1, fillWidth, barHeight, 1);
      this.hpBarFill.fill({ color, alpha: 1 });
    }
  }

  /**
   * Idle bob animation
   */
  private startIdleAnimation(): void {
    // Gentle bobbing
    gsap.to(this.knightSprite, {
      y: -2,
      duration: 1.5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    // Glow pulse
    gsap.to(this.glowEffect, {
      alpha: 0.6,
      duration: 2,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Start roaming patrol
   */
  public startPatrol(): void {
    this.smartPatrol();
  }

  /**
   * Register threat from incoming projectile (for smart AI)
   */
  public registerThreat(row: number): void {
    const existing = this.threatMap.get(row) || { row, count: 0, lastUpdate: 0 };
    existing.count++;
    existing.lastUpdate = Date.now();
    this.threatMap.set(row, existing);
  }

  /**
   * Get safest row to move to (lowest threat)
   */
  private getSafestRow(): number {
    const cellHeight = DEFAULT_GRID_CONFIG.cellHeight;
    const rows = [0, 1, 2, 3, 4]; // PTS, REB, AST, STL, 3PT

    // Decay old threats
    const now = Date.now();
    this.threatMap.forEach((threat, row) => {
      if (now - threat.lastUpdate > 2000) {
        threat.count = Math.max(0, threat.count - 1);
      }
    });

    // Find row with lowest threat
    let safestRow = this.targetRow;
    let lowestThreat = Infinity;

    rows.forEach(row => {
      const threat = this.threatMap.get(row);
      const threatLevel = threat ? threat.count : 0;
      if (threatLevel < lowestThreat) {
        lowestThreat = threatLevel;
        safestRow = row;
      }
    });

    return safestRow;
  }

  /**
   * Smart patrol - evade threats, protect weak lanes
   */
  private smartPatrol(): void {
    if (!this.alive) return;

    const cellHeight = DEFAULT_GRID_CONFIG.cellHeight;
    const minY = cellHeight / 2;
    const maxY = cellHeight * 4 + cellHeight / 2;

    // 60% chance to use smart positioning, 40% random (keeps it interesting)
    let targetRow: number;
    if (Math.random() < 0.6) {
      targetRow = this.getSafestRow();
    } else {
      targetRow = Math.floor(Math.random() * 5);
    }

    this.targetRow = targetRow;
    const targetY = cellHeight * targetRow + cellHeight / 2;

    // Clamp to bounds
    const clampedY = Math.max(minY, Math.min(maxY, targetY));
    const distance = Math.abs(clampedY - this.position.y);
    const duration = (distance / (maxY - minY)) * this.patrolSpeed / 1000;

    this.patrolTween = gsap.to(this.sprite, {
      y: clampedY,
      duration: Math.max(0.4, duration),
      ease: 'power2.inOut',
      onUpdate: () => {
        this.position.y = this.sprite.y;
      },
      onComplete: () => {
        // Shorter pause for more responsive movement
        gsap.delayedCall(0.2 + Math.random() * 0.3, () => this.smartPatrol());
      },
    });
  }

  /**
   * Emergency evade - quick movement away from danger
   */
  public evade(dangerY: number): void {
    if (!this.alive) return;
    if (this.patrolTween) this.patrolTween.kill();

    const cellHeight = DEFAULT_GRID_CONFIG.cellHeight;
    const minY = cellHeight / 2;
    const maxY = cellHeight * 4 + cellHeight / 2;

    // Move away from danger
    const evadeDirection = this.position.y > dangerY ? 1 : -1;
    const evadeDistance = cellHeight * 1.5;
    const targetY = Math.max(minY, Math.min(maxY, this.position.y + evadeDirection * evadeDistance));

    gsap.to(this.sprite, {
      y: targetY,
      duration: 0.25,
      ease: 'power3.out',
      onUpdate: () => {
        this.position.y = this.sprite.y;
      },
      onComplete: () => {
        gsap.delayedCall(0.3, () => this.smartPatrol());
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
    this.deflectCount++;
    this.damageBlocked++;
    console.log(`🛡️ [KnightDefender] ${this.id} DEFLECTED! (Total: ${this.deflectCount})`);

    // LANCE SWING ANIMATION - rotate knight to show attack
    const facing = this.side === 'left' ? 1 : -1;
    gsap.timeline()
      .to(this.knightSprite, { rotation: facing * -0.3, duration: 0.08, ease: 'power2.out' })
      .to(this.knightSprite, { rotation: facing * 0.2, duration: 0.12, ease: 'power2.in' })
      .to(this.knightSprite, { rotation: 0, duration: 0.15, ease: 'elastic.out(1, 0.5)' });

    // Show shield effect with team color
    this.shieldEffect.visible = true;
    this.shieldEffect.alpha = 1;
    this.shieldEffect.scale.set(0.3);

    // Shield burst animation - BIGGER and more visible
    gsap.timeline()
      .to(this.shieldEffect.scale, { x: 2.0, y: 2.0, duration: 0.25, ease: 'power2.out' })
      .to(this.shieldEffect, { alpha: 0, duration: 0.3 }, '-=0.15')
      .call(() => {
        this.shieldEffect.visible = false;
        this.shieldEffect.scale.set(1);
      });

    // Create spark particles on deflection
    this.createDeflectionSparks();

    // Knight flash - brighter
    gsap.timeline()
      .to(this.knightSprite, { alpha: 2, duration: 0.05 })
      .to(this.knightSprite, { alpha: 1, duration: 0.2 });

    // Scale pulse - more dramatic
    gsap.timeline()
      .to(this.sprite.scale, { x: 1.3, y: 1.3, duration: 0.08, ease: 'power2.out' })
      .to(this.sprite.scale, { x: 1, y: 1, duration: 0.25, ease: 'elastic.out(1, 0.4)' });

    // Glow pulse
    gsap.timeline()
      .to(this.glowEffect, { alpha: 1, duration: 0.1 })
      .to(this.glowEffect, { alpha: 0.3, duration: 0.3 });

    // Create floating "BLOCKED!" text - more visible
    this.showFloatingText('⚔️ BLOCKED!', 0x00FFFF);
  }

  /**
   * Create spark particles when deflecting
   */
  private createDeflectionSparks(): void {
    const sparkCount = 8;
    const facing = this.side === 'left' ? 1 : -1;

    for (let i = 0; i < sparkCount; i++) {
      const spark = new PIXI.Graphics();

      // Random spark color (cyan/white/yellow)
      const colors = [0x00FFFF, 0xFFFFFF, 0xFFFF00, this.teamColor];
      const color = colors[Math.floor(Math.random() * colors.length)];

      spark.circle(0, 0, 3 + Math.random() * 3);
      spark.fill({ color, alpha: 1 });

      // Start position (at lance tip area)
      spark.x = facing * 20;
      spark.y = -10;
      this.sprite.addChild(spark);

      // Random direction
      const angle = (Math.PI / 4) + (Math.random() * Math.PI / 2); // 45-135 degrees
      const distance = 30 + Math.random() * 40;
      const targetX = spark.x + Math.cos(angle) * distance * facing;
      const targetY = spark.y - Math.sin(angle) * distance;

      gsap.timeline()
        .to(spark, {
          x: targetX,
          y: targetY,
          alpha: 0,
          duration: 0.3 + Math.random() * 0.2,
          ease: 'power2.out',
        })
        .call(() => {
          this.sprite.removeChild(spark);
          spark.destroy();
        });
    }
  }

  /**
   * Show floating text above knight
   */
  private showFloatingText(text: string, color: number): void {
    const style = new PIXI.TextStyle({
      fontFamily: 'Arial Black',
      fontSize: 14,
      fill: color,
      stroke: { color: 0x000000, width: 3 },
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });

    const floatText = new PIXI.Text({ text, style });
    floatText.anchor.set(0.5);
    floatText.x = 0;
    floatText.y = -50;
    this.sprite.addChild(floatText);

    gsap.timeline()
      .to(floatText, { y: -70, alpha: 0, duration: 0.8, ease: 'power2.out' })
      .call(() => {
        this.sprite.removeChild(floatText);
        floatText.destroy();
      });
  }

  /**
   * Take damage (when hit during cooldown)
   */
  public takeDamage(amount: number = 1): void {
    if (!this.alive) return;

    const hpBefore = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    console.log(`💥 [KnightDefender] ${this.id} took ${amount} damage | ${hpBefore} → ${this.hp} HP`);

    // Update HP bar
    this.updateHpBar();

    // Flash HP bar red
    gsap.timeline()
      .to(this.hpBarContainer, { alpha: 0.3, duration: 0.05 })
      .to(this.hpBarContainer, { alpha: 1, duration: 0.1 });

    if (this.hp <= 0) {
      this.destroy();
    } else {
      // Red flash on knight
      const originalTint = (this.knightSprite as PIXI.Graphics).tint;
      (this.knightSprite as PIXI.Graphics).tint = 0xFF4444;
      gsap.delayedCall(0.15, () => {
        (this.knightSprite as PIXI.Graphics).tint = originalTint;
      });

      // Shake effect
      gsap.timeline()
        .to(this.knightSprite, { x: -3, duration: 0.03 })
        .to(this.knightSprite, { x: 3, duration: 0.03 })
        .to(this.knightSprite, { x: -2, duration: 0.03 })
        .to(this.knightSprite, { x: 0, duration: 0.03 });

      // Show damage number
      this.showFloatingText(`-${amount}`, 0xFF4444);
    }
  }

  /**
   * Destroy the knight with dramatic death animation
   */
  private destroy(): void {
    this.alive = false;
    console.log(`💀 [KnightDefender] ${this.id} DESTROYED! (Blocked ${this.deflectCount} projectiles)`);

    // Stop patrol
    if (this.patrolTween) {
      this.patrolTween.kill();
    }

    // Kill idle animations
    gsap.killTweensOf(this.knightSprite);
    gsap.killTweensOf(this.glowEffect);

    // Hide HP bar immediately
    this.hpBarContainer.visible = false;

    // Create death particles
    this.createDeathParticles();

    // Show "SLAIN!" text
    this.showFloatingText('💀 SLAIN!', 0xFF0000);

    // Dramatic death animation
    gsap.timeline()
      // Flash red
      .to(this.knightSprite, { alpha: 0, duration: 0.1 })
      .to(this.knightSprite, { alpha: 1, duration: 0.1 })
      .to(this.knightSprite, { alpha: 0, duration: 0.1 })
      .to(this.knightSprite, { alpha: 1, duration: 0.1 })
      // Spin and shrink
      .to(this.sprite, { rotation: Math.PI * 2, duration: 0.5, ease: 'power2.in' }, '-=0.2')
      .to(this.sprite.scale, { x: 0, y: 0, duration: 0.5, ease: 'power2.in' }, '-=0.5')
      // Final fade
      .to(this.sprite, { alpha: 0, duration: 0.2 })
      .call(() => {
        this.sprite.visible = false;
      });
  }

  /**
   * Create death particle explosion
   */
  private createDeathParticles(): void {
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
      const particle = new PIXI.Graphics();
      const size = 4 + Math.random() * 6;
      const color = Math.random() > 0.5 ? this.teamColor : 0xC0C0C0;

      particle.circle(0, 0, size);
      particle.fill({ color, alpha: 1 });

      particle.x = 0;
      particle.y = 0;
      this.sprite.addChild(particle);

      const angle = (i / particleCount) * Math.PI * 2;
      const distance = 40 + Math.random() * 30;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance;

      gsap.to(particle, {
        x: targetX,
        y: targetY,
        alpha: 0,
        duration: 0.5 + Math.random() * 0.3,
        ease: 'power2.out',
        onComplete: () => {
          this.sprite.removeChild(particle);
          particle.destroy();
        },
      });
    }
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
      return true; // Projectile destroyed, knight unharmed
    } else {
      this.takeDamage(1);
      return true; // Projectile destroyed, but knight takes damage
    }
  }

  /**
   * Get current HP percentage
   */
  public getHpPercent(): number {
    return this.hp / this.maxHp;
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
    gsap.killTweensOf(this.knightSprite);
    gsap.killTweensOf(this.glowEffect);
    gsap.killTweensOf(this.shieldEffect);
    gsap.killTweensOf(this.hpBarContainer);
    this.sprite.destroy({ children: true });
  }
}

