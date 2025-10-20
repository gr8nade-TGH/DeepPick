import { describe, it, expect } from '@jest/globals'
import * as math from '../math'

describe('SHIVA v1 Math Engine', () => {
  describe('paceHarmonic', () => {
    it('calculates harmonic mean for normal paces', () => {
      expect(math.paceHarmonic(100, 100)).toBeCloseTo(100, 1)
      expect(math.paceHarmonic(100, 95)).toBeCloseTo(97.4, 1)
      expect(math.paceHarmonic(105, 95)).toBeCloseTo(99.8, 1)
    })

    it('returns 0 for zero pace', () => {
      expect(math.paceHarmonic(0, 100)).toBe(0)
      expect(math.paceHarmonic(100, 0)).toBe(0)
      expect(math.paceHarmonic(0, 0)).toBe(0)
    })

    it('handles negative paces', () => {
      expect(math.paceHarmonic(-100, 100)).toBe(0)
      expect(math.paceHarmonic(100, -100)).toBe(0)
    })
  })

  describe('delta100', () => {
    const weights = {
      f1: 0.21,
      f2: 0.175,
      f3: 0.14,
      f4: 0.07,
      f5: 0.07,
      f6: 0.035,
      f7: 0.021,
    }

    it('calculates weighted sum for normal factors', () => {
      const result = math.delta100(3.7, 4.8, 0.7, 5.56, -1.0, 1.5, 0.0, weights)
      expect(result).toBeCloseTo(2.21, 2)
    })

    it('returns 0 when all factors are zero', () => {
      const result = math.delta100(0, 0, 0, 0, 0, 0, 0, weights)
      expect(result).toBe(0)
    })

    it('handles negative factors', () => {
      const result = math.delta100(-3, -2, -1, -0.5, -0.5, -1, -0.5, weights)
      expect(result).toBeLessThan(0)
    })

    it('caps do not affect delta100 calculation', () => {
      // delta100 doesn't apply caps - that's done at factor level
      const result = math.delta100(10, 10, 10, 10, 10, 10, 10, weights)
      expect(result).toBeCloseTo(6.706, 2)
    })
  })

  describe('spreadFromDelta', () => {
    it('converts delta to spread for normal values', () => {
      expect(math.spreadFromDelta(2.21, 99.07)).toBeCloseTo(2.19, 1)
      expect(math.spreadFromDelta(0, 100)).toBe(0)
    })

    it('returns 0 for zero pace', () => {
      expect(math.spreadFromDelta(2.21, 0)).toBe(0)
    })

    it('handles negative delta', () => {
      expect(math.spreadFromDelta(-2.21, 99.07)).toBeCloseTo(-2.19, 1)
    })
  })

  describe('totalFromORtgs', () => {
    it('calculates total from offensive ratings', () => {
      expect(math.totalFromORtgs(116.2, 114.6, 99.07)).toBeCloseTo(228.6, 1)
      expect(math.totalFromORtgs(114, 114, 100)).toBeCloseTo(228, 1)
    })

    it('returns 0 for zero pace', () => {
      expect(math.totalFromORtgs(116.2, 114.6, 0)).toBe(0)
    })

    it('handles negative ORtgs', () => {
      expect(math.totalFromORtgs(-100, 100, 100)).toBe(0)
    })
  })

  describe('scoresFromSpreadTotal', () => {
    it('calculates scores for normal spread/total', () => {
      const result = math.scoresFromSpreadTotal(2.19, 230.1)
      expect(result.home_pts).toBe(116)
      expect(result.away_pts).toBe(114)
    })

    it('handles zero spread', () => {
      const result = math.scoresFromSpreadTotal(0, 200)
      expect(result.home_pts).toBe(100)
      expect(result.away_pts).toBe(100)
    })

    it('handles negative spread (away favored)', () => {
      const result = math.scoresFromSpreadTotal(-5, 200)
      expect(result.home_pts).toBe(98)
      expect(result.away_pts).toBe(103)
    })
  })

  describe('conf7', () => {
    it('calculates confidence for normal spreads', () => {
      expect(math.conf7(2.19)).toBeCloseTo(2.46, 2)
      expect(math.conf7(0)).toBeCloseTo(1.0, 2)
      expect(math.conf7(6)).toBeCloseTo(5.0, 2)
    })

    it('caps at max when spread exceeds 6', () => {
      expect(math.conf7(10)).toBeCloseTo(5.0, 2)
      expect(math.conf7(100)).toBeCloseTo(5.0, 2)
    })

    it('handles negative spreads (uses absolute value)', () => {
      expect(math.conf7(-2.19)).toBeCloseTo(2.46, 2)
      expect(math.conf7(-6)).toBeCloseTo(5.0, 2)
    })
  })

  describe('marketAdj', () => {
    it('calculates adjustment for normal edges', () => {
      expect(math.marketAdj(-1.31, 2.6)).toBeCloseTo(0.26, 2)
      expect(math.marketAdj(3, 1)).toBeCloseTo(0.6, 2)
    })

    it('returns 0 for zero edges', () => {
      expect(math.marketAdj(0, 0)).toBe(0)
    })

    it('caps adjustment at ±1.2', () => {
      expect(math.marketAdj(10, 0)).toBeCloseTo(1.2, 2)
      expect(math.marketAdj(-10, 0)).toBeCloseTo(-1.2, 2)
      expect(math.marketAdj(0, 20)).toBeCloseTo(1.2, 2)
    })

    it('uses dominant edge', () => {
      // Total edge dominates
      const adj1 = math.marketAdj(1, 6)
      expect(Math.abs(adj1)).toBeGreaterThan(0.5)

      // Side edge dominates
      const adj2 = math.marketAdj(4, 2)
      expect(Math.abs(adj2)).toBeGreaterThan(0.6)
    })
  })

  describe('confFinal', () => {
    it('adds conf7 and market adjustment', () => {
      expect(math.confFinal(2.46, 0.26)).toBeCloseTo(2.72, 2)
      expect(math.confFinal(3.0, 0.5)).toBeCloseTo(3.5, 2)
    })

    it('handles negative market adjustment', () => {
      expect(math.confFinal(3.0, -0.5)).toBeCloseTo(2.5, 2)
    })

    it('can result in values below conf7', () => {
      expect(math.confFinal(2.0, -1.0)).toBeCloseTo(1.0, 2)
    })
  })

  describe('unitsFromConfidence', () => {
    it('returns 0 units below pass threshold', () => {
      expect(math.unitsFromConfidence(2.4)).toBe(0)
      expect(math.unitsFromConfidence(1.0)).toBe(0)
    })

    it('returns 1 unit for 2.5-3.0 range', () => {
      expect(math.unitsFromConfidence(2.5)).toBe(1)
      expect(math.unitsFromConfidence(2.8)).toBe(1)
      expect(math.unitsFromConfidence(2.99)).toBe(1)
    })

    it('returns 2 units for 3.01-4.0 range', () => {
      expect(math.unitsFromConfidence(3.0)).toBe(2)
      expect(math.unitsFromConfidence(3.5)).toBe(2)
      expect(math.unitsFromConfidence(3.99)).toBe(2)
    })

    it('returns 3 units above 4.0', () => {
      expect(math.unitsFromConfidence(4.0)).toBe(3)
      expect(math.unitsFromConfidence(5.0)).toBe(3)
      expect(math.unitsFromConfidence(10.0)).toBe(3)
    })
  })

  describe('applyCap', () => {
    it('does not cap values within range', () => {
      const result = math.applyCap(3.5, 6)
      expect(result.value).toBe(3.5)
      expect(result.capped).toBe(false)
      expect(result.reason).toBeNull()
    })

    it('caps positive values exceeding cap', () => {
      const result = math.applyCap(8.5, 6)
      expect(result.value).toBe(6)
      expect(result.capped).toBe(true)
      expect(result.reason).toContain('Capped at ±6')
    })

    it('caps negative values exceeding cap', () => {
      const result = math.applyCap(-8.5, 6)
      expect(result.value).toBe(-6)
      expect(result.capped).toBe(true)
      expect(result.reason).toContain('Capped at ±6')
    })

    it('handles zero', () => {
      const result = math.applyCap(0, 6)
      expect(result.value).toBe(0)
      expect(result.capped).toBe(false)
      expect(result.reason).toBeNull()
    })
  })

  describe('determinePickType', () => {
    it('returns PASS for low confidence', () => {
      expect(math.determinePickType(5, 3, 2.0, -3.5, 227.5)).toBe('PASS')
    })

    it('returns TOTAL when total edge dominates', () => {
      expect(math.determinePickType(2, 8, 3.0, -3.5, 227.5)).toBe('TOTAL')
    })

    it('returns SPREAD when side edge dominates', () => {
      expect(math.determinePickType(5, 2, 3.0, -3.5, 227.5)).toBe('SPREAD')
    })

    it('returns SPREAD for favorite with significant edge', () => {
      expect(math.determinePickType(4, 1, 3.5, -5.5, 220)).toBe('SPREAD')
    })
  })
})

