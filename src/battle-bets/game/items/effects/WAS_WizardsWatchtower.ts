/**
 * WAS_WizardsWatchtower.ts
 *
 * Wizard's Watchtower - Washington Wizards Defense Item
 *
 * Description:
 * Buffs the last defense orb in each stat row by adding 1-3 extra HP.
 * Similar to Ironman Armor but strengthens existing orbs instead of creating a shield.
 * Buffed orbs have a glowing purple edge to indicate the enchantment.
 *
 * Roll Ranges:
 * - bonusHP: 1-3 HP added to last orb in each row
 *
 * Quality Tiers:
 * - Warped: +1 HP to last orbs
 * - Balanced: +2 HP to last orbs
 * - Honed/Masterwork: +3 HP to last orbs
 */

import { battleEventBus } from '../../events/EventBus';
import { itemEffectRegistry } from '../ItemEffectRegistry';
import type { ItemRuntimeContext } from '../ItemEffectRegistry';
import type { ItemDefinition } from '../ItemRollSystem';
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
  description: "Enchants the last defense orb in each stat row with +1-3 bonus HP. Buffed orbs glow with purple magic.",
  icon: '🔮',
  rollRanges: {
    bonusHP: { min: 1, max: 3, step: 1 },
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
 */
export function registerWizardsWatchtowerEffect(context: ItemRuntimeContext): void {
  const { itemInstanceId, gameId, side, rolls } = context;
  const { bonusHP } = rolls;

  console.log(`🔮 [WizardsWatchtower] REGISTERING EFFECT for ${side} side in game ${gameId}`);
  console.log(`🔮 [WizardsWatchtower] Bonus HP per last orb: +${bonusHP}`);

  // Track buffed orb IDs for cleanup
  const buffedOrbIds: string[] = [];

  // BATTLE_START: Buff last orbs in each row
  battleEventBus.on('BATTLE_START', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    console.log(`🔮 [WizardsWatchtower] Buffing last orbs for ${side} with +${bonusHP} HP each`);

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
      lastOrb.hp += bonusHP;
      // Note: We're adding HP beyond maxHp - this is intentional for the buff

      console.log(`🔮 [WizardsWatchtower] Buffed ${stat} last orb: ${oldHP} → ${lastOrb.hp} HP (+${bonusHP})`);

      // Add visual glow effect
      if (lastOrb.sprite && lastOrb.sprite.parent) {
        const glow = addGlowingEdge(lastOrb.sprite);
        lastOrb.sprite.parent.addChild(glow);

        // Store reference for potential cleanup
        (lastOrb as any)._wizardGlow = glow;
      }

      buffedOrbIds.push(lastOrb.id);
      orbsBuffed++;
    });

    // Track total buffed
    itemEffectRegistry.setCounter(itemInstanceId, 'orbsBuffed', orbsBuffed);
    itemEffectRegistry.setCounter(itemInstanceId, 'totalBonusHP', orbsBuffed * bonusHP);

    console.log(`✅ [WizardsWatchtower] Buffed ${orbsBuffed} orbs with +${bonusHP} HP each (total: +${orbsBuffed * bonusHP} HP)`);
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

