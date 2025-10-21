/**
 * Factors Service
 * 
 * Business logic for factor computation, separated from API routes
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { computeTotalsFactors, RunCtx } from '../factors/nba-totals'
import { getFactorWeightsFromProfile } from '../confidence-calculator'

export interface FactorComputationInput {
  runId: string
  gameId: string
  awayTeam: string
  homeTeam: string
  sport: 'NBA' | 'NFL' | 'MLB'
  betType: 'SPREAD' | 'MONEYLINE' | 'TOTAL'
  capperId: string
  aiProvider?: 'perplexity' | 'openai'
  newsWindowHours?: number
}

export interface FactorComputationResult {
  factors: any[]
  factorVersion: string
  debug: any
  factorWeights: Record<string, number>
}

/**
 * Compute factors for a given sport/bet type combination
 */
export async function computeFactors(input: FactorComputationInput): Promise<FactorComputationResult> {
  const { runId, gameId, awayTeam, homeTeam, sport, betType, capperId } = input
  
  console.log('[FACTORS_SERVICE:START]', { runId, sport, betType, capperId })
  
  if (sport === 'NBA' && betType === 'TOTAL') {
    return await computeNBATotalsFactors(input)
  }
  
  throw new Error(`Factor computation not implemented for ${sport} ${betType}`)
}

/**
 * Compute NBA Totals factors (F1-F5)
 */
async function computeNBATotalsFactors(input: FactorComputationInput): Promise<FactorComputationResult> {
  const { runId, gameId, awayTeam, homeTeam, capperId } = input
  
  // Get factor weights from capper profile
  const factorWeights = await getFactorWeights(capperId, 'NBA', 'TOTAL')
  
  // Create run context
  const ctx: RunCtx = {
    game_id: gameId,
    away: awayTeam,
    home: homeTeam,
    sport: 'NBA',
    betType: 'TOTAL',
    leagueAverages: {
      pace: 100.0,
      ORtg: 110.0,
      DRtg: 110.0,
      threePAR: 0.35,
      FTr: 0.25,
      threePstdev: 0.05
    },
    factorWeights
  }
  
  // Compute factors
  const result = await computeTotalsFactors(ctx)
  
  console.log('[FACTORS_SERVICE:NBA_TOTALS_SUCCESS]', { 
    runId, 
    factorCount: result.factors.length,
    factorVersion: result.factor_version 
  })
  
  return {
    factors: result.factors,
    factorVersion: result.factor_version,
    debug: result.totals_debug,
    factorWeights
  }
}

/**
 * Get factor weights from capper profile
 */
async function getFactorWeights(capperId: string, sport: string, betType: string): Promise<Record<string, number>> {
  const admin = getSupabaseAdmin()
  
  try {
    const profileRes = await admin
      .from('capper_settings')
      .select('profile_json')
      .eq('capper_id', capperId)
      .eq('sport', sport)
      .eq('bet_type', betType)
      .single()
    
    if (profileRes.data?.profile_json?.factors) {
      const weights = getFactorWeightsFromProfile(profileRes.data.profile_json)
      console.log('[FACTORS_SERVICE:LOADED_WEIGHTS]', { capperId, sport, betType, weights })
      return weights
    }
  } catch (error) {
    console.warn('[FACTORS_SERVICE:PROFILE_LOAD_FAILED]', { capperId, sport, betType, error })
  }
  
  // Return default weights
  const defaultWeights = {
    paceIndex: 20,
    offForm: 20,
    defErosion: 20,
    threeEnv: 20,
    whistleEnv: 20
  }
  
  console.log('[FACTORS_SERVICE:USING_DEFAULT_WEIGHTS]', { capperId, sport, betType, defaultWeights })
  return defaultWeights
}
