import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { StatMuseNumeric } from '../statmuse'

// Mock fetch for testing
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

// We need to dynamically import after mocking
let statmuse: typeof import('../statmuse')

beforeEach(async () => {
  jest.clearAllMocks()
  // Re-import to get fresh cache
  jest.resetModules()
  statmuse = await import('../statmuse')
})

describe('SHIVA v1 StatMuse Integration', () => {
  describe('Query Builders', () => {
    it('builds net rating query', () => {
      const result = statmuse.buildQuery.netRating('Oklahoma City Thunder')
      expect(result.query).toBe('Oklahoma City Thunder net rating this season')
      expect(result.unit).toBe('per100')
    })

    it('builds offensive rating query', () => {
      const result = statmuse.buildQuery.offensiveRating('Houston Rockets')
      expect(result.query).toBe('Houston Rockets offensive rating this season')
      expect(result.unit).toBe('per100')
    })

    it('builds defensive rating query', () => {
      const result = statmuse.buildQuery.defensiveRating('Houston Rockets')
      expect(result.query).toBe('Houston Rockets defensive rating this season')
      expect(result.unit).toBe('per100')
    })

    it('builds pace query', () => {
      const result = statmuse.buildQuery.pace('New York Knicks')
      expect(result.query).toBe('New York Knicks pace this season')
      expect(result.unit).toBe('pace')
    })

    it('builds last N games query', () => {
      const result = statmuse.buildQuery.netRatingLastN('Golden State Warriors', 10)
      expect(result.query).toBe('Golden State Warriors net rating last 10 games')
      expect(result.unit).toBe('per100')
    })

    it('builds PPG vs opponent query', () => {
      const result = statmuse.buildQuery.ppgVs('Oklahoma City Thunder', 'Houston Rockets')
      expect(result.query).toBe('Oklahoma City Thunder points per game vs Houston Rockets this season')
      expect(result.unit).toBe('ppg')
    })

    it('builds 3PA query', () => {
      const result = statmuse.buildQuery.threePtAttempts('Atlanta Hawks')
      expect(result.query).toBe('Atlanta Hawks 3 point attempts per game this season')
      expect(result.unit).toBe('rate')
    })

    it('builds 3P% query', () => {
      const result = statmuse.buildQuery.threePtPct('Atlanta Hawks')
      expect(result.query).toBe('Atlanta Hawks 3 point percentage this season')
      expect(result.unit).toBe('percent')
    })

    it('builds opponent 3PA query', () => {
      const result = statmuse.buildQuery.oppThreePtAttempts('Atlanta Hawks')
      expect(result.query).toBe('Atlanta Hawks opponent 3 point attempts per game this season')
      expect(result.unit).toBe('rate')
    })
  })

  describe('Parser - Fixture Tests', () => {
    it('A) parses ORtg', async () => {
      const mockHTML = `
        <html>
          <body>
            <div class="answer">The Oklahoma City Thunder have an offensive rating of 116.2 this season.</div>
          </body>
        </html>
      `
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const result = await statmuse.askStatMuse(
        'Oklahoma City Thunder offensive rating this season',
        'per100'
      )

      expect(result.ok).toBe(true)
      expect(result.value).toBe(116.2)
      expect(result.unit).toBe('per100')
      expect(result.provider).toBe('statmuse')
    })

    it('B) parses DRtg', async () => {
      const mockHTML = `
        <html>
          <body>
            <div>The Houston Rockets have a defensive rating of 110.9 this season.</div>
          </body>
        </html>
      `
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const result = await statmuse.askStatMuse(
        'Houston Rockets defensive rating this season',
        'per100'
      )

      expect(result.ok).toBe(true)
      expect(result.value).toBe(110.9)
      expect(result.unit).toBe('per100')
    })

    it('C) parses Net last 10', async () => {
      const mockHTML = `
        <html>
          <body>
            <div>The Warriors have a net rating of 9.2 in their last 10 games.</div>
          </body>
        </html>
      `
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const result = await statmuse.askStatMuse(
        'Golden State Warriors net rating last 10 games',
        'per100'
      )

      expect(result.ok).toBe(true)
      expect(result.value).toBe(9.2)
    })

    it('D) parses Pace', async () => {
      const mockHTML = `
        <html>
          <body>
            <div>The Knicks have a pace of 98.7 this season.</div>
          </body>
        </html>
      `
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const result = await statmuse.askStatMuse(
        'New York Knicks pace this season',
        'pace'
      )

      expect(result.ok).toBe(true)
      expect(result.value).toBe(98.7)
      expect(result.unit).toBe('pace')
    })

    it('E) parses PPG vs opponent', async () => {
      const mockHTML = `
        <html>
          <body>
            <div>The Oklahoma City Thunder have averaged 118.0 points per game against the Houston Rockets this season.</div>
          </body>
        </html>
      `
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const result = await statmuse.askStatMuse(
        'Oklahoma City Thunder points per game vs Houston Rockets this season',
        'ppg'
      )

      expect(result.ok).toBe(true)
      expect(result.value).toBe(118.0)
      expect(result.unit).toBe('ppg')
    })

    it('F1) parses 3PA', async () => {
      const mockHTML = `
        <html>
          <body>
            <div>The Hawks have attempted 39.7 three-pointers per game this season.</div>
          </body>
        </html>
      `
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const result = await statmuse.askStatMuse(
        'Atlanta Hawks 3 point attempts per game this season',
        'rate'
      )

      expect(result.ok).toBe(true)
      expect(result.value).toBe(39.7)
      expect(result.unit).toBe('rate')
    })

    it('F2) parses 3P%', async () => {
      const mockHTML = `
        <html>
          <body>
            <div>The Hawks have shot 37.1% from three this season.</div>
          </body>
        </html>
      `
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const result = await statmuse.askStatMuse(
        'Atlanta Hawks 3 point percentage this season',
        'percent'
      )

      expect(result.ok).toBe(true)
      expect(result.value).toBe(37.1)
      expect(result.unit).toBe('percent')
    })

    it('F3) parses Opp 3PA', async () => {
      const mockHTML = `
        <html>
          <body>
            <div>The Hawks have allowed 35.9 opponent three-point attempts per game this season.</div>
          </body>
        </html>
      `
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const result = await statmuse.askStatMuse(
        'Atlanta Hawks opponent 3 point attempts per game this season',
        'rate'
      )

      expect(result.ok).toBe(true)
      expect(result.value).toBe(35.9)
      expect(result.unit).toBe('rate')
    })

    it('G) handles parse failure', async () => {
      const mockHTML = `
        <html>
          <body>
            <div>No results found.</div>
          </body>
        </html>
      `
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const result = await statmuse.askStatMuse(
        'Invalid team query',
        'per100'
      )

      expect(result.ok).toBe(false)
      expect(result.value).toBeUndefined()
    })
  })

  describe('Caching', () => {
    it('returns cached result on second call', async () => {
      const mockHTML = '<div>The Thunder have an offensive rating of 116.2 this season.</div>'
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      // First call - cache miss
      const result1 = await statmuse.askStatMuse(
        'Oklahoma City Thunder offensive rating this season',
        'per100'
      )
      expect(result1.cache).toBe('miss')
      expect(result1.value).toBe(116.2)

      // Second call - cache hit
      const result2 = await statmuse.askStatMuse(
        'Oklahoma City Thunder offensive rating this season',
        'per100'
      )
      expect(result2.cache).toBe('hit')
      expect(result2.value).toBe(116.2)
      
      // Fetch should only have been called once
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Batch Processing', () => {
    it('deduplicates identical queries', async () => {
      const mockHTML = '<div>The Thunder have an offensive rating of 116.2 this season.</div>'
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const queries = [
        { query: 'Oklahoma City Thunder offensive rating this season', unit: 'per100' as const },
        { query: 'Oklahoma City Thunder offensive rating this season', unit: 'per100' as const },
        { query: 'Houston Rockets defensive rating this season', unit: 'per100' as const },
      ]

      const results = await statmuse.runBatch(queries)

      expect(results).toHaveLength(3)
      expect(results[0].value).toBe(results[1].value) // Same query, same result
      expect(global.fetch).toHaveBeenCalledTimes(2) // Only 2 unique queries
    })

    it('processes queries with max concurrency of 4', async () => {
      const mockHTML = '<div>Value: 100.0</div>'
      
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      } as Response)

      const queries = Array(10).fill(null).map((_, i) => ({
        query: `Team ${i} rating`,
        unit: 'per100' as const,
      }))

      const results = await statmuse.runBatch(queries)

      expect(results).toHaveLength(10)
      expect(global.fetch).toHaveBeenCalledTimes(10)
    })
  })

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      )

      const result = await statmuse.askStatMuse(
        'Oklahoma City Thunder offensive rating this season',
        'per100'
      )

      expect(result.ok).toBe(false)
      expect(result.provider).toBe('statmuse')
    })

    it('handles non-200 responses', async () => {
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      const result = await statmuse.askStatMuse(
        'Invalid query',
        'per100'
      )

      expect(result.ok).toBe(false)
    })
  })
})

