/**
 * ItemTestUtils.ts
 * 
 * Testing utilities for item system.
 * Provides helper functions to test items in debug mode.
 */

import { rollItem, rollItemWithTier } from './ItemRollSystem';
import { itemEffectRegistry } from './ItemEffectRegistry';
import type { ItemDefinition, QualityTier, RolledItemStats } from './ItemRollSystem';

// Import item definitions
import { LAL_IRONMAN_ARMOR_DEFINITION } from './effects/LAL_IronmanArmor';
import { STARTER_SHORTSWORD_DEFINITION } from './effects/STARTER_Shortsword';
import { CHA_HORNETS_NEST_DEFINITION } from './effects/CHA_HornetsNest';
import { WAS_WIZARDS_WATCHTOWER_DEFINITION } from './effects/WAS_WizardsWatchtower';
import { MED_KNIGHT_DEFENDER_DEFINITION } from './effects/MED_KnightDefender';

/**
 * All available item definitions
 */
export const ALL_ITEM_DEFINITIONS: ItemDefinition[] = [
  LAL_IRONMAN_ARMOR_DEFINITION,
  STARTER_SHORTSWORD_DEFINITION,
  CHA_HORNETS_NEST_DEFINITION,
  WAS_WIZARDS_WATCHTOWER_DEFINITION,
  MED_KNIGHT_DEFENDER_DEFINITION,
  // Add more as they're implemented
];

/**
 * Get item definition by ID
 */
export function getItemDefinition(itemId: string): ItemDefinition | null {
  return ALL_ITEM_DEFINITIONS.find((def) => def.id === itemId) ?? null;
}

/**
 * Roll a test item by ID
 */
export function rollTestItem(itemId: string): RolledItemStats | null {
  const definition = getItemDefinition(itemId);

  if (!definition) {
    console.error(`❌ [ItemTestUtils] Item definition not found: ${itemId}`);
    return null;
  }

  return rollItem(definition);
}

/**
 * Roll a test item with specific quality tier
 */
export function rollTestItemWithTier(
  itemId: string,
  tier: QualityTier
): RolledItemStats | null {
  const definition = getItemDefinition(itemId);

  if (!definition) {
    console.error(`❌ [ItemTestUtils] Item definition not found: ${itemId}`);
    return null;
  }

  return rollItemWithTier(definition, tier);
}

/**
 * Activate a test item in a battle
 */
export async function activateTestItem(
  gameId: string,
  side: 'left' | 'right',
  itemId: string,
  tier?: QualityTier
): Promise<string | null> {
  let rolledItem: RolledItemStats | null;

  if (tier) {
    rolledItem = rollTestItemWithTier(itemId, tier);
  } else {
    rolledItem = rollTestItem(itemId);
  }

  if (!rolledItem) {
    return null;
  }

  const instanceId = await itemEffectRegistry.activateItem(gameId, side, rolledItem);

  console.log(`✅ [ItemTestUtils] Activated ${itemId} on ${side} (${instanceId})`);

  return instanceId;
}

/**
 * Activate multiple test items
 */
export async function activateTestItems(
  gameId: string,
  leftItems: string[],
  rightItems: string[]
): Promise<void> {
  console.log(`🎮 [ItemTestUtils] Activating test items for game ${gameId}`);

  for (const itemId of leftItems) {
    await activateTestItem(gameId, 'left', itemId);
  }

  for (const itemId of rightItems) {
    await activateTestItem(gameId, 'right', itemId);
  }

  console.log(`✅ [ItemTestUtils] All test items activated`);
}

/**
 * Get all active items for a game (for debugging)
 */
export function getActiveItemsForGame(gameId: string): any[] {
  const allItems = itemEffectRegistry.getActiveItems();
  return allItems.filter((item) => item.gameId === gameId);
}

/**
 * Print item stats (for debugging)
 */
export function printItemStats(itemId: string, rolls: Record<string, number>): void {
  console.log(`📊 [ItemTestUtils] ${itemId} Stats:`);
  for (const [key, value] of Object.entries(rolls)) {
    console.log(`  - ${key}: ${value}`);
  }
}

/**
 * Create a test loadout (for URL parameter testing)
 * Example: ?testItems=LAL_def_ironman_armor,LAL_atk_ironman_bands
 */
export function parseTestItemsFromURL(): {
  leftItems: string[];
  rightItems: string[];
} {
  const params = new URLSearchParams(window.location.search);
  const testItemsParam = params.get('testItems');

  if (!testItemsParam) {
    return { leftItems: [], rightItems: [] };
  }

  const itemIds = testItemsParam.split(',').map((id) => id.trim());

  // For now, put all items on left side
  // Later, support syntax like "left:item1,item2;right:item3,item4"
  return {
    leftItems: itemIds,
    rightItems: [],
  };
}

/**
 * Auto-activate test items from URL parameter
 */
export async function autoActivateTestItems(gameId: string): Promise<void> {
  const { leftItems, rightItems } = parseTestItemsFromURL();

  if (leftItems.length === 0 && rightItems.length === 0) {
    console.log(`ℹ️ [ItemTestUtils] No test items specified in URL`);
    return;
  }

  console.log(`🎮 [ItemTestUtils] Auto-activating test items from URL`);
  await activateTestItems(gameId, leftItems, rightItems);
}

