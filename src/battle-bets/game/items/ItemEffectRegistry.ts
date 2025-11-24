/**
 * ItemEffectRegistry.ts
 * 
 * Manages item effect registration and counter tracking.
 * Each item instance can register effects and track counters.
 */

import { battleEventEmitter } from './EventEmitter';
import type { BattleEventType } from '../events/types';
import type { RolledItemStats } from './ItemRollSystem';

export interface ItemRuntimeContext {
  itemInstanceId: string;
  gameId: string;
  side: 'left' | 'right';
  rolls: Record<string, number>;
  qualityTier: string;
}

type ItemEffectRegistration = (context: ItemRuntimeContext) => void | Promise<void>;

interface RegisteredItem {
  instanceId: string;
  gameId: string;
  side: 'left' | 'right';
  itemId: string;
  rolls: Record<string, number>;
  qualityTier: string;
  counters: Map<string, number>;
  subscriptionIds: string[];
}

class ItemEffectRegistryClass {
  private items: Map<string, RegisteredItem> = new Map();
  private effectRegistrations: Map<string, ItemEffectRegistration> = new Map();

  /**
   * Register an item effect function
   * @param itemId - The item ID (e.g., 'LAL_def_ironman_armor')
   * @param effectFn - Function that registers event listeners
   */
  public registerEffect(itemId: string, effectFn: ItemEffectRegistration): void {
    this.effectRegistrations.set(itemId, effectFn);
    console.log(`🎯 [ItemEffectRegistry] Registered effect for ${itemId}`);
  }

  /**
   * Activate an item instance in a battle
   * @param gameId - The battle game ID
   * @param side - Which side the item is on
   * @param rolledItem - The rolled item stats
   * @returns Item instance ID
   */
  public async activateItem(
    gameId: string,
    side: 'left' | 'right',
    rolledItem: RolledItemStats
  ): Promise<string> {
    const instanceId = `${gameId}_${side}_${rolledItem.itemId}_${Date.now()}`;
    
    const item: RegisteredItem = {
      instanceId,
      gameId,
      side,
      itemId: rolledItem.itemId,
      rolls: rolledItem.rolls,
      qualityTier: rolledItem.qualityTier,
      counters: new Map(),
      subscriptionIds: [],
    };
    
    this.items.set(instanceId, item);
    
    // Get effect registration function
    const effectFn = this.effectRegistrations.get(rolledItem.itemId);
    
    if (!effectFn) {
      console.warn(`⚠️ [ItemEffectRegistry] No effect registered for ${rolledItem.itemId}`);
      return instanceId;
    }
    
    // Create runtime context
    const context: ItemRuntimeContext = {
      itemInstanceId: instanceId,
      gameId,
      side,
      rolls: rolledItem.rolls,
      qualityTier: rolledItem.qualityTier,
    };
    
    // Call effect registration function
    await effectFn(context);
    
    console.log(`✅ [ItemEffectRegistry] Activated ${rolledItem.itemId} (${instanceId})`);
    
    return instanceId;
  }

  /**
   * Deactivate an item instance (cleanup)
   */
  public deactivateItem(instanceId: string): void {
    const item = this.items.get(instanceId);
    
    if (!item) {
      console.warn(`⚠️ [ItemEffectRegistry] Item not found: ${instanceId}`);
      return;
    }
    
    // Unsubscribe from all events
    item.subscriptionIds.forEach((subId) => {
      battleEventEmitter.off(subId);
    });
    
    this.items.delete(instanceId);
    console.log(`🗑️ [ItemEffectRegistry] Deactivated ${item.itemId} (${instanceId})`);
  }

  /**
   * Deactivate all items for a game (cleanup after battle ends)
   */
  public deactivateGame(gameId: string): void {
    const toRemove: string[] = [];
    
    this.items.forEach((item, instanceId) => {
      if (item.gameId === gameId) {
        toRemove.push(instanceId);
      }
    });
    
    toRemove.forEach((instanceId) => this.deactivateItem(instanceId));
    console.log(`🗑️ [ItemEffectRegistry] Deactivated ${toRemove.length} items for game ${gameId}`);
  }

  /**
   * Get counter value for an item instance
   */
  public getCounter(instanceId: string, counterName: string): number {
    const item = this.items.get(instanceId);
    return item?.counters.get(counterName) ?? 0;
  }

  /**
   * Set counter value for an item instance
   */
  public setCounter(instanceId: string, counterName: string, value: number): void {
    const item = this.items.get(instanceId);
    if (item) {
      item.counters.set(counterName, value);
    }
  }

  /**
   * Increment counter for an item instance
   */
  public incrementCounter(instanceId: string, counterName: string, delta: number = 1): number {
    const current = this.getCounter(instanceId, counterName);
    const newValue = current + delta;
    this.setCounter(instanceId, counterName, newValue);
    return newValue;
  }

  /**
   * Reset counter for an item instance
   */
  public resetCounter(instanceId: string, counterName: string): void {
    this.setCounter(instanceId, counterName, 0);
  }

  /**
   * Get all active items for debugging
   */
  public getActiveItems(): RegisteredItem[] {
    return Array.from(this.items.values());
  }
}

// Global singleton instance
export const itemEffectRegistry = new ItemEffectRegistryClass();

// Export types
export type { ItemEffectRegistration, RegisteredItem };

