import { calculateOffensiveFormPoints, estimateOffensiveImpact } from '../f2-offensive-form'

describe('Offensive Form vs League Factor (F2)', () => {
  const leagueORtg = 110

  describe('calculateOffensiveFormPoints', () => {
    it('should handle neutral offense (league average)', () => {
      const result = calculateOffensiveFormPoints({
        homeORtg: 110,
        awayORtg: 110,
        leagueORtg
      })

      expect(result.overScore).toBe(0)
      expect(result.underScore).toBe(0)
      expect(result.signal).toBeCloseTo(0, 2)
      expect(result.meta.combinedORtg).toBe(110)
      expect(result.meta.advantage).toBe(0)
    })

    it('should handle moderate offensive advantage', () => {
      const result = calculateOffensiveFormPoints({
        homeORtg: 112,
        awayORtg: 113,
        leagueORtg
      })

      // combinedORtg = 112.5, advantage = +2.5
      // signal = tanh(2.5/10) = tanh(0.25) ≈ 0.245
      expect(result.overScore).toBeCloseTo(0.490, 2) // 0.245 * 2.0
      expect(result.underScore).toBe(0)
      expect(result.signal).toBeCloseTo(0.245, 2)
      expect(result.meta.combinedORtg).toBe(112.5)
      expect(result.meta.advantage).toBe(2.5)
    })

    it('should handle significant offensive advantage', () => {
      const result = calculateOffensiveFormPoints({
        homeORtg: 115,
        awayORtg: 118,
        leagueORtg
      })

      // combinedORtg = 116.5, advantage = +6.5
      // signal = tanh(6.5/10) = tanh(0.65) ≈ 0.571
      expect(result.overScore).toBeCloseTo(1.142, 2) // 0.571 * 2.0
      expect(result.underScore).toBe(0)
      expect(result.signal).toBeCloseTo(0.571, 2)
      expect(result.meta.combinedORtg).toBe(116.5)
      expect(result.meta.advantage).toBe(6.5)
    })

    it('should handle extreme offensive advantage', () => {
      const result = calculateOffensiveFormPoints({
        homeORtg: 120,
        awayORtg: 125,
        leagueORtg
      })

      // combinedORtg = 122.5, advantage = +12.5
      // signal = tanh(12.5/10) = tanh(1.25) ≈ 0.848
      expect(result.overScore).toBeCloseTo(1.696, 2) // 0.848 * 2.0
      expect(result.underScore).toBe(0)
      expect(result.signal).toBeCloseTo(0.848, 2)
      expect(result.meta.combinedORtg).toBe(122.5)
      expect(result.meta.advantage).toBe(12.5)
    })

    it('should handle offensive disadvantage', () => {
      const result = calculateOffensiveFormPoints({
        homeORtg: 105,
        awayORtg: 107,
        leagueORtg
      })

      // combinedORtg = 106, advantage = -4
      // signal = tanh(-4/10) = tanh(-0.4) ≈ -0.380
      expect(result.overScore).toBe(0)
      expect(result.underScore).toBeCloseTo(0.760, 2) // 0.380 * 2.0
      expect(result.signal).toBeCloseTo(-0.380, 2)
      expect(result.meta.combinedORtg).toBe(106)
      expect(result.meta.advantage).toBe(-4)
    })

    it('should handle extreme offensive disadvantage', () => {
      const result = calculateOffensiveFormPoints({
        homeORtg: 100,
        awayORtg: 102,
        leagueORtg
      })

      // combinedORtg = 101, advantage = -9
      // signal = tanh(-9/10) = tanh(-0.9) ≈ -0.716
      expect(result.overScore).toBe(0)
      expect(result.underScore).toBeCloseTo(1.432, 2) // 0.716 * 2.0
      expect(result.signal).toBeCloseTo(-0.716, 2)
      expect(result.meta.combinedORtg).toBe(101)
      expect(result.meta.advantage).toBe(-9)
    })

    it('should handle invalid inputs', () => {
      const result = calculateOffensiveFormPoints({
        homeORtg: NaN,
        awayORtg: 110,
        leagueORtg
      })

      expect(result.overScore).toBe(0)
      expect(result.underScore).toBe(0)
      expect(result.signal).toBe(0)
      expect(result.meta.reason).toBe('bad_input')
    })

    it('should cap extreme outliers for safety', () => {
      const result = calculateOffensiveFormPoints({
        homeORtg: 200, // Extremely high
        awayORtg: 200,
        leagueORtg
      })

      // Should be capped at +30 advantage
      expect(result.meta.advantage).toBe(30)
      expect(result.overScore).toBeCloseTo(1.99, 2) // Very close to full points
      expect(result.underScore).toBe(0)
    })
  })

  describe('estimateOffensiveImpact', () => {
    it('should estimate offensive impact correctly', () => {
      expect(estimateOffensiveImpact(5)).toBeCloseTo(5.0, 2) // 5 * 1.0
      expect(estimateOffensiveImpact(-3)).toBeCloseTo(-3.0, 2) // -3 * 1.0
      expect(estimateOffensiveImpact(0)).toBe(0)
    })
  })
})
