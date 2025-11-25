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

  // Get LOCAL position of defense orb sprite (relative to battle container)
  const startX = defenseDot.sprite.x;
  const startY = defenseDot.sprite.y;

  // Get LOCAL position of castle sprite (relative to battle container)
  const endX = castle.sprite.x;
  const endY = castle.sprite.y - 30; // Above castle

  console.log(`🔵 [ShieldHeal] Defense orb side: ${defenseDot.side}, Castle ID: ${castleId}`);
  console.log(`🔵 [ShieldHeal] Battle ID: ${battleId}`);
  console.log(`🔵 [ShieldHeal] Orb local pos: (${startX}, ${startY})`);
  console.log(`🔵 [ShieldHeal] Castle local pos: (${endX}, ${endY})`);
  console.log(`🔵 [ShieldHeal] Animation path: (${startX}, ${startY}) → (${endX}, ${endY})`);

  // Create BLUE healing orb (matching shield color) - smaller and cleaner
  const healOrb = new PIXI.Graphics();

  // Shield blue colors (matching the shield design)
  const shieldBlue = 0x2a9d8f; // Teal/blue from shield border
  const lightBlue = 0x5dccbd;  // Lighter blue

  // Outer glow - blue
  healOrb.circle(0, 0, 18);
  healOrb.fill({ color: shieldBlue, alpha: 0.5 });

  // Middle layer - lighter blue
  healOrb.circle(0, 0, 12);
  healOrb.fill({ color: lightBlue, alpha: 0.7 });

  // Inner core - white
  healOrb.circle(0, 0, 6);
  healOrb.fill({ color: 0xffffff, alpha: 0.9 });

  healOrb.position.set(startX, startY);

  // CRITICAL: Set z-index to be in front of EVERYTHING
  healOrb.zIndex = 10000;

  // Add to the CORRECT battle's PixiJS container (using local coordinates)
  pixiManager.addSprite(healOrb, battleId);

  // Animate the orb flying to the castle - smooth and visible
  gsap.timeline()
    // Fly to castle with arc motion
    .to(healOrb.position, {
      x: endX,
      y: endY,
      duration: 1.0,
      ease: 'power1.inOut',
      onUpdate: function () {
        // Add arc to the motion
        const progress = this.progress();
        const arcHeight = 40; // Arc height
        healOrb.position.y = startY + (endY - startY) * progress - Math.sin(progress * Math.PI) * arcHeight;
      }
    })
    // Pulse during flight
    .to(healOrb.scale, {
      x: 1.3,
      y: 1.3,
      duration: 0.4,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut'
    }, 0)
    // Impact effect - burst into shield
    .to(healOrb.scale, {
      x: 2.0,
      y: 2.0,
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
    }, '-=0.1');
}

/**
 * Show floating +HP text above the castle - BIGGER AND MORE VISIBLE
 */
function showHealText(battleId: string, x: number, y: number, amount: number): void {
  const healText = new PIXI.Text({
    text: `+${amount} HP 🛡️`,
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 32, // MUCH BIGGER
      fontWeight: '900',
      fill: 0x00ff00,
      stroke: { color: 0x000000, width: 5 }, // Thicker stroke
      dropShadow: {
        color: 0x00ff00,
        blur: 8,
        alpha: 1.0,
        distance: 0
      }
    }
  });

  healText.anchor.set(0.5);
  healText.position.set(x, y - 40);

  // CRITICAL: Set z-index to be in front of EVERYTHING
  healText.zIndex = 10001; // Higher than heal orb

  pixiManager.addSprite(healText, battleId);

  // Float up and fade out - SLOWER
  gsap.timeline()
    .to(healText.position, {
      y: y - 100, // Float higher
      duration: 2.0, // Slower
      ease: 'power2.out'
    })
    .to(healText, {
      alpha: 0,
      duration: 0.6,
      ease: 'power2.in',
      onComplete: () => {
        pixiManager.removeSprite(healText, battleId);
        healText.destroy();
      }
    }, '-=0.6');
}

