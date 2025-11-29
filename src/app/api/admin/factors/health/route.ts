import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

interface FactorStats {
  key: string
  name: string
  betType: 'TOTAL' | 'SPREAD'
  totalRuns: number
  lastRun: string | null
  avgSignal: number
  avgAwayScore: number
  avgHomeScore: number
  zeroCount: number
  healthStatus: 'healthy' | 'warning' | 'error'
  recentSamples: Array<{
    runId: string
    createdAt: string
    matchup: string
    signal: number
    awayScore: number
    homeScore: number
  }>
}

export async function GET(request: NextRequest) {
  try {
    // Get runs with factor_contributions from last 7 days
    const { data: runs, error } = await supabase
      .from('runs')
      .select('id, bet_type, factor_contributions, created_at, metadata')
      .not('factor_contributions', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error

    // Aggregate factor stats
    const factorMap = new Map<string, {
      key: string
      name: string
      betType: 'TOTAL' | 'SPREAD'
      runs: number
      lastRun: string | null
      signalSum: number
      awayScoreSum: number
      homeScoreSum: number
      zeroCount: number
      samples: Array<{
        runId: string
        createdAt: string
        matchup: string
        signal: number
        awayScore: number
        homeScore: number
      }>
    }>()

    for (const run of runs || []) {
      const factors = run.factor_contributions as any[]
      if (!factors || !Array.isArray(factors)) continue

      const betType = run.bet_type as 'TOTAL' | 'SPREAD'
      const matchup = run.metadata?.game?.matchup || 
        `${run.metadata?.teams?.away || '???'} @ ${run.metadata?.teams?.home || '???'}`

      for (const factor of factors) {
        const key = `${betType}_${factor.key}`
        const signal = factor.z || 0
        const awayScore = factor.parsed_values_json?.awayScore || factor.parsed_values_json?.overScore || 0
        const homeScore = factor.parsed_values_json?.homeScore || factor.parsed_values_json?.underScore || 0

        if (!factorMap.has(key)) {
          factorMap.set(key, {
            key: factor.key,
            name: factor.name,
            betType,
            runs: 0,
            lastRun: null,
            signalSum: 0,
            awayScoreSum: 0,
            homeScoreSum: 0,
            zeroCount: 0,
            samples: []
          })
        }

        const stats = factorMap.get(key)!
        stats.runs++
        stats.signalSum += signal
        stats.awayScoreSum += awayScore
        stats.homeScoreSum += homeScore
        if (signal === 0) stats.zeroCount++
        if (!stats.lastRun || run.created_at > stats.lastRun) {
          stats.lastRun = run.created_at
        }
        // Keep last 5 samples
        if (stats.samples.length < 5) {
          stats.samples.push({
            runId: run.id,
            createdAt: run.created_at,
            matchup,
            signal,
            awayScore,
            homeScore
          })
        }
      }
    }

    // Convert to array and calculate health
    const now = Date.now()
    const factors: FactorStats[] = Array.from(factorMap.values()).map(stats => {
      const avgSignal = stats.runs > 0 ? stats.signalSum / stats.runs : 0
      const zeroRate = stats.runs > 0 ? stats.zeroCount / stats.runs : 1
      const hoursSinceLastRun = stats.lastRun 
        ? (now - new Date(stats.lastRun).getTime()) / (1000 * 60 * 60)
        : Infinity

      let healthStatus: 'healthy' | 'warning' | 'error' = 'healthy'
      if (hoursSinceLastRun > 48 || stats.runs === 0) {
        healthStatus = 'error'
      } else if (zeroRate > 0.8 || hoursSinceLastRun > 24) {
        healthStatus = 'warning'
      }

      return {
        key: stats.key,
        name: stats.name,
        betType: stats.betType,
        totalRuns: stats.runs,
        lastRun: stats.lastRun,
        avgSignal: Math.round(avgSignal * 1000) / 1000,
        avgAwayScore: Math.round(stats.awayScoreSum / Math.max(stats.runs, 1) * 100) / 100,
        avgHomeScore: Math.round(stats.homeScoreSum / Math.max(stats.runs, 1) * 100) / 100,
        zeroCount: stats.zeroCount,
        healthStatus,
        recentSamples: stats.samples
      }
    })

    // Sort: TOTAL first, then SPREAD, then by factor order
    const factorOrder = ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'injuryAvailability',
      'netRatingDiff', 'turnoverDiff', 'shootingEfficiencyMomentum', 'paceMismatch', 'homeAwaySplits', 
      'fourFactorsDiff', 'injuryAvailabilitySpread', 'edgeVsMarket', 'edgeVsMarketSpread']
    
    factors.sort((a, b) => {
      if (a.betType !== b.betType) return a.betType === 'TOTAL' ? -1 : 1
      return factorOrder.indexOf(a.key) - factorOrder.indexOf(b.key)
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalRuns: runs?.length || 0,
      factors
    })
  } catch (error) {
    console.error('[Factor Health API] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

