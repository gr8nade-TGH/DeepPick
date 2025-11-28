/**
 * WAS_WizardsWatchtower.ts
 *
 * Wizard's Watchtower - Washington Wizards Defense Item
 *
 * Description:
 * Castle shield that starts with 5-15 HP and regenerates +1 HP every time a defense
 * orb is destroyed. PLUS enchants the last defense orb in each stat row with +1-3
 * bonus HP and a purple glowing edge.
 *
 * Roll Ranges:
 * - startShieldHp: 5-15 HP (castle shield starting HP)
 * - orbBonusHP: 1-3 HP (extra HP added to last orb in each row)
 *
 * Fixed Stats:
 * - hpPerDestroyedOrb: +1 HP (shield regeneration per orb destroyed - not rolled)
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
import gsap from 'gsap';

// Purple glow color for wizard enchantment
const WIZARD_GLOW_COLOR = 0x9b59b6;

// Track glows by orb ID for cleanup - keyed by gameId-side-orbId
const orbGlowMap = new Map<string, PIXI.Graphics>();
// Also track glow animations so we can kill them
const glowAnimations = new Map<string, gsap.core.Tween>();

// Track registered handlers to prevent duplicates
const registeredHandlers = new Set<string>();

/**
 * Get unique key for orb glow tracking
 */
function getGlowKey(gameId: string, side: string, orbId: string): string {
  return `${gameId}-${side}-${orbId}`;
}

/**
 * Clean up glow for a destroyed orb
 */
export function cleanupOrbGlow(glowKey: string): void {
  console.log(`🔮 [WizardsWatchtower] Attempting to clean up glow for key: ${glowKey}`);

  const glow = orbGlowMap.get(glowKey);
  if (glow) {
    console.log(`🔮 [WizardsWatchtower] Found glow in map. Parent exists: ${!!glow.parent}, destroyed: ${glow.destroyed}`);

    // Kill animation first
    const anim = glowAnimations.get(glowKey);
    if (anim) {
      anim.kill();
      glowAnimations.delete(glowKey);
    }

    // Make invisible immediately
    glow.visible = false;
    glow.alpha = 0;

    // Clear all graphics
    glow.clear();

    // Remove from parent
    if (glow.parent) {
      console.log(`🔮 [WizardsWatchtower] Removing from parent...`);
      glow.parent.removeChild(glow);
    } else {
      console.log(`⚠️ [WizardsWatchtower] Glow has no parent!`);
    }

    // Destroy
    if (!glow.destroyed) {
      glow.destroy({ children: true });
    }

    orbGlowMap.delete(glowKey);
    console.log(`✅ [WizardsWatchtower] Glow cleaned up for key: ${glowKey}`);
  }
}

/**
 * Clean up ALL glows for a specific game/side (for battle end/reset)
 */
export function cleanupAllGlows(gameId?: string, side?: string): void {
  console.log(`🔮 [WizardsWatchtower] Cleaning up glows for game=${gameId}, side=${side}`);

  const keysToRemove: string[] = [];

  orbGlowMap.forEach((glow, key) => {
    // If gameId/side specified, only clean matching ones
    if (gameId && side) {
      if (!key.startsWith(`${gameId}-${side}-`)) return;
    }

    keysToRemove.push(key);
    const anim = glowAnimations.get(key);
    if (anim) anim.kill();
    if (glow.parent) glow.parent.removeChild(glow);
    glow.destroy();
  });

  keysToRemove.forEach(key => {
    orbGlowMap.delete(key);
    glowAnimations.delete(key);
  });

  console.log(`🔮 [WizardsWatchtower] Cleaned up ${keysToRemove.length} glows`);
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
  description: "Castle shield (5-15 HP) that regenerates +1 HP each time a defense orb is destroyed. Also enchants the last defense orb in each row with +1-3 bonus HP and a purple glow.",
  icon: '🔮',
  rollRanges: {
    startShieldHp: { min: 5, max: 15, step: 1 },
    orbBonusHP: { min: 1, max: 3, step: 1 },
  },
  // Note: hpPerDestroyedOrb is fixed at 1, not rolled
};

/**
 * Add glowing edge effect to a defense orb sprite
 * Creates a bright pulsing purple outline directly on the shield edge
 */
function addGlowingEdge(sprite: PIXI.Graphics, glowKey: string, glowColor: number = WIZARD_GLOW_COLOR): PIXI.Graphics {
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

  // Track for cleanup using the unique key
  orbGlowMap.set(glowKey, glowContainer);
  console.log(`🔮 [WizardsWatchtower] Added glow to map with key: ${glowKey}`);

  // Add pulsing animation (synchronous - gsap is already imported at top)
  const anim = gsap.to(glowContainer, {
    alpha: 0.5,
    duration: 0.8,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });
  glowAnimations.set(glowKey, anim);

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

  // Prevent duplicate handler registration
  const handlerKey = `${gameId}_${side}`;
  if (registeredHandlers.has(handlerKey)) {
    console.log(`⚠️ [WizardsWatchtower] Handler already registered for ${handlerKey}, skipping`);
    return;
  }
  registeredHandlers.add(handlerKey);

  console.log(`🔮 [WizardsWatchtower] REGISTERING EFFECT for ${side} side in game ${gameId}`);
  console.log(`🔮 [WizardsWatchtower] Shield: ${startShieldHp} HP, +${hpPerDestroyedOrb} per orb | Orb Buff: +${orbBonusHP} HP to last orbs`);
  console.log(`🔮🔮🔮 [WizardsWatchtower] SUBSCRIBING to BATTLE_START for gameId=${gameId}, side=${side}`);

  // BATTLE_START: Create shield AND buff last orbs
  battleEventBus.on('BATTLE_START', (payload) => {
    console.log(`🔮 [WizardsWatchtower] BATTLE_START received!`, {
      payloadGameId: payload.gameId,
      expectedGameId: gameId,
      payloadSide: payload.side,
      expectedSide: side
    });

    if (payload.gameId !== gameId) {
      console.log(`🔮 [WizardsWatchtower] FILTERED OUT: gameId mismatch (${payload.gameId} !== ${gameId})`);
      return;
    }
    if (payload.side !== side) {
      console.log(`🔮 [WizardsWatchtower] FILTERED OUT: side mismatch (${payload.side} !== ${side})`);
      return;
    }

    console.log(`🔮 [WizardsWatchtower] PASSED FILTERS! Creating shield and buffing orbs...`);

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
    // Delay slightly to ensure sprites are added to container after React render cycle
    setTimeout(() => {
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

        console.log(`🔮 [WizardsWatchtower] Buffed ${stat} last orb (${lastOrb.id}): ${oldHP} → ${lastOrb.hp} HP (+${orbBonusHP})`);

        // Skip if already buffed (prevent double glows)
        if ((lastOrb as any).isWizardBuffed && (lastOrb as any)._wizardGlow) {
          console.log(`⚠️ [WizardsWatchtower] Orb ${lastOrb.id} already has glow, skipping`);
          return;
        }

        // Mark orb as buffed and trigger visual update
        (lastOrb as any).isWizardBuffed = true;

        // Create unique glow key for this orb
        const glowKey = getGlowKey(gameId, side, lastOrb.id);

        // Clean up any existing glow first
        if (orbGlowMap.has(glowKey)) {
          console.log(`🔮 [WizardsWatchtower] Cleaning existing glow before creating new one`);
          cleanupOrbGlow(glowKey);
        }

        // Also clean up via orb reference
        if ((lastOrb as any)._wizardGlow) {
          const existingGlow = (lastOrb as any)._wizardGlow as PIXI.Graphics;
          existingGlow.visible = false;
          existingGlow.clear();
          if (existingGlow.parent) existingGlow.parent.removeChild(existingGlow);
          if (!existingGlow.destroyed) existingGlow.destroy({ children: true });
          (lastOrb as any)._wizardGlow = null;
        }

        console.log(`🔮 [WizardsWatchtower] Creating glow with key: ${glowKey}`);
        console.log(`🔮 [WizardsWatchtower] lastOrb sprite check:`, {
          hasSprite: !!lastOrb.sprite,
          spriteParent: lastOrb.sprite?.parent ? 'EXISTS' : 'NULL/UNDEFINED',
          orbId: lastOrb.id
        });

        // Update the orb's visual to show purple glow
        if (lastOrb.sprite && lastOrb.sprite.parent) {
          console.log(`🔮 [WizardsWatchtower] ADDING GLOW to orb ${lastOrb.id}!`);
          const glow = addGlowingEdge(lastOrb.sprite, glowKey);
          lastOrb.sprite.parent.addChild(glow);
          (lastOrb as any)._wizardGlow = glow;
          (lastOrb as any)._wizardGlowKey = glowKey; // Store key for cleanup
          console.log(`🔮 [WizardsWatchtower] ✅ Glow added successfully!`);
        } else {
          console.log(`🔮 [WizardsWatchtower] ❌ CANNOT ADD GLOW - sprite or parent missing!`);
        }

        orbsBuffed++;
      });

      // Track total buffed
      itemEffectRegistry.setCounter(itemInstanceId, 'orbsBuffed', orbsBuffed);
      itemEffectRegistry.setCounter(itemInstanceId, 'totalOrbBonusHP', orbsBuffed * orbBonusHP);

      console.log(`✅ [WizardsWatchtower] Buffed ${orbsBuffed} orbs with +${orbBonusHP} HP each (total: +${orbsBuffed * orbBonusHP} HP)`);
    }, 100); // 100ms delay to ensure sprites are in the container
  });

  // DEFENSE_ORB_HIT: Remove glow on first hit (bonus HP consumed)
  battleEventBus.on('DEFENSE_ORB_HIT', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    // Build the glow key to look up
    const glowKey = getGlowKey(gameId, side, payload.orbId);
    console.log(`🔮 [WizardsWatchtower] DEFENSE_ORB_HIT for orbId: ${payload.orbId}, glowKey: ${glowKey}`);

    // Try cleanup from orbGlowMap using proper key
    if (orbGlowMap.has(glowKey)) {
      console.log(`🔮 [WizardsWatchtower] Found glowKey in orbGlowMap - removing glow`);
      cleanupOrbGlow(glowKey);
    }

    // Also try to cleanup via the orb's _wizardGlow reference (backup method)
    const battle = useMultiGameStore.getState().battles.get(gameId);
    if (battle) {
      const orb = battle.defenseDots.get(payload.orbId);
      if (orb && (orb as any)._wizardGlow) {
        console.log(`🔮 [WizardsWatchtower] Found _wizardGlow on orb - removing directly`);
        const glowRef = (orb as any)._wizardGlow as PIXI.Graphics;

        // Kill animation if tracked
        const storedKey = (orb as any)._wizardGlowKey;
        if (storedKey && glowAnimations.has(storedKey)) {
          glowAnimations.get(storedKey)?.kill();
          glowAnimations.delete(storedKey);
        }

        // Make invisible immediately
        glowRef.visible = false;
        glowRef.alpha = 0;
        glowRef.clear();

        if (glowRef.parent) glowRef.parent.removeChild(glowRef);
        if (!glowRef.destroyed) glowRef.destroy({ children: true });

        (orb as any)._wizardGlow = null;
        (orb as any)._wizardGlowKey = null;
        (orb as any).isWizardBuffed = false;
        console.log(`✅ [WizardsWatchtower] Glow removed from orb ${payload.orbId}`);
      }

      // NUCLEAR OPTION: Find and destroy ANY wizard-glow graphics near the orb sprite
      if (orb && orb.sprite && orb.sprite.parent) {
        const parent = orb.sprite.parent;
        const toRemove: PIXI.Graphics[] = [];
        for (const child of parent.children) {
          if (child instanceof PIXI.Graphics && child.name === 'wizard-glow') {
            // Check if it's at the same position as this orb
            if (Math.abs(child.x - orb.sprite.x) < 5 && Math.abs(child.y - orb.sprite.y) < 5) {
              toRemove.push(child);
            }
          }
        }
        if (toRemove.length > 0) {
          console.log(`🔮 [WizardsWatchtower] NUCLEAR: Found ${toRemove.length} wizard-glow graphics at orb position`);
          for (const g of toRemove) {
            g.visible = false;
            g.clear();
            parent.removeChild(g);
            if (!g.destroyed) g.destroy({ children: true });
          }
        }
      }
    }
  });

  // DEFENSE_ORB_DESTROYED: Add HP to shield (glow already removed on hit)
  battleEventBus.on('DEFENSE_ORB_DESTROYED', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    const glowKey = getGlowKey(gameId, side, payload.orbId);
    console.log(`🔮 [WizardsWatchtower] DEFENSE_ORB_DESTROYED for orbId: ${payload.orbId}, glowKey: ${glowKey}`);

    // Clean up glow from map (in case one-shot without hit event)
    if (orbGlowMap.has(glowKey)) {
      cleanupOrbGlow(glowKey);
    }

    // Also cleanup via orb reference (backup)
    const battle = useMultiGameStore.getState().battles.get(gameId);
    if (battle) {
      const orb = battle.defenseDots.get(payload.orbId);
      if (orb && (orb as any)._wizardGlow) {
        const glowRef = (orb as any)._wizardGlow as PIXI.Graphics;

        const storedKey = (orb as any)._wizardGlowKey;
        if (storedKey && glowAnimations.has(storedKey)) {
          glowAnimations.get(storedKey)?.kill();
          glowAnimations.delete(storedKey);
        }

        if (glowRef.parent) glowRef.parent.removeChild(glowRef);
        glowRef.destroy();
        (orb as any)._wizardGlow = null;
        (orb as any)._wizardGlowKey = null;
        console.log(`✅ [WizardsWatchtower] Glow removed on destroy for orb ${payload.orbId}`);
      }
    }

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

