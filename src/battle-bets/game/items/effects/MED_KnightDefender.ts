/**
 * MED_KnightDefender.ts
 *
 * Medieval Knight Defender Power Item
 * Spawns a knight that patrols the battlefield and deflects projectiles.
 *
 * - Spawns in the middle battlefield zone on owner's side
 * - Roams up and down between stat rows
 * - Smart AI: evades threats, protects weak lanes
 * - Deflects first projectile, but if hit within 1 second, takes damage
 * - Has 20 HP with visual HP bar
 */

import { battleEventBus } from '../../events/EventBus';
import { itemEffectRegistry } from '../ItemEffectRegistry';
import type { ItemRuntimeContext } from '../ItemEffectRegistry';
import type { ItemDefinition } from '../ItemRollSystem';
import { KnightDefender } from '../../entities/KnightDefender';
import { useMultiGameStore } from '../../../store/multiGameStore';
import { pixiManager } from '../../managers/PixiManager';
import { getPendingShieldCharges } from './sharedKnightState';

/**
 * Knight Defender Item Definition
 */
export const MED_KNIGHT_DEFENDER_DEFINITION: ItemDefinition = {
  id: 'MED_pwr_knight_defender',
  team: 'MED', // Medieval theme (generic)
  teamName: 'Medieval',
  slot: 'power',
  name: 'Knight Defender',
  description: 'Summons a knight that patrols the battlefield, deflecting enemy projectiles. Can deflect once per second; hits during cooldown deal damage. 20 HP.',
  icon: '🐴',
  rollRanges: {
    // No rolls for now - fixed stats
  },
};

/**
 * Store for active knights (per game) - SINGLETON REGISTRY
 * Key format: "gameId-side" (e.g., "battle-123-left")
 */
const activeKnights: Map<string, KnightDefender> = new Map();

/**
 * Get knight for a game/side (only returns if alive)
 */
export function getKnight(gameId: string, side: 'left' | 'right'): KnightDefender | null {
  const key = `${gameId}-${side}`;
  const knight = activeKnights.get(key);
  console.log(`🐴 [getKnight] Looking for key="${key}", found=${!!knight}, alive=${knight?.alive}`);
  console.log(`🐴 [getKnight] All active knights:`, Array.from(activeKnights.keys()));
  return (knight && knight.alive) ? knight : null;
}

/**
 * Get all active knight keys (for debugging)
 */
export function getActiveKnightKeys(): string[] {
  return Array.from(activeKnights.keys());
}

/**
 * Get knight debug info for a game
 */
export function getKnightDebugInfo(gameId: string): { left: any; right: any; allKeys: string[] } {
  const leftKey = `${gameId}-left`;
  const rightKey = `${gameId}-right`;
  const leftKnight = activeKnights.get(leftKey);
  const rightKnight = activeKnights.get(rightKey);

  return {
    left: leftKnight ? {
      key: leftKey,
      alive: leftKnight.alive,
      hp: leftKnight.hp,
      maxHP: leftKnight.maxHp,
      shieldCharges: leftKnight.shieldCharges,
      isPatrolling: leftKnight.isPatrolling,
      position: leftKnight.sprite ? { x: leftKnight.sprite.x, y: leftKnight.sprite.y } : null,
    } : null,
    right: rightKnight ? {
      key: rightKey,
      alive: rightKnight.alive,
      hp: rightKnight.hp,
      maxHP: rightKnight.maxHp,
      shieldCharges: rightKnight.shieldCharges,
      isPatrolling: rightKnight.isPatrolling,
      position: rightKnight.sprite ? { x: rightKnight.sprite.x, y: rightKnight.sprite.y } : null,
    } : null,
    allKeys: Array.from(activeKnights.keys()),
  };
}

/**
 * Check if a knight exists and is alive for a game/side
 */
export function hasActiveKnight(gameId: string, side: 'left' | 'right'): boolean {
  const knight = activeKnights.get(`${gameId}-${side}`);
  return !!knight && knight.alive;
}

/**
 * Spawn or get existing knight - CENTRALIZED SPAWN FUNCTION
 * This is the ONLY function that should be used to spawn knights.
 * Returns existing knight if already spawned and alive.
 */
export function getOrSpawnKnight(gameId: string, side: 'left' | 'right'): KnightDefender | null {
  const key = `${gameId}-${side}`;

  // Check if knight already exists and is alive
  const existing = activeKnights.get(key);
  if (existing && existing.alive) {
    console.log(`🐴 [KnightDefender] Knight already exists for ${side} in ${gameId}, returning existing`);
    return existing;
  }

  // If dead knight exists, clean it up
  if (existing && !existing.alive) {
    console.log(`🐴 [KnightDefender] Cleaning up dead knight for ${side} in ${gameId}`);
    existing.dispose();
    activeKnights.delete(key);
  }

  console.log(`🐴 [KnightDefender] Spawning NEW knight for ${side} in game ${gameId}`);

  // Get team color from battle state
  const battle = useMultiGameStore.getState().battles.get(gameId);
  if (!battle) {
    console.error(`🐴 [KnightDefender] No battle found for ${gameId}`);
    return null;
  }

  const team = side === 'left' ? battle.game.leftTeam : battle.game.rightTeam;
  const teamColor = team.color;

  // Create knight
  const knight = new KnightDefender({
    id: `knight-${gameId}-${side}`,
    gameId,
    side,
    teamColor,
  });

  // Store reference
  activeKnights.set(key, knight);

  // Add knight sprite to game container
  const container = pixiManager.getContainer(gameId);
  if (container) {
    container.addChild(knight.sprite);
    console.log(`🐴 [KnightDefender] Added knight sprite to container at position (${knight.position.x}, ${knight.position.y})`);
  } else {
    console.error(`🐴 [KnightDefender] No container found for ${gameId}`);
    activeKnights.delete(key);
    return null;
  }

  // DON'T start patrolling here - that's what caused the PIXI render crash!
  // Patrol will be started by QuarterDebugControls.handleStartGame()
  // Knight will sit idle with bob animation until game starts

  // Check for pending shield charges from Castle item
  const pendingCharges = getPendingShieldCharges(gameId, side);
  if (pendingCharges > 0) {
    knight.setShieldCharges(pendingCharges);
    console.log(`🐴 [KnightDefender] Applied ${pendingCharges} pending shield charges from Castle item`);
  }

  console.log(`🐴 [KnightDefender] Knight spawned (idle, waiting for game start to patrol)`);
  return knight;
}

/**
 * Remove and dispose knight for a game/side
 */
export function removeKnight(gameId: string, side: 'left' | 'right'): void {
  const key = `${gameId}-${side}`;
  const knight = activeKnights.get(key);
  if (knight) {
    knight.dispose();
    activeKnights.delete(key);
    console.log(`🐴 [KnightDefender] Removed knight for ${side} in ${gameId}`);
  }
}

/**
 * Register Knight Defender effect
 * Note: When used as a slot 2 item, this spawns and patrols the knight.
 * When castle is equipped, the knight is spawned in PreGameItemSelector.handleRollCastle instead.
 */
export function registerKnightDefenderEffect(context: ItemRuntimeContext): void {
  const { itemInstanceId, gameId, side } = context;

  console.log(`🐴 [KnightDefender] REGISTERING EFFECT for ${side} side in game ${gameId}`);

  // Spawn knight immediately and start patrol (like original slot 2 item behavior)
  const knight = getOrSpawnKnight(gameId, side);
  if (knight) {
    knight.startPatrol();
    console.log(`🐴 [KnightDefender] Knight spawned and patrolling for ${side}`);
  }

  console.log(`✅ [KnightDefender] Effect registered for ${side} (${itemInstanceId})`);
}

/**
 * Auto-register this item effect
 */
itemEffectRegistry.registerEffect(
  MED_KNIGHT_DEFENDER_DEFINITION.id,
  registerKnightDefenderEffect
);

console.log(`📦 [KnightDefender] Item effect registered: ${MED_KNIGHT_DEFENDER_DEFINITION.id}`);

