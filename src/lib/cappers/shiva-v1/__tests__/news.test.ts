import { describe, it, expect } from '@jest/globals'
import * as news from '../news'
import type { InjuryFinding, PlayerRoster } from '../news'

describe('SHIVA v1 News/Injury Integration', () => {
  describe('calculateMinutesImpact', () => {
    it('returns 0 for available players', () => {
      expect(news.calculateMinutesImpact('available', 'star')).toBe(0)
      expect(news.calculateMinutesImpact('available', 'starter')).toBe(0)
    })

    it('returns 0 for probable players (default)', () => {
      expect(news.calculateMinutesImpact('probable', 'star')).toBe(0)
      expect(news.calculateMinutesImpact('probable', 'starter')).toBe(0)
    })

    it('calculates negative impact for out players', () => {
      expect(news.calculateMinutesImpact('out', 'star')).toBe(-2.0)
      expect(news.calculateMinutesImpact('out', 'starter')).toBe(-1.0)
      expect(news.calculateMinutesImpact('out', 'bench')).toBe(-0.5)
      expect(news.calculateMinutesImpact('out', 'unknown')).toBe(-1.0)
    })

    it('calculates negative impact for doubtful players', () => {
      expect(news.calculateMinutesImpact('doubtful', 'star')).toBe(-2.0)
      expect(news.calculateMinutesImpact('doubtful', 'starter')).toBe(-1.0)
    })

    it('calculates half impact for questionable players', () => {
      expect(news.calculateMinutesImpact('questionable', 'star')).toBe(-1.0)
      expect(news.calculateMinutesImpact('questionable', 'starter')).toBe(-0.5)
    })

    it('returns positive impact for returning players with restriction', () => {
      expect(news.calculateMinutesImpact('questionable', 'star', true)).toBe(0.5)
      expect(news.calculateMinutesImpact('doubtful', 'star', true)).toBe(0.5)
    })
  })

  describe('calculateNewsEdge', () => {
    it('sums impacts from multiple findings', () => {
      const findings: InjuryFinding[] = [
        { team: 'OKC', player: 'Player A', status: 'out', minutesImpact: -2.0, sourceUrl: 'url1' },
        { team: 'OKC', player: 'Player B', status: 'out', minutesImpact: -1.0, sourceUrl: 'url2' },
      ]
      
      expect(news.calculateNewsEdge(findings)).toBe(-3.0)
    })

    it('caps total edge at +3.0', () => {
      const findings: InjuryFinding[] = [
        { team: 'OKC', player: 'Player A', status: 'questionable', minutesImpact: 2.0, sourceUrl: 'url1' },
        { team: 'OKC', player: 'Player B', status: 'questionable', minutesImpact: 2.0, sourceUrl: 'url2' },
        { team: 'OKC', player: 'Player C', status: 'questionable', minutesImpact: 1.0, sourceUrl: 'url3' },
      ]
      
      expect(news.calculateNewsEdge(findings)).toBe(3.0)
    })

    it('caps total edge at -3.0', () => {
      const findings: InjuryFinding[] = [
        { team: 'OKC', player: 'Player A', status: 'out', minutesImpact: -2.0, sourceUrl: 'url1' },
        { team: 'OKC', player: 'Player B', status: 'out', minutesImpact: -2.0, sourceUrl: 'url2' },
        { team: 'OKC', player: 'Player C', status: 'out', minutesImpact: -1.0, sourceUrl: 'url3' },
      ]
      
      expect(news.calculateNewsEdge(findings)).toBe(-3.0)
    })

    it('handles mixed positive and negative impacts', () => {
      const findings: InjuryFinding[] = [
        { team: 'OKC', player: 'Player A', status: 'out', minutesImpact: -2.0, sourceUrl: 'url1' },
        { team: 'OKC', player: 'Player B', status: 'questionable', minutesImpact: 0.5, sourceUrl: 'url2' },
      ]
      
      expect(news.calculateNewsEdge(findings)).toBe(-1.5)
    })

    it('returns 0 for no findings', () => {
      expect(news.calculateNewsEdge([])).toBe(0)
    })
  })

  describe('parseInjuryStatus', () => {
    it('parses "out" status', () => {
      expect(news.parseInjuryStatus('Player is out')).toBe('out')
      expect(news.parseInjuryStatus('OUT for game')).toBe('out')
    })

    it('parses "doubtful" status', () => {
      expect(news.parseInjuryStatus('Player is doubtful')).toBe('doubtful')
      expect(news.parseInjuryStatus('DOUBTFUL to play')).toBe('doubtful')
    })

    it('parses "questionable" status', () => {
      expect(news.parseInjuryStatus('Player is questionable')).toBe('questionable')
      expect(news.parseInjuryStatus('QUESTIONABLE for tonight')).toBe('questionable')
    })

    it('parses "probable" status', () => {
      expect(news.parseInjuryStatus('Player is probable')).toBe('probable')
      expect(news.parseInjuryStatus('PROBABLE to play')).toBe('probable')
    })

    it('defaults to "available" for unclear status', () => {
      expect(news.parseInjuryStatus('Player will play')).toBe('available')
      expect(news.parseInjuryStatus('No injury')).toBe('available')
    })
  })

  describe('getPlayerRole', () => {
    const mockRoster: PlayerRoster = {
      'Oklahoma City Thunder': {
        'Shai Gilgeous-Alexander': 'star',
        'Jalen Williams': 'starter',
        'Isaiah Joe': 'bench',
      },
    }

    it('returns correct role from roster', () => {
      expect(news.getPlayerRole('Shai Gilgeous-Alexander', 'Oklahoma City Thunder', mockRoster)).toBe('star')
      expect(news.getPlayerRole('Jalen Williams', 'Oklahoma City Thunder', mockRoster)).toBe('starter')
      expect(news.getPlayerRole('Isaiah Joe', 'Oklahoma City Thunder', mockRoster)).toBe('bench')
    })

    it('returns unknown for player not in roster', () => {
      expect(news.getPlayerRole('Unknown Player', 'Oklahoma City Thunder', mockRoster)).toBe('unknown')
    })

    it('returns unknown for team not in roster', () => {
      expect(news.getPlayerRole('Player', 'Houston Rockets', mockRoster)).toBe('unknown')
    })

    it('returns unknown when no roster provided', () => {
      expect(news.getPlayerRole('Player', 'Oklahoma City Thunder')).toBe('unknown')
    })
  })

  describe('buildSearchQueries', () => {
    it('builds correct search queries', () => {
      const queries = news.buildSearchQueries('Oklahoma City Thunder', 'Houston Rockets', 48)
      
      expect(queries).toHaveLength(3)
      expect(queries[0]).toBe('Oklahoma City Thunder injury report last 48 hours')
      expect(queries[1]).toBe('Oklahoma City Thunder vs Houston Rockets injuries')
      expect(queries[2]).toBe('Oklahoma City Thunder status questionable doubtful out minutes restriction')
    })

    it('uses custom window hours', () => {
      const queries = news.buildSearchQueries('Lakers', 'Warriors', 72)
      expect(queries[0]).toBe('Lakers injury report last 72 hours')
    })
  })

  describe('Edge Calculation Examples', () => {
    it('Example 1: Two findings with proper cap', () => {
      const findings: InjuryFinding[] = [
        { team: 'OKC', player: 'Star Player', status: 'out', minutesImpact: -2.0, sourceUrl: 'nba.com' },
        { team: 'OKC', player: 'Bench Player', status: 'doubtful', minutesImpact: -0.5, sourceUrl: 'espn.com' },
      ]
      
      const edge = news.calculateNewsEdge(findings)
      expect(edge).toBe(-2.5)
      expect(edge).toBeGreaterThanOrEqual(-3.0)
      expect(edge).toBeLessThanOrEqual(3.0)
    })

    it('Example 2: Cap behavior at -3.0', () => {
      const findings: InjuryFinding[] = [
        { team: 'HOU', player: 'Player 1', status: 'out', minutesImpact: -2.0, sourceUrl: 'url1' },
        { team: 'HOU', player: 'Player 2', status: 'out', minutesImpact: -2.0, sourceUrl: 'url2' },
      ]
      
      const edge = news.calculateNewsEdge(findings)
      expect(edge).toBe(-3.0) // Capped from -4.0
    })

    it('Example 3: Mixed impacts', () => {
      const findings: InjuryFinding[] = [
        { team: 'OKC', player: 'Returning Star', status: 'questionable', minutesImpact: 0.5, sourceUrl: 'url1' },
        { team: 'OKC', player: 'Out Player', status: 'out', minutesImpact: -1.0, sourceUrl: 'url2' },
      ]
      
      const edge = news.calculateNewsEdge(findings)
      expect(edge).toBe(-0.5)
    })
  })
})

