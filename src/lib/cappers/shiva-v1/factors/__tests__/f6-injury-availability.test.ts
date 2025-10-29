/**
 * F6: Injury Availability Factor Tests
 * Unit tests for AI-powered injury analysis with MySportsFeeds integration
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { RunCtx } from '../types'
import type { PlayerInjuryData, MergedInjuryData } from '@/lib/data-sources/types/player-injury'

// Mock modules
jest.mock('@/lib/data-sources/mysportsfeeds-players')
jest.mock('../news')
jest.mock('../injury-data-merger')

// Mock fetch for AI providers
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

let injuryModule: typeof import('../f6-injury-availability')
let mysportsfeeds: any
let news: any
let merger: any

beforeEach(async () => {
  jest.clearAllMocks()
  jest.resetModules()
  
  // Re-import to get fresh instances
  injuryModule = await import('../f6-injury-availability')
  mysportsfeeds = await import('@/lib/data-sources/mysportsfeeds-players')
  news = await import('../news')
  merger = await import('../injury-data-merger')
})

const mockCtx: RunCtx = {
  game_id: 'test-game-123',
  away: 'Boston Celtics',
  home: 'Los Angeles Lakers',
  sport: 'NBA',
  betType: 'TOTAL',
  leagueAverages: {
    pace: 100.0,
    ORtg: 110.0,
    DRtg: 110.0,
    threePAR: 0.35,
    FTr: 0.25,
    threePstdev: 0.05
  },
  factorWeights: {
    injuryAvailability: 20
  }
}

describe('F6: Injury Availability Factor', () => {
  describe('analyzeInjuriesWithAI', () => {
    it('should return neutral impact when no injuries found', async () => {
      // Mock no injuries
      const mockMergedData: MergedInjuryData = {
        awayTeam: {
          teamName: 'Boston Celtics',
          teamAbbrev: 'BOS',
          totalPlayers: 15,
          injuredPlayers: [],
          keyPlayers: [],
          injuryImpact: { severity: 'none', impactScore: 0, reasoning: 'No injuries' }
        },
        homeTeam: {
          teamName: 'Los Angeles Lakers',
          teamAbbrev: 'LAL',
          totalPlayers: 15,
          injuredPlayers: [],
          keyPlayers: [],
          injuryImpact: { severity: 'none', impactScore: 0, reasoning: 'No injuries' }
        },
        recentNews: [],
        dataSourcesUsed: ['MySportsFeeds Player Stats (STATS addon)'],
        fetchedAt: new Date().toISOString()
      }
      
      merger.mergeInjuryData.mockResolvedValue(mockMergedData)
      
      const result = await injuryModule.analyzeInjuriesWithAI({
        awayTeam: 'Boston Celtics',
        homeTeam: 'Los Angeles Lakers',
        gameDate: '2025-10-29',
        sport: 'NBA'
      }, 'perplexity')
      
      expect(result.signal).toBe(0)
      expect(result.overScore).toBe(0)
      expect(result.underScore).toBe(0)
      expect(result.meta.awayImpact).toBe(0)
      expect(result.meta.homeImpact).toBe(0)
      expect(result.meta.keyInjuries).toEqual([])
    })

    it('should analyze injuries with AI when injuries exist', async () => {
      // Mock injured star player
      const mockMergedData: MergedInjuryData = {
        awayTeam: {
          teamName: 'Boston Celtics',
          teamAbbrev: 'BOS',
          totalPlayers: 15,
          injuredPlayers: [{
            player: {
              id: 1,
              firstName: 'Jayson',
              lastName: 'Tatum',
              primaryPosition: 'SF',
              jerseyNumber: 0,
              currentTeam: { id: 1, abbreviation: 'BOS' },
              currentRosterStatus: 'ACTIVE',
              currentInjury: {
                description: 'Ankle sprain',
                playingProbability: 'OUT'
              },
              height: '6-8',
              weight: 210,
              birthDate: '1998-03-03',
              age: 26,
              rookie: false
            },
            stats: {
              gamesPlayed: 50,
              offense: { pts: 1350, fgAtt: 900, fgMade: 450, fg3PtAtt: 300, fg3PtMade: 120, ftAtt: 200, ftMade: 180 }
            },
            averages: {
              gamesPlayed: 50,
              avgMinutes: 35.0,
              avgPoints: 27.0,
              avgRebounds: 8.5,
              avgAssists: 4.5,
              avgSteals: 1.0,
              avgBlocks: 0.5,
              fg3PtPct: 0.40,
              ftPct: 0.90
            },
            team: { id: 1, abbreviation: 'BOS' }
          }],
          keyPlayers: [],
          injuryImpact: { severity: 'critical', impactScore: -8, reasoning: 'Star player out' }
        },
        homeTeam: {
          teamName: 'Los Angeles Lakers',
          teamAbbrev: 'LAL',
          totalPlayers: 15,
          injuredPlayers: [],
          keyPlayers: [],
          injuryImpact: { severity: 'none', impactScore: 0, reasoning: 'No injuries' }
        },
        recentNews: [],
        dataSourcesUsed: ['MySportsFeeds Player Stats (STATS addon)'],
        fetchedAt: new Date().toISOString()
      }
      
      merger.mergeInjuryData.mockResolvedValue(mockMergedData)
      merger.formatMergedDataForAI.mockReturnValue('Formatted injury data')
      
      // Mock AI response
      const mockAIResponse = {
        awayImpact: -7,
        homeImpact: 0,
        keyInjuries: ['Jayson Tatum (SF, 27.0 PPG, OUT, -7 impact)'],
        reasoning: 'Celtics missing star scorer Jayson Tatum (27 PPG), significantly hurts scoring potential',
        confidence: 'high'
      }
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify(mockAIResponse)
            }
          }]
        })
      } as Response)
      
      const result = await injuryModule.analyzeInjuriesWithAI({
        awayTeam: 'Boston Celtics',
        homeTeam: 'Los Angeles Lakers',
        gameDate: '2025-10-29',
        sport: 'NBA'
      }, 'perplexity')
      
      expect(result.signal).toBeLessThan(0) // Negative signal (favors Under)
      expect(result.underScore).toBeGreaterThan(0)
      expect(result.overScore).toBe(0)
      expect(result.meta.awayImpact).toBe(-7)
      expect(result.meta.homeImpact).toBe(0)
      expect(result.meta.keyInjuries.length).toBeGreaterThan(0)
    })

    it('should handle defensive player injuries (positive impact)', async () => {
      // Mock injured defensive player
      const mockMergedData: MergedInjuryData = {
        awayTeam: {
          teamName: 'Boston Celtics',
          teamAbbrev: 'BOS',
          totalPlayers: 15,
          injuredPlayers: [],
          keyPlayers: [],
          injuryImpact: { severity: 'none', impactScore: 0, reasoning: 'No injuries' }
        },
        homeTeam: {
          teamName: 'Los Angeles Lakers',
          teamAbbrev: 'LAL',
          totalPlayers: 15,
          injuredPlayers: [{
            player: {
              id: 2,
              firstName: 'Anthony',
              lastName: 'Davis',
              primaryPosition: 'C',
              jerseyNumber: 3,
              currentTeam: { id: 2, abbreviation: 'LAL' },
              currentRosterStatus: 'ACTIVE',
              currentInjury: {
                description: 'Back soreness',
                playingProbability: 'OUT'
              },
              height: '6-10',
              weight: 253,
              birthDate: '1993-03-11',
              age: 31,
              rookie: false
            },
            stats: {
              gamesPlayed: 45,
              defense: { stl: 60, blk: 90 }
            },
            averages: {
              gamesPlayed: 45,
              avgMinutes: 34.0,
              avgPoints: 24.0,
              avgRebounds: 12.0,
              avgAssists: 3.0,
              avgSteals: 1.3,
              avgBlocks: 2.0,
              fg3PtPct: 0.25,
              ftPct: 0.80
            },
            team: { id: 2, abbreviation: 'LAL' }
          }],
          keyPlayers: [],
          injuryImpact: { severity: 'major', impactScore: 5, reasoning: 'Elite rim protector out' }
        },
        recentNews: [],
        dataSourcesUsed: ['MySportsFeeds Player Stats (STATS addon)'],
        fetchedAt: new Date().toISOString()
      }
      
      merger.mergeInjuryData.mockResolvedValue(mockMergedData)
      merger.formatMergedDataForAI.mockReturnValue('Formatted injury data')
      
      // Mock AI response - defensive player out helps scoring
      const mockAIResponse = {
        awayImpact: 0,
        homeImpact: 4,
        keyInjuries: ['Anthony Davis (C, 24.0 PPG, 2.0 BPG, OUT, +4 impact)'],
        reasoning: 'Lakers missing elite rim protector Anthony Davis, easier scoring inside for Celtics',
        confidence: 'high'
      }
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify(mockAIResponse)
            }
          }]
        })
      } as Response)
      
      const result = await injuryModule.analyzeInjuriesWithAI({
        awayTeam: 'Boston Celtics',
        homeTeam: 'Los Angeles Lakers',
        gameDate: '2025-10-29',
        sport: 'NBA'
      }, 'perplexity')
      
      expect(result.signal).toBeGreaterThan(0) // Positive signal (favors Over)
      expect(result.overScore).toBeGreaterThan(0)
      expect(result.underScore).toBe(0)
      expect(result.meta.homeImpact).toBe(4)
    })
  })

  describe('computeInjuryAvailabilityAsync', () => {
    it('should compute injury factor successfully', async () => {
      const mockMergedData: MergedInjuryData = {
        awayTeam: {
          teamName: 'Boston Celtics',
          teamAbbrev: 'BOS',
          totalPlayers: 15,
          injuredPlayers: [],
          keyPlayers: [],
          injuryImpact: { severity: 'none', impactScore: 0, reasoning: 'No injuries' }
        },
        homeTeam: {
          teamName: 'Los Angeles Lakers',
          teamAbbrev: 'LAL',
          totalPlayers: 15,
          injuredPlayers: [],
          keyPlayers: [],
          injuryImpact: { severity: 'none', impactScore: 0, reasoning: 'No injuries' }
        },
        recentNews: [],
        dataSourcesUsed: ['MySportsFeeds Player Stats (STATS addon)'],
        fetchedAt: new Date().toISOString()
      }
      
      merger.mergeInjuryData.mockResolvedValue(mockMergedData)
      
      const result = await injuryModule.computeInjuryAvailabilityAsync(mockCtx, 'perplexity', '2025-10-29')
      
      expect(result.factor_no).toBe(6)
      expect(result.key).toBe('injuryAvailability')
      expect(result.name).toBe('Key Injuries & Availability - Totals')
      expect(result.normalized_value).toBeDefined()
      expect(result.raw_values_json).toBeDefined()
      expect(result.parsed_values_json).toBeDefined()
    })

    it('should handle errors gracefully', async () => {
      merger.mergeInjuryData.mockRejectedValue(new Error('API error'))
      
      const result = await injuryModule.computeInjuryAvailabilityAsync(mockCtx, 'perplexity', '2025-10-29')
      
      expect(result.normalized_value).toBe(0)
      expect(result.cap_reason).toBe('AI analysis error')
      expect(result.notes).toContain('Error')
    })
  })
})

