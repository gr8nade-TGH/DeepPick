/**
 * Inventory system types for Battle Bets V3
 * Defines items, effects, and equipment slots
 */

// Item types
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemType = 'shield' | 'weapon' | 'potion' | 'buff';
export type ItemSlot = 'slot1' | 'slot2' | 'slot3'; // Updated to support 3 slots

// Quality tiers for rolled items (new item system)
export type QualityTier = 'Warped' | 'Balanced' | 'Honed' | 'Masterwork';

/**
 * Rolled item stats (new item system)
 * Items have randomized stats when won from treasure chests
 */
export interface RolledItemStats {
  itemId: string; // e.g., 'LAL_def_ironman_armor'
  ownerCapperId: string; // UUID of capper who owns this item
  rolls: Record<string, number>; // e.g., { startShieldHp: 7, hpPerDestroyedOrb: 2 }
  qualityTier: QualityTier; // Warped, Balanced, Honed, or Masterwork
  qualityScore: number; // 0-100, used to determine tier
  acquiredAt: Date;
}

/**
 * Item runtime context (new item system)
 * Passed to item effect functions when activated in battle
 */
export interface ItemRuntimeContext {
  itemInstanceId: string; // Unique ID for this item instance in this battle
  gameId: string; // Battle game ID
  side: 'left' | 'right'; // Which side the item is on
  rolls: Record<string, number>; // The rolled stats for this item
  qualityTier: QualityTier; // Quality tier of this item
}

/**
 * Base item interface
 */
export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  icon: string; // Emoji or icon identifier
  isImplemented: boolean; // Whether the item is functional or just a placeholder

  // Item effect configuration
  effect?: ItemEffect;
}

/**
 * Item effect configuration
 */
export interface ItemEffect {
  // Shield effects
  shieldHP?: number; // Amount of shield HP provided
  shieldActivationThreshold?: number; // HP threshold to activate shield (e.g., 3 = activates when HP < 3)

  // Damage effects
  damageBoost?: number; // Percentage damage boost (e.g., 20 = +20% damage)

  // Healing effects
  healAmount?: number; // Amount of HP to restore

  // Projectile effects
  fireOrbRatio?: number; // For every X POINTS projectiles, fire 1 FIRE projectile (e.g., 5 = every 5 POINTS fires 1 FIRE)

  // Passive effects
  passive?: boolean; // Whether effect is always active or triggered
}

/**
 * Equipped item state for a castle
 */
export interface EquippedItems {
  slot1: InventoryItem | null;
  slot2: InventoryItem | null;
  slot3: InventoryItem | null; // Added slot3 support
}

/**
 * Shield state tracking
 */
export interface ShieldState {
  isActive: boolean;
  currentHP: number;
  maxHP: number;
  sourceItem: InventoryItem;
}

/**
 * Available inventory items
 */
export const INVENTORY_ITEMS: InventoryItem[] = [
  // Functional item: Blue Orb Shield
  {
    id: 'blue-orb-shield',
    name: 'Blue Orb Shield',
    description: 'A mystical blue orb that activates a protective shield when your castle HP drops below 3. The shield absorbs 5 damage before breaking.',
    type: 'shield',
    rarity: 'epic',
    icon: '🔵',
    isImplemented: true,
    effect: {
      shieldHP: 5,
      shieldActivationThreshold: 3,
      passive: true,
    }
  },

  // Functional item: Fire Orb
  {
    id: 'fire-orb',
    name: 'Fire Orb',
    description: 'A blazing orb that channels your offensive power. For every 5 POINTS projectiles fired, automatically launches 1 bonus FIRE projectile from your FIRE attack row.',
    type: 'weapon',
    rarity: 'rare',
    icon: '🔴',
    isImplemented: true,
    effect: {
      fireOrbRatio: 5, // Every 5 POINTS projectiles = 1 FIRE projectile
      passive: true,
    }
  },

  // Placeholder items
  {
    id: 'fire-sword',
    name: 'Fire Sword',
    description: 'A blazing sword that increases your attack damage by 25%. Burns enemies with each strike.',
    type: 'weapon',
    rarity: 'rare',
    icon: '🔥',
    isImplemented: false,
    effect: {
      damageBoost: 25,
      passive: true,
    }
  },

  {
    id: 'healing-potion',
    name: 'Healing Potion',
    description: 'A magical potion that instantly restores 5 HP when used. Single use item.',
    type: 'potion',
    rarity: 'common',
    icon: '🧪',
    isImplemented: false,
    effect: {
      healAmount: 5,
      passive: false,
    }
  },

  {
    id: 'golden-crown',
    name: 'Golden Crown',
    description: 'A royal crown that increases your maximum HP by 3. Fit for a true king.',
    type: 'buff',
    rarity: 'legendary',
    icon: '👑',
    isImplemented: false,
  },

  {
    id: 'lightning-bolt',
    name: 'Lightning Bolt',
    description: 'Harness the power of lightning to deal massive damage. Strikes with devastating force.',
    type: 'weapon',
    rarity: 'epic',
    icon: '⚡',
    isImplemented: false,
    effect: {
      damageBoost: 50,
      passive: false,
    }
  },
];

/**
 * Get item by ID
 */
export function getItemById(id: string): InventoryItem | undefined {
  return INVENTORY_ITEMS.find(item => item.id === id);
}

/**
 * Get rarity color for UI display
 */
export function getRarityColor(rarity: ItemRarity): string {
  switch (rarity) {
    case 'common':
      return '#9ca3af'; // Gray
    case 'rare':
      return '#3b82f6'; // Blue
    case 'epic':
      return '#a855f7'; // Purple
    case 'legendary':
      return '#f59e0b'; // Gold
    default:
      return '#ffffff';
  }
}

/**
 * Get rarity color as hex number for PixiJS
 */
export function getRarityColorHex(rarity: ItemRarity): number {
  switch (rarity) {
    case 'common':
      return 0x9ca3af;
    case 'rare':
      return 0x3b82f6;
    case 'epic':
      return 0xa855f7;
    case 'legendary':
      return 0xf59e0b;
    default:
      return 0xffffff;
  }
}

