/**
 * MED_KnightDefender.ts
 * 
 * Medieval Knight Defender Power Item
 * Spawns a knight that patrols the battlefield and deflects projectiles.
 * 
 * - Spawns in the middle battlefield zone on owner's side
 * - Roams up and down between stat rows
 * - Deflects first projectile, but if hit within 1 second, takes damage
 * - Has 20 HP
 */

import { battleEventBus } from '../../events/EventBus';
import { itemEffectRegistry } from '../ItemEffectRegistry';
import type { ItemRuntimeContext } from '../ItemEffectRegistry';
import type { ItemDefinition } from '../ItemRollSystem';
import { KnightDefender } from '../../entities/KnightDefender';
import { useMultiGameStore } from '../../../store/multiGameStore';
import { pixiManager } from '../../managers/PixiManager';

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
 * Store for active knights (per game)
 */
const activeKnights: Map<string, KnightDefender> = new Map();

/**
 * Get knight for a game/side
 */
export function getKnight(gameId: string, side: 'left' | 'right'): KnightDefender | undefined {
  return activeKnights.get(`${gameId}-${side}`);
}

/**
 * Spawn knight helper function
 */
function spawnKnight(gameId: string, side: 'left' | 'right'): KnightDefender | null {
  console.log(`🐴 [KnightDefender] Spawning knight for ${side} in game ${gameId}`);

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
  activeKnights.set(`${gameId}-${side}`, knight);

  // Add knight sprite to game container
  const container = pixiManager.getGameContainer(gameId);
  if (container) {
    container.addChild(knight.sprite);
    console.log(`🐴 [KnightDefender] Added knight sprite to container at position (${knight.position.x}, ${knight.position.y})`);
  } else {
    console.error(`🐴 [KnightDefender] No container found for ${gameId}`);
    return null;
  }

  // Start patrolling
  knight.startPatrol();

  console.log(`🐴 [KnightDefender] Knight spawned and patrolling!`);
  return knight;
}

/**
 * Register Knight Defender effect
 */
export function registerKnightDefenderEffect(context: ItemRuntimeContext): void {
  const { itemInstanceId, gameId, side } = context;

  console.log(`🐴 [KnightDefender] REGISTERING EFFECT for ${side} side in game ${gameId}`);

  // Check if knight already exists (from previous activation)
  const existingKnight = activeKnights.get(`${gameId}-${side}`);
  if (existingKnight && existingKnight.alive) {
    console.log(`🐴 [KnightDefender] Knight already exists for ${side} in ${gameId}, skipping spawn`);
    return;
  }

  // Spawn knight immediately when item is equipped (pre-game)
  // This way the knight is visible before Q1 starts
  console.log(`🐴 [KnightDefender] Spawning knight immediately on equip...`);
  spawnKnight(gameId, side);

  // Also listen to BATTLE_START in case this is called before game init
  battleEventBus.on('BATTLE_START', (payload) => {
    if (payload.gameId !== gameId) return;
    if (payload.side !== side) return;

    // Check if knight already exists
    const knight = activeKnights.get(`${gameId}-${side}`);
    if (knight && knight.alive) {
      console.log(`🐴 [KnightDefender] Knight already exists on BATTLE_START, skipping`);
      return;
    }

    // Spawn if not already spawned
    spawnKnight(gameId, side);
  });

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

