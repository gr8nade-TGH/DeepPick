import { calculateDefensiveErosionPoints, estimateDefensiveImpact } from '../f3-defensive-erosion'

describe('Defensive Erosion Factor (F3)', () => {
  const leagueDRtg = 110

  describe('calculateDefensiveErosionPoints', () => {
    it('should handle neutral defense (league average)', () => {
      const result = calculateDefensiveErosionPoints({
        homeDRtg: 110,
        awayDRtg: 110,
        leagueDRtg,
        injuryImpact: { defenseImpactA: 0, defenseImpactB: 0 }
      })

      expect(result.overScore).toBe(0)
      expect(result.underScore).toBe(0)
      expect(result.signal).toBeCloseTo(0, 2)
      expect(result.meta.combinedDRtg).toBe(110)
      expect(result.meta.drtgDelta).toBe(0)
    })

    it('should favor Over for poor defense (high DRtg)', () => {
      const result = calculateDefensiveErosionPoints({
        homeDRtg: 120, // 10 points worse than league
        awayDRtg: 115, // 5 points worse than league
        leagueDRtg,
        injuryImpact: { defenseImpactA: 0, defenseImpactB: 0 }
      })

      expect(result.overScore).toBeGreaterThan(0)
      expect(result.underScore).toBe(0)
      expect(result.signal).toBeGreaterThan(0)
      expect(result.meta.combinedDRtg).toBe(117.5)
      expect(result.meta.drtgDelta).toBe(7.5)
    })

    it('should favor Under for strong defense (low DRtg)', () => {
      const result = calculateDefensiveErosionPoints({
        homeDRtg: 100, // 10 points better than league
        awayDRtg: 105, // 5 points better than league
        leagueDRtg,
        injuryImpact: { defenseImpactA: 0, defenseImpactB: 0 }
      })

      expect(result.overScore).toBe(0)
      expect(result.underScore).toBeGreaterThan(0)
      expect(result.signal).toBeLessThan(0)
      expect(result.meta.combinedDRtg).toBe(102.5)
      expect(result.meta.drtgDelta).toBe(-7.5)
    })

    it('should factor in injury impact', () => {
      const result = calculateDefensiveErosionPoints({
        homeDRtg: 110,
        awayDRtg: 110,
        leagueDRtg,
        injuryImpact: { 
          defenseImpactA: -0.5, // Worse defense due to injuries
          defenseImpactB: -0.3 
        }
      })

      expect(result.overScore).toBeGreaterThan(0)
      expect(result.underScore).toBe(0)
      expect(result.signal).toBeGreaterThan(0)
      expect(result.meta.injuryImpact).toBe(-0.4) // Average of -0.5 and -0.3
    })

    it('should cap extreme outliers for safety', () => {
      const result = calculateDefensiveErosionPoints({
        homeDRtg: 200, // Extremely high
        awayDRtg: 200,
        leagueDRtg,
        injuryImpact: { defenseImpactA: 0, defenseImpactB: 0 }
      })

      // Should be capped at +20 drtgDelta
      expect(result.meta.drtgDelta).toBe(20)
      expect(result.overScore).toBeCloseTo(1.99, 2) // Very close to full points
      expect(result.underScore).toBe(0)
    })

    it('should handle invalid inputs gracefully', () => {
      const result = calculateDefensiveErosionPoints({
        homeDRtg: NaN,
        awayDRtg: 110,
        leagueDRtg,
        injuryImpact: { defenseImpactA: 0, defenseImpactB: 0 }
      })

      expect(result.overScore).toBe(0)
      expect(result.underScore).toBe(0)
      expect(result.signal).toBe(0)
      expect(result.meta.reason).toBe('bad_input')
    })

    it('should achieve maximum points for extreme defensive erosion', () => {
      const result = calculateDefensiveErosionPoints({
        homeDRtg: 130, // Very poor defense
        awayDRtg: 125,
        leagueDRtg,
        injuryImpact: { 
          defenseImpactA: -0.8, // Major injuries
          defenseImpactB: -0.6 
        }
      })

      // Should get close to maximum points
      expect(result.overScore).toBeGreaterThan(1.5)
      expect(result.underScore).toBe(0)
      expect(result.signal).toBeGreaterThan(0.7)
    })

    it('should achieve maximum points for extreme defensive strength', () => {
      const result = calculateDefensiveErosionPoints({
        homeDRtg: 90, // Very strong defense
        awayDRtg: 95,
        leagueDRtg,
        injuryImpact: { 
          defenseImpactA: 0.8, // Healthy key players
          defenseImpactB: 0.6 
        }
      })

      // Should get close to maximum points
      expect(result.overScore).toBe(0)
      expect(result.underScore).toBeGreaterThan(1.5)
      expect(result.signal).toBeLessThan(-0.7)
    })
  })

  describe('estimateDefensiveImpact', () => {
    it('should estimate defensive impact correctly', () => {
      expect(estimateDefensiveImpact(5)).toBeCloseTo(5.0, 2) // 5 * 1.0
      expect(estimateDefensiveImpact(-3)).toBeCloseTo(-3.0, 2) // -3 * 1.0
      expect(estimateDefensiveImpact(0)).toBe(0)
    })
  })
})
