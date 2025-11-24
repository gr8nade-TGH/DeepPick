/**
 * ProjectileSystem.ts
 * 
 * API for items to fire additional projectiles.
 * Provides functions to inject projectiles into the battle.
 */

import { multiGameStore } from '../../../store/multiGameStore';
import type { StatType } from '../../../types/game';

export interface ProjectileOptions {
  damage?: number; // Damage per projectile (default: 1)
  hp?: number; // HP of projectile (for Magic Missiles, default: 1)
  color?: number; // Custom color (default: lane color)
  source?: 'BASE' | 'ITEM'; // Source of projectile (default: 'ITEM')
  delay?: number; // Delay before firing in ms (default: 0)
}

/**
 * Fire a single projectile from a lane
 */
export async function fireProjectile(
  gameId: string,
  side: 'left' | 'right',
  lane: StatType,
  options: ProjectileOptions = {}
): Promise<void> {
  const { damage = 1, hp = 1, source = 'ITEM', delay = 0 } = options;
  
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  
  console.log(`🔥 [ProjectileSystem] Firing projectile from ${side} ${lane} (Damage: ${damage}, HP: ${hp}, Source: ${source})`);
  
  // Use existing projectile firing logic from multiGameStore
  multiGameStore.getState().fireItemProjectile(gameId, side, lane, damage, hp, source);
}

/**
 * Fire multiple projectiles from a lane
 */
export async function fireProjectiles(
  gameId: string,
  side: 'left' | 'right',
  lane: StatType,
  count: number,
  options: ProjectileOptions = {}
): Promise<void> {
  const { delay = 0 } = options;
  
  console.log(`🔥 [ProjectileSystem] Firing ${count} projectiles from ${side} ${lane}`);
  
  for (let i = 0; i < count; i++) {
    await fireProjectile(gameId, side, lane, {
      ...options,
      delay: i * delay, // Stagger projectiles if delay specified
    });
  }
}

/**
 * Fire projectiles from all lanes
 */
export async function fireProjectilesFromAllLanes(
  gameId: string,
  side: 'left' | 'right',
  options: ProjectileOptions = {}
): Promise<void> {
  const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
  
  console.log(`🔥 [ProjectileSystem] Firing projectiles from all lanes on ${side}`);
  
  for (const stat of stats) {
    await fireProjectile(gameId, side, stat, options);
  }
}

/**
 * Fire projectiles from specific lanes
 */
export async function fireProjectilesFromLanes(
  gameId: string,
  side: 'left' | 'right',
  lanes: StatType[],
  options: ProjectileOptions = {}
): Promise<void> {
  console.log(`🔥 [ProjectileSystem] Firing projectiles from ${lanes.length} lanes on ${side}`);
  
  for (const lane of lanes) {
    await fireProjectile(gameId, side, lane, options);
  }
}

/**
 * Fire "Final Blow" projectiles (extra damage when opponent low HP)
 */
export async function fireFinalBlowProjectiles(
  gameId: string,
  side: 'left' | 'right',
  lane: StatType,
  count: number,
  bonusDamage: number
): Promise<void> {
  console.log(`💥 [ProjectileSystem] Firing ${count} Final Blow projectiles from ${side} ${lane} (+${bonusDamage} damage)`);
  
  await fireProjectiles(gameId, side, lane, count, {
    damage: 1 + bonusDamage,
    source: 'ITEM',
  });
}

/**
 * Fire retaliation projectiles (triggered by taking damage)
 */
export async function fireRetaliationProjectiles(
  gameId: string,
  side: 'left' | 'right',
  count: number,
  options: ProjectileOptions = {}
): Promise<void> {
  const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
  
  // Pick random lanes for retaliation
  const randomLanes: StatType[] = [];
  for (let i = 0; i < count; i++) {
    const randomLane = stats[Math.floor(Math.random() * stats.length)];
    randomLanes.push(randomLane);
  }
  
  console.log(`⚔️ [ProjectileSystem] Firing ${count} retaliation projectiles from ${side}`);
  
  await fireProjectilesFromLanes(gameId, side, randomLanes, {
    ...options,
    source: 'ITEM',
  });
}

/**
 * Get projectile count fired this quarter (for tracking)
 */
export function getProjectileCountThisQuarter(
  gameId: string,
  side: 'left' | 'right'
): number {
  const state = multiGameStore.getState();
  const game = state.games.get(gameId);
  
  if (!game) {
    console.error(`❌ [ProjectileSystem] Game not found: ${gameId}`);
    return 0;
  }
  
  // This would need to be tracked in game state
  // For now, return 0 (implement tracking later)
  return 0;
}

