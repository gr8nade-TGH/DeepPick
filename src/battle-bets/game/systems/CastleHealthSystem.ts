/**
 * CastleHealthSystem - Unified HP and shield management
 * 
 * PURPOSE:
 * - Single source of truth for castle health
 * - Centralized shield activation/deactivation logic
 * - Damage history tracking for debugging/analytics
 * - Item effect integration (Blue Orb Shield, etc.)
 * 
 * BENEFITS:
 * - No confusion about HP state (was split between Castle.ts and multiGameStore)
 * - Easy to add new shield types or HP modifiers
 * - Better debugging with damage history
 * - Cleaner item effect integration
 */

import type { Castle } from '../entities/Castle';

/**
 * Shield state for a castle
 */
interface ShieldState {
  isActive: boolean;
  currentHP: number;
  maxHP: number;
  activationThreshold: number; // HP threshold that triggers shield (e.g., 3)
  source: string; // Item ID that provided the shield (e.g., 'blue-orb-shield')
}

/**
 * Damage event for tracking
 */
interface DamageEvent {
  timestamp: number;
  damage: number;
  shieldDamage: number;
  hpDamage: number;
  source?: string; // Projectile type or other source
}

/**
 * Result of applying damage
 */
interface DamageResult {
  totalDamage: number;
  shieldDamage: number;
  hpDamage: number;
  shieldBroken: boolean;
  castleDestroyed: boolean;
  finalHP: number;
  finalShieldHP: number;
}

/**
 * Health state for a castle
 */
interface CastleHealth {
  castleId: string;
  currentHP: number;
  maxHP: number;
  shield: ShieldState | null;
  damageHistory: DamageEvent[];
}

/**
 * Centralized castle health management system
 */
class CastleHealthSystem {
  private health: Map<string, CastleHealth> = new Map();

  /**
   * Initialize health tracking for a castle
   */
  initializeCastle(castleId: string, maxHP: number, currentHP?: number): void {
    if (this.health.has(castleId)) {
      console.warn(`[CastleHealthSystem] Castle ${castleId} already initialized`);
      return;
    }

    const health: CastleHealth = {
      castleId,
      currentHP: currentHP ?? maxHP,
      maxHP,
      shield: null,
      damageHistory: [],
    };

    this.health.set(castleId, health);
    console.log(`[CastleHealthSystem] Initialized castle ${castleId}: ${health.currentHP}/${maxHP} HP`);
  }

  /**
   * Get current HP for a castle
   */
  getCurrentHP(castleId: string): number {
    const health = this.health.get(castleId);
    return health?.currentHP ?? 0;
  }

  /**
   * Get max HP for a castle
   */
  getMaxHP(castleId: string): number {
    const health = this.health.get(castleId);
    return health?.maxHP ?? 0;
  }

  /**
   * Get shield state for a castle
   */
  getShield(castleId: string): ShieldState | null {
    const health = this.health.get(castleId);
    return health?.shield ?? null;
  }

  /**
   * Check if castle has active shield
   */
  hasActiveShield(castleId: string): boolean {
    const shield = this.getShield(castleId);
    return shield?.isActive ?? false;
  }

  /**
   * Activate shield for a castle
   */
  activateShield(
    castleId: string,
    shieldHP: number,
    activationThreshold: number,
    source: string
  ): void {
    const health = this.health.get(castleId);
    if (!health) {
      console.error(`[CastleHealthSystem] Castle ${castleId} not found`);
      return;
    }

    if (health.shield?.isActive) {
      console.warn(`[CastleHealthSystem] Castle ${castleId} already has active shield`);
      return;
    }

    health.shield = {
      isActive: true,
      currentHP: shieldHP,
      maxHP: shieldHP,
      activationThreshold,
      source,
    };

    console.log(`[CastleHealthSystem] Shield activated for ${castleId}: ${shieldHP} HP (source: ${source})`);
  }

  /**
   * Deactivate shield for a castle
   */
  deactivateShield(castleId: string): void {
    const health = this.health.get(castleId);
    if (!health || !health.shield) return;

    console.log(`[CastleHealthSystem] Shield deactivated for ${castleId}`);
    health.shield = null;
  }

  /**
   * Apply damage to a castle (handles shield logic automatically)
   */
  takeDamage(castleId: string, damage: number, source?: string): DamageResult {
    return this._applyDamage(castleId, damage, source);
  }

  /**
   * Internal damage application logic
   */
  private _applyDamage(castleId: string, damage: number, source?: string): DamageResult {
    const health = this.health.get(castleId);
    if (!health) {
      console.error(`[CastleHealthSystem] Castle ${castleId} not found`);
      return {
        totalDamage: 0,
        shieldDamage: 0,
        hpDamage: 0,
        shieldBroken: false,
        castleDestroyed: false,
        finalHP: 0,
        finalShieldHP: 0,
      };
    }

    let remainingDamage = damage;
    let shieldDamage = 0;
    let hpDamage = 0;
    let shieldBroken = false;

    // 1. Apply damage to shield first (if active)
    if (health.shield?.isActive) {
      const damageToShield = Math.min(remainingDamage, health.shield.currentHP);
      health.shield.currentHP -= damageToShield;
      shieldDamage = damageToShield;
      remainingDamage -= damageToShield;

      // Check if shield broke
      if (health.shield.currentHP <= 0) {
        shieldBroken = true;
        this.deactivateShield(castleId);
      }
    }

    // 2. Apply remaining damage to HP
    if (remainingDamage > 0) {
      hpDamage = Math.min(remainingDamage, health.currentHP);
      health.currentHP -= hpDamage;
    }

    // 3. Record damage event
    const event: DamageEvent = {
      timestamp: Date.now(),
      damage,
      shieldDamage,
      hpDamage,
      source,
    };
    health.damageHistory.push(event);

    const result: DamageResult = {
      totalDamage: damage,
      shieldDamage,
      hpDamage,
      shieldBroken,
      castleDestroyed: health.currentHP <= 0,
      finalHP: health.currentHP,
      finalShieldHP: health.shield?.currentHP ?? 0,
    };

    return result;
  }

  /**
   * Heal a castle
   */
  heal(castleId: string, amount: number): void {
    const health = this.health.get(castleId);
    if (!health) {
      console.error(`[CastleHealthSystem] Castle ${castleId} not found`);
      return;
    }

    const oldHP = health.currentHP;
    health.currentHP = Math.min(health.currentHP + amount, health.maxHP);
    const actualHeal = health.currentHP - oldHP;

    console.log(`[CastleHealthSystem] Healed ${castleId}: +${actualHeal} HP (${oldHP} → ${health.currentHP})`);
  }

  /**
   * Get damage history for a castle
   */
  getDamageHistory(castleId: string): DamageEvent[] {
    const health = this.health.get(castleId);
    return health?.damageHistory ?? [];
  }

  /**
   * Clear damage history for a castle
   */
  clearDamageHistory(castleId: string): void {
    const health = this.health.get(castleId);
    if (health) {
      health.damageHistory = [];
    }
  }

  /**
   * Remove castle from tracking
   */
  removeCastle(castleId: string): void {
    this.health.delete(castleId);
    console.log(`[CastleHealthSystem] Removed castle ${castleId}`);
  }

  /**
   * Get all tracked castles
   */
  getAllCastles(): string[] {
    return Array.from(this.health.keys());
  }

  /**
   * Reset all health tracking
   */
  reset(): void {
    this.health.clear();
    console.log(`[CastleHealthSystem] Reset all health tracking`);
  }
}

// Export singleton instance
export const castleHealthSystem = new CastleHealthSystem();

