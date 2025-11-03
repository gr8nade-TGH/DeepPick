/**
 * MySportsFeeds Supabase Cache
 *
 * Stores team stats in Supabase to persist across serverless function cold starts
 * This solves the rate limiting issue where in-memory cache is reset on every cold start
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getNBASeason } from './season-utils'

export interface TeamFormData {
  team: string
  pace: number
  ortg: number
  drtg: number
  threeP_pct: number
  threeP_rate: number // 3PAR
  ft_rate: number     // FTr
  gamesAnalyzed: number // Number of games used in calculation
  avgTurnovers: number // Average turnovers per game (for SPREAD factor S2)

  // Rebounding data (for SPREAD factor S3)
  avgOffReb: number // Offensive rebounds per game
  avgDefReb: number // Defensive rebounds per game
  avgOppOffReb: number // Opponent offensive rebounds per game
  avgOppDefReb: number // Opponent defensive rebounds per game

  // Four Factors data (for SPREAD factor S5)
  avgEfg: number // Effective Field Goal %
  avgTovPct: number // Turnover %
  avgOrebPct: number // Offensive Rebound %
  avgFtr: number // Free Throw Rate

  // Home/Away splits (for SPREAD factor S4)
  ortgHome?: number // ORtg in home games only
  ortgAway?: number // ORtg in away games only
  drtgHome?: number // DRtg in home games only
  drtgAway?: number // DRtg in away games only
  homeGames?: number // Number of home games analyzed
  awayGames?: number // Number of away games analyzed
}

// Cache TTL: 4 hours (team stats don't change frequently during the day)
const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

/**
 * Get cached team form data from Supabase
 * @param cacheKey - Format: "{teamAbbrev}:{n}" (e.g., "BOS:10")
 * @returns TeamFormData if found and not expired, null otherwise
 */
export async function getCachedTeamForm(cacheKey: string): Promise<TeamFormData | null> {
  try {
    const supabase = getSupabaseAdmin()
    const now = new Date()

    // Parse cache key to get team and limit
    const [team, limitStr] = cacheKey.split(':')
    const limit = parseInt(limitStr, 10)
    const season = 'current' // Always use 'current' season

    const { data, error } = await supabase
      .from('team_stats_cache')
      .select('*')
      .eq('team', team)
      .eq('season', season)
      .eq('limit_games', limit)
      .gt('expires_at', now.toISOString())
      .maybeSingle()

    if (error) {
      console.error('[MySportsFeeds Cache] Error fetching from cache:', error)
      return null
    }

    if (!data) {
      console.log(`[MySportsFeeds Cache] Cache MISS for ${cacheKey}`)
      return null
    }

    const age = now.getTime() - new Date(data.cached_at).getTime()
    console.log(`[MySportsFeeds Cache] Cache HIT for ${cacheKey} (age: ${(age / 1000 / 60).toFixed(1)} minutes)`)

    return data.data as TeamFormData
  } catch (error) {
    console.error('[MySportsFeeds Cache] Error in getCachedTeamForm:', error)
    return null
  }
}

/**
 * Set cached team form data in Supabase
 * @param cacheKey - Format: "{teamAbbrev}:{n}" (e.g., "BOS:10")
 * @param data - Team form data to cache
 */
export async function setCachedTeamForm(cacheKey: string, data: TeamFormData): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS)

    // Parse cache key to get team and limit
    const [team, limitStr] = cacheKey.split(':')
    const limit = parseInt(limitStr, 10)
    const season = 'current' // Always use 'current' season

    const { error } = await supabase
      .from('team_stats_cache')
      .upsert({
        team,
        season,
        limit_games: limit,
        data,
        cached_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'team,season,limit_games'
      })

    if (error) {
      console.error('[MySportsFeeds Cache] Error setting cache:', error)
    } else {
      console.log(`[MySportsFeeds Cache] Cached team form for ${cacheKey} (expires in ${CACHE_TTL_MS / 1000 / 60} minutes)`)
    }
  } catch (error) {
    console.error('[MySportsFeeds Cache] Error in setCachedTeamForm:', error)
  }
}

/**
 * Clear expired cache entries (can be called periodically)
 */
export async function clearExpiredCache(): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    const now = new Date()

    const { error } = await supabase
      .from('team_stats_cache')
      .delete()
      .lt('expires_at', now.toISOString())

    if (error) {
      console.error('[MySportsFeeds Cache] Error clearing expired cache:', error)
    } else {
      console.log('[MySportsFeeds Cache] Cleared expired cache entries')
    }
  } catch (error) {
    console.error('[MySportsFeeds Cache] Error in clearExpiredCache:', error)
  }
}

