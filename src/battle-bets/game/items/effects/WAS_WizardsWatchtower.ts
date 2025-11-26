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

// Track glows by orb ID for cleanup
const orbGlowMap = new Map<string, PIXI.Graphics>();
// Also track glow animations so we can kill them
const glowAnimations = new Map<string, gsap.core.Tween>();

/**
 * Clean up glow for a destroyed orb
 */
export function cleanupOrbGlow(orbId: string): void {
  console.log(`🔮 [WizardsWatchtower] Attempting to clean up glow for: ${orbId}`);
  console.log(`🔮 [WizardsWatchtower] Current glow map keys:`, Array.from(orbGlowMap.keys()));

  const glow = orbGlowMap.get(orbId);
  if (glow) {
    console.log(`🔮 [WizardsWatchtower] Found glow, removing...`);

    // Kill animation
    const anim = glowAnimations.get(orbId);
    if (anim) {
      anim.kill();
      glowAnimations.delete(orbId);
    }

    if (glow.parent) {
      glow.parent.removeChild(glow);
    }
    glow.destroy();
    orbGlowMap.delete(orbId);
    console.log(`✅ [WizardsWatchtower] Glow cleaned up for: ${orbId}`);
  } else {
    console.log(`⚠️ [WizardsWatchtower] No glow found for orbId: ${orbId}`);
  }
}

/**
 * Clean up ALL glows (for battle end/reset)
 */
export function cleanupAllGlows(): void {
  console.log(`🔮 [WizardsWatchtower] Cleaning up ALL ${orbGlowMap.size} glows`);
  orbGlowMap.forEach((glow, orbId) => {
    const anim = glowAnimations.get(orbId);
    if (anim) anim.kill();
    if (glow.parent) glow.parent.removeChild(glow);
    glow.destroy();
  });
  orbGlowMap.clear();
  glowAnimations.clear();
}

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
 * Creates a bright pulsing purple outline directly on the shield edge
 */
function addGlowingEdge(sprite: PIXI.Graphics, orbId: string, glowColor: number = WIZARD_GLOW_COLOR): PIXI.Graphics {
  const glowContainer = new PIXI.Graphics();
  const size = 18; // Match shield size exactly

  // Helper to draw shield shape
  const drawShield = (g: PIXI.Graphics, s: number, strokeWidth: number, color: number, alpha: number) => {
    const topY = -s / 2;
    const topWidth = s * 0.8;
    const midWidth = s;
    const bottomY = s / 2;

    g.moveTo(-topWidth / 2, topY);
    // Top edge
    g.lineTo(topWidth / 2, topY);
    // Right edge curves down
    g.bezierCurveTo(midWidth / 2, topY + s * 0.1, midWidth / 2, s * 0.1, midWidth / 2, 0);
    // Right bottom curve to point
    g.bezierCurveTo(midWidth / 2, s * 0.25, s * 0.15, bottomY - s * 0.15, 0, bottomY);
    // Left bottom curve from point
    g.bezierCurveTo(-s * 0.15, bottomY - s * 0.15, -midWidth / 2, s * 0.25, -midWidth / 2, 0);
    // Left edge curves up
    g.bezierCurveTo(-midWidth / 2, s * 0.1, -midWidth / 2, topY + s * 0.1, -topWidth / 2, topY);
    g.stroke({ width: strokeWidth, color, alpha });
  };

  // Outer glow (softer, larger)
  drawShield(glowContainer, size + 8, 6, glowColor, 0.3);
  drawShield(glowContainer, size + 5, 4, glowColor, 0.5);
  // Inner bright edge (the actual highlight)
  drawShield(glowContainer, size + 2, 2.5, glowColor, 0.9);
  // Innermost white core for pop
  drawShield(glowContainer, size, 1.5, 0xFFFFFF, 0.6);

  // Position at sprite location
  glowContainer.x = sprite.x;
  glowContainer.y = sprite.y;
  glowContainer.name = 'wizard-glow';

  // Track for cleanup
  orbGlowMap.set(orbId, glowContainer);

  // Add pulsing animation
  import('gsap').then(({ gsap }) => {
    gsap.to(glowContainer, {
      alpha: 0.5,
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  });

  return glowContainer;
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
        const glow = addGlowingEdge(lastOrb.sprite, lastOrb.id);
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

  // DEFENSE_ORB_HIT: Remove glow on first hit (bonus HP consumed)
  battleEventBus.on('DEFENSE_ORB_HIT', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    // Check if this orb had a glow (was buffed)
    if (orbGlowMap.has(payload.orbId)) {
      console.log(`🔮 [WizardsWatchtower] Buffed orb ${payload.orbId} was hit! Removing enchantment glow.`);
      cleanupOrbGlow(payload.orbId);
    }
  });

  // DEFENSE_ORB_DESTROYED: Add HP to shield (glow already removed on hit)
  battleEventBus.on('DEFENSE_ORB_DESTROYED', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    // Clean up glow just in case (if orb was one-shot before hit event)
    cleanupOrbGlow(payload.orbId);

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

