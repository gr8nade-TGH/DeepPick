/**
 * sharedKnightState.ts
 * 
 * Shared state for knight and castle interactions.
 * This file breaks the circular dependency between CASTLE_Fortress and MED_KnightDefender.
 */

/**
 * Store pending shield charges (applied when knight spawns)
 * Key format: "battleId-side" (e.g., "battle-123-left")
 */
export const pendingShieldCharges: Map<string, number> = new Map();

/**
 * Set pending shield charges for a side (called by Castle item)
 */
export function setPendingShieldCharges(battleId: string, side: 'left' | 'right', charges: number): void {
  const key = `${battleId}-${side}`;
  pendingShieldCharges.set(key, charges);
  console.log(`🛡️ [SharedState] Set ${charges} pending shield charges for ${side}`);
}

/**
 * Get and clear pending shield charges for a side (called by KnightDefender when spawning)
 */
export function getPendingShieldCharges(battleId: string, side: 'left' | 'right'): number {
  const key = `${battleId}-${side}`;
  const charges = pendingShieldCharges.get(key) || 0;
  if (charges > 0) {
    pendingShieldCharges.delete(key); // Clear after retrieval
  }
  return charges;
}

/**
 * Clear all pending charges (e.g., on game reset)
 */
export function clearPendingShieldCharges(battleId: string): void {
  pendingShieldCharges.delete(`${battleId}-left`);
  pendingShieldCharges.delete(`${battleId}-right`);
}

