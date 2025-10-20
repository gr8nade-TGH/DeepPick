/**
 * SHIVA v1 StatMuse Integration
 * Templated queries for NBA team stats with exact query strings
 */

import { createHash } from 'crypto'

// ============================================================================
// TYPES
// ============================================================================

export type StatMuseUnit = 'per100' | 'ppg' | 'pace' | 'rate' | 'percent' | 'count'

export interface StatMuseNumeric {
  ok: boolean
  value?: number
  unit: StatMuseUnit
  rawText?: string
  query: string
  provider: 'statmuse'
  cache: 'hit' | 'miss'
  latencyMs: number
}

// ============================================================================
// QUERY BUILDERS (Exact Templates)
// ============================================================================

export const buildQuery = {
  /**
   * Team net rating this season
   */
  netRating(team: string): { query: string; unit: StatMuseUnit } {
    return {
      query: `${team} net rating this season`,
      unit: 'per100',
    }
  },

  /**
   * Team offensive rating this season
   */
  offensiveRating(team: string): { query: string; unit: StatMuseUnit } {
    return {
      query: `${team} offensive rating this season`,
      unit: 'per100',
    }
  },

  /**
   * Team defensive rating this season
   */
  defensiveRating(team: string): { query: string; unit: StatMuseUnit } {
    return {
      query: `${team} defensive rating this season`,
      unit: 'per100',
    }
  },

  /**
   * Team pace this season
   */
  pace(team: string): { query: string; unit: StatMuseUnit } {
    return {
      query: `${team} pace this season`,
      unit: 'pace',
    }
  },

  /**
   * Team net rating last N games
   */
  netRatingLastN(team: string, n: number = 10): { query: string; unit: StatMuseUnit } {
    return {
      query: `${team} net rating last ${n} games`,
      unit: 'per100',
    }
  },

  /**
   * Team PPG vs opponent this season
   */
  ppgVs(team: string, opponent: string): { query: string; unit: StatMuseUnit } {
    return {
      query: `${team} points per game vs ${opponent} this season`,
      unit: 'ppg',
    }
  },

  /**
   * Team 3-point attempts per game this season
   */
  threePtAttempts(team: string): { query: string; unit: StatMuseUnit } {
    return {
      query: `${team} 3 point attempts per game this season`,
      unit: 'rate',
    }
  },

  /**
   * Team 3-point percentage this season
   */
  threePtPct(team: string): { query: string; unit: StatMuseUnit } {
    return {
      query: `${team} 3 point percentage this season`,
      unit: 'percent',
    }
  },

  /**
   * Opponent 3-point attempts allowed per game this season
   */
  oppThreePtAttempts(team: string): { query: string; unit: StatMuseUnit } {
    return {
      query: `${team} opponent 3 point attempts per game this season`,
      unit: 'rate',
    }
  },
}

// ============================================================================
// CACHE SYSTEM
// ============================================================================

interface CacheEntry {
  value: StatMuseNumeric
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

// TTL: 10 min for season stats, 5 min for recent/matchup stats
function getCacheTTL(query: string): number {
  if (query.includes('last') || query.includes('vs')) {
    return 5 * 60 * 1000 // 5 minutes
  }
  return 10 * 60 * 1000 // 10 minutes
}

function getCacheKey(query: string): string {
  return createHash('sha1').update(query).digest('hex')
}

function getCached(query: string): StatMuseNumeric | null {
  const key = getCacheKey(query)
  const entry = cache.get(key)
  if (!entry) return null

  const age = Date.now() - entry.timestamp
  const ttl = getCacheTTL(query)
  
  if (age > ttl) {
    cache.delete(key)
    return null
  }

  return entry.value
}

function setCache(query: string, value: StatMuseNumeric): void {
  const key = getCacheKey(query)
  cache.set(key, {
    value,
    timestamp: Date.now(),
  })
}

// ============================================================================
// PARSER
// ============================================================================

/**
 * Strip HTML tags and collapse whitespace
 */
function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Parse numeric value from StatMuse text response
 * @param text Cleaned text response
 * @param unit Expected unit type
 * @returns Parsed number or null
 */
function parseStatMuseValue(text: string, unit: StatMuseUnit): number | null {
  if (unit === 'percent') {
    // Look for percentage (e.g., "37.1%")
    const match = text.match(/(\d+\.\d+)%/)
    if (match) return parseFloat(match[1])
  }

  // For all other units, look for first number with one decimal
  // Prefer numbers with decimals for ratings/pace/rates
  const decimalMatch = text.match(/[-+]?(\d+\.\d+)/)
  if (decimalMatch) return parseFloat(decimalMatch[0])

  // Fallback to any number
  const intMatch = text.match(/[-+]?(\d+)/)
  if (intMatch) return parseFloat(intMatch[0])

  return null
}

// ============================================================================
// FETCH WITH RETRIES
// ============================================================================

/**
 * Fetch with timeout and retries
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 2
): Promise<Response> {
  const delays = [300, 900] // Exponential backoff: 300ms, 900ms
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000) // 6s timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]))
      } else {
        throw error
      }
    }
  }

  throw new Error('Max retries exceeded')
}

// ============================================================================
// STATMUSE API INTERACTION
// ============================================================================

/**
 * Ask StatMuse a question and parse the numeric response
 */
export async function askStatMuse(
  query: string,
  unit: StatMuseUnit
): Promise<StatMuseNumeric> {
  const startTime = Date.now()

  // Check cache first
  const cachedResult = getCached(query)
  if (cachedResult) {
    return {
      ...cachedResult,
      cache: 'hit',
      latencyMs: Date.now() - startTime,
    }
  }

  try {
    const encodedQuery = encodeURIComponent(query)
    const url = `https://www.statmuse.com/nba/ask/${encodedQuery}`

    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'SHIVA/1.0 (+service)',
        'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      const result: StatMuseNumeric = {
        ok: false,
        unit,
        query,
        provider: 'statmuse',
        cache: 'miss',
        latencyMs: Date.now() - startTime,
      }
      
      // Log structured error
      console.error('[StatMuse]', {
        query,
        status: response.status,
        latencyMs: result.latencyMs,
        cacheHit: false,
        error: `HTTP ${response.status}`,
      })
      
      return result
    }

    const html = await response.text()
    const cleanText = stripHTML(html)
    const value = parseStatMuseValue(cleanText, unit)

    if (value === null) {
      const result: StatMuseNumeric = {
        ok: false,
        unit,
        rawText: cleanText.substring(0, 200),
        query,
        provider: 'statmuse',
        cache: 'miss',
        latencyMs: Date.now() - startTime,
      }

      console.error('[StatMuse]', {
        query,
        status: response.status,
        latencyMs: result.latencyMs,
        cacheHit: false,
        error: 'Parse failure',
      })

      return result
    }

    const result: StatMuseNumeric = {
      ok: true,
      value,
      unit,
      rawText: cleanText.substring(0, 200),
      query,
      provider: 'statmuse',
      cache: 'miss',
      latencyMs: Date.now() - startTime,
    }

    // Cache successful result
    setCache(query, result)

    // Log structured success
    console.log('[StatMuse]', {
      query,
      status: response.status,
      latencyMs: result.latencyMs,
      cacheHit: false,
    })

    return result
  } catch (error) {
    const result: StatMuseNumeric = {
      ok: false,
      unit,
      query,
      provider: 'statmuse',
      cache: 'miss',
      latencyMs: Date.now() - startTime,
    }

    console.error('[StatMuse]', {
      query,
      status: 0,
      latencyMs: result.latencyMs,
      cacheHit: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return result
  }
}

// ============================================================================
// BATCH INTERFACE
// ============================================================================

/**
 * Run batch queries with deduplication and concurrency limit
 */
export async function runBatch(
  queries: Array<{ query: string; unit: StatMuseUnit }>
): Promise<StatMuseNumeric[]> {
  // Deduplicate by query string
  const uniqueQueries = new Map<string, { query: string; unit: StatMuseUnit; indices: number[] }>()
  
  queries.forEach((q, index) => {
    const existing = uniqueQueries.get(q.query)
    if (existing) {
      existing.indices.push(index)
    } else {
      uniqueQueries.set(q.query, { ...q, indices: [index] })
    }
  })

  // Process with max concurrency of 4
  const MAX_CONCURRENCY = 4
  const uniqueArray = Array.from(uniqueQueries.values())
  const results = new Map<string, StatMuseNumeric>()

  for (let i = 0; i < uniqueArray.length; i += MAX_CONCURRENCY) {
    const batch = uniqueArray.slice(i, i + MAX_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(q => askStatMuse(q.query, q.unit))
    )
    
    batchResults.forEach((result, idx) => {
      results.set(batch[idx].query, result)
    })
  }

  // Map back to original order
  return queries.map(q => results.get(q.query)!)
}
