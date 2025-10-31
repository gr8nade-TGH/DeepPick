import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0 // Disable caching completely

/**
 * GET /api/shiva/runs/debug-export
 * Returns comprehensive debug data for ALL SHIVA runs including complete step JSONs
 * Used for auditing factor calculations, confidence scores, and prediction accuracy
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = getSupabaseAdmin()

    console.log('[DebugExport] Fetching comprehensive run data...')

    // Fetch runs from the runs table with complete metadata
    const { data: runsData, error: runsError } = await supabase
      .from('runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (runsError) {
      console.error('[DebugExport] Error fetching runs:', runsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch runs',
        details: runsError.message
      }, { status: 500 })
    }

    // Filter for SHIVA runs only
    const shivaRuns = (runsData || []).filter((run: any) => {
      const metadata = run.metadata || {}
      return metadata.capper === 'shiva' || run.capper === 'shiva'
    })

    console.log('[DebugExport] Found', shivaRuns.length, 'SHIVA runs')

    // Extract unique game IDs
    const gameIds = [...new Set(shivaRuns.map((run: any) => run.game_id).filter((id: string) => id && id !== 'unknown'))]

    // Fetch games data
    let gamesMap = new Map()
    if (gameIds.length > 0) {
      const { data: gamesData } = await supabase
        .from('games')
        .select('id, home_team, away_team, game_time, odds')
        .in('id', gameIds)

      gamesData?.forEach(game => {
        gamesMap.set(game.id, game)
      })
    }

    // Fetch cooldown records
    const { data: cooldownsData } = await supabase
      .from('pick_generation_cooldowns')
      .select('*')
      .eq('capper', 'shiva')

    const cooldownMap = new Map()
    cooldownsData?.forEach(cd => {
      cooldownMap.set(cd.run_id, cd)
    })

    // Fetch shiva_runs table for additional metadata (if exists)
    const { data: shivaRunsData } = await supabase
      .from('shiva_runs')
      .select('*')

    const shivaRunsMap = new Map()
    shivaRunsData?.forEach(sr => {
      shivaRunsMap.set(sr.id, sr)
    })

    // Build comprehensive debug export
    const debugData = shivaRuns.map((run: any) => {
      const metadata = run.metadata || {}
      const cooldown = cooldownMap.get(run.run_id)
      const game = gamesMap.get(run.game_id)
      const shivaRun = shivaRunsMap.get(run.id) || shivaRunsMap.get(run.run_id)

      // Extract team names
      const homeTeam = game?.home_team?.name || game?.home_team || metadata.home_team || 'Unknown'
      const awayTeam = game?.away_team?.name || game?.away_team || metadata.away_team || 'Unknown'
      const matchup = `${awayTeam} @ ${homeTeam}`

      // Parse factor contributions with detailed breakdown
      const factorContributions = (metadata.factor_contributions || []).map((factor: any) => {
        const parsedValues = factor.parsed_values_json || {}

        // CRITICAL: Try weight_applied first (new format), fallback to weight_total_pct (old format)
        let weight = factor.weight_applied || 0
        if (weight === 0 && factor.weight_total_pct) {
          weight = factor.weight_total_pct / 100 // Convert percentage to decimal
        }
        const weightPct = Math.round(weight * 100)

        // Calculate weighted contributions
        const rawOverScore = Number(parsedValues.overScore || 0)
        const rawUnderScore = Number(parsedValues.underScore || 0)
        const weightedOverScore = rawOverScore * weight
        const weightedUnderScore = rawUnderScore * weight

        return {
          factor_key: factor.key || factor.factor_key,
          factor_name: factor.name || factor.factor_name,
          weight_percentage: weightPct,
          weight_decimal: weight,
          raw_values: {
            overScore: rawOverScore,
            underScore: rawUnderScore,
            signal: parsedValues.signal || 0,
            points: parsedValues.points || 0
          },
          weighted_contributions: {
            overScore: weightedOverScore,
            underScore: weightedUnderScore,
            net: weightedOverScore - weightedUnderScore
          },
          parsed_values_json: parsedValues,
          raw_values_json: factor.raw_values_json || {},
          normalized_value: factor.normalized_value || 0,
          notes: factor.notes || '',
          // Include both fields for debugging
          weight_total_pct: factor.weight_total_pct,
          weight_applied: factor.weight_applied
        }
      })

      // Calculate confidence breakdown
      const totalWeightedOver = factorContributions.reduce((sum: number, f: any) =>
        sum + (f.weighted_contributions?.overScore || 0), 0)
      const totalWeightedUnder = factorContributions.reduce((sum: number, f: any) =>
        sum + (f.weighted_contributions?.underScore || 0), 0)
      const calculatedConfidence = totalWeightedOver + totalWeightedUnder

      return {
        // Run identification
        run_id: run.run_id,
        id: run.id,
        game_id: run.game_id,
        created_at: run.created_at,

        // Game details
        matchup,
        game_time: game?.game_time || metadata.game_time,

        // Pick details
        pick_type: metadata.pick_type || run.pick_type,
        selection: metadata.selection || run.selection,
        units: cooldown?.units !== undefined ? cooldown.units : (metadata.units || run.units),

        // Confidence and predictions
        confidence: {
          final: cooldown?.confidence_score !== undefined ? cooldown.confidence_score : (metadata.confidence || run.confidence),
          calculated_from_factors: calculatedConfidence,
          total_weighted_over: totalWeightedOver,
          total_weighted_under: totalWeightedUnder,
          base_confidence: metadata.base_confidence,
          market_edge_adjustment: metadata.conf_market_adj || run.conf_market_adj
        },

        // Totals
        predicted_total: metadata.predicted_total,
        baseline_avg: metadata.baseline_avg,
        market_total: metadata.market_total,

        // Factor analysis
        factors: factorContributions,
        factor_summary: {
          total_factors: factorContributions.length,
          factors_favoring_over: factorContributions.filter((f: any) =>
            (f.weighted_contributions?.overScore || 0) > (f.weighted_contributions?.underScore || 0)).length,
          factors_favoring_under: factorContributions.filter((f: any) =>
            (f.weighted_contributions?.underScore || 0) > (f.weighted_contributions?.overScore || 0)).length,
          total_weight_percentage: factorContributions.reduce((sum: number, f: any) =>
            sum + (f.weight_percentage || 0), 0)
        },

        // Step JSONs (if available from metadata)
        step_data: {
          step3_json: metadata.step3_json || null,
          step4_json: metadata.step4_json || null,
          step5_json: metadata.step5_json || null
        },

        // Cooldown data
        cooldown: cooldown ? {
          id: cooldown.id,
          result: cooldown.result,
          cooldown_until: cooldown.cooldown_until,
          created_at: cooldown.created_at
        } : null,

        // Additional metadata
        state: run.state,
        capper: metadata.capper || run.capper,
        sport: metadata.sport || run.sport,

        // Raw metadata for debugging
        raw_metadata: metadata,
        shiva_run_metadata: shivaRun?.metadata || null
      }
    })

    // Calculate summary statistics
    const summary = {
      total_runs: debugData.length,
      pick_generated_count: debugData.filter(r => r.cooldown?.result === 'PICK_GENERATED').length,
      pass_count: debugData.filter(r => r.cooldown?.result === 'PASS').length,
      error_count: debugData.filter(r => r.cooldown?.result === 'ERROR').length,
      average_confidence: debugData.reduce((sum, r) => sum + (r.confidence.final || 0), 0) / debugData.length,
      average_units: debugData.reduce((sum, r) => sum + (r.units || 0), 0) / debugData.length,
      confidence_calculation_discrepancies: debugData.filter(r => {
        const diff = Math.abs((r.confidence.final || 0) - (r.confidence.calculated_from_factors || 0))
        return diff > 0.01 // Flag if difference > 0.01
      }).length
    }

    const response = NextResponse.json({
      success: true,
      export_timestamp: new Date().toISOString(),
      summary,
      runs: debugData
    })

    // Add explicit no-cache headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response

  } catch (error: any) {
    console.error('[DebugExport] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

