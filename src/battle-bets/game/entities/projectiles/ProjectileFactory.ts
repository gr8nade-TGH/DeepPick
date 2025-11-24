/**
 * Projectile Factory - Creates the correct projectile type based on stat
 */

import type { Position, StatType } from '../../../types/game';
import { getProjectileType } from '../../../types/projectileTypes';
import { BaseProjectile, type BaseProjectileConfig } from './BaseProjectile';

export interface ProjectileFactoryConfig {
  id: string;
  gameId: string;
  stat: StatType;
  side: 'left' | 'right';
  startPosition: Position;
  targetPosition: Position;
}

/**
 * Factory class for creating projectiles
 */
export class ProjectileFactory {
  /**
   * Create a projectile of the appropriate type for the given stat
   */
  static create(config: ProjectileFactoryConfig): BaseProjectile {
    const typeConfig = getProjectileType(config.stat);

    const baseConfig: BaseProjectileConfig = {
      ...config,
      typeConfig,
    };

    // All projectiles use BaseProjectile (simple straight-line movement)
    return new BaseProjectile(baseConfig);
  }

  /**
   * Create multiple projectiles for rapid fire
   */
  static createRapidFire(config: ProjectileFactoryConfig): BaseProjectile[] {
    const typeConfig = getProjectileType(config.stat);

    // Check if this projectile type supports rapid fire
    if (!typeConfig.rapidFire || !typeConfig.rapidFireCount) {
      return [ProjectileFactory.create(config)];
    }

    // Create multiple projectiles with slight offsets
    const projectiles: BaseProjectile[] = [];
    const count = typeConfig.rapidFireCount;
    const offsetY = 3; // Vertical offset between bullets

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * offsetY;

      const projectileConfig: ProjectileFactoryConfig = {
        ...config,
        id: `${config.id}-${i}`,
        startPosition: {
          x: config.startPosition.x,
          y: config.startPosition.y + offset,
        },
        targetPosition: {
          x: config.targetPosition.x,
          y: config.targetPosition.y + offset,
        },
      };

      projectiles.push(ProjectileFactory.create(projectileConfig));
    }

    return projectiles;
  }
}

