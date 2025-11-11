/**
 * Projectile Type System - Grid-Based Speed & Collision System
 *
 * DESIGN PHILOSOPHY:
 * ==================
 * This system uses a grid-based approach for consistent, predictable, and scalable projectile behavior.
 *
 * GRID-BASED SPEED:
 * - Speed is measured in "grid cells per second" instead of arbitrary pixel values
 * - Grid cell width = 30px (from DEFAULT_GRID_CONFIG)
 * - Example: baseSpeed = 20 means the projectile travels 20 cells/sec = 600 pixels/sec
 * - This makes speed values intuitive and consistent across different layouts
 *
 * SPEED MODIFIERS:
 * - Each projectile has a `speedMultiplier` property (default 1.0)
 * - Items/buffs can modify this: 1.5 = 50% faster, 0.5 = 50% slower
 * - Effective speed = baseSpeed * speedMultiplier
 * - Duration is calculated as: (distance in pixels / cellWidth) / effectiveSpeed
 *
 * COLLISION SYSTEM:
 * - Each projectile type has a `collisionRadius` (in pixels)
 * - Projectile-to-projectile collision uses sum of both radii
 * - Defense dot collision uses projectile radius + 4px (dot radius)
 * - Some projectiles can pass through enemy projectiles (canCollideWithProjectiles = false)
 *
 * FUTURE-PROOFING:
 * - Different projectile types can have different speeds, sizes, and behaviors
 * - Items can modify speed, damage, collision radius, etc.
 * - New projectile behaviors (homing, arc, explosive) can be added easily
 * - Grid-based system scales automatically if grid size changes
 *
 * STAT-SPECIFIC BEHAVIORS:
 * - PTS: Fast, standard bullets (20 cells/sec)
 * - REB: Heavy, slower bullets (15 cells/sec, larger collision radius)
 * - AST: Precision, fastest bullets (25 cells/sec, smaller collision radius)
 * - BLK: Medium speed with future explosion potential (18 cells/sec)
 * - 3PT: Medium speed, passes through enemy projectiles (20 cells/sec, canCollideWithProjectiles = false)
 */

import type { StatType } from './game';

/**
 * Projectile behavior types
 */
export type ProjectileBehavior = 'straight' | 'homing' | 'arc' | 'piercing' | 'explosive';

/**
 * Projectile shape types
 */
export type ProjectileShape = 'bullet' | 'orb' | 'missile' | 'fireball' | 'spear';

/**
 * Projectile type configuration
 */
export interface ProjectileTypeConfig {
  id: string;
  name: string;
  stat: StatType;

  // Visual properties
  shape: ProjectileShape;
  size: { width: number; height: number };
  color: number;
  glowColor: number;
  trailColor: number;

  // Gameplay properties - GRID-BASED SYSTEM
  baseSpeed: number; // Base speed in grid cells per second (e.g., 15 = crosses 15 cells/sec)
  damage: number;
  behavior: ProjectileBehavior;

  // Collision properties
  collisionRadius: number; // Collision detection radius in pixels

  // Special abilities
  rapidFire?: boolean; // Can fire multiple projectiles
  rapidFireCount?: number; // Number of projectiles in rapid fire
  bounces?: number; // Number of bounces
  areaOfEffect?: number; // Explosion radius in pixels
  piercing?: boolean; // Penetrates targets
  homingStrength?: number; // How strongly it homes (0-1)
  canCollideWithProjectiles?: boolean; // Can this projectile collide with enemy projectiles?
}

/**
 * Projectile type definitions for each stat
 */
export const PROJECTILE_TYPES: Record<StatType, ProjectileTypeConfig> = {
  // PTS - Rapid Fire Bullets
  pts: {
    id: 'rapid-bullets',
    name: 'Rapid Fire Bullets',
    stat: 'pts',

    // Visual
    shape: 'bullet',
    size: { width: 12, height: 5 },
    color: 0xFF6B35, // Orange
    glowColor: 0xFF8C5A,
    trailColor: 0xFFAA77,

    // Gameplay - Grid-based speed (UNIFIED SPEED)
    baseSpeed: 3, // 3 grid cells per second (UNIFIED - all projectiles same speed, MUCH SLOWER)
    damage: 1,
    behavior: 'straight',

    // Collision
    collisionRadius: 8, // 8px collision radius

    // Special
    rapidFire: false,
    rapidFireCount: 1,
    canCollideWithProjectiles: true, // Can collide with enemy projectiles
  },

  // REB - Rebounds (Heavy projectiles)
  reb: {
    id: 'heavy-bullets',
    name: 'Heavy Bullets',
    stat: 'reb',

    // Visual (cyan color, slightly larger)
    shape: 'bullet',
    size: { width: 14, height: 6 },
    color: 0x4ECDC4, // Cyan
    glowColor: 0x6EDDD5,
    trailColor: 0x8EEDE5,

    // Gameplay - Slower but heavier (UNIFIED SPEED)
    baseSpeed: 3, // 3 cells/sec (UNIFIED - all projectiles same speed, MUCH SLOWER)
    damage: 1,
    behavior: 'straight',

    // Collision
    collisionRadius: 10, // Larger collision radius

    // Special
    rapidFire: false,
    rapidFireCount: 1,
    canCollideWithProjectiles: true,
  },

  // AST - Assists (Fast, precise)
  ast: {
    id: 'precision-bullets',
    name: 'Precision Bullets',
    stat: 'ast',

    // Visual (yellow color, smaller)
    shape: 'bullet',
    size: { width: 10, height: 4 },
    color: 0xF7B731, // Yellow
    glowColor: 0xF9C74F,
    trailColor: 0xFBD76D,

    // Gameplay - Fastest (UNIFIED SPEED)
    baseSpeed: 3, // 3 cells/sec (UNIFIED - all projectiles same speed, MUCH SLOWER)
    damage: 1,
    behavior: 'straight',

    // Collision
    collisionRadius: 6, // Smaller collision radius

    // Special
    rapidFire: false,
    rapidFireCount: 1,
    canCollideWithProjectiles: true,
  },

  // BLK - Explosive projectiles
  blk: {
    id: 'blk-bullets',
    name: 'Block Bullets',
    stat: 'blk',

    // Visual (red color, glowing)
    shape: 'bullet',
    size: { width: 12, height: 5 },
    color: 0xFF3838, // Red
    glowColor: 0xFF5858,
    trailColor: 0xFF7878,

    // Gameplay - Medium speed (UNIFIED SPEED)
    baseSpeed: 3, // 3 cells/sec (UNIFIED - all projectiles same speed, MUCH SLOWER)
    damage: 1,
    behavior: 'straight',

    // Collision
    collisionRadius: 8,

    // Special
    rapidFire: false,
    rapidFireCount: 1,
    canCollideWithProjectiles: true,
    areaOfEffect: 20, // Small explosion radius (future feature)
  },

  // 3PT - Defensive projectiles (don't collide with enemy projectiles)
  '3pt': {
    id: '3pt-bullets',
    name: '3-Point Bullets',
    stat: '3pt',

    // Visual (blue color, shimmering)
    shape: 'bullet',
    size: { width: 12, height: 5 },
    color: 0x00D2FF, // Blue
    glowColor: 0x33E0FF,
    trailColor: 0x66EEFF,

    // Gameplay - Medium speed (UNIFIED SPEED)
    baseSpeed: 3, // 3 cells/sec (UNIFIED - all projectiles same speed, MUCH SLOWER)
    damage: 1,
    behavior: 'straight',

    // Collision
    collisionRadius: 8,

    // Special - 3PT projectiles PASS THROUGH enemy projectiles
    rapidFire: false,
    rapidFireCount: 1,
    canCollideWithProjectiles: false, // Unique: doesn't collide with enemy projectiles!
  },
};

/**
 * Get projectile type config for a stat
 */
export function getProjectileType(stat: StatType): ProjectileTypeConfig {
  return PROJECTILE_TYPES[stat];
}

/**
 * Particle configuration for projectile trails
 */
export interface ParticleConfig {
  color: number;
  alpha: number;
  scale: number;
  lifetime: number; // seconds
  speed: number;
  count: number; // particles per emission
}

/**
 * Get particle config for a projectile type
 */
export function getParticleConfig(stat: StatType): ParticleConfig {
  const type = PROJECTILE_TYPES[stat];
  
  return {
    color: type.trailColor,
    alpha: 0.6,
    scale: 0.5,
    lifetime: 0.5,
    speed: 50,
    count: 3,
  };
}

