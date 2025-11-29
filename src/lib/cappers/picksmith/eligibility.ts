/**
 * PICKSMITH Eligibility Module
 * 
 * Determines which system cappers are eligible for consensus consideration.
 * Only cappers with positive overall NBA unit records are eligible.
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { EligibleCapper } from './types'

// Cache for eligible cappers (refreshed every 5 minutes)
let cachedEligibleCappers: EligibleCapper[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch all system cappers with positive NBA unit records
 * Uses the capper_stats materialized view for performance
 */
export async function getEligibleCappers(): Promise<EligibleCapper[]> {
  const now = Date.now()
  
  // Return cached data if still valid
  if (cachedEligibleCappers && (now - cacheTimestamp) < CACHE_TTL_MS) {
    console.log(`[PICKSMITH:Eligibility] Using cached data: ${cachedEligibleCappers.length} eligible cappers`)
    return cachedEligibleCappers
  }
  
  try {
    const admin = getSupabaseAdmin()
    
    // Query capper_stats materialized view for system cappers with positive records
    const { data, error } = await admin
      .from('capper_stats')
      .select('capper, display_name, net_units, win_rate, total_picks, is_system_capper')
      .eq('is_system_capper', true)
      .gt('net_units', 0) // Only positive unit records
      .neq('capper', 'picksmith') // Exclude PICKSMITH from its own consensus
      .order('net_units', { ascending: false })
    
    if (error) {
      console.error('[PICKSMITH:Eligibility] Error fetching capper stats:', error)
      return []
    }
    
    const eligibleCappers: EligibleCapper[] = (data || []).map(c => ({
      id: c.capper,
      name: c.display_name,
      netUnits: parseFloat(c.net_units) || 0,
      winRate: parseFloat(c.win_rate) || 0,
      totalPicks: c.total_picks || 0
    }))
    
    // Update cache
    cachedEligibleCappers = eligibleCappers
    cacheTimestamp = now
    
    console.log(`[PICKSMITH:Eligibility] Found ${eligibleCappers.length} eligible cappers:`, 
      eligibleCappers.map(c => `${c.name} (+${c.netUnits.toFixed(1)}u)`).join(', '))
    
    return eligibleCappers
  } catch (error) {
    console.error('[PICKSMITH:Eligibility] Unexpected error:', error)
    return []
  }
}

/**
 * Check if a specific capper is eligible
 */
export async function isCapperEligible(capperId: string): Promise<boolean> {
  const eligible = await getEligibleCappers()
  return eligible.some(c => c.id === capperId.toLowerCase())
}

/**
 * Get the unit record for a specific capper
 */
export async function getCapperNetUnits(capperId: string): Promise<number> {
  const eligible = await getEligibleCappers()
  const capper = eligible.find(c => c.id === capperId.toLowerCase())
  return capper?.netUnits || 0
}

/**
 * Clear the eligibility cache (useful for testing)
 */
export function clearEligibilityCache(): void {
  cachedEligibleCappers = null
  cacheTimestamp = 0
  console.log('[PICKSMITH:Eligibility] Cache cleared')
}

