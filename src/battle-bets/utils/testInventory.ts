/**
 * Test utility for adding sample items to inventory
 */

import { useInventoryStore, type InventoryItemInstance } from '../store/inventoryStore';
import type { QualityTier } from '../game/items/ItemRollSystem';

// Sample item definitions for testing
const SAMPLE_ITEMS: Array<Omit<InventoryItemInstance, 'instanceId' | 'acquiredAt'>> = [
  // Defense items
  {
    itemId: 'LAL_def_ironman_armor',
    name: 'Ironman Armor',
    icon: '🛡️',
    slot: 'defense',
    qualityTier: 'Masterwork',
    qualityScore: 95,
    rolledStats: { startShieldHp: 14, hpPerDestroyedOrb: 3 },
    source: 'chest',
  },
  {
    itemId: 'WAS_def_wizards_watchtower',
    name: "Wizard's Watchtower",
    icon: '🔮',
    slot: 'defense',
    qualityTier: 'Honed',
    qualityScore: 72,
    rolledStats: { startShieldHp: 12, orbBonusHP: 2 },
    source: 'chest',
  },
  {
    itemId: 'LAL_def_ironman_armor',
    name: 'Ironman Armor',
    icon: '🛡️',
    slot: 'defense',
    qualityTier: 'Balanced',
    qualityScore: 45,
    rolledStats: { startShieldHp: 9, hpPerDestroyedOrb: 2 },
    source: 'battle_win',
  },
  {
    itemId: 'LAL_def_ironman_armor',
    name: 'Ironman Armor',
    icon: '🛡️',
    slot: 'defense',
    qualityTier: 'Warped',
    qualityScore: 15,
    rolledStats: { startShieldHp: 6, hpPerDestroyedOrb: 1 },
    source: 'chest',
  },
  // Offense/Power items
  {
    itemId: 'CHA_pow_hornets_nest',
    name: "Hornet's Nest",
    icon: '🐝',
    slot: 'power',
    qualityTier: 'Masterwork',
    qualityScore: 92,
    rolledStats: { swarmDamage: 5, swarmCount: 3 },
    source: 'chest',
  },
  {
    itemId: 'MED_wpn_knight_defender',
    name: 'Knight Defender',
    icon: '⚔️',
    slot: 'weapon',
    qualityTier: 'Honed',
    qualityScore: 68,
    rolledStats: { knightHP: 8, patrolSpeed: 1.5 },
    source: 'battle_win',
  },
  {
    itemId: 'STARTER_wpn_shortsword',
    name: 'Shortsword',
    icon: '🗡️',
    slot: 'weapon',
    qualityTier: 'Balanced',
    qualityScore: 50,
    rolledStats: { damage: 2 },
    source: 'starter',
  },
  // Castle items
  {
    itemId: 'CASTLE_fortress',
    name: 'Fortress',
    icon: '🏰',
    slot: 'castle',
    qualityTier: 'Masterwork',
    qualityScore: 88,
    rolledStats: { maxHP: 25, armor: 2 },
    source: 'chest',
  },
  {
    itemId: 'CASTLE_fortress',
    name: 'Fortress',
    icon: '🏰',
    slot: 'castle',
    qualityTier: 'Balanced',
    qualityScore: 42,
    rolledStats: { maxHP: 22, armor: 1 },
    source: 'chest',
  },
];

/**
 * Add sample items to inventory for testing
 */
export function addTestItemsToInventory(): void {
  const store = useInventoryStore.getState();
  
  // Clear existing items first
  store.clearInventory();
  
  // Add each sample item with unique instanceId
  SAMPLE_ITEMS.forEach((item, index) => {
    const fullItem: InventoryItemInstance = {
      ...item,
      instanceId: `test_${Date.now()}_${index}`,
      acquiredAt: Date.now() - (index * 60000), // Stagger acquisition times
    };
    store.addItem(fullItem);
  });
  
  console.log(`📦 Added ${SAMPLE_ITEMS.length} test items to inventory`);
}

/**
 * Add a single random item to inventory
 */
export function addRandomTestItem(): void {
  const store = useInventoryStore.getState();
  const tiers: QualityTier[] = ['Warped', 'Balanced', 'Honed', 'Masterwork'];
  const randomTier = tiers[Math.floor(Math.random() * tiers.length)];
  const randomItem = SAMPLE_ITEMS[Math.floor(Math.random() * SAMPLE_ITEMS.length)];
  
  const newItem: InventoryItemInstance = {
    ...randomItem,
    qualityTier: randomTier,
    qualityScore: Math.floor(Math.random() * 100),
    instanceId: `random_${Date.now()}`,
    acquiredAt: Date.now(),
  };
  
  store.addItem(newItem);
}

