/**
 * DEEP Eligibility Module
 *
 * Determines which cappers are eligible to contribute to DEEP consensus.
 * Only cappers with positive unit records can influence DEEP picks.
 * 
 * SCALABILITY: Designed for 100+ cappers with caching and efficient queries.
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { EligibleCapper } from './types'

// Cache for eligible cappers (10 minutes for scalability)
let cachedCappers: EligibleCapper[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes (up from 5 for scale)

/**
 * Get all system cappers eligible to contribute to DEEP consensus.
 * 
 * Eligibility criteria:
 * - is_system_capper = true (AI cappers only)
 * - net_units > 0 (must be profitable)
 * - Excludes DEEP itself
 * 
 * Uses capper_stats materialized view for performance.
 */
export async function getEligibleCappers(): Promise<EligibleCapper[]> {
  const now = Date.now()

  // Return cached if valid
  if (cachedCappers && (now - cacheTimestamp) < CACHE_TTL_MS) {
    console.log(`[DEEP:Eligibility] Using cached cappers (${cachedCappers.length} eligible)`)
    return cachedCappers
  }

  console.log('[DEEP:Eligibility] Fetching eligible cappers from capper_stats...')
  const admin = getSupabaseAdmin()

  // Query the materialized view for eligible system cappers
  // SCALABILITY: This query is optimized with indexes on is_system_capper and net_units
  const { data, error } = await admin
    .from('capper_stats')
    .select('capper_id, display_name, net_units, win_rate, total_picks')
    .eq('is_system_capper', true)
    .gt('net_units', 0)
    .not('capper_id', 'ilike', 'deep')       // Exclude DEEP
    .not('capper_id', 'ilike', 'picksmith')  // Also exclude old PICKSMITH
    .order('net_units', { ascending: false })
    .limit(100) // SCALABILITY: Limit to top 100 profitable cappers

  if (error) {
    console.error('[DEEP:Eligibility] Error fetching cappers:', error)
    return []
  }

  const eligible: EligibleCapper[] = (data || []).map(row => ({
    id: row.capper_id,
    name: row.display_name || row.capper_id.toUpperCase(),
    netUnits: row.net_units || 0,
    winRate: row.win_rate || 0,
    totalPicks: row.total_picks || 0
  }))

  // Update cache
  cachedCappers = eligible
  cacheTimestamp = now

  console.log(`[DEEP:Eligibility] Found ${eligible.length} eligible cappers:`,
    eligible.slice(0, 10).map(c => `${c.name}(+${c.netUnits.toFixed(1)}u)`).join(', '),
    eligible.length > 10 ? `... and ${eligible.length - 10} more` : '')

  return eligible
}

/**
 * Clear the eligibility cache (for testing/manual refresh)
 */
export function clearEligibilityCache(): void {
  cachedCappers = null
  cacheTimestamp = 0
  console.log('[DEEP:Eligibility] Cache cleared')
}

/**
 * Get a specific capper's eligibility status
 */
export async function isCapperEligible(capperId: string): Promise<boolean> {
  const eligible = await getEligibleCappers()
  return eligible.some(c => c.id.toLowerCase() === capperId.toLowerCase())
}

