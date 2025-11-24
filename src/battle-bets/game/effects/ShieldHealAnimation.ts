/**
 * ShieldHealAnimation.ts
 * 
 * Creates a green orb animation that flies from a destroyed defense orb to the castle shield
 * Used by Ironman Armor to visually show shield HP refill
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { pixiManager } from '../managers/PixiManager';
import { castleManager } from '../managers/CastleManager';
import { useMultiGameStore } from '../../store/multiGameStore';

/**
 * Create a green orb that flies from destroyed defense orb to castle shield
 * @param battleId - Battle ID
 * @param orbId - ID of the destroyed defense orb (to get position)
 * @param castleId - ID of the castle to heal
 * @param healAmount - Amount of HP being healed (for visual feedback)
 */
export function createShieldHealAnimation(
  battleId: string,
  orbId: string,
  castleId: string,
  healAmount: number
): void {
  console.log(`💚 [ShieldHeal] Creating heal animation: ${orbId} → ${castleId} (+${healAmount} HP)`);

  // Get the destroyed defense orb position from the store
  const battle = useMultiGameStore.getState().getBattle(battleId);
  const defenseDot = battle?.defenseDots.get(orbId);
  
  if (!defenseDot) {
    console.warn(`⚠️ [ShieldHeal] Defense orb ${orbId} not found in store`);
    return;
  }

  // Get castle position
  const castle = castleManager.getCastle(battleId, castleId);
  if (!castle) {
    console.warn(`⚠️ [ShieldHeal] Castle ${castleId} not found`);
    return;
  }

  // Get start position (destroyed orb)
  const startX = defenseDot.sprite.x;
  const startY = defenseDot.sprite.y;

  // Get end position (castle shield - slightly above castle)
  const endX = castle.sprite.x;
  const endY = castle.sprite.y - 30; // Above castle

  console.log(`💚 [ShieldHeal] Animation path: (${startX}, ${startY}) → (${endX}, ${endY})`);

  // Create green healing orb
  const healOrb = new PIXI.Graphics();
  
  // Outer glow
  healOrb.circle(0, 0, 12);
  healOrb.fill({ color: 0x00ff00, alpha: 0.3 });
  
  // Middle layer
  healOrb.circle(0, 0, 8);
  healOrb.fill({ color: 0x00ff88, alpha: 0.6 });
  
  // Inner core
  healOrb.circle(0, 0, 4);
  healOrb.fill({ color: 0xffffff, alpha: 0.9 });

  healOrb.position.set(startX, startY);

  // Add to PixiJS container
  pixiManager.addSprite(healOrb, battleId);

  // Animate the orb flying to the castle
  gsap.timeline()
    // Fly to castle with arc motion
    .to(healOrb.position, {
      x: endX,
      y: endY,
      duration: 0.6,
      ease: 'power2.inOut',
      onUpdate: function() {
        // Add slight arc to the motion
        const progress = this.progress();
        const arcHeight = 30;
        healOrb.position.y = startY + (endY - startY) * progress - Math.sin(progress * Math.PI) * arcHeight;
      }
    })
    // Pulse during flight
    .to(healOrb.scale, {
      x: 1.3,
      y: 1.3,
      duration: 0.3,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut'
    }, 0)
    // Impact effect - burst into shield
    .to(healOrb.scale, {
      x: 2,
      y: 2,
      duration: 0.15,
      ease: 'power2.out'
    })
    .to(healOrb, {
      alpha: 0,
      duration: 0.15,
      ease: 'power2.in',
      onComplete: () => {
        // Cleanup
        pixiManager.removeSprite(healOrb, battleId);
        healOrb.destroy();
        
        // Trigger shield visual update
        castle.updateShieldVisual();
        
        // Show +HP text on castle
        showHealText(battleId, endX, endY, healAmount);
        
        console.log(`✅ [ShieldHeal] Animation complete`);
      }
    }, '-=0.05');
}

/**
 * Show floating +HP text above the castle
 */
function showHealText(battleId: string, x: number, y: number, amount: number): void {
  const healText = new PIXI.Text({
    text: `+${amount} HP`,
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 18,
      fontWeight: '900',
      fill: 0x00ff00,
      stroke: { color: 0x000000, width: 3 },
      dropShadow: {
        color: 0x00ff00,
        blur: 4,
        alpha: 0.8,
        distance: 0
      }
    }
  });

  healText.anchor.set(0.5);
  healText.position.set(x, y - 20);

  pixiManager.addSprite(healText, battleId);

  // Float up and fade out
  gsap.timeline()
    .to(healText.position, {
      y: y - 60,
      duration: 1.2,
      ease: 'power2.out'
    })
    .to(healText, {
      alpha: 0,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => {
        pixiManager.removeSprite(healText, battleId);
        healText.destroy();
      }
    }, '-=0.4');
}

