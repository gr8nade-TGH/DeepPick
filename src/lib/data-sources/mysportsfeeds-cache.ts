/**
 * MySportsFeeds Supabase Cache
 * 
 * Stores team stats in Supabase to persist across serverless function cold starts
 * This solves the rate limiting issue where in-memory cache is reset on every cold start
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'

export interface TeamFormData {
  team: string
  pace: number
  ortg: number
  drtg: number
  threeP_pct: number
  threeP_rate: number
  ft_rate: number
  gamesAnalyzed: number
}

interface CacheEntry {
  cache_key: string
  data: TeamFormData
  created_at: string
  expires_at: string
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

    const { data, error } = await supabase
      .from('mysportsfeeds_cache')
      .select('*')
      .eq('cache_key', cacheKey)
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

    const age = now.getTime() - new Date(data.created_at).getTime()
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

    const { error } = await supabase
      .from('mysportsfeeds_cache')
      .upsert({
        cache_key: cacheKey,
        data,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'cache_key'
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
      .from('mysportsfeeds_cache')
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

