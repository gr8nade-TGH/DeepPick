/**
 * SHIVA v1 News/Injury Integration
 * Searches for injury reports and calculates impact on game edge
 */

import { createHash } from 'crypto'

// ============================================================================
// TYPES
// ============================================================================

export type InjuryStatus = 'out' | 'doubtful' | 'questionable' | 'probable' | 'available'

export interface InjuryFinding {
  team: string
  player: string
  status: InjuryStatus
  minutesImpact: number // positive or negative per 100
  sourceUrl: string
}

export interface NewsEdge {
  ok: boolean
  findings: InjuryFinding[]
  edgePer100: number // capped in [-3.0, +3.0]
  windowHours: number
  latencyMs: number
  cache: 'hit' | 'miss'
}

// ============================================================================
// PLAYER IMPACT MAPPING
// ============================================================================

export type PlayerRole = 'star' | 'starter' | 'bench' | 'unknown'

export interface PlayerRoster {
  [team: string]: {
    [player: string]: PlayerRole
  }
}

// Default impact per role (per 100 possessions)
const IMPACT_MAP: Record<PlayerRole, number> = {
  star: -2.0, // Star out
  starter: -1.0, // Key starter out
  bench: -0.5, // Key bench out
  unknown: -1.0, // Conservative default
}

// Returning player with minutes restriction
const RETURNING_IMPACT = 0.5

// Total edge cap
const EDGE_CAP = 3.0

/**
 * Calculate minutes impact for a player
 */
export function calculateMinutesImpact(
  status: InjuryStatus,
  role: PlayerRole,
  isReturning: boolean = false
): number {
  if (status === 'available') return 0
  if (status === 'probable') return 0 // Treat probable as 0 impact by default

  // Returning player with restriction (out → questionable, limited mins)
  if (isReturning && (status === 'questionable' || status === 'doubtful')) {
    return RETURNING_IMPACT
  }

  // Out or doubtful - apply negative impact
  if (status === 'out' || status === 'doubtful') {
    return IMPACT_MAP[role]
  }

  // Questionable - apply half impact
  if (status === 'questionable') {
    return IMPACT_MAP[role] / 2
  }

  return 0
}

/**
 * Calculate total edge from injury findings
 */
export function calculateNewsEdge(findings: InjuryFinding[]): number {
  const totalImpact = findings.reduce((sum, finding) => sum + finding.minutesImpact, 0)
  
  // Apply cap
  return Math.max(-EDGE_CAP, Math.min(EDGE_CAP, totalImpact))
}

// ============================================================================
// CACHE SYSTEM
// ============================================================================

interface CacheEntry {
  value: NewsEdge
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function getCacheKey(team: string, opponent: string, windowHours: number): string {
  return createHash('sha1')
    .update(`${team}:${opponent}:${windowHours}`)
    .digest('hex')
}

function getCached(team: string, opponent: string, windowHours: number): NewsEdge | null {
  const key = getCacheKey(team, opponent, windowHours)
  const entry = cache.get(key)
  if (!entry) return null

  const age = Date.now() - entry.timestamp
  if (age > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }

  return entry.value
}

function setCache(team: string, opponent: string, windowHours: number, value: NewsEdge): void {
  const key = getCacheKey(team, opponent, windowHours)
  cache.set(key, {
    value,
    timestamp: Date.now(),
  })
}

// ============================================================================
// NEWS SOURCES (RANKED)
// ============================================================================

const NEWS_SOURCES = [
  'https://www.nba.com/injury-report',
  // Team official sites would be dynamically constructed
  'https://www.espn.com/nba/injuries',
  'https://www.theathletic.com/nba/injuries/',
  'https://apnews.com/hub/nba',
  'https://www.rotowire.com/basketball/injuries.php',
  'https://underdogfantasy.com/nba/news',
] as const

/**
 * Build search queries for a team and matchup
 */
export function buildSearchQueries(team: string, opponent: string, windowHours: number): string[] {
  return [
    `${team} injury report last ${windowHours} hours`,
    `${team} vs ${opponent} injuries`,
    `${team} status questionable doubtful out minutes restriction`,
  ]
}

// ============================================================================
// FETCH WITH RETRIES
// ============================================================================

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
// INJURY SEARCH
// ============================================================================

/**
 * Search for injuries for a team
 * @param team Team name
 * @param opponent Opponent name (for matchup context)
 * @param windowHours Time window in hours (default 48)
 * @param roster Player roster with roles (optional)
 * @returns NewsEdge with findings and calculated edge
 */
export async function searchInjuries(
  team: string,
  opponent: string = '',
  windowHours: number = 48,
  roster?: PlayerRoster
): Promise<NewsEdge> {
  const startTime = Date.now()

  // Check cache first
  const cachedResult = getCached(team, opponent, windowHours)
  if (cachedResult) {
    return {
      ...cachedResult,
      cache: 'hit',
      latencyMs: Date.now() - startTime,
    }
  }

  try {
    // In production, this would:
    // 1. Query multiple sources (nba.com, team site, ESPN, etc.)
    // 2. Parse HTML/JSON responses
    // 3. Extract player status information
    // 4. Deduplicate across sources (prefer team site → NBA → ESPN)
    // 5. Filter by recency (windowHours)
    // 6. Match against roster to determine role
    // 7. Calculate impact per player
    // 8. Sum and cap total edge

    // For now, return a placeholder structure
    const findings: InjuryFinding[] = []

    // TODO: Implement actual injury search
    // This is where we would scrape/query news sources

    const edgePer100 = calculateNewsEdge(findings)

    const result: NewsEdge = {
      ok: true,
      findings,
      edgePer100,
      windowHours,
      latencyMs: Date.now() - startTime,
      cache: 'miss',
    }

    // Cache result
    setCache(team, opponent, windowHours, result)

    // Log
    console.log('[News]', {
      team,
      opponent,
      windowHours,
      findingsCount: findings.length,
      edgePer100,
      latencyMs: result.latencyMs,
      cacheHit: false,
    })

    return result
  } catch (error) {
    const result: NewsEdge = {
      ok: false,
      findings: [],
      edgePer100: 0,
      windowHours,
      latencyMs: Date.now() - startTime,
      cache: 'miss',
    }

    console.error('[News]', {
      team,
      opponent,
      windowHours,
      latencyMs: result.latencyMs,
      cacheHit: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return result
  }
}

/**
 * Parse injury status from text
 */
export function parseInjuryStatus(text: string): InjuryStatus {
  const lower = text.toLowerCase()
  
  if (lower.includes('out')) return 'out'
  if (lower.includes('doubtful')) return 'doubtful'
  if (lower.includes('questionable')) return 'questionable'
  if (lower.includes('probable')) return 'probable'
  
  return 'available'
}

/**
 * Extract player role from roster
 */
export function getPlayerRole(
  player: string,
  team: string,
  roster?: PlayerRoster
): PlayerRole {
  if (!roster || !roster[team]) return 'unknown'
  return roster[team][player] || 'unknown'
}
