/**
 * WAS_WizardsWatchtower.ts
 *
 * Wizard's Watchtower - Washington Wizards Defense Item
 *
 * Description:
 * Castle shield (same as Ironman Armor) that starts with 5-15 HP and gains +1-3 HP
 * when defense orbs are destroyed. PLUS enchants the last defense orb in each stat row
 * with +1-3 bonus HP and a purple glowing edge.
 *
 * Roll Ranges:
 * - startShieldHp: 5-15 HP (castle shield)
 * - hpPerDestroyedOrb: 1-3 HP (shield heal per orb destroyed)
 * - orbBonusHP: 1-3 HP (extra HP added to last orb in each row)
 *
 * Quality Tiers:
 * - Warped: Low rolls on all stats
 * - Balanced: Average rolls
 * - Honed: Good rolls
 * - Masterwork: Perfect rolls on all stats
 */

import { battleEventBus } from '../../events/EventBus';
import { itemEffectRegistry } from '../ItemEffectRegistry';
import type { ItemRuntimeContext } from '../ItemEffectRegistry';
import type { ItemDefinition } from '../ItemRollSystem';
import { castleHealthSystem } from '../../systems/CastleHealthSystem';
import { castleManager } from '../../managers/CastleManager';
import { createShieldHealAnimation } from '../../effects/ShieldHealAnimation';
import { useMultiGameStore } from '../../../store/multiGameStore';
import type { StatType } from '../../../types/game';
import * as PIXI from 'pixi.js';

// Purple glow color for wizard enchantment
const WIZARD_GLOW_COLOR = 0x9b59b6;

/**
 * Item definition for WAS Wizard's Watchtower
 */
export const WAS_WIZARDS_WATCHTOWER_DEFINITION: ItemDefinition = {
  id: 'WAS_def_wizards_watchtower',
  team: 'WAS',
  teamName: 'Washington Wizards',
  slot: 'defense',
  name: "Wizard's Watchtower",
  description: "Castle shield (5-15 HP, heals +1 per orb destroyed) plus enchants the last defense orb in each row with +1-3 bonus HP and a purple glow.",
  icon: '🔮',
  rollRanges: {
    startShieldHp: { min: 5, max: 15, step: 1 },
    orbBonusHP: { min: 1, max: 3, step: 1 },
  },
};

/**
 * Add glowing edge effect to a defense orb sprite
 */
function addGlowingEdge(sprite: PIXI.Graphics, glowColor: number = WIZARD_GLOW_COLOR): PIXI.Graphics {
  const glowGraphics = new PIXI.Graphics();

  // Create pulsing glow ring around the shield
  const size = 24; // Slightly larger than the shield
  const height = size;
  const width = size;

  // Draw multiple glow layers for depth
  for (let i = 3; i >= 1; i--) {
    const layerSize = size + (i * 3);
    const alpha = 0.2 / i;

    const topY = -layerSize / 2;
    const topWidth = layerSize * 0.75;
    const midWidth = layerSize;
    const bottomY = layerSize / 2;

    glowGraphics.moveTo(-topWidth / 2, topY);
    glowGraphics.bezierCurveTo(-topWidth / 2, topY - 0.5, topWidth / 2, topY - 0.5, topWidth / 2, topY);
    glowGraphics.bezierCurveTo(topWidth / 2 + 1, topY + layerSize * 0.15, midWidth / 2, -layerSize * 0.05, midWidth / 2, 0);
    glowGraphics.bezierCurveTo(midWidth / 2, layerSize * 0.15, layerSize * 0.2 + 1, bottomY - layerSize * 0.2, 0, bottomY);
    glowGraphics.bezierCurveTo(-layerSize * 0.2 - 1, bottomY - layerSize * 0.2, -midWidth / 2, layerSize * 0.15, -midWidth / 2, 0);
    glowGraphics.bezierCurveTo(-midWidth / 2, -layerSize * 0.05, -topWidth / 2 - 1, topY + layerSize * 0.15, -topWidth / 2, topY);
    glowGraphics.stroke({ width: 2, color: glowColor, alpha });
  }

  // Add to sprite's parent at same position
  glowGraphics.x = sprite.x;
  glowGraphics.y = sprite.y;
  glowGraphics.name = 'wizard-glow';

  return glowGraphics;
}

/**
 * Register Wizard's Watchtower effect
 *
 * This combines Ironman Armor functionality (castle shield) with
 * bonus HP to the last defense orb in each stat row.
 */
export function registerWizardsWatchtowerEffect(context: ItemRuntimeContext): void {
  const { itemInstanceId, gameId, side, rolls } = context;
  const { startShieldHp, orbBonusHP } = rolls;
  const hpPerDestroyedOrb = 1; // Fixed at 1, no roll

  console.log(`🔮 [WizardsWatchtower] REGISTERING EFFECT for ${side} side in game ${gameId}`);
  console.log(`🔮 [WizardsWatchtower] Shield: ${startShieldHp} HP, +${hpPerDestroyedOrb} per orb | Orb Buff: +${orbBonusHP} HP to last orbs`);

  // BATTLE_START: Create shield AND buff last orbs
  battleEventBus.on('BATTLE_START', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    // ===== PART 1: Castle Shield (same as Ironman Armor) =====
    console.log(`🔮 [WizardsWatchtower] Creating shield for ${side} with ${startShieldHp} HP`);

    const castleId = `${gameId}-${side}`;

    // Create shield using CastleHealthSystem
    castleHealthSystem.activateShield(
      castleId,
      startShieldHp,
      0, // No activation threshold - shield is active immediately
      'WAS_def_wizards_watchtower'
    );

    // Trigger visual update on castle
    const castle = castleManager.getCastle(gameId, castleId);
    if (castle) {
      castle.activateShield({
        id: 'WAS_def_wizards_watchtower',
        name: "Wizard's Watchtower",
        description: 'Castle shield with orb enchantment',
        icon: '🔮',
        shieldHP: startShieldHp,
        shieldActivationThreshold: 0,
      });
    }

    console.log(`✅ [WizardsWatchtower] Shield created with ${startShieldHp} HP!`);

    // Store shield state
    itemEffectRegistry.setCounter(itemInstanceId, 'shieldId', 1);
    itemEffectRegistry.setCounter(itemInstanceId, 'shieldActive', 1);

    // ===== PART 2: Buff last orbs in each row =====
    console.log(`🔮 [WizardsWatchtower] Buffing last orbs for ${side} with +${orbBonusHP} HP each`);

    const battle = useMultiGameStore.getState().battles.get(gameId);
    if (!battle) {
      console.error(`❌ [WizardsWatchtower] Battle not found: ${gameId}`);
      return;
    }

    const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
    let orbsBuffed = 0;

    stats.forEach(stat => {
      // Find all alive orbs in this lane for this side
      const laneOrbs = Array.from(battle.defenseDots.values())
        .filter(orb => orb.stat === stat && orb.side === side && orb.alive)
        .sort((a, b) => b.index - a.index); // Sort by index descending (last orb first)

      if (laneOrbs.length === 0) {
        console.log(`🔮 [WizardsWatchtower] No orbs in ${stat} lane for ${side}`);
        return;
      }

      // Get the last orb (highest index = furthest from castle)
      const lastOrb = laneOrbs[0];

      // Buff the orb's HP
      const oldHP = lastOrb.hp;
      lastOrb.hp += orbBonusHP;
      lastOrb.maxHp = Math.max(lastOrb.maxHp, lastOrb.hp); // Increase maxHp too

      console.log(`🔮 [WizardsWatchtower] Buffed ${stat} last orb: ${oldHP} → ${lastOrb.hp} HP (+${orbBonusHP})`);

      // Mark orb as buffed and trigger visual update
      (lastOrb as any).isWizardBuffed = true;

      // Update the orb's visual to show purple glow
      if (lastOrb.sprite && lastOrb.sprite.parent) {
        const glow = addGlowingEdge(lastOrb.sprite);
        lastOrb.sprite.parent.addChild(glow);
        (lastOrb as any)._wizardGlow = glow;
      }

      orbsBuffed++;
    });

    // Track total buffed
    itemEffectRegistry.setCounter(itemInstanceId, 'orbsBuffed', orbsBuffed);
    itemEffectRegistry.setCounter(itemInstanceId, 'totalOrbBonusHP', orbsBuffed * orbBonusHP);

    console.log(`✅ [WizardsWatchtower] Buffed ${orbsBuffed} orbs with +${orbBonusHP} HP each (total: +${orbsBuffed * orbBonusHP} HP)`);
  });

  // DEFENSE_ORB_DESTROYED: Add HP to shield (same as Ironman Armor)
  battleEventBus.on('DEFENSE_ORB_DESTROYED', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    const castleId = `${gameId}-${side}`;

    // Check if shield is still active
    const shield = castleHealthSystem.getShield(castleId);
    if (!shield || !shield.isActive) {
      console.log(`🔮 [WizardsWatchtower] Shield not active, ignoring orb destruction`);
      return;
    }

    console.log(`🔮 [WizardsWatchtower] Defense orb destroyed, adding +${hpPerDestroyedOrb} HP to shield`);

    // Only heal if shield is not at max HP
    const needsHealing = shield.currentHP < shield.maxHP;

    // Heal shield
    castleHealthSystem.healShield(castleId, hpPerDestroyedOrb, false);

    // Get castle for animation
    const castle = castleManager.getCastle(gameId, castleId);
    if (castle && needsHealing) {
      castle.updateShieldVisual();
      createShieldHealAnimation(gameId, payload.orbId, castleId, hpPerDestroyedOrb);
    }

    // Track total HP gained
    const totalHpGained = itemEffectRegistry.incrementCounter(itemInstanceId, 'totalShieldHpGained', hpPerDestroyedOrb);
    console.log(`✅ [WizardsWatchtower] Shield healed by +${hpPerDestroyedOrb} HP! Total: ${totalHpGained}`);
  });

  // SHIELD_BROKEN: Mark shield as inactive
  battleEventBus.on('SHIELD_BROKEN', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    console.log(`💥 [WizardsWatchtower] Shield broken on ${side}!`);
    itemEffectRegistry.setCounter(itemInstanceId, 'shieldActive', 0);
  });

  console.log(`✅ [WizardsWatchtower] Effect registered for ${side} (${itemInstanceId})`);
}

/**
 * Auto-register this item effect
 */
itemEffectRegistry.registerEffect(
  WAS_WIZARDS_WATCHTOWER_DEFINITION.id,
  registerWizardsWatchtowerEffect
);

console.log(`📦 [WizardsWatchtower] Item effect registered: ${WAS_WIZARDS_WATCHTOWER_DEFINITION.id}`);

