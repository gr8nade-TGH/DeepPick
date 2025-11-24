/**
 * Event Types for Battle Bets Item Engine
 * Based on ITEM_ENGINE_SPEC.md Section 3
 */

export type Lane = 'pts' | 'reb' | 'ast' | 'stl' | '3pt';
export type Side = 'left' | 'right';

/**
 * All battle events that can be emitted
 */
export type BattleEvent =
  | 'BATTLE_START'
  | 'QUARTER_START'
  | 'QUARTER_END'
  | 'PROJECTILE_FIRED'
  | 'PROJECTILE_COLLISION'
  | 'PROJECTILE_HIT_CASTLE'
  | 'DEFENSE_ORB_DESTROYED'
  | 'OPPONENT_ORB_DESTROYED'
  | 'CASTLE_SHIELD_HIT'
  | 'CASTLE_PRIMARY_HIT'
  | 'FINAL_BLOW_START'
  | 'TICK';

/**
 * Base payload for all events
 */
export interface BaseEventPayload {
  side: Side;              // which side this event is about
  opponentSide: Side;      // the enemy
  quarter: 1 | 2 | 3 | 4;  // current quarter
  battleId: string;        // unique battle identifier
  gameId: string;          // game identifier
}

/**
 * Projectile fired event
 */
export interface ProjectileFiredPayload extends BaseEventPayload {
  lane: Lane;              // which stat lane spawned this projectile
  projectileId: string;
  isExtraFromItem?: boolean;
  source?: 'BASE' | 'ITEM';
  itemId?: string;
}

/**
 * Projectile collision event (projectile hit another projectile)
 */
export interface ProjectileCollisionPayload extends BaseEventPayload {
  projectileId: string;
  otherProjectileId: string;
  lane: Lane;
}

/**
 * Projectile hit castle event
 */
export interface ProjectileHitCastlePayload extends BaseEventPayload {
  projectileId: string;
  damage: number;
  lane: Lane;
}

/**
 * Defense orb destroyed event (your own orb was destroyed)
 */
export interface DefenseOrbDestroyedPayload extends BaseEventPayload {
  lane: Lane;
  orbId: string;
  destroyedByProjectileId?: string;
}

/**
 * Opponent orb destroyed event (you destroyed an enemy orb)
 */
export interface OpponentOrbDestroyedPayload extends BaseEventPayload {
  lane: Lane;
  orbId: string;
  destroyedByProjectileId?: string;
}

/**
 * Castle shield hit event
 */
export interface CastleShieldHitPayload extends BaseEventPayload {
  damage: number;
  shieldId: string;
  absorbed: number;
  overflow: number;
}

/**
 * Castle primary HP hit event
 */
export interface CastlePrimaryHitPayload extends BaseEventPayload {
  damage: number;
  projectileId?: string;
}

/**
 * Quarter stats for scoreboard comparisons
 */
export interface QuarterStats {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  threesMade: number;
}

/**
 * Quarter start event
 */
export interface QuarterStartPayload extends BaseEventPayload {
  prevQuarterStats: QuarterStats | null;
}

/**
 * Quarter end event
 */
export interface QuarterEndPayload extends BaseEventPayload {
  score: { self: number; opponent: number };
  quarterStats: QuarterStats;
}

/**
 * Battle start event
 */
export interface BattleStartPayload extends BaseEventPayload {
  // Additional battle metadata can be added here
}

/**
 * Final blow start event
 */
export interface FinalBlowStartPayload extends BaseEventPayload {
  score: { self: number; opponent: number };
}

/**
 * Tick event (optional, for time-based effects)
 */
export interface TickPayload extends BaseEventPayload {
  deltaTime: number; // milliseconds since last tick
}

/**
 * Union type of all event payloads
 */
export type BattleEventPayload =
  | BattleStartPayload
  | QuarterStartPayload
  | QuarterEndPayload
  | ProjectileFiredPayload
  | ProjectileCollisionPayload
  | ProjectileHitCastlePayload
  | DefenseOrbDestroyedPayload
  | OpponentOrbDestroyedPayload
  | CastleShieldHitPayload
  | CastlePrimaryHitPayload
  | FinalBlowStartPayload
  | TickPayload;

