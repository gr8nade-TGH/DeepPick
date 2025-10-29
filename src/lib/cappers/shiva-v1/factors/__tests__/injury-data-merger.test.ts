/**
 * Injury Data Merger Tests
 * Unit tests for merging MySportsFeeds data with web search results
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { PlayerInjuryData } from '@/lib/data-sources/types/player-injury'

// Mock modules
jest.mock('@/lib/data-sources/mysportsfeeds-players')
jest.mock('../news')

let merger: typeof import('../injury-data-merger')
let mysportsfeeds: any
let news: any

beforeEach(async () => {
  jest.clearAllMocks()
  jest.resetModules()
  
  // Re-import to get fresh instances
  merger = await import('../injury-data-merger')
  mysportsfeeds = await import('@/lib/data-sources/mysportsfeeds-players')
  news = await import('../news')
})

const createMockPlayer = (
  name: string,
  ppg: number,
  mpg: number,
  injury: { description: string; playingProbability: 'OUT' | 'QUESTIONABLE' | 'DOUBTFUL' | 'PROBABLE' } | null
): PlayerInjuryData => ({
  player: {
    id: Math.random(),
    firstName: name.split(' ')[0],
    lastName: name.split(' ')[1] || '',
    primaryPosition: 'SF',
    jerseyNumber: 0,
    currentTeam: { id: 1, abbreviation: 'BOS' },
    currentRosterStatus: 'ACTIVE',
    currentInjury: injury,
    height: '6-8',
    weight: 210,
    birthDate: '1998-03-03',
    age: 26,
    rookie: false
  },
  stats: {
    gamesPlayed: 50,
    offense: { pts: ppg * 50, fgAtt: 900, fgMade: 450, fg3PtAtt: 300, fg3PtMade: 120, ftAtt: 200, ftMade: 180 }
  },
  averages: {
    gamesPlayed: 50,
    avgMinutes: mpg,
    avgPoints: ppg,
    avgRebounds: 8.0,
    avgAssists: 4.0,
    avgSteals: 1.0,
    avgBlocks: 0.5,
    fg3PtPct: 0.40,
    ftPct: 0.90
  },
  team: { id: 1, abbreviation: 'BOS' }
})

describe('Injury Data Merger', () => {
  describe('mergeInjuryData', () => {
    it('should merge MySportsFeeds data for both teams', async () => {
      const awayPlayers = [
        createMockPlayer('Jayson Tatum', 27.0, 35.0, { description: 'Ankle sprain', playingProbability: 'OUT' }),
        createMockPlayer('Jaylen Brown', 24.0, 34.0, null),
        createMockPlayer('Derrick White', 15.0, 30.0, null)
      ]
      
      const homePlayers = [
        createMockPlayer('LeBron James', 25.0, 35.0, null),
        createMockPlayer('Anthony Davis', 24.0, 34.0, { description: 'Back soreness', playingProbability: 'QUESTIONABLE' })
      ]
      
      mysportsfeeds.fetchTeamPlayerStats
        .mockResolvedValueOnce(awayPlayers)
        .mockResolvedValueOnce(homePlayers)
      
      const result = await merger.mergeInjuryData('Boston Celtics', 'Los Angeles Lakers')
      
      expect(result.awayTeam.teamName).toBe('Boston Celtics')
      expect(result.homeTeam.teamName).toBe('Los Angeles Lakers')
      expect(result.awayTeam.injuredPlayers.length).toBe(1)
      expect(result.homeTeam.injuredPlayers.length).toBe(1)
      expect(result.dataSourcesUsed).toContain('MySportsFeeds Player Stats (STATS addon)')
    })

    it('should include web search news when available', async () => {
      const awayPlayers = [createMockPlayer('Jayson Tatum', 27.0, 35.0, null)]
      const homePlayers = [createMockPlayer('LeBron James', 25.0, 35.0, null)]
      
      mysportsfeeds.fetchTeamPlayerStats
        .mockResolvedValueOnce(awayPlayers)
        .mockResolvedValueOnce(homePlayers)
      
      const mockNewsEdge = {
        ok: true,
        findings: [
          {
            team: 'Boston Celtics',
            player: 'Jayson Tatum',
            status: 'OUT',
            minutesImpact: 35,
            sourceUrl: 'https://example.com/news'
          }
        ],
        edgePer100: 5.0,
        windowHours: 48,
        latencyMs: 100,
        cache: 'miss' as const
      }
      
      const result = await merger.mergeInjuryData('Boston Celtics', 'Los Angeles Lakers', mockNewsEdge)
      
      expect(result.recentNews.length).toBe(1)
      expect(result.recentNews[0].player).toBe('Jayson Tatum')
      expect(result.dataSourcesUsed).toContain('Web Search Injury News')
    })

    it('should identify key players correctly', async () => {
      const players = [
        createMockPlayer('Star Player', 28.0, 36.0, null), // Star (25+ PPG)
        createMockPlayer('All-Star', 22.0, 34.0, null), // All-star (20-25 PPG)
        createMockPlayer('Key Contributor', 16.0, 28.0, null), // Key (15-20 PPG)
        createMockPlayer('Role Player', 12.0, 22.0, null), // Role (10-15 PPG)
        createMockPlayer('Bench Player', 6.0, 15.0, null) // Bench (<10 PPG)
      ]
      
      mysportsfeeds.fetchTeamPlayerStats
        .mockResolvedValueOnce(players)
        .mockResolvedValueOnce([])
      
      const result = await merger.mergeInjuryData('Boston Celtics', 'Los Angeles Lakers')
      
      // Should identify top 3 as key players (15+ PPG)
      expect(result.awayTeam.keyPlayers.length).toBeGreaterThanOrEqual(3)
      const keyPlayerPPGs = result.awayTeam.keyPlayers.map(p => p.averages.avgPoints)
      expect(Math.min(...keyPlayerPPGs)).toBeGreaterThanOrEqual(15)
    })
  })

  describe('formatMergedDataForAI', () => {
    it('should format data for AI prompt', async () => {
      const awayPlayers = [
        createMockPlayer('Jayson Tatum', 27.0, 35.0, { description: 'Ankle sprain', playingProbability: 'OUT' })
      ]
      const homePlayers = [
        createMockPlayer('LeBron James', 25.0, 35.0, null)
      ]
      
      mysportsfeeds.fetchTeamPlayerStats
        .mockResolvedValueOnce(awayPlayers)
        .mockResolvedValueOnce(homePlayers)
      
      const mergedData = await merger.mergeInjuryData('Boston Celtics', 'Los Angeles Lakers')
      const formatted = merger.formatMergedDataForAI(mergedData)
      
      expect(formatted).toContain('Boston Celtics')
      expect(formatted).toContain('Los Angeles Lakers')
      expect(formatted).toContain('Jayson Tatum')
      expect(formatted).toContain('OUT')
      expect(formatted).toContain('27.0 PPG')
    })

    it('should handle teams with no injuries', async () => {
      const awayPlayers = [createMockPlayer('Jayson Tatum', 27.0, 35.0, null)]
      const homePlayers = [createMockPlayer('LeBron James', 25.0, 35.0, null)]
      
      mysportsfeeds.fetchTeamPlayerStats
        .mockResolvedValueOnce(awayPlayers)
        .mockResolvedValueOnce(homePlayers)
      
      const mergedData = await merger.mergeInjuryData('Boston Celtics', 'Los Angeles Lakers')
      const formatted = merger.formatMergedDataForAI(mergedData)
      
      expect(formatted).toContain('No injured players')
    })
  })
})

