/**
 * LAL_IronmanArmor.ts
 * 
 * AC "Ironman" Armor - Los Angeles Lakers Defense Item
 * 
 * Description:
 * Castle shield that starts with 3 to 8 HP and gains +1 to 3 HP every time 
 * a defense orb is destroyed, then is gone for the matchup once it breaks.
 * 
 * Roll Ranges:
 * - startShieldHp: 3-8 HP
 * - hpPerDestroyedOrb: 1-3 HP
 * 
 * Quality Tiers:
 * - Warped: Low rolls (e.g., 3 HP start, +1 per orb)
 * - Balanced: Average rolls (e.g., 5-6 HP start, +2 per orb)
 * - Honed: Good rolls (e.g., 7 HP start, +2-3 per orb)
 * - Masterwork: Perfect rolls (e.g., 8 HP start, +3 per orb)
 */

import { battleEventBus } from '../../events/EventBus';
import { itemEffectRegistry } from '../ItemEffectRegistry';
import type { ItemRuntimeContext } from '../ItemEffectRegistry';
import type { ItemDefinition } from '../ItemRollSystem';
import { castleHealthSystem } from '../../systems/CastleHealthSystem';
import { castleManager } from '../../managers/CastleManager';
import { createShieldHealAnimation } from '../../effects/ShieldHealAnimation';

/**
 * Item definition for LAL Ironman Armor
 */
export const LAL_IRONMAN_ARMOR_DEFINITION: ItemDefinition = {
  id: 'LAL_def_ironman_armor',
  team: 'LAL',
  teamName: 'Los Angeles Lakers',
  slot: 'defense',
  name: 'AC "Ironman" Armor',
  description: 'Castle shield that starts with 3 to 8 HP and gains +1 to 3 HP every time a defense orb is destroyed, then is gone for the matchup once it breaks.',
  icon: '🛡️',
  rollRanges: {
    startShieldHp: { min: 3, max: 8, step: 1 },
    hpPerDestroyedOrb: { min: 1, max: 3, step: 1 },
  },
};

/**
 * Register Ironman Armor effect
 * 
 * This function is called when the item is activated in a battle.
 * It sets up event listeners for:
 * 1. BATTLE_START - Create shield at battle start
 * 2. DEFENSE_ORB_DESTROYED - Add HP to shield when orbs destroyed
 */
export function registerIronmanArmorEffect(context: ItemRuntimeContext): void {
  const { itemInstanceId, gameId, side, rolls } = context;
  const { startShieldHp, hpPerDestroyedOrb } = rolls;

  console.log(`🎯🎯🎯 [IronmanArmor] REGISTERING EFFECT for ${side} side in game ${gameId}`);
  console.log(`🛡️ [IronmanArmor] Start HP: ${startShieldHp}, +${hpPerDestroyedOrb} per orb destroyed`);

  // BATTLE_START: Create shield
  battleEventBus.on('BATTLE_START', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    console.log(`🛡️ [IronmanArmor] Creating shield for ${side} with ${startShieldHp} HP`);

    // Get castle ID from gameId and side
    const castleId = `${gameId}-${side}`;

    // Create shield using CastleHealthSystem
    castleHealthSystem.activateShield(
      castleId,
      startShieldHp,
      0, // No activation threshold - shield is active immediately
      'LAL_def_ironman_armor'
    );

    // Trigger visual update on castle
    const castle = castleManager.getCastle(gameId, castleId);
    if (castle) {
      castle.activateShield({
        id: 'LAL_def_ironman_armor',
        name: 'AC "Ironman" Armor',
        description: 'Castle shield',
        icon: '🛡️',
        shieldHP: startShieldHp,
        shieldActivationThreshold: 0,
      });
    }

    console.log(`✅ [IronmanArmor] Shield created with ${startShieldHp} HP!`);

    // Store shield ID in counter
    itemEffectRegistry.setCounter(itemInstanceId, 'shieldId', 1);
    itemEffectRegistry.setCounter(itemInstanceId, 'shieldActive', 1);
  });

  // DEFENSE_ORB_DESTROYED: Add HP to shield
  battleEventBus.on('DEFENSE_ORB_DESTROYED', (payload) => {
    console.log(`🔔 [IronmanArmor] DEFENSE_ORB_DESTROYED event received!`, payload);

    if (payload.gameId !== gameId) {
      console.log(`❌ [IronmanArmor] Wrong gameId: ${payload.gameId} !== ${gameId}`);
      return;
    }
    if (payload.side !== side) {
      console.log(`❌ [IronmanArmor] Wrong side: ${payload.side} !== ${side}`);
      return;
    }

    // Get castle ID from gameId and side
    const castleId = `${gameId}-${side}`;

    // Check if shield is still active using CastleHealthSystem (source of truth)
    const shield = castleHealthSystem.getShield(castleId);
    if (!shield || !shield.isActive) {
      console.log(`🛡️ [IronmanArmor] Shield not active (broken or doesn't exist), ignoring orb destruction`);
      return;
    }

    console.log(`✅✅✅ [IronmanArmor] SHIELD SHOULD HEAL NOW! Defense orb destroyed on ${side} ${payload.lane}, adding +${hpPerDestroyedOrb} HP to shield (current: ${shield.currentHP}/${shield.maxHP})`);


    // Only heal if shield is not at max HP
    const needsHealing = shield.currentHP < shield.maxHP;

    // Heal shield using CastleHealthSystem
    castleHealthSystem.healShield(castleId, hpPerDestroyedOrb);

    // Get castle for animation
    const castle = castleManager.getCastle(gameId, castleId);
    if (castle && needsHealing) {
      // Trigger visual update on castle
      castle.updateShieldVisual();

      // Create green orb animation from destroyed orb position to shield
      createShieldHealAnimation(gameId, payload.orbId, castleId, hpPerDestroyedOrb);
    }

    // Track total HP gained
    const totalHpGained = itemEffectRegistry.incrementCounter(itemInstanceId, 'totalHpGained', hpPerDestroyedOrb);
    console.log(`✅ [IronmanArmor] Shield healed by +${hpPerDestroyedOrb} HP! Total HP gained: ${totalHpGained}`);
  });

  // SHIELD_BROKEN: Mark shield as inactive
  battleEventBus.on('SHIELD_BROKEN', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    console.log(`💥 [IronmanArmor] Shield broken on ${side}!`);

    // Mark shield as inactive
    itemEffectRegistry.setCounter(itemInstanceId, 'shieldActive', 0);
  });

  console.log(`✅ [IronmanArmor] Effect registered for ${side} (${itemInstanceId})`);
}

/**
 * Auto-register this item effect
 */
itemEffectRegistry.registerEffect(
  LAL_IRONMAN_ARMOR_DEFINITION.id,
  registerIronmanArmorEffect
);

console.log(`📦 [IronmanArmor] Item effect registered: ${LAL_IRONMAN_ARMOR_DEFINITION.id}`);

