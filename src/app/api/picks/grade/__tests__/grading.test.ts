/**
 * Unit tests for pick grading logic
 */
import { describe, it, expect } from '@jest/globals'

describe('Pick Grading Logic', () => {
  describe('Moneyline Grading', () => {
    it('grades win correctly', () => {
      const result = {
        selection: 'HOME TEAM',
        units: 2,
        finalScore: { home_score: 110, away_score: 105 },
        expected: { result: 'win', units_delta: 2 },
      }
      
      expect(result.expected.result).toBe('win')
      expect(result.expected.units_delta).toBe(2)
    })

    it('grades loss correctly', () => {
      const result = {
        selection: 'HOME TEAM',
        units: 2,
        finalScore: { home_score: 100, away_score: 110 },
        expected: { result: 'loss', units_delta: -2 },
      }
      
      expect(result.expected.result).toBe('loss')
      expect(result.expected.units_delta).toBe(-2)
    })

    it('grades push for tie game', () => {
      const result = {
        selection: 'HOME TEAM',
        units: 2,
        finalScore: { home_score: 105, away_score: 105 },
        expected: { result: 'push', units_delta: 0 },
      }
      
      expect(result.expected.result).toBe('push')
      expect(result.expected.units_delta).toBe(0)
    })
  })

  describe('Spread Grading', () => {
    it('grades cover win correctly', () => {
      const result = {
        selection: 'LA LAKERS -7',
        units: 2,
        finalScore: { home_score: 115, away_score: 100 }, // Margin: 15, covers -7
        expected: { result: 'win', units_delta: 2 },
      }
      
      expect(result.expected.result).toBe('win')
    })

    it('grades non-cover loss correctly', () => {
      const result = {
        selection: 'LA LAKERS -7',
        units: 2,
        finalScore: { home_score: 105, away_score: 100 }, // Margin: 5, does not cover -7
        expected: { result: 'loss', units_delta: -2 },
      }
      
      expect(result.expected.result).toBe('loss')
    })

    it('grades push when margin equals spread', () => {
      const result = {
        selection: 'LA LAKERS -7',
        units: 2,
        finalScore: { home_score: 107, away_score: 100 }, // Margin: 7, exact push
        expected: { result: 'push', units_delta: 0 },
      }
      
      expect(result.expected.result).toBe('push')
    })

    it('grades underdog spread correctly', () => {
      const result = {
        selection: 'WARRIORS +5.5',
        units: 1,
        finalScore: { home_score: 110, away_score: 106 }, // Away lost by 4, covers +5.5
        expected: { result: 'win', units_delta: 1 },
      }
      
      expect(result.expected.result).toBe('win')
    })
  })

  describe('Total Grading', () => {
    it('grades over win correctly', () => {
      const result = {
        selection: 'OVER 227.5',
        units: 1,
        finalScore: { home_score: 120, away_score: 115 }, // Total: 235, over 227.5
        expected: { result: 'win', units_delta: 1 },
      }
      
      expect(result.expected.result).toBe('win')
    })

    it('grades over loss correctly', () => {
      const result = {
        selection: 'OVER 227.5',
        units: 1,
        finalScore: { home_score: 110, away_score: 112 }, // Total: 222, under 227.5
        expected: { result: 'loss', units_delta: -1 },
      }
      
      expect(result.expected.result).toBe('loss')
    })

    it('grades under win correctly', () => {
      const result = {
        selection: 'UNDER 227.5',
        units: 2,
        finalScore: { home_score: 108, away_score: 110 }, // Total: 218, under 227.5
        expected: { result: 'win', units_delta: 2 },
      }
      
      expect(result.expected.result).toBe('win')
    })

    it('grades push when total equals line', () => {
      const result = {
        selection: 'OVER 227.5',
        units: 1,
        finalScore: { home_score: 114, away_score: 113.5 }, // Total: 227.5, exact push
        expected: { result: 'push', units_delta: 0 },
      }
      
      expect(result.expected.result).toBe('push')
    })
  })
})

