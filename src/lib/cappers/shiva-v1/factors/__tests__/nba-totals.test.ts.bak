/**
 * NBA Totals Factor Tests
 * Unit tests for F1-F5 factor computation
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { computeTotalsFactors, fetchNBAStatsBundle, summarizeAvailabilityWithLLM, RunCtx, StatMuseBundle, InjuryImpact } from '../nba-totals'

// Mock StatMuse
jest.mock('../../statmuse', () => ({
  askStatMuse: jest.fn()
}))

// Mock News
jest.mock('../../news', () => ({
  searchInjuries: jest.fn()
}))

// Mock fetch for OpenAI
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('NBA Totals Factors', () => {
  const mockCtx: RunCtx = {
    game_id: 'test-game-123',
    away: 'Houston Rockets',
    home: 'Oklahoma City Thunder',
    sport: 'NBA',
    betType: 'TOTAL',
    leagueAverages: {
      pace: 100.0,
      ORtg: 110.0,
      DRtg: 110.0,
      threePAR: 0.39,
      FTr: 0.22,
      threePstdev: 0.036
    }
  }

  const mockBundle: StatMuseBundle = {
    // Team pace data
    awayPaceSeason: 98.5,
    awayPaceLast10: 101.2,
    homePaceSeason: 102.1,
    homePaceLast10: 99.8,
    
    // Offensive/Defensive ratings
    awayORtgLast10: 112.5,
    homeORtgLast10: 108.3,
    awayDRtgSeason: 109.2,
    homeDRtgSeason: 111.8,
    
    // 3-Point environment
    away3PAR: 0.42,
    home3PAR: 0.38,
    awayOpp3PAR: 0.41,
    homeOpp3PAR: 0.37,
    away3Pct: 0.38,
    home3Pct: 0.34,
    away3PctLast10: 0.38,
    home3PctLast10: 0.34,
    
    // Free throw environment
    awayFTr: 0.24,
    homeFTr: 0.19,
    awayOppFTr: 0.23,
    homeOppFTr: 0.21,
    
    // League anchors
    leaguePace: 100.0,
    leagueORtg: 110.0,
    leagueDRtg: 110.0,
    league3PAR: 0.39,
    league3Pct: 0.35,
    leagueFTr: 0.22,
    league3Pstdev: 0.036
  }

  const mockInjuryImpact: InjuryImpact = {
    defenseImpactA: 0.2,  // Slightly weaker defense
    defenseImpactB: -0.1,  // Slightly stronger defense
    summary: 'Test injury impact',
    rawResponse: 'Test response'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchNBAStatsBundle', () => {
    it('should fetch and parse StatMuse data correctly', async () => {
      const { askStatMuse } = require('../../statmuse')
      
      // Mock successful StatMuse responses
      askStatMuse.mockImplementation((queryText: string) => {
        if (queryText.includes('pace this season')) return Promise.resolve({ ok: true, data: '98.5' })
        if (queryText.includes('pace last 10')) return Promise.resolve({ ok: true, data: '101.2' })
        if (queryText.includes('league average pace')) return Promise.resolve({ ok: true, data: '100.0' })
        if (queryText.includes('offensive rating last 10')) return Promise.resolve({ ok: true, data: '112.5' })
        if (queryText.includes('defensive rating this season')) return Promise.resolve({ ok: true, data: '109.2' })
        if (queryText.includes('3 point attempt rate')) return Promise.resolve({ ok: true, data: '0.42' })
        if (queryText.includes('opponent 3 point attempt rate')) return Promise.resolve({ ok: true, data: '0.41' })
        if (queryText.includes('3pt percentage last 10')) return Promise.resolve({ ok: true, data: '0.38' })
        if (queryText.includes('free throw rate')) return Promise.resolve({ ok: true, data: '0.24' })
        if (queryText.includes('opponent free throw rate')) return Promise.resolve({ ok: true, data: '0.23' })
        return Promise.resolve({ ok: true, data: '0' })
      })

      const result = await fetchNBAStatsBundle(mockCtx)
      
      expect(result.awayPaceSeason).toBe(98.5)
      expect(result.awayPaceLast10).toBe(101.2)
      expect(result.leaguePace).toBe(100.0)
      expect(result.awayORtgLast10).toBe(112.5)
      expect(result.away3PAR).toBe(0.42)
      expect(result.awayFTr).toBe(0.24)
    })

    it('should handle StatMuse failures gracefully', async () => {
      const { askStatMuse } = require('../../statmuse')
      
      // Mock failed responses
      askStatMuse.mockResolvedValue({ ok: false, data: null })
      
      const result = await fetchNBAStatsBundle(mockCtx)
      
      // Should fall back to league averages
      expect(result.awayPaceSeason).toBe(100.0) // League average fallback
      expect(result.leaguePace).toBe(100.0)
      expect(result.awayORtgLast10).toBe(110.0) // League average fallback
    })
  })

  describe('summarizeAvailabilityWithLLM', () => {
    it('should parse injury data correctly', async () => {
      const { searchInjuries } = require('../../news')
      
      // Mock news data
      searchInjuries.mockResolvedValue({
        ok: true,
        findings: [
          { team: 'Houston Rockets', player: 'Chet Holmgren', status: 'OUT', minutesImpact: 0.3, sourceUrl: 'test.com' },
          { team: 'Oklahoma City Thunder', player: 'Jalen Green', status: 'LIMITED', minutesImpact: -0.1, sourceUrl: 'test.com' }
        ],
        edgePer100: 0.1,
        windowHours: 48,
        latencyMs: 100,
        cache: 'miss'
      })
      
      // Mock OpenAI response
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                key_absences: [
                  { team: 'Houston Rockets', player: 'Chet Holmgren', role: 'rim protector', status: 'OUT', defense_impact_score: 0.3 },
                  { team: 'Oklahoma City Thunder', player: 'Jalen Green', role: 'scorer', status: 'LIMITED', defense_impact_score: -0.1 }
                ],
                minutes_limits: [
                  { team: 'Houston Rockets', player: 'Jalen Green', limit: 25 }
                ],
                defense_impact_score: 0.1
              })
            }
          }]
        })
      })
      
      const result = await summarizeAvailabilityWithLLM(mockCtx)
      
      expect(result.defenseImpactA).toBeCloseTo(0.2, 1)
      expect(result.defenseImpactB).toBeCloseTo(-0.1, 1)
    })

    it('should handle LLM failures gracefully', async () => {
      const { searchInjuries } = require('../../news')
      
      // Mock no news
      searchInjuries.mockResolvedValue({
        ok: true,
        findings: [],
        edgePer100: 0,
        windowHours: 48,
        latencyMs: 100,
        cache: 'miss'
      })
      
      const result = await summarizeAvailabilityWithLLM(mockCtx)
      
      expect(result.defenseImpactA).toBe(0)
      expect(result.defenseImpactB).toBe(0)
    })
  })

  describe('computeTotalsFactors', () => {
    it('should compute all 5 factors correctly', async () => {
      const { askStatMuse } = require('../../statmuse')
      const { searchInjuries } = require('../../news')
      
      // Mock StatMuse responses
      askStatMuse.mockImplementation((queryText: string) => {
        if (queryText.includes('pace this season')) return Promise.resolve({ ok: true, data: '98.5' })
        if (queryText.includes('pace last 10')) return Promise.resolve({ ok: true, data: '101.2' })
        if (queryText.includes('league average pace')) return Promise.resolve({ ok: true, data: '100.0' })
        if (queryText.includes('offensive rating last 10')) return Promise.resolve({ ok: true, data: '112.5' })
        if (queryText.includes('defensive rating this season')) return Promise.resolve({ ok: true, data: '109.2' })
        if (queryText.includes('3 point attempt rate')) return Promise.resolve({ ok: true, data: '0.42' })
        if (queryText.includes('opponent 3 point attempt rate')) return Promise.resolve({ ok: true, data: '0.41' })
        if (queryText.includes('3pt percentage last 10')) return Promise.resolve({ ok: true, data: '0.38' })
        if (queryText.includes('free throw rate')) return Promise.resolve({ ok: true, data: '0.24' })
        if (queryText.includes('opponent free throw rate')) return Promise.resolve({ ok: true, data: '0.23' })
        return Promise.resolve({ ok: true, data: '0' })
      })
      
      // Mock news
      searchInjuries.mockResolvedValue({
        ok: true,
        findings: [],
        edgePer100: 0,
        windowHours: 48,
        latencyMs: 100,
        cache: 'miss'
      })
      
      // Mock OpenAI
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                key_absences: [],
                minutes_limits: [],
                defense_impact_score: 0
              })
            }
          }]
        })
      })
      
      const result = await computeTotalsFactors(mockCtx)
      
      // Should return 5 factors
      expect(result.factors).toHaveLength(5)
      expect(result.factor_version).toBe('nba_totals_v1')
      
      // Check factor keys
      const factorKeys = result.factors.map(f => f.key)
      expect(factorKeys).toEqual(['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv'])
      
      // Check debug info
      expect(result.totals_debug.league_anchors.pace).toBe(100.0)
      expect(result.totals_debug.injury_impact.defenseImpactA).toBe(0)
      expect(result.totals_debug.injury_impact.defenseImpactB).toBe(0)
      
      // Check that all factors have symmetric contributions
      result.factors.forEach(factor => {
        const parsed = factor.parsed_values_json as any
        expect(parsed.awayContribution).toBeCloseTo(-parsed.homeContribution, 3)
      })
    })
  })
})
