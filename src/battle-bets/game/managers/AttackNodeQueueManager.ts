/**
 * AttackNodeQueueManager.ts
 * 
 * Manages projectile queues for attack nodes (weapon slots).
 * Each attack node can only fire 1 projectile every 0.5 seconds.
 * 
 * This prevents projectile overlap and ensures proper spacing.
 */

import type { StatType } from '../../../types/game';

interface QueuedProjectile {
  gameId: string;
  side: 'left' | 'right';
  lane: StatType;
  source: 'BASE' | 'ITEM';
  itemId?: string;
  fireFn: () => Promise<void>;
}

interface AttackNodeState {
  queue: QueuedProjectile[];
  isProcessing: boolean;
  lastFireTime: number;
}

class AttackNodeQueueManagerClass {
  private nodes: Map<string, AttackNodeState> = new Map();
  private readonly FIRE_INTERVAL = 500; // 0.5 seconds between projectiles

  /**
   * Get node key for tracking
   */
  private getNodeKey(gameId: string, side: 'left' | 'right', lane: StatType): string {
    return `${gameId}-${side}-${lane}`;
  }

  /**
   * Get or create node state
   */
  private getNodeState(gameId: string, side: 'left' | 'right', lane: StatType): AttackNodeState {
    const key = this.getNodeKey(gameId, side, lane);

    if (!this.nodes.has(key)) {
      this.nodes.set(key, {
        queue: [],
        isProcessing: false,
        lastFireTime: 0,
      });
    }

    return this.nodes.get(key)!;
  }

  /**
   * Add a projectile to the attack node's queue
   */
  public enqueueProjectile(
    gameId: string,
    side: 'left' | 'right',
    lane: StatType,
    fireFn: () => Promise<void>,
    source: 'BASE' | 'ITEM' = 'ITEM',
    itemId?: string
  ): void {
    const nodeState = this.getNodeState(gameId, side, lane);

    const queuedProjectile: QueuedProjectile = {
      gameId,
      side,
      lane,
      source,
      itemId,
      fireFn,
    };

    nodeState.queue.push(queuedProjectile);

    console.log(`🎯 [AttackNodeQueue] Enqueued projectile for ${side} ${lane.toUpperCase()} (Queue: ${nodeState.queue.length}, Source: ${source})`);

    // Start processing if not already running
    if (!nodeState.isProcessing) {
      this.processQueue(gameId, side, lane);
    }
  }

  /**
   * Process the queue for an attack node
   */
  private async processQueue(gameId: string, side: 'left' | 'right', lane: StatType): Promise<void> {
    const nodeState = this.getNodeState(gameId, side, lane);

    if (nodeState.isProcessing) {
      return; // Already processing
    }

    nodeState.isProcessing = true;

    while (nodeState.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastFire = now - nodeState.lastFireTime;

      // Wait if we need to respect the fire interval
      if (timeSinceLastFire < this.FIRE_INTERVAL && nodeState.lastFireTime > 0) {
        const waitTime = this.FIRE_INTERVAL - timeSinceLastFire;
        console.log(`⏳ [AttackNodeQueue] Waiting ${waitTime}ms before next projectile from ${side} ${lane.toUpperCase()}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Fire the next projectile
      const projectile = nodeState.queue.shift();
      if (projectile) {
        console.log(`🚀 [AttackNodeQueue] Firing projectile from ${side} ${lane.toUpperCase()} (${nodeState.queue.length} remaining in queue)`);

        // Fire projectile WITHOUT awaiting (fire and forget)
        // This allows the next projectile to fire 0.5s later without waiting for collision
        projectile.fireFn().catch(error => {
          console.error(`❌ [AttackNodeQueue] Error firing projectile:`, error);
        });

        nodeState.lastFireTime = Date.now();
      }
    }

    nodeState.isProcessing = false;
    console.log(`✅ [AttackNodeQueue] Queue empty for ${side} ${lane.toUpperCase()}`);
  }

  /**
   * Clear all queues for a game (when battle ends)
   */
  public clearGame(gameId: string): void {
    const keysToDelete: string[] = [];

    this.nodes.forEach((state, key) => {
      if (key.startsWith(gameId)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.nodes.delete(key));

    console.log(`🗑️ [AttackNodeQueue] Cleared ${keysToDelete.length} attack node queues for game ${gameId}`);
  }

  /**
   * Get queue length for debugging
   */
  public getQueueLength(gameId: string, side: 'left' | 'right', lane: StatType): number {
    const nodeState = this.getNodeState(gameId, side, lane);
    return nodeState.queue.length;
  }
}

// Global singleton instance
export const attackNodeQueueManager = new AttackNodeQueueManagerClass();

