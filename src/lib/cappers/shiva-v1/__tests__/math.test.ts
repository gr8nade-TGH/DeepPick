/**
 * Math Engine Tests
 * Unit tests for sigmoid functions and confidence calculations
 */

import { describe, it, expect } from '@jest/globals'
import { 
  sigmoid, 
  sigmoidScaled, 
  calculateEdgeConfidence, 
  calculateLegacyConfidence,
  oddsToProbability,
  probabilityToOdds
} from '../math'

describe('Math Engine', () => {
  describe('sigmoid functions', () => {
    it('should calculate sigmoid correctly', () => {
      expect(sigmoid(0)).toBeCloseTo(0.5, 3)
      expect(sigmoid(1)).toBeCloseTo(0.731, 3)
      expect(sigmoid(-1)).toBeCloseTo(0.269, 3)
      expect(sigmoid(2)).toBeCloseTo(0.881, 3)
      expect(sigmoid(-2)).toBeCloseTo(0.119, 3)
    })

    it('should calculate scaled sigmoid correctly', () => {
      expect(sigmoidScaled(0, 2.5)).toBeCloseTo(0.5, 3)
      expect(sigmoidScaled(1, 2.5)).toBeCloseTo(0.924, 3)
      expect(sigmoidScaled(-1, 2.5)).toBeCloseTo(0.076, 3)
    })
  })

  describe('odds conversion', () => {
    it('should convert odds to probability correctly', () => {
      expect(oddsToProbability(100)).toBeCloseTo(0.5, 3) // +100 = 50%
      expect(oddsToProbability(200)).toBeCloseTo(0.333, 3) // +200 = 33.3%
      expect(oddsToProbability(-150)).toBeCloseTo(0.6, 3) // -150 = 60%
      expect(oddsToProbability(-200)).toBeCloseTo(0.667, 3) // -200 = 66.7%
    })

    it('should convert probability to odds correctly', () => {
      expect(probabilityToOdds(0.5)).toBeCloseTo(100, 0) // 50% = +100
      expect(probabilityToOdds(0.6)).toBeCloseTo(-150, 0) // 60% = -150
      expect(probabilityToOdds(0.333)).toBeCloseTo(200, 0) // 33.3% = +200
    })
  })

  describe('confidence calculations', () => {
    const mockFactors = [
      { normalized_value: 0.5, weight_total_pct: 0.3 },
      { normalized_value: -0.3, weight_total_pct: 0.2 },
      { normalized_value: 0.8, weight_total_pct: 0.1 }
    ]

    it('should calculate legacy confidence correctly', () => {
      const conf = calculateLegacyConfidence(mockFactors)
      expect(conf).toBeGreaterThan(0)
      expect(conf).toBeLessThanOrEqual(5)
    })

    it('should calculate edge confidence correctly', () => {
      const result = calculateEdgeConfidence(mockFactors)
      
      expect(result).toHaveProperty('edgeRaw')
      expect(result).toHaveProperty('edgePct')
      expect(result).toHaveProperty('confScore')
      
      expect(result.edgePct).toBeGreaterThanOrEqual(0)
      expect(result.edgePct).toBeLessThanOrEqual(1)
      expect(result.confScore).toBeGreaterThanOrEqual(0)
      expect(result.confScore).toBeLessThanOrEqual(5)
    })

    it('should handle negative edge correctly', () => {
      const negativeFactors = [
        { normalized_value: -0.8, weight_total_pct: 0.5 },
        { normalized_value: -0.3, weight_total_pct: 0.3 }
      ]
      
      const result = calculateEdgeConfidence(negativeFactors)
      expect(result.edgeRaw).toBeLessThan(0)
      expect(result.edgePct).toBeLessThan(0.5)
      expect(result.confScore).toBeLessThan(2.5)
    })

    it('should handle positive edge correctly', () => {
      const positiveFactors = [
        { normalized_value: 0.8, weight_total_pct: 0.5 },
        { normalized_value: 0.3, weight_total_pct: 0.3 }
      ]
      
      const result = calculateEdgeConfidence(positiveFactors)
      expect(result.edgeRaw).toBeGreaterThan(0)
      expect(result.edgePct).toBeGreaterThan(0.5)
      expect(result.confScore).toBeGreaterThan(2.5)
    })

    it('should be symmetric for opposite factors', () => {
      const factors1 = [{ normalized_value: 0.5, weight_total_pct: 1.0 }]
      const factors2 = [{ normalized_value: -0.5, weight_total_pct: 1.0 }]
      
      const result1 = calculateEdgeConfidence(factors1)
      const result2 = calculateEdgeConfidence(factors2)
      
      expect(result1.edgeRaw).toBeCloseTo(-result2.edgeRaw, 3)
      expect(result1.edgePct + result2.edgePct).toBeCloseTo(1, 3)
      expect(result1.confScore + result2.confScore).toBeCloseTo(5, 1)
    })
  })

  describe('edge scaling', () => {
    it('should respond to different scaling constants', () => {
      const factors = [{ normalized_value: 1.0, weight_total_pct: 1.0 }]
      
      const result1 = calculateEdgeConfidence(factors, 1.0)
      const result2 = calculateEdgeConfidence(factors, 2.5)
      const result3 = calculateEdgeConfidence(factors, 5.0)
      
      // Higher scaling = more extreme probabilities
      expect(result1.edgePct).toBeLessThan(result2.edgePct)
      expect(result2.edgePct).toBeLessThan(result3.edgePct)
    })
  })
})