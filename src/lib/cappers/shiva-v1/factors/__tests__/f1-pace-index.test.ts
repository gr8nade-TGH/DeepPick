import { calculatePaceFactorPoints, estimateTotalImpact } from '../f1-pace-index'

describe('Matchup Pace Index Factor (F1)', () => {
  const leaguePace = 100

  describe('calculatePaceFactorPoints', () => {
    it('should handle neutral pace (no difference from league)', () => {
      const result = calculatePaceFactorPoints({
        homePace: 100,
        awayPace: 100,
        leaguePace
      })

      expect(result.points).toBeCloseTo(0, 2)
      expect(result.signal).toBeCloseTo(0, 2)
      expect(result.meta.expPace).toBe(100)
      expect(result.meta.paceDelta).toBe(0)
    })

    it('should handle moderate pace increase', () => {
      const result = calculatePaceFactorPoints({
        homePace: 105,
        awayPace: 103,
        leaguePace
      })

      // expPace = 104, paceDelta = +4
      // signal = tanh(4/8) = tanh(0.5) ≈ 0.462
      expect(result.points).toBeCloseTo(0.924, 2) // 0.462 * 2.0
      expect(result.signal).toBeCloseTo(0.462, 2)
      expect(result.meta.expPace).toBe(104)
      expect(result.meta.paceDelta).toBe(4)
    })

    it('should handle significant pace increase', () => {
      const result = calculatePaceFactorPoints({
        homePace: 110,
        awayPace: 108,
        leaguePace
      })

      // expPace = 109, paceDelta = +9
      // signal = tanh(9/8) = tanh(1.125) ≈ 0.811
      expect(result.points).toBeCloseTo(1.622, 2) // 0.811 * 2.0
      expect(result.signal).toBeCloseTo(0.811, 2)
      expect(result.meta.expPace).toBe(109)
      expect(result.meta.paceDelta).toBe(9)
    })

    it('should handle extreme pace increase (should get near full points)', () => {
      const result = calculatePaceFactorPoints({
        homePace: 120,
        awayPace: 118,
        leaguePace
      })

      // expPace = 119, paceDelta = +19
      // signal = tanh(19/8) = tanh(2.375) ≈ 0.983
      // After clamp: signal = 0.983 (very close to full credit)
      expect(result.points).toBeCloseTo(1.97, 2) // 0.983 * 2.0
      expect(result.signal).toBeCloseTo(0.983, 2)
      expect(result.meta.expPace).toBe(119)
      expect(result.meta.paceDelta).toBe(19)
    })

    it('should handle very extreme pace increase (should get full points)', () => {
      const result = calculatePaceFactorPoints({
        homePace: 150, // Very extreme
        awayPace: 148,
        leaguePace
      })

      // expPace = 149, paceDelta = +49
      // signal = tanh(49/8) = tanh(6.125) ≈ 0.9999
      // After clamp: signal = 1.0 (full credit due to clamp)
      expect(result.points).toBeCloseTo(2.0, 2) // 1.0 * 2.0
      expect(result.signal).toBeCloseTo(1.0, 2)
      expect(result.meta.expPace).toBe(149)
      expect(result.meta.paceDelta).toBe(30) // Capped at 30
    })

    it('should handle pace decrease', () => {
      const result = calculatePaceFactorPoints({
        homePace: 95,
        awayPace: 97,
        leaguePace
      })

      // expPace = 96, paceDelta = -4
      // signal = tanh(-4/8) = tanh(-0.5) ≈ -0.462
      expect(result.points).toBeCloseTo(-0.924, 2) // -0.462 * 2.0
      expect(result.signal).toBeCloseTo(-0.462, 2)
      expect(result.meta.expPace).toBe(96)
      expect(result.meta.paceDelta).toBe(-4)
    })

    it('should handle invalid inputs', () => {
      const result = calculatePaceFactorPoints({
        homePace: NaN,
        awayPace: 100,
        leaguePace
      })

      expect(result.points).toBe(0)
      expect(result.signal).toBe(0)
      expect(result.meta.reason).toBe('bad_input')
    })

    it('should handle zero or negative inputs', () => {
      const result = calculatePaceFactorPoints({
        homePace: 0,
        awayPace: 100,
        leaguePace
      })

      expect(result.points).toBe(0)
      expect(result.signal).toBe(0)
      expect(result.meta.reason).toBe('bad_input')
    })

    it('should cap extreme outliers for safety', () => {
      const result = calculatePaceFactorPoints({
        homePace: 200, // Extremely high
        awayPace: 200,
        leaguePace
      })

      // Should be capped at +30 possessions
      expect(result.meta.paceDelta).toBe(30)
      expect(result.points).toBeCloseTo(2.0, 2) // Should still get full points
    })
  })

  describe('estimateTotalImpact', () => {
    it('should estimate total impact correctly', () => {
      expect(estimateTotalImpact(5)).toBeCloseTo(11.45, 2) // 5 * 2.29
      expect(estimateTotalImpact(-3)).toBeCloseTo(-6.87, 2) // -3 * 2.29
      expect(estimateTotalImpact(0)).toBe(0)
    })
  })
})
