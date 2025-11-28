/**
 * CASTLE_Fortress.ts
 *
 * Castle Item - Determines castle HP and knight shield charges.
 * Comes with one Knight Defender with 1-3 shield charges.
 *
 * Stats:
 * - castleHP: 15-40 (determines castle starting HP)
 * - shieldCharges: 1-3 (knight can block this many projectiles before cooldown applies)
 *
 * Rarity determines castle type name:
 * - LEGENDARY: Castle (35-40 HP, 3 charges)
 * - EPIC: Stronghold (30-35 HP, 2-3 charges)
 * - RARE: Garrison (25-30 HP, 2 charges)
 * - UNCOMMON: Guard Tower (20-25 HP, 1-2 charges)
 * - COMMON: Outpost (15-20 HP, 1 charge)
 */

import { itemEffectRegistry } from '../ItemEffectRegistry';
import type { ItemRuntimeContext } from '../ItemEffectRegistry';
import type { ItemDefinition, RolledItemStats, QualityTier } from '../ItemRollSystem';
import { TEAM_NAMES, LEGENDARY_PLAYERS, CASTLE_TYPES, type CastleRarity } from '../../../data/castleNames';
import { useMultiGameStore } from '../../../store/multiGameStore';
import { castleManager } from '../../managers/CastleManager';
import { setPendingShieldCharges } from './sharedKnightState';

/**
 * Castle Item Definition (base - name is generated dynamically)
 */
export const CASTLE_FORTRESS_DEFINITION: ItemDefinition = {
  id: 'CASTLE_fortress',
  team: 'CASTLE',
  teamName: 'Castle',
  slot: 'defense', // Castle goes in defense slot conceptually, but has its own slot
  name: 'Castle', // Will be overridden by generated name
  description: 'Your fortress! Determines castle HP and includes a Knight Defender with shield charges.',
  icon: '🏰',
  rollRanges: {
    castleHP: { min: 15, max: 40, step: 1 },
    shieldCharges: { min: 1, max: 3, step: 1 },
  },
};

/**
 * Get castle type suffix based on HP roll
 */
export function getCastleType(hp: number): { rarity: CastleRarity; type: string } {
  if (hp >= 35) return { rarity: 'LEGENDARY', type: CASTLE_TYPES.LEGENDARY };
  if (hp >= 30) return { rarity: 'EPIC', type: CASTLE_TYPES.EPIC };
  if (hp >= 25) return { rarity: 'RARE', type: CASTLE_TYPES.RARE };
  if (hp >= 20) return { rarity: 'UNCOMMON', type: CASTLE_TYPES.UNCOMMON };
  return { rarity: 'COMMON', type: CASTLE_TYPES.COMMON };
}

/**
 * Generate a random castle name based on HP roll
 */
export function generateCastleName(hp: number): string {
  const { rarity, type } = getCastleType(hp);

  // Determine name pool weights based on rarity
  let legendaryWeight: number;
  switch (rarity) {
    case 'LEGENDARY':
    case 'EPIC':
      legendaryWeight = 0.7; // 70% legendary players
      break;
    case 'RARE':
      legendaryWeight = 0.5; // 50/50
      break;
    case 'UNCOMMON':
    case 'COMMON':
    default:
      legendaryWeight = 0.3; // 30% legendary players
      break;
  }

  // Pick from appropriate pool
  const useLegendary = Math.random() < legendaryWeight;
  const namePool = useLegendary ? LEGENDARY_PLAYERS : TEAM_NAMES;
  const name = namePool[Math.floor(Math.random() * namePool.length)];

  return `${name} ${type}`;
}

/**
 * Get rarity color for UI
 */
export function getCastleRarityColor(rarity: CastleRarity): string {
  switch (rarity) {
    case 'LEGENDARY': return '#FFD700'; // Gold
    case 'EPIC': return '#A855F7';      // Purple
    case 'RARE': return '#3B82F6';      // Blue
    case 'UNCOMMON': return '#22C55E';  // Green
    case 'COMMON': return '#9CA3AF';    // Gray
  }
}

/**
 * Store equipped castle per side
 */
const equippedCastles: Map<string, RolledItemStats & { generatedName: string }> = new Map();

/**
 * Get equipped castle for a battle/side
 */
export function getEquippedCastle(battleId: string, side: 'left' | 'right') {
  return equippedCastles.get(`${battleId}-${side}`);
}

/**
 * Equip a castle and apply its effects
 * NOTE: Knight spawning is handled by PreGameItemSelector directly to avoid circular dependencies.
 */
export function equipCastle(
  battleId: string,
  side: 'left' | 'right',
  rolledStats: RolledItemStats
): void {
  const hp = Math.round(rolledStats.rolls.castleHP || 20);
  const shieldCharges = Math.round(rolledStats.rolls.shieldCharges || 1);
  const generatedName = generateCastleName(hp);

  console.log(`🏰 [Castle] Equipping ${generatedName} for ${side}:`, {
    hp,
    shieldCharges,
    quality: rolledStats.qualityTier,
  });

  // Store equipped castle with generated name
  equippedCastles.set(`${battleId}-${side}`, {
    ...rolledStats,
    generatedName,
  });

  // Apply castle HP to battle state using store action
  useMultiGameStore.getState().setCastleHP(battleId, side, hp);

  // Also update the visual castle entity (if it exists already)
  // Castle IDs in BattleCanvas are: "${battleId}-left" and "${battleId}-right"
  const castleId = `${battleId}-${side}`;
  castleManager.setCastleHP(battleId, castleId, hp);

  // Store pending shield charges using shared state (backup in case knight spawns later)
  setPendingShieldCharges(battleId, side, shieldCharges);

  console.log(`🏰 [Castle] Castle equipped. HP=${hp}, ShieldCharges=${shieldCharges} stored.`);
}

/**
 * Register Castle effect
 * This is a NO-OP now - castle HP is set in handleRollCastle/equipCastle.
 * Knight spawning is handled by handleStartGame in DebugBottomBar.
 * We register this effect just so the item registry doesn't complain.
 */
export function registerCastleEffect(context: ItemRuntimeContext): void {
  const { gameId, side } = context;
  console.log(`🏰 [Castle] registerCastleEffect called for ${side} in ${gameId} - NO-OP (HP already set)`);
  // NO-OP - everything is already handled by handleRollCastle and handleStartGame
}

// Register effect (required for item registry)
itemEffectRegistry.registerEffect(CASTLE_FORTRESS_DEFINITION.id, registerCastleEffect);

console.log(`📦 [Castle] Item effect registered: ${CASTLE_FORTRESS_DEFINITION.id}`);

