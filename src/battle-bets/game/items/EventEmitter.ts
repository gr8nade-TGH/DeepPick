/**
 * EventEmitter.ts
 * 
 * Global event bus for Battle Bets item system.
 * Allows items to subscribe to game events and react accordingly.
 */

import type { 
  BattleEvent, 
  BattleEventType, 
  BattleEventPayload 
} from '../events/types';

type EventListener<T extends BattleEventType> = (
  payload: BattleEventPayload<T>
) => void | Promise<void>;

interface Subscription {
  id: string;
  eventType: BattleEventType;
  listener: EventListener<any>;
  gameId?: string; // Optional filter by gameId
}

class BattleEventEmitter {
  private subscriptions: Map<string, Subscription> = new Map();
  private nextId = 0;

  /**
   * Subscribe to a specific event type
   * @param eventType - The type of event to listen for
   * @param listener - Callback function when event fires
   * @param gameId - Optional: only fire for specific game
   * @returns Subscription ID (use to unsubscribe)
   */
  public on<T extends BattleEventType>(
    eventType: T,
    listener: EventListener<T>,
    gameId?: string
  ): string {
    const id = `sub_${this.nextId++}`;
    this.subscriptions.set(id, {
      id,
      eventType,
      listener,
      gameId,
    });
    
    console.log(`📡 [EventEmitter] Subscribed to ${eventType}${gameId ? ` (game: ${gameId})` : ''}`);
    return id;
  }

  /**
   * Unsubscribe from an event
   * @param subscriptionId - The ID returned from on()
   */
  public off(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      this.subscriptions.delete(subscriptionId);
      console.log(`📡 [EventEmitter] Unsubscribed from ${sub.eventType}`);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event - The event to emit
   */
  public async emit<T extends BattleEventType>(
    event: BattleEvent<T>
  ): Promise<void> {
    const { type, payload } = event;
    const gameId = (payload as any).gameId;

    console.log(`📡 [EventEmitter] Emitting ${type}${gameId ? ` (game: ${gameId})` : ''}`);

    // Find all matching subscriptions
    const matchingSubs = Array.from(this.subscriptions.values()).filter(
      (sub) => {
        // Must match event type
        if (sub.eventType !== type) return false;
        
        // If subscription has gameId filter, must match
        if (sub.gameId && sub.gameId !== gameId) return false;
        
        return true;
      }
    );

    console.log(`📡 [EventEmitter] Found ${matchingSubs.length} listeners for ${type}`);

    // Call all listeners (in parallel for performance)
    await Promise.all(
      matchingSubs.map(async (sub) => {
        try {
          await sub.listener(payload);
        } catch (error) {
          console.error(`❌ [EventEmitter] Error in listener for ${type}:`, error);
        }
      })
    );
  }

  /**
   * Remove all subscriptions (useful for cleanup)
   */
  public clear(): void {
    const count = this.subscriptions.size;
    this.subscriptions.clear();
    console.log(`📡 [EventEmitter] Cleared ${count} subscriptions`);
  }

  /**
   * Remove all subscriptions for a specific game (cleanup after battle ends)
   */
  public clearGame(gameId: string): void {
    const toRemove: string[] = [];
    
    this.subscriptions.forEach((sub, id) => {
      if (sub.gameId === gameId) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => this.subscriptions.delete(id));
    console.log(`📡 [EventEmitter] Cleared ${toRemove.length} subscriptions for game ${gameId}`);
  }

  /**
   * Get subscription count (for debugging)
   */
  public getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscriptions by event type (for debugging)
   */
  public getSubscriptionsByType(eventType: BattleEventType): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.eventType === eventType
    );
  }
}

// Global singleton instance
export const battleEventEmitter = new BattleEventEmitter();

// Export type for convenience
export type { EventListener, Subscription };

