/**
 * Treasure Chest - Appears when battle ends
 * Displays victory rewards in the center of the battlefield
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import type { Position } from '../../types/game';

export interface TreasureChestConfig {
  position: Position;
  winner: 'left' | 'right' | 'draw';
}

export class TreasureChest {
  public sprite: PIXI.Container;
  private position: Position;
  private winner: 'left' | 'right' | 'draw';

  constructor(config: TreasureChestConfig) {
    this.position = config.position;
    this.winner = config.winner;
    this.sprite = this.createSprite();
  }

  /**
   * Create the treasure chest sprite with professional design
   */
  private createSprite(): PIXI.Container {
    const container = new PIXI.Container();
    container.x = this.position.x;
    container.y = this.position.y;

    // Chest dimensions - Make it look more like a classic treasure chest
    const chestWidth = 100;
    const chestHeight = 70;
    const lidHeight = 25;

    // Shadow
    const shadow = new PIXI.Graphics();
    shadow.ellipse(0, chestHeight / 2 + 10, chestWidth / 2 + 5, 15);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    container.addChild(shadow);

    // Chest body (bottom part) - More detailed design
    const body = new PIXI.Graphics();

    // Main body - rich brown wood
    body.roundRect(-chestWidth / 2, -chestHeight / 2 + lidHeight, chestWidth, chestHeight - lidHeight, 10);
    body.fill({ color: 0x8B4513, alpha: 1.0 });

    // Body border - darker outline
    body.roundRect(-chestWidth / 2, -chestHeight / 2 + lidHeight, chestWidth, chestHeight - lidHeight, 10);
    body.stroke({ width: 4, color: 0x654321 });

    // Vertical wood planks (more detailed)
    for (let i = -3; i <= 3; i++) {
      const x = i * 14;
      body.moveTo(x, -chestHeight / 2 + lidHeight + 5);
      body.lineTo(x, chestHeight / 2 - 5);
      body.stroke({ width: 2, color: 0x654321, alpha: 0.4 });
    }

    // Bottom edge detail
    body.rect(-chestWidth / 2 + 5, chestHeight / 2 - 8, chestWidth - 10, 5);
    body.fill({ color: 0x654321, alpha: 0.6 });

    container.addChild(body);

    // Chest lid (top part) - Curved/arched design
    const lid = new PIXI.Graphics();

    // Main lid - lighter brown with curved top
    lid.roundRect(-chestWidth / 2, -chestHeight / 2, chestWidth, lidHeight, 12);
    lid.fill({ color: 0xA0522D, alpha: 1.0 });

    // Lid border - thicker for emphasis
    lid.roundRect(-chestWidth / 2, -chestHeight / 2, chestWidth, lidHeight, 12);
    lid.stroke({ width: 4, color: 0x654321 });

    // Lid highlight (curved top edge)
    lid.roundRect(-chestWidth / 2 + 8, -chestHeight / 2 + 4, chestWidth - 16, 10, 6);
    lid.fill({ color: 0xD2691E, alpha: 0.7 });

    // Lid wood grain detail
    for (let i = -2; i <= 2; i++) {
      const x = i * 18;
      lid.moveTo(x, -chestHeight / 2 + 5);
      lid.lineTo(x, -chestHeight / 2 + lidHeight - 5);
      lid.stroke({ width: 1.5, color: 0x654321, alpha: 0.3 });
    }

    container.addChild(lid);

    // Metal bands (decorative) - More prominent golden bands
    const band1 = new PIXI.Graphics();
    band1.rect(-chestWidth / 2, -12, chestWidth, 6);
    band1.fill({ color: 0xFFD700, alpha: 1.0 });
    band1.rect(-chestWidth / 2, -12, chestWidth, 6);
    band1.stroke({ width: 2, color: 0xDAA520 });
    // Add rivets to band
    for (let i = -3; i <= 3; i++) {
      const x = i * 14;
      band1.circle(x, -9, 2);
      band1.fill({ color: 0xDAA520, alpha: 1.0 });
    }
    container.addChild(band1);

    const band2 = new PIXI.Graphics();
    band2.rect(-chestWidth / 2, 12, chestWidth, 6);
    band2.fill({ color: 0xFFD700, alpha: 1.0 });
    band2.rect(-chestWidth / 2, 12, chestWidth, 6);
    band2.stroke({ width: 2, color: 0xDAA520 });
    // Add rivets to band
    for (let i = -3; i <= 3; i++) {
      const x = i * 14;
      band2.circle(x, 15, 2);
      band2.fill({ color: 0xDAA520, alpha: 1.0 });
    }
    container.addChild(band2);

    // Lock (golden) - Larger and more prominent
    const lock = new PIXI.Graphics();

    // Lock body - bigger and more detailed
    lock.roundRect(-12, 8, 24, 18, 4);
    lock.fill({ color: 0xFFD700, alpha: 1.0 });
    lock.roundRect(-12, 8, 24, 18, 4);
    lock.stroke({ width: 2, color: 0xDAA520 });

    // Lock shine/highlight
    lock.roundRect(-10, 10, 8, 6, 2);
    lock.fill({ color: 0xFFFF99, alpha: 0.6 });

    // Keyhole - larger and more visible
    lock.circle(0, 17, 4);
    lock.fill({ color: 0x654321, alpha: 1.0 });
    lock.rect(-1.5, 17, 3, 6);
    lock.fill({ color: 0x654321, alpha: 1.0 });

    container.addChild(lock);

    // Glow effect based on winner
    const glowColor = this.winner === 'left' ? 0x00BFFF : this.winner === 'right' ? 0xFF4500 : 0xFFD700;
    const glow = new PIXI.Graphics();
    glow.circle(0, 0, chestWidth / 2 + 20);
    glow.fill({ color: glowColor, alpha: 0.2 });
    container.addChildAt(glow, 0); // Add behind everything

    // Sparkles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const distance = chestWidth / 2 + 15;
      const sparkle = new PIXI.Graphics();
      sparkle.star(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        4,
        4,
        2
      );
      sparkle.fill({ color: 0xFFFFFF, alpha: 0.8 });
      container.addChild(sparkle);
      
      // Animate sparkles
      gsap.to(sparkle, {
        alpha: 0.3,
        duration: 0.5 + Math.random() * 0.5,
        repeat: -1,
        yoyo: true,
        delay: Math.random() * 0.5,
      });
    }

    // Start hidden (for entrance animation)
    container.alpha = 0;
    container.scale.set(0.1, 0.1);

    return container;
  }

  /**
   * Animate chest entrance (faster, smoother)
   */
  public async animateEntrance(): Promise<void> {
    return new Promise((resolve) => {
      // Quick, smooth entrance animation
      gsap.timeline()
        .to(this.sprite, {
          alpha: 1,
          duration: 0.3,
          ease: 'power2.out',
        })
        .to(this.sprite.scale, {
          x: 1.15,
          y: 1.15,
          duration: 0.25,
          ease: 'back.out(1.5)',
        }, '-=0.2')
        .to(this.sprite.scale, {
          x: 1,
          y: 1,
          duration: 0.15,
          ease: 'power2.inOut',
        })
        .call(() => {
          // Subtle idle bounce animation
          gsap.to(this.sprite, {
            y: this.position.y - 10,
            duration: 1,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });
          resolve();
        });
    });
  }

  /**
   * Animate chest opening
   */
  public async animateOpen(): Promise<void> {
    return new Promise((resolve) => {
      // Find the lid (second child after shadow)
      const lid = this.sprite.children[2] as PIXI.Graphics;
      
      if (lid) {
        // Open lid animation
        gsap.timeline()
          .to(lid, {
            rotation: -Math.PI / 3, // Open 60 degrees
            y: lid.y - 10,
            duration: 0.5,
            ease: 'back.out(1.5)',
          })
          .call(() => {
            // Create burst of coins/rewards
            this.createRewardBurst();
            resolve();
          });
      } else {
        resolve();
      }
    });
  }

  /**
   * Create burst of coins when chest opens
   */
  private createRewardBurst(): void {
    const coinCount = 12;
    
    for (let i = 0; i < coinCount; i++) {
      const coin = new PIXI.Graphics();
      
      // Gold coin
      coin.circle(0, 0, 6);
      coin.fill({ color: 0xFFD700, alpha: 1.0 });
      coin.circle(0, 0, 6);
      coin.stroke({ width: 1, color: 0xDAA520 });
      
      // Inner detail
      coin.circle(0, 0, 4);
      coin.stroke({ width: 1, color: 0xDAA520, alpha: 0.5 });
      
      coin.x = this.sprite.x;
      coin.y = this.sprite.y - 20;
      
      // Add to parent
      if (this.sprite.parent) {
        this.sprite.parent.addChild(coin);
      }
      
      // Animate coin burst
      const angle = (i / coinCount) * Math.PI * 2;
      const distance = 50 + Math.random() * 30;
      
      gsap.timeline()
        .to(coin, {
          x: this.sprite.x + Math.cos(angle) * distance,
          y: this.sprite.y - 20 + Math.sin(angle) * distance,
          duration: 0.6,
          ease: 'power2.out',
        })
        .to(coin, {
          y: coin.y + 100, // Fall down
          alpha: 0,
          duration: 0.8,
          ease: 'power2.in',
        }, '-=0.2')
        .call(() => {
          coin.destroy();
        });
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    gsap.killTweensOf(this.sprite);
    gsap.killTweensOf(this.sprite.scale);
    this.sprite.destroy({ children: true });
  }
}

