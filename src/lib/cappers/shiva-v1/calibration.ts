/**
 * SHIVA v1 Model Calibration
 * Auto-tune confidence scaling based on historical performance
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { sigmoidScaled } from './math'

export interface CalibrationResult {
  id: string
  created_at: string
  model_version: string
  scaling_constant: number
  sample_size: number
  hit_rate_by_bin: Record<string, number>
  r_squared: number
  notes?: string
}

export interface CalibrationBin {
  conf_range: [number, number]
  sample_size: number
  hit_rate: number
  expected_rate: number
  error: number
}

/**
 * Run calibration analysis on historical picks
 */
export async function runCalibration(
  modelVersion: string = 'nba_totals_v1',
  sampleSize: number = 100,
  minConfScore: number = 1.0
): Promise<CalibrationResult> {
  const admin = getSupabaseAdmin()
  
  // Fetch graded picks with edge data
  const { data: picks, error } = await admin
    .from('pick_results')
    .select(`
      conf_score,
      edge_pct,
      result,
      created_at
    `)
    .eq('model_version', modelVersion)
    .not('conf_score', 'is', null)
    .not('edge_pct', 'is', null)
    .not('result', 'is', null)
    .gte('conf_score', minConfScore)
    .order('created_at', { ascending: false })
    .limit(sampleSize)
  
  if (error) throw new Error(`Failed to fetch picks: ${error.message}`)
  if (!picks || picks.length < 20) {
    throw new Error(`Insufficient data: ${picks?.length || 0} picks found`)
  }
  
  // Create confidence bins
  const bins = createConfidenceBins(picks)
  
  // Find optimal scaling constant
  const optimalScaling = findOptimalScaling(picks, bins)
  
  // Calculate R-squared
  const rSquared = calculateRSquared(picks, bins, optimalScaling)
  
  // Store calibration result
  const calibrationResult: Omit<CalibrationResult, 'id' | 'created_at'> = {
    model_version: modelVersion,
    scaling_constant: optimalScaling,
    sample_size: picks.length,
    hit_rate_by_bin: bins.reduce((acc, bin, i) => {
      acc[`bin_${i}`] = bin.hit_rate
      return acc
    }, {} as Record<string, number>),
    r_squared: rSquared,
    notes: `Auto-calibrated from ${picks.length} picks`
  }
  
  const { data: result, error: insertError } = await admin
    .from('calibration_runs')
    .insert(calibrationResult)
    .select()
    .single()
  
  if (insertError) throw new Error(`Failed to store calibration: ${insertError.message}`)
  
  return result
}

/**
 * Create confidence score bins for analysis
 */
function createConfidenceBins(picks: any[]): CalibrationBin[] {
  const bins: CalibrationBin[] = []
  const binRanges: [number, number][] = [
    [1.0, 2.0],
    [2.0, 3.0], 
    [3.0, 4.0],
    [4.0, 5.0]
  ]
  
  for (const [min, max] of binRanges) {
    const binPicks = picks.filter(p => p.conf_score >= min && p.conf_score < max)
    const wins = binPicks.filter(p => p.result === 'win').length
    const hitRate = binPicks.length > 0 ? wins / binPicks.length : 0
    const expectedRate = binPicks.length > 0 
      ? binPicks.reduce((sum, p) => sum + p.edge_pct, 0) / binPicks.length 
      : 0
    
    bins.push({
      conf_range: [min, max],
      sample_size: binPicks.length,
      hit_rate: hitRate,
      expected_rate: expectedRate,
      error: Math.abs(hitRate - expectedRate)
    })
  }
  
  return bins
}

/**
 * Find optimal scaling constant using grid search
 */
function findOptimalScaling(picks: any[], bins: CalibrationBin[]): number {
  const scalingRange = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
  let bestScaling = 2.5
  let bestError = Infinity
  
  for (const scaling of scalingRange) {
    const error = calculateScalingError(picks, bins, scaling)
    if (error < bestError) {
      bestError = error
      bestScaling = scaling
    }
  }
  
  return bestScaling
}

/**
 * Calculate error for a given scaling constant
 */
function calculateScalingError(picks: any[], bins: CalibrationBin[], scaling: number): number {
  let totalError = 0
  let totalWeight = 0
  
  for (const bin of bins) {
    if (bin.sample_size < 5) continue // Skip bins with too few samples
    
    // Calculate expected hit rate with this scaling
    const binPicks = picks.filter(p => 
      p.conf_score >= bin.conf_range[0] && p.conf_score < bin.conf_range[1]
    )
    
    const expectedRate = binPicks.length > 0
      ? binPicks.reduce((sum, p) => sum + sigmoidScaled(p.edge_pct * 2.5 / scaling, 1), 0) / binPicks.length
      : 0
    
    const error = Math.abs(bin.hit_rate - expectedRate)
    totalError += error * bin.sample_size
    totalWeight += bin.sample_size
  }
  
  return totalWeight > 0 ? totalError / totalWeight : Infinity
}

/**
 * Calculate R-squared for calibration quality
 */
function calculateRSquared(picks: any[], bins: CalibrationBin[], scaling: number): number {
  let ssRes = 0 // Sum of squares of residuals
  let ssTot = 0 // Total sum of squares
  
  const overallHitRate = picks.filter(p => p.result === 'win').length / picks.length
  
  for (const bin of bins) {
    if (bin.sample_size < 5) continue
    
    const binPicks = picks.filter(p => 
      p.conf_score >= bin.conf_range[0] && p.conf_score < bin.conf_range[1]
    )
    
    const expectedRate = binPicks.length > 0
      ? binPicks.reduce((sum, p) => sum + sigmoidScaled(p.edge_pct * 2.5 / scaling, 1), 0) / binPicks.length
      : 0
    
    ssRes += Math.pow(bin.hit_rate - expectedRate, 2) * bin.sample_size
    ssTot += Math.pow(bin.hit_rate - overallHitRate, 2) * bin.sample_size
  }
  
  return ssTot > 0 ? 1 - (ssRes / ssTot) : 0
}

/**
 * Get the latest calibration result for a model
 */
export async function getLatestCalibration(modelVersion: string = 'nba_totals_v1'): Promise<CalibrationResult | null> {
  const admin = getSupabaseAdmin()
  
  const { data, error } = await admin
    .from('calibration_runs')
    .select('*')
    .eq('model_version', modelVersion)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch calibration: ${error.message}`)
  }
  
  return data
}

/**
 * Get calibration statistics
 */
export async function getCalibrationStats(modelVersion: string = 'nba_totals_v1'): Promise<{
  totalRuns: number
  latestScaling: number
  avgRSquared: number
  lastCalibrated: string | null
}> {
  const admin = getSupabaseAdmin()
  
  const { data, error } = await admin
    .from('calibration_runs')
    .select('scaling_constant, r_squared, created_at')
    .eq('model_version', modelVersion)
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) throw new Error(`Failed to fetch calibration stats: ${error.message}`)
  
  if (!data || data.length === 0) {
    return {
      totalRuns: 0,
      latestScaling: 2.5, // Default
      avgRSquared: 0,
      lastCalibrated: null
    }
  }
  
  const avgRSquared = data.reduce((sum, r) => sum + r.r_squared, 0) / data.length
  
  return {
    totalRuns: data.length,
    latestScaling: data[0].scaling_constant,
    avgRSquared: Math.round(avgRSquared * 1000) / 1000,
    lastCalibrated: data[0].created_at
  }
}
