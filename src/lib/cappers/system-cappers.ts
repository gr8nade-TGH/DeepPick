/**
 * System Cappers Registry
 * 
 * Centralized module for fetching system cappers from the database.
 * This replaces all hardcoded SYSTEM_CAPPERS arrays throughout the codebase.
 * 
 * System cappers are stored in the `user_cappers` table with `is_system_capper = true`
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'

export interface SystemCapper {
  id: string        // capper_id (lowercase)
  name: string      // display_name
  description?: string
  avatarUrl?: string
  colorTheme?: string
  sport?: string
  betTypes?: string[]
  isActive: boolean
}

// Cache for system cappers (refreshed every 5 minutes)
let cachedSystemCappers: SystemCapper[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch all system cappers from the database
 * Results are cached for 5 minutes to reduce database load
 */
export async function getSystemCappers(): Promise<SystemCapper[]> {
  const now = Date.now()
  
  // Return cached data if still valid
  if (cachedSystemCappers && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedSystemCappers
  }
  
  try {
    const admin = getSupabaseAdmin()
    
    const { data, error } = await admin
      .from('user_cappers')
      .select('capper_id, display_name, description, avatar_url, color_theme, sport, bet_types, is_active')
      .eq('is_system_capper', true)
      .order('display_name')
    
    if (error) {
      console.error('[SystemCappers] Error fetching system cappers:', error)
      // Return empty array on error, don't use stale cache
      return []
    }
    
    const cappers: SystemCapper[] = (data || []).map(c => ({
      id: c.capper_id,
      name: c.display_name,
      description: c.description,
      avatarUrl: c.avatar_url,
      colorTheme: c.color_theme,
      sport: c.sport,
      betTypes: c.bet_types,
      isActive: c.is_active
    }))
    
    // Update cache
    cachedSystemCappers = cappers
    cacheTimestamp = now
    
    console.log(`[SystemCappers] Loaded ${cappers.length} system cappers:`, cappers.map(c => c.id).join(', '))
    
    return cappers
  } catch (error) {
    console.error('[SystemCappers] Unexpected error:', error)
    return []
  }
}

/**
 * Get a Map of capper_id -> display_name for quick lookups
 */
export async function getSystemCapperMap(): Promise<Map<string, string>> {
  const cappers = await getSystemCappers()
  return new Map(cappers.map(c => [c.id, c.name]))
}

/**
 * Check if a capper ID is a system capper
 */
export async function isSystemCapper(capperId: string): Promise<boolean> {
  const cappers = await getSystemCappers()
  return cappers.some(c => c.id === capperId.toLowerCase())
}

/**
 * Get active system cappers only
 */
export async function getActiveSystemCappers(): Promise<SystemCapper[]> {
  const cappers = await getSystemCappers()
  return cappers.filter(c => c.isActive)
}

/**
 * Clear the cache (useful for testing or after adding new cappers)
 */
export function clearSystemCapperCache(): void {
  cachedSystemCappers = null
  cacheTimestamp = 0
  console.log('[SystemCappers] Cache cleared')
}

