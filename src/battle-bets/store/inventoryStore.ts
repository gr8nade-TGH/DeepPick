/**
 * Inventory Store - Zustand store for managing user's item inventory
 * 
 * Features:
 * - Persists to localStorage (will migrate to Supabase later)
 * - Tracks owned items with rolled stats
 * - Tracks equipped items per team
 * - Chest/reward system integration
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QualityTier } from '../game/items/ItemRollSystem';

/**
 * An item instance stored in inventory
 */
export interface InventoryItemInstance {
  instanceId: string;           // Unique ID for this specific item
  itemId: string;               // Base item ID (e.g., "LAL_def_ironman_armor")
  name: string;                 // Display name
  icon: string;                 // Emoji icon
  slot: 'defense' | 'power' | 'weapon' | 'castle';
  qualityTier: QualityTier;
  qualityScore: number;         // 0-100
  rolledStats: Record<string, number>;
  acquiredAt: number;           // Timestamp
  source: 'chest' | 'battle_win' | 'quest' | 'starter';
}

/**
 * Team equipment slots - what items are equipped for a specific team
 */
export interface TeamEquipment {
  teamId: string;               // Team abbreviation (e.g., "BOS", "LAL")
  castle: InventoryItemInstance | null;
  slot1: InventoryItemInstance | null;
  slot2: InventoryItemInstance | null;
  slot3: InventoryItemInstance | null;
}

/**
 * Inventory state
 */
interface InventoryState {
  // All owned items
  items: InventoryItemInstance[];
  
  // Equipped items per team
  teamEquipment: Record<string, TeamEquipment>;
  
  // Inventory capacity
  capacity: number;
  
  // Currency (for future use)
  gold: number;
  
  // Actions
  addItem: (item: InventoryItemInstance) => void;
  removeItem: (instanceId: string) => void;
  equipItem: (teamId: string, slot: 'castle' | 'slot1' | 'slot2' | 'slot3', item: InventoryItemInstance) => void;
  unequipItem: (teamId: string, slot: 'castle' | 'slot1' | 'slot2' | 'slot3') => void;
  getTeamEquipment: (teamId: string) => TeamEquipment;
  addGold: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  clearInventory: () => void;
  
  // Utility
  getItemsBySlot: (slot: 'defense' | 'power' | 'weapon' | 'castle') => InventoryItemInstance[];
  isItemEquipped: (instanceId: string) => boolean;
}

/**
 * Generate unique instance ID
 */
function generateInstanceId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create default team equipment
 */
function createDefaultTeamEquipment(teamId: string): TeamEquipment {
  return {
    teamId,
    castle: null,
    slot1: null,
    slot2: null,
    slot3: null,
  };
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      items: [],
      teamEquipment: {},
      capacity: 50,
      gold: 1000, // Start with some gold

      addItem: (item) => {
        const state = get();
        if (state.items.length >= state.capacity) {
          console.warn('📦 Inventory full! Cannot add item.');
          return;
        }
        
        // Ensure unique instanceId
        const newItem = {
          ...item,
          instanceId: item.instanceId || generateInstanceId(),
        };
        
        set((state) => ({
          items: [...state.items, newItem],
        }));
        console.log(`📦 Added to inventory: ${newItem.name} (${newItem.qualityTier})`);
      },

      removeItem: (instanceId) => {
        set((state) => ({
          items: state.items.filter((item) => item.instanceId !== instanceId),
        }));
      },

      equipItem: (teamId, slot, item) => {
        set((state) => {
          const currentEquipment = state.teamEquipment[teamId] || createDefaultTeamEquipment(teamId);
          return {
            teamEquipment: {
              ...state.teamEquipment,
              [teamId]: {
                ...currentEquipment,
                [slot]: item,
              },
            },
          };
        });
        console.log(`⚔️ Equipped ${item.name} to ${teamId} ${slot}`);
      },

      unequipItem: (teamId, slot) => {
        set((state) => {
          const currentEquipment = state.teamEquipment[teamId];
          if (!currentEquipment) return state;
          
          return {
            teamEquipment: {
              ...state.teamEquipment,
              [teamId]: {
                ...currentEquipment,
                [slot]: null,
              },
            },
          };
        });
      },

      getTeamEquipment: (teamId) => {
        const state = get();
        return state.teamEquipment[teamId] || createDefaultTeamEquipment(teamId);
      },

      addGold: (amount) => {
        set((state) => ({
          gold: state.gold + amount,
        }));
      },

      spendGold: (amount) => {
        const state = get();
        if (state.gold < amount) return false;
        set({ gold: state.gold - amount });
        return true;
      },

      clearInventory: () => {
        set({
          items: [],
          teamEquipment: {},
          gold: 1000,
        });
      },

      getItemsBySlot: (slot) => {
        const state = get();
        return state.items.filter((item) => item.slot === slot);
      },

      isItemEquipped: (instanceId) => {
        const state = get();
        for (const equipment of Object.values(state.teamEquipment)) {
          if (
            equipment.castle?.instanceId === instanceId ||
            equipment.slot1?.instanceId === instanceId ||
            equipment.slot2?.instanceId === instanceId ||
            equipment.slot3?.instanceId === instanceId
          ) {
            return true;
          }
        }
        return false;
      },
    }),
    {
      name: 'battle-bets-inventory',
      version: 1,
    }
  )
);

