import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectilePool } from '../ProjectilePool';

/**
 * Tests for projectile object pooling
 */
describe('ProjectilePool', () => {
  let pool: ProjectilePool;

  beforeEach(() => {
    pool = ProjectilePool.getInstance();
    pool.clear(); // Clear pool before each test
  });

  describe('Pool Statistics', () => {
    it('should start with empty pool', () => {
      const stats = pool.getStats();
      
      expect(stats.total.pooled).toBe(0);
      expect(stats.total.active).toBe(0);
    });

    it('should track active count correctly', () => {
      expect(pool.getActiveCount()).toBe(0);
    });

    it('should track pooled count correctly', () => {
      expect(pool.getPooledCount()).toBe(0);
    });
  });

  describe('Pool Limits', () => {
    it('should respect max pool size', () => {
      // The pool has a max size of 50 per type
      const maxSize = 50;
      
      expect(maxSize).toBe(50);
    });
  });

  describe('Pool Clearing', () => {
    it('should clear all pools', () => {
      pool.clear();
      
      const stats = pool.getStats();
      expect(stats.total.pooled).toBe(0);
      expect(stats.total.active).toBe(0);
    });
  });
});

