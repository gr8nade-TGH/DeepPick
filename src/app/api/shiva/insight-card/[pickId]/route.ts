import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { pickId: string } }
) {
  try {
    const { pickId } = params
    console.log('[InsightCard] Request for pickId:', pickId)

    if (!pickId) {
      console.error('[InsightCard] No pickId provided')
      return NextResponse.json(
        { error: 'Pick ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Step 1: Get the pick
    console.log('[InsightCard] Querying picks table for:', pickId)
    const { data: pick, error: pickError } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('id', pickId)
      .single()

    if (pickError) {
      console.error('[InsightCard] Pick query error:', {
        error: pickError,
        code: pickError.code,
        message: pickError.message,
        details: pickError.details
      })
      return NextResponse.json(
        { error: 'Pick not found', details: pickError.message },
        { status: 404 }
      )
    }

    if (!pick) {
      console.error('[InsightCard] Pick not found in database:', pickId)
      return NextResponse.json(
        { error: 'Pick not found' },
        { status: 404 }
      )
    }

    console.log('[InsightCard] Pick found:', {
      pickId: pick.id,
      runId: pick.run_id,
      selection: pick.selection,
      hasGame: !!pick.games
    })

    // Step 2: Get the run using run_id
    console.log('[InsightCard] Querying runs table for run_id:', pick.run_id)
    const { data: run, error: runError } = await supabase
      .from('runs')
      .select('*')
      .eq('run_id', pick.run_id)
      .maybeSingle()

    if (runError) {
      console.error('[InsightCard] Run query error:', {
        error: runError,
        runId: pick.run_id
      })
      return NextResponse.json(
        { error: 'Run data not found', details: runError.message },
        { status: 404 }
      )
    }

    if (!run) {
      console.error('[InsightCard] Run not found in database:', pick.run_id)
      return NextResponse.json(
        { error: 'Run data not found for this pick' },
        { status: 404 }
      )
    }

    console.log('[InsightCard] Run found:', {
      runId: run.run_id,
      hasMetadata: !!run.metadata,
      metadataKeys: run.metadata ? Object.keys(run.metadata) : []
    })

    // Step 3: Extract data from metadata (EXACTLY like run log does)
    const metadata = run.metadata || {}
    const game = pick.games || {}

    // Extract all data from metadata
    const factorContributions = metadata.factor_contributions || []
    const predictedTotal = metadata.predicted_total || 0
    const baselineAvg = metadata.baseline_avg || 220
    const marketTotal = metadata.market_total || 0
    const predictedHomeScore = metadata.predicted_home_score || 0
    const predictedAwayScore = metadata.predicted_away_score || 0
    const boldPredictions = metadata.bold_predictions || null

    console.log('[InsightCard] Data extracted:', {
      pickId,
      runId: run.run_id,
      factorCount: factorContributions.length,
      predictedTotal,
      marketTotal,
      hasBoldPredictions: !!boldPredictions
    })

    // Step 4: Build insight card data structure
    const insightCardData = buildInsightCard({
      pick,
      game,
      run,
      factorContributions,
      predictedTotal,
      baselineAvg,
      marketTotal,
      predictedHomeScore,
      predictedAwayScore,
      boldPredictions
    })

    return NextResponse.json({
      success: true,
      data: insightCardData
    })

  } catch (error) {
    console.error('[InsightCard] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insight card', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Build insight card data structure from run metadata
function buildInsightCard({ pick, game, run, factorContributions, predictedTotal, baselineAvg, marketTotal, predictedHomeScore, predictedAwayScore, boldPredictions }: any) {

  // Map factors to insight card format
  const factors = factorContributions.map((factor: any) => {
    // Get weight percentage
    const weightPct = factor.weight_percentage || factor.weight_total_pct || 0
    const weightDecimal = weightPct / 100

    // Get scores from weighted_contributions if available
    let overScore = 0
    let underScore = 0

    if (factor.weighted_contributions) {
      overScore = factor.weighted_contributions.overScore || 0
      underScore = factor.weighted_contributions.underScore || 0
    } else if (factor.parsed_values_json) {
      // Calculate from parsed values
      const parsed = factor.parsed_values_json
      overScore = (parsed.overScore || 0) * weightDecimal
      underScore = (parsed.underScore || 0) * weightDecimal
    }

    return {
      key: factor.key || factor.factor_key,
      label: factor.name || factor.factor_name || factor.key,
      icon: getFactorIcon(factor.key || factor.factor_key),
      overScore,
      underScore,
      weightAppliedPct: Math.round(weightPct),
      rationale: factor.notes || 'No rationale provided'
    }
  })

  // Get confidence
  const confidence = Number(pick.confidence || run.confidence || 0)

  // Calculate edge
  const edgeRaw = predictedTotal - marketTotal
  const edgePct = marketTotal > 0 ? (edgeRaw / marketTotal) * 100 : 0

  // Build the insight card
  return {
    capper: 'SHIVA',
    capperIconUrl: null,
    sport: 'NBA' as const,
    gameId: game.id,
    pickId: pick.id,
    generatedAt: pick.created_at,
    matchup: {
      away: game.away_team?.name || game.away_team || 'Away',
      home: game.home_team?.name || game.home_team || 'Home',
      spreadText: game.spread_line ? `${game.spread_line}` : 'N/A',
      totalText: `O/U ${marketTotal || game.total_line || 'N/A'}`,
      gameDateLocal: game.game_start_timestamp || game.game_date || new Date().toISOString()
    },
    pick: {
      type: 'TOTAL' as const,
      selection: pick.selection,
      units: pick.units,
      confidence,
      edgeRaw,
      edgePct,
      confScore: confidence,
      locked_odds: pick.game_snapshot || null,
      locked_at: pick.created_at
    },
    predictedScore: {
      away: predictedAwayScore || Math.floor(predictedTotal / 2),
      home: predictedHomeScore || Math.ceil(predictedTotal / 2),
      winner: 'TBD'
    },
    writeups: {
      prediction: `Model projects ${pick.selection} with ${confidence.toFixed(1)}/10.0 confidence based on ${factors.length} factors.`,
      gamePrediction: `Predicted total: ${predictedTotal.toFixed(1)} vs Market: ${marketTotal.toFixed(1)}`,
      bold: boldPredictions?.summary || null
    },
    bold_predictions: boldPredictions,
    injury_summary: null,
    factors,
    market: {
      conf7: confidence,
      confAdj: 0,
      confFinal: confidence,
      dominant: 'total' as const
    },
    results: {
      status: pick.status === 'won' ? 'win'
        : pick.status === 'lost' ? 'loss'
          : pick.status === 'push' ? 'push'
            : 'pending',
      finalScore: game.final_score ? {
        away: game.final_score.away,
        home: game.final_score.home
      } : undefined,
      postMortem: undefined
    },
    onClose: () => { }
  }
}

// Get factor icon
function getFactorIcon(key: string): string {
  const icons: Record<string, string> = {
    edgeVsMarket: '💰',
    paceIndex: '⚡',
    offForm: '🎯',
    defErosion: '🛡️',
    threeEnv: '🏀',
    whistleEnv: '🎺',
    injuryAvailability: '🏥'
  }
  return icons[key] || '📊'
}
