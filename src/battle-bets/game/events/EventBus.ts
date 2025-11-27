/**
 * Battle Event Bus
 * 
 * Generic event system for the item engine.
 * Items subscribe to events and react without directly mutating game state.
 * 
 * Based on ITEM_ENGINE_SPEC.md Section 3
 */

import type { BattleEvent, BattleEventPayload } from './types';

type EventHandler = (payload: any) => void;

/**
 * Event bus for battle events
 * Supports multiple battles running simultaneously
 */
export class BattleEventBus {
  private listeners: Map<BattleEvent, Set<EventHandler>> = new Map();
  private battleListeners: Map<string, Map<BattleEvent, Set<EventHandler>>> = new Map();

  /**
   * Subscribe to a global event (all battles)
   */
  on(event: BattleEvent, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * Subscribe to an event for a specific battle
   */
  onBattle(battleId: string, event: BattleEvent, handler: EventHandler): void {
    if (!this.battleListeners.has(battleId)) {
      this.battleListeners.set(battleId, new Map());
    }
    const battleEvents = this.battleListeners.get(battleId)!;
    if (!battleEvents.has(event)) {
      battleEvents.set(event, new Set());
    }
    battleEvents.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from a global event
   */
  off(event: BattleEvent, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Unsubscribe from a battle-specific event
   */
  offBattle(battleId: string, event: BattleEvent, handler: EventHandler): void {
    const battleEvents = this.battleListeners.get(battleId);
    if (battleEvents) {
      const handlers = battleEvents.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emit(event: BattleEvent, payload: BattleEventPayload): void {
    // Always log for debugging item effects
    const globalHandlers = this.listeners.get(event);
    const battleId = payload.battleId;
    const battleEvents = this.battleListeners.get(battleId);
    const globalCount = globalHandlers?.size || 0;
    const battleCount = battleEvents?.get(event)?.size || 0;

    console.log(`📡 [EventBus] EMIT ${event} → ${globalCount} global + ${battleCount} battle handlers (battleId: ${battleId})`);

    // Emit to global listeners
    if (globalHandlers) {
      globalHandlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[EventBus] Error in global handler for ${event}:`, error);
        }
      });
    }

    // Emit to battle-specific listeners
    if (battleEvents) {
      const battleHandlers = battleEvents.get(event);
      if (battleHandlers) {
        battleHandlers.forEach(handler => {
          try {
            handler(payload);
          } catch (error) {
            console.error(`[EventBus] Error in battle handler for ${event} (battle ${battleId}):`, error);
          }
        });
      }
    }
  }

  /**
   * Remove all listeners for a specific battle
   * Call this when a battle ends to prevent memory leaks
   */
  clearBattle(battleId: string): void {
    this.battleListeners.delete(battleId);
    console.log(`[EventBus] Cleared all listeners for battle ${battleId}`);
  }

  /**
   * Remove all listeners (global and battle-specific)
   */
  clearAll(): void {
    this.listeners.clear();
    this.battleListeners.clear();
    console.log('[EventBus] Cleared all listeners');
  }

  /**
   * Get listener count for debugging
   */
  getListenerCount(event?: BattleEvent): number {
    if (event) {
      const globalCount = this.listeners.get(event)?.size || 0;
      let battleCount = 0;
      this.battleListeners.forEach(battleEvents => {
        battleCount += battleEvents.get(event)?.size || 0;
      });
      return globalCount + battleCount;
    } else {
      let total = 0;
      this.listeners.forEach(handlers => total += handlers.size);
      this.battleListeners.forEach(battleEvents => {
        battleEvents.forEach(handlers => total += handlers.size);
      });
      return total;
    }
  }
}

/**
 * Global event bus instance
 * Can be imported and used across the application
 */
export const battleEventBus = new BattleEventBus();

