/**
 * MySportsFeeds Player Stats Fetcher Tests
 * Unit tests for player stats and injury data fetching
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// Mock modules
jest.mock('../mysportsfeeds-api')
jest.mock('../team-mappings')

let mysportsfeeds: typeof import('../mysportsfeeds-players')
let api: any
let mappings: any

beforeEach(async () => {
  jest.clearAllMocks()
  jest.resetModules()
  
  // Re-import to get fresh instances
  mysportsfeeds = await import('../mysportsfeeds-players')
  api = await import('../mysportsfeeds-api')
  mappings = await import('../team-mappings')
  
  // Clear cache before each test
  mysportsfeeds.clearPlayerStatsCache()
})

const createMockAPIResponse = (players: any[]) => ({
  lastUpdatedOn: new Date().toISOString(),
  playerStatsTotals: players
})

const createMockPlayerData = (
  firstName: string,
  lastName: string,
  ppg: number,
  mpg: number,
  injury: any = null
) => ({
  player: {
    id: Math.random(),
    firstName,
    lastName,
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
  team: { id: 1, abbreviation: 'BOS' },
  stats: {
    gamesPlayed: 50,
    offense: {
      pts: ppg * 50,
      fgAtt: 900,
      fgMade: 450,
      fg3PtAtt: 300,
      fg3PtMade: 120,
      ftAtt: 200,
      ftMade: 180
    },
    rebounds: {
      reb: 400,
      offReb: 100,
      defReb: 300
    },
    assists: {
      ast: 200
    },
    defense: {
      stl: 50,
      blk: 25
    },
    miscellaneous: {
      minSeconds: mpg * 60 * 50,
      plusMinus: 100
    }
  }
})

describe('MySportsFeeds Player Stats Fetcher', () => {
  describe('fetchTeamPlayerStats', () => {
    it('should fetch and parse player stats correctly', async () => {
      mappings.getTeamAbbrev.mockReturnValue('BOS')
      
      const mockResponse = createMockAPIResponse([
        createMockPlayerData('Jayson', 'Tatum', 27.0, 35.0),
        createMockPlayerData('Jaylen', 'Brown', 24.0, 34.0)
      ])
      
      api.fetchMySportsFeeds.mockResolvedValue(mockResponse)
      
      const result = await mysportsfeeds.fetchTeamPlayerStats('Boston Celtics')
      
      expect(result).toHaveLength(2)
      expect(result[0].player.firstName).toBe('Jayson')
      expect(result[0].player.lastName).toBe('Tatum')
      expect(result[0].averages.avgPoints).toBeCloseTo(27.0, 1)
      expect(result[0].averages.avgMinutes).toBeCloseTo(35.0, 1)
    })

    it('should calculate player averages correctly', async () => {
      mappings.getTeamAbbrev.mockReturnValue('BOS')
      
      const mockResponse = createMockAPIResponse([
        createMockPlayerData('Jayson', 'Tatum', 27.0, 35.0)
      ])
      
      api.fetchMySportsFeeds.mockResolvedValue(mockResponse)
      
      const result = await mysportsfeeds.fetchTeamPlayerStats('Boston Celtics')
      
      expect(result[0].averages.avgPoints).toBeCloseTo(27.0, 1)
      expect(result[0].averages.avgRebounds).toBeCloseTo(8.0, 1)
      expect(result[0].averages.avgAssists).toBeCloseTo(4.0, 1)
      expect(result[0].averages.avgSteals).toBeCloseTo(1.0, 1)
      expect(result[0].averages.avgBlocks).toBeCloseTo(0.5, 1)
    })

    it('should cache results for 5 minutes', async () => {
      mappings.getTeamAbbrev.mockReturnValue('BOS')
      
      const mockResponse = createMockAPIResponse([
        createMockPlayerData('Jayson', 'Tatum', 27.0, 35.0)
      ])
      
      api.fetchMySportsFeeds.mockResolvedValue(mockResponse)
      
      // First call
      await mysportsfeeds.fetchTeamPlayerStats('Boston Celtics')
      expect(api.fetchMySportsFeeds).toHaveBeenCalledTimes(1)
      
      // Second call (should use cache)
      await mysportsfeeds.fetchTeamPlayerStats('Boston Celtics')
      expect(api.fetchMySportsFeeds).toHaveBeenCalledTimes(1) // Still 1
    })

    it('should handle API errors gracefully', async () => {
      mappings.getTeamAbbrev.mockReturnValue('BOS')
      api.fetchMySportsFeeds.mockRejectedValue(new Error('API error'))
      
      await expect(mysportsfeeds.fetchTeamPlayerStats('Boston Celtics')).rejects.toThrow('Failed to fetch player stats')
    })

    it('should handle empty response', async () => {
      mappings.getTeamAbbrev.mockReturnValue('BOS')
      api.fetchMySportsFeeds.mockResolvedValue({ playerStatsTotals: null })
      
      const result = await mysportsfeeds.fetchTeamPlayerStats('Boston Celtics')
      expect(result).toEqual([])
    })
  })

  describe('getInjuredPlayers', () => {
    it('should filter injured players', () => {
      const players = [
        {
          player: {
            id: 1,
            currentInjury: { description: 'Ankle sprain', playingProbability: 'OUT' as const }
          }
        } as any,
        {
          player: {
            id: 2,
            currentInjury: null
          }
        } as any
      ]
      
      const injured = mysportsfeeds.getInjuredPlayers(players)
      expect(injured).toHaveLength(1)
      expect(injured[0].player.id).toBe(1)
    })
  })

  describe('getKeyPlayers', () => {
    it('should identify key players by PPG threshold', () => {
      const players = [
        { player: { id: 1 }, averages: { avgPoints: 27.0, avgMinutes: 35.0 } } as any,
        { player: { id: 2 }, averages: { avgPoints: 16.0, avgMinutes: 30.0 } } as any,
        { player: { id: 3 }, averages: { avgPoints: 8.0, avgMinutes: 20.0 } } as any
      ]
      
      const keyPlayers = mysportsfeeds.getKeyPlayers(players)
      expect(keyPlayers.length).toBeGreaterThanOrEqual(2)
      expect(keyPlayers.some(p => p.player.id === 1)).toBe(true)
      expect(keyPlayers.some(p => p.player.id === 2)).toBe(true)
    })

    it('should identify key players by MPG threshold', () => {
      const players = [
        { player: { id: 1 }, averages: { avgPoints: 10.0, avgMinutes: 28.0 } } as any,
        { player: { id: 2 }, averages: { avgPoints: 8.0, avgMinutes: 20.0 } } as any
      ]
      
      const keyPlayers = mysportsfeeds.getKeyPlayers(players)
      expect(keyPlayers.some(p => p.player.id === 1)).toBe(true)
    })

    it('should return at least top 5 scorers', () => {
      const players = Array.from({ length: 10 }, (_, i) => ({
        player: { id: i },
        averages: { avgPoints: 10 - i, avgMinutes: 20 }
      })) as any[]
      
      const keyPlayers = mysportsfeeds.getKeyPlayers(players)
      expect(keyPlayers.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('getInjuredKeyPlayers', () => {
    it('should return intersection of injured and key players', () => {
      const players = [
        {
          player: { id: 1, currentInjury: { description: 'Ankle', playingProbability: 'OUT' as const } },
          averages: { avgPoints: 27.0, avgMinutes: 35.0 }
        } as any,
        {
          player: { id: 2, currentInjury: null },
          averages: { avgPoints: 24.0, avgMinutes: 34.0 }
        } as any,
        {
          player: { id: 3, currentInjury: { description: 'Knee', playingProbability: 'OUT' as const } },
          averages: { avgPoints: 8.0, avgMinutes: 20.0 }
        } as any
      ]
      
      const injuredKeyPlayers = mysportsfeeds.getInjuredKeyPlayers(players)
      expect(injuredKeyPlayers.length).toBe(1)
      expect(injuredKeyPlayers[0].player.id).toBe(1)
    })
  })

  describe('formatPlayerDisplay', () => {
    it('should format injured player correctly', () => {
      const player = {
        player: {
          firstName: 'Jayson',
          lastName: 'Tatum',
          primaryPosition: 'SF',
          currentInjury: {
            description: 'Ankle sprain',
            playingProbability: 'OUT' as const
          }
        },
        averages: {
          avgPoints: 27.0
        }
      } as any
      
      const formatted = mysportsfeeds.formatPlayerDisplay(player)
      expect(formatted).toContain('Jayson Tatum')
      expect(formatted).toContain('SF')
      expect(formatted).toContain('27.0 PPG')
      expect(formatted).toContain('OUT')
      expect(formatted).toContain('Ankle sprain')
    })

    it('should format healthy player correctly', () => {
      const player = {
        player: {
          firstName: 'Jaylen',
          lastName: 'Brown',
          primaryPosition: 'SG',
          currentInjury: null
        },
        averages: {
          avgPoints: 24.0
        }
      } as any
      
      const formatted = mysportsfeeds.formatPlayerDisplay(player)
      expect(formatted).toContain('Jaylen Brown')
      expect(formatted).toContain('SG')
      expect(formatted).toContain('24.0 PPG')
      expect(formatted).not.toContain('OUT')
    })
  })
})

