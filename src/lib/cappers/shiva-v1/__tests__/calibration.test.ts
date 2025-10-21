/**
 * Calibration Tests
 * Unit tests for model calibration logic
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { 
  createConfidenceBins, 
  findOptimalScaling, 
  calculateScalingError,
  calculateRSquared
} from '../calibration'

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          not: () => ({
            gte: () => ({
              order: () => ({
                limit: () => ({
                  data: mockPicks,
                  error: null
                })
              })
            })
          })
        }),
        single: () => ({
          data: mockCalibrationResult,
          error: null
        })
      }),
      insert: () => ({
        select: () => ({
          single: () => ({
            data: mockCalibrationResult,
            error: null
          })
        })
      })
    })
  })
}))

const mockPicks = [
  { conf_score: 1.5, edge_pct: 0.3, result: 'win' },
  { conf_score: 2.2, edge_pct: 0.45, result: 'win' },
  { conf_score: 2.8, edge_pct: 0.55, result: 'loss' },
  { conf_score: 3.5, edge_pct: 0.7, result: 'win' },
  { conf_score: 4.2, edge_pct: 0.8, result: 'win' },
  { conf_score: 1.8, edge_pct: 0.35, result: 'loss' },
  { conf_score: 2.5, edge_pct: 0.5, result: 'win' },
  { conf_score: 3.8, edge_pct: 0.75, result: 'win' },
  { conf_score: 4.5, edge_pct: 0.85, result: 'win' },
  { conf_score: 2.0, edge_pct: 0.4, result: 'loss' }
]

const mockCalibrationResult = {
  id: 'test-calibration-123',
  created_at: '2024-01-01T00:00:00Z',
  model_version: 'nba_totals_v1',
  scaling_constant: 2.5,
  sample_size: 10,
  hit_rate_by_bin: { bin_0: 0.5, bin_1: 0.6, bin_2: 0.8, bin_3: 0.9 },
  r_squared: 0.85,
  notes: 'Test calibration'
}

describe('Calibration Logic', () => {
  describe('createConfidenceBins', () => {
    it('should create bins correctly', () => {
      const bins = createConfidenceBins(mockPicks)
      
      expect(bins).toHaveLength(4)
      expect(bins[0].conf_range).toEqual([1.0, 2.0])
      expect(bins[1].conf_range).toEqual([2.0, 3.0])
      expect(bins[2].conf_range).toEqual([3.0, 4.0])
      expect(bins[3].conf_range).toEqual([4.0, 5.0])
    })

    it('should calculate hit rates correctly', () => {
      const bins = createConfidenceBins(mockPicks)
      
      // Bin 1.0-2.0: 2 picks, 1 win = 50%
      expect(bins[0].hit_rate).toBeCloseTo(0.5, 2)
      
      // Bin 2.0-3.0: 3 picks, 2 wins = 66.7%
      expect(bins[1].hit_rate).toBeCloseTo(0.667, 2)
      
      // Bin 3.0-4.0: 2 picks, 2 wins = 100%
      expect(bins[2].hit_rate).toBeCloseTo(1.0, 2)
      
      // Bin 4.0-5.0: 2 picks, 2 wins = 100%
      expect(bins[3].hit_rate).toBeCloseTo(1.0, 2)
    })

    it('should calculate expected rates correctly', () => {
      const bins = createConfidenceBins(mockPicks)
      
      // Expected rate should be average edge_pct for each bin
      expect(bins[0].expected_rate).toBeGreaterThan(0)
      expect(bins[1].expected_rate).toBeGreaterThan(0)
      expect(bins[2].expected_rate).toBeGreaterThan(0)
      expect(bins[3].expected_rate).toBeGreaterThan(0)
    })
  })

  describe('findOptimalScaling', () => {
    it('should find optimal scaling constant', () => {
      const bins = createConfidenceBins(mockPicks)
      const optimalScaling = findOptimalScaling(mockPicks, bins)
      
      expect(optimalScaling).toBeGreaterThan(0)
      expect(optimalScaling).toBeLessThan(10)
      expect(typeof optimalScaling).toBe('number')
    })

    it('should return a reasonable scaling value', () => {
      const bins = createConfidenceBins(mockPicks)
      const optimalScaling = findOptimalScaling(mockPicks, bins)
      
      // Should be in reasonable range for sigmoid scaling
      expect(optimalScaling).toBeGreaterThanOrEqual(1.0)
      expect(optimalScaling).toBeLessThanOrEqual(5.0)
    })
  })

  describe('calculateScalingError', () => {
    it('should calculate error for different scaling values', () => {
      const bins = createConfidenceBins(mockPicks)
      
      const error1 = calculateScalingError(mockPicks, bins, 1.0)
      const error2 = calculateScalingError(mockPicks, bins, 2.5)
      const error3 = calculateScalingError(mockPicks, bins, 5.0)
      
      expect(error1).toBeGreaterThanOrEqual(0)
      expect(error2).toBeGreaterThanOrEqual(0)
      expect(error3).toBeGreaterThanOrEqual(0)
    })

    it('should return finite error values', () => {
      const bins = createConfidenceBins(mockPicks)
      const error = calculateScalingError(mockPicks, bins, 2.5)
      
      expect(Number.isFinite(error)).toBe(true)
    })
  })

  describe('calculateRSquared', () => {
    it('should calculate R-squared correctly', () => {
      const bins = createConfidenceBins(mockPicks)
      const rSquared = calculateRSquared(mockPicks, bins, 2.5)
      
      expect(rSquared).toBeGreaterThanOrEqual(0)
      expect(rSquared).toBeLessThanOrEqual(1)
      expect(Number.isFinite(rSquared)).toBe(true)
    })

    it('should handle edge cases', () => {
      const emptyBins = []
      const rSquared = calculateRSquared(mockPicks, emptyBins, 2.5)
      
      expect(rSquared).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty picks array', () => {
      const bins = createConfidenceBins([])
      expect(bins).toHaveLength(4)
      bins.forEach(bin => {
        expect(bin.sample_size).toBe(0)
        expect(bin.hit_rate).toBe(0)
        expect(bin.expected_rate).toBe(0)
      })
    })

    it('should handle picks with missing data', () => {
      const incompletePicks = [
        { conf_score: 2.0, edge_pct: 0.5, result: 'win' },
        { conf_score: null, edge_pct: 0.5, result: 'win' },
        { conf_score: 3.0, edge_pct: null, result: 'win' },
        { conf_score: 4.0, edge_pct: 0.8, result: null }
      ]
      
      const bins = createConfidenceBins(incompletePicks)
      expect(bins).toHaveLength(4)
    })
  })
})
