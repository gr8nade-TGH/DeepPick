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

import { battleEventEmitter } from '../EventEmitter';
import { itemEffectRegistry } from '../ItemEffectRegistry';
import type { ItemRuntimeContext } from '../ItemEffectRegistry';
import type { ItemDefinition } from '../ItemRollSystem';
import { castleHealthSystem } from '../../systems/CastleHealthSystem';
import { castleManager } from '../../managers/CastleManager';

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

  console.log(`🛡️ [IronmanArmor] Registering effect for ${side} (Start HP: ${startShieldHp}, +${hpPerDestroyedOrb} per orb)`);

  // BATTLE_START: Create shield
  const battleStartSubId = battleEventEmitter.on(
    'BATTLE_START',
    (payload) => {
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
      const castle = castleManager.getCastle(castleId);
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
    },
    gameId // Filter by gameId
  );

  // DEFENSE_ORB_DESTROYED: Add HP to shield
  const orbDestroyedSubId = battleEventEmitter.on(
    'DEFENSE_ORB_DESTROYED',
    (payload) => {
      if (payload.gameId !== gameId) return;
      if (payload.side !== side) return;

      // Check if shield is still active
      const shieldActive = itemEffectRegistry.getCounter(itemInstanceId, 'shieldActive');
      if (!shieldActive) {
        console.log(`🛡️ [IronmanArmor] Shield already broken, ignoring orb destruction`);
        return;
      }

      console.log(`🛡️ [IronmanArmor] Defense orb destroyed on ${side} ${payload.lane}, adding +${hpPerDestroyedOrb} HP to shield`);

      // Get castle ID from gameId and side
      const castleId = `${gameId}-${side}`;

      // Heal shield using CastleHealthSystem
      castleHealthSystem.healShield(castleId, hpPerDestroyedOrb);

      // Trigger visual update on castle
      const castle = castleManager.getCastle(castleId);
      if (castle) {
        castle.updateShieldVisual();
      }

      // Track total HP gained
      const totalHpGained = itemEffectRegistry.incrementCounter(itemInstanceId, 'totalHpGained', hpPerDestroyedOrb);
      console.log(`✅ [IronmanArmor] Shield healed by +${hpPerDestroyedOrb} HP! Total HP gained: ${totalHpGained}`);
    },
    gameId // Filter by gameId
  );

  // SHIELD_BROKEN: Mark shield as inactive
  const shieldBrokenSubId = battleEventEmitter.on(
    'SHIELD_BROKEN',
    (payload) => {
      if (payload.gameId !== gameId) return;
      if (payload.side !== side) return;

      console.log(`💥 [IronmanArmor] Shield broken on ${side}!`);

      // Mark shield as inactive
      itemEffectRegistry.setCounter(itemInstanceId, 'shieldActive', 0);
    },
    gameId // Filter by gameId
  );

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

