/**
 * DefenseOrbSystem.ts
 * 
 * API for items to manipulate defense orbs.
 * Provides functions to add, buff, and query defense orbs.
 */

import { multiGameStore } from '../../../store/multiGameStore';
import type { StatType } from '../../../types/game';

export interface DefenseOrbOptions {
  hp?: number; // HP of the orb (default: 1)
  isEnergized?: boolean; // Whether orb is energized (default: false)
}

/**
 * Add a single defense orb to a lane
 */
export function addDefenseOrb(
  gameId: string,
  side: 'left' | 'right',
  lane: StatType,
  options: DefenseOrbOptions = {}
): void {
  const { hp = 1, isEnergized = false } = options;
  
  console.log(`🛡️ [DefenseOrbSystem] Adding orb to ${side} ${lane} (HP: ${hp}, Energized: ${isEnergized})`);
  
  multiGameStore.getState().addDefenseOrb(gameId, side, lane, hp, isEnergized);
}

/**
 * Add multiple defense orbs to a lane
 */
export function addDefenseOrbs(
  gameId: string,
  side: 'left' | 'right',
  lane: StatType,
  count: number,
  options: DefenseOrbOptions = {}
): void {
  for (let i = 0; i < count; i++) {
    addDefenseOrb(gameId, side, lane, options);
  }
  
  console.log(`🛡️ [DefenseOrbSystem] Added ${count} orbs to ${side} ${lane}`);
}

/**
 * Buff random defense orbs (increase HP)
 */
export function buffRandomOrbs(
  gameId: string,
  side: 'left' | 'right',
  count: number,
  hpDelta: number
): void {
  console.log(`⚡ [DefenseOrbSystem] Buffing ${count} random orbs on ${side} by +${hpDelta} HP`);
  
  multiGameStore.getState().buffRandomDefenseOrbs(gameId, side, count, hpDelta);
}

/**
 * Get the lane with the fewest defense orbs
 */
export function getWeakestLane(
  gameId: string,
  side: 'left' | 'right'
): StatType | null {
  const state = multiGameStore.getState();
  const game = state.games.get(gameId);
  
  if (!game) {
    console.error(`❌ [DefenseOrbSystem] Game not found: ${gameId}`);
    return null;
  }
  
  const sideKey = side === 'left' ? 'leftDefenseOrbs' : 'rightDefenseOrbs';
  const defenseOrbs = game[sideKey];
  
  const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
  let weakestLane: StatType | null = null;
  let minCount = Infinity;
  
  for (const stat of stats) {
    const count = defenseOrbs[stat]?.length ?? 0;
    if (count < minCount) {
      minCount = count;
      weakestLane = stat;
    }
  }
  
  console.log(`🔍 [DefenseOrbSystem] Weakest lane on ${side}: ${weakestLane} (${minCount} orbs)`);
  
  return weakestLane;
}

/**
 * Get defense orb count for a lane
 */
export function getDefenseOrbCount(
  gameId: string,
  side: 'left' | 'right',
  lane: StatType
): number {
  const state = multiGameStore.getState();
  const game = state.games.get(gameId);
  
  if (!game) {
    console.error(`❌ [DefenseOrbSystem] Game not found: ${gameId}`);
    return 0;
  }
  
  const sideKey = side === 'left' ? 'leftDefenseOrbs' : 'rightDefenseOrbs';
  const defenseOrbs = game[sideKey];
  
  return defenseOrbs[lane]?.length ?? 0;
}

/**
 * Get total defense orb count across all lanes
 */
export function getTotalDefenseOrbCount(
  gameId: string,
  side: 'left' | 'right'
): number {
  const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
  let total = 0;
  
  for (const stat of stats) {
    total += getDefenseOrbCount(gameId, side, stat);
  }
  
  return total;
}

/**
 * Check if a lane has any defense orbs
 */
export function hasDefenseOrbs(
  gameId: string,
  side: 'left' | 'right',
  lane: StatType
): boolean {
  return getDefenseOrbCount(gameId, side, lane) > 0;
}

/**
 * Get all lanes with no defense orbs
 */
export function getEmptyLanes(
  gameId: string,
  side: 'left' | 'right'
): StatType[] {
  const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
  return stats.filter((stat) => !hasDefenseOrbs(gameId, side, stat));
}

