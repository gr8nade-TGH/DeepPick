import { BaseProjectile } from './BaseProjectile';
import type { BaseProjectileConfig } from './BaseProjectile';
import { ProjectileFactory } from './ProjectileFactory';

/**
 * Object pool for projectiles to reduce GC pressure and improve performance
 * Reuses projectile instances instead of creating/destroying them
 */
export class ProjectilePool {
  private static instance: ProjectilePool;
  private pools: Map<string, BaseProjectile[]> = new Map();
  private active: Set<BaseProjectile> = new Set();
  private readonly POOL_SIZE = 50; // Max pooled objects per type

  private constructor() {}

  static getInstance(): ProjectilePool {
    if (!ProjectilePool.instance) {
      ProjectilePool.instance = new ProjectilePool();
    }
    return ProjectilePool.instance;
  }

  /**
   * Acquire a projectile from the pool or create a new one
   */
  acquire(config: BaseProjectileConfig): BaseProjectile {
    const type = config.typeConfig.name;
    let pool = this.pools.get(type);

    if (!pool) {
      pool = [];
      this.pools.set(type, pool);
    }

    let projectile: BaseProjectile;

    if (pool.length > 0) {
      // Reuse from pool
      projectile = pool.pop()!;
      projectile.reset(config);
      console.log(`♻️ Reused ${type} projectile from pool (${pool.length} remaining)`);
    } else {
      // Create new
      projectile = ProjectileFactory.create(config);
      console.log(`🆕 Created new ${type} projectile (pool empty)`);
    }

    this.active.add(projectile);
    return projectile;
  }

  /**
   * Release a projectile back to the pool
   */
  release(projectile: BaseProjectile): void {
    if (!this.active.has(projectile)) {
      console.warn('⚠️ Attempted to release projectile not in active set');
      return;
    }

    this.active.delete(projectile);

    const type = projectile.typeConfig.name;
    let pool = this.pools.get(type);

    if (!pool) {
      pool = [];
      this.pools.set(type, pool);
    }

    if (pool.length < this.POOL_SIZE) {
      // Return to pool
      projectile.cleanup();
      pool.push(projectile);
      console.log(`♻️ Returned ${type} to pool (${pool.length}/${this.POOL_SIZE})`);
    } else {
      // Pool full, destroy
      projectile.dispose();
      console.log(`🗑️ Pool full, destroyed ${type}`);
    }
  }

  /**
   * Get pool statistics for debugging
   */
  getStats(): {
    total: { pooled: number; active: number };
    byType: Record<string, { pooled: number; active: number }>;
  } {
    const byType: Record<string, { pooled: number; active: number }> = {};
    let totalPooled = 0;
    let totalActive = this.active.size;

    this.pools.forEach((pool, type) => {
      const activeCount = Array.from(this.active).filter(
        p => p.typeConfig.name === type
      ).length;

      byType[type] = {
        pooled: pool.length,
        active: activeCount,
      };

      totalPooled += pool.length;
    });

    return {
      total: { pooled: totalPooled, active: totalActive },
      byType,
    };
  }

  /**
   * Clear all pools (for cleanup/reset)
   */
  clear(): void {
    // Dispose all pooled projectiles
    this.pools.forEach(pool => {
      pool.forEach(projectile => projectile.dispose());
    });

    // Dispose all active projectiles
    this.active.forEach(projectile => projectile.dispose());

    this.pools.clear();
    this.active.clear();

    console.log('🧹 Projectile pool cleared');
  }

  /**
   * Get active projectile count
   */
  getActiveCount(): number {
    return this.active.size;
  }

  /**
   * Get pooled projectile count
   */
  getPooledCount(): number {
    let count = 0;
    this.pools.forEach(pool => {
      count += pool.length;
    });
    return count;
  }
}

export const projectilePool = ProjectilePool.getInstance();

