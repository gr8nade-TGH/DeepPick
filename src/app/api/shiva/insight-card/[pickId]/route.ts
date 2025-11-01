import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { pickId: string } }
) {
  try {
    const { pickId } = params

    if (!pickId) {
      return NextResponse.json(
        { error: 'Pick ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Fetch the pick and its associated run data
    const { data: pick, error: pickError } = await supabase
      .from('picks')
      .select(`
        *,
        shiva_runs!inner(
          *,
          games(*)
        )
      `)
      .eq('id', pickId)
      .single()

    if (pickError || !pick) {
      return NextResponse.json(
        { error: 'Pick not found' },
        { status: 404 }
      )
    }

    console.log('[InsightCard API] Pick found, assembling insight card...')

    const metadata = pick.shiva_runs?.metadata || {}
    const game = pick.shiva_runs?.games || {}

    // Extract step data from metadata
    const step3 = metadata.step3_json || {}
    const step4 = metadata.step4_json || {}
    const step5 = metadata.step5_json || {}
    const step6 = metadata.step6_json || {}
    const snapshot = metadata.odds_snapshot || {}

    // Assemble insight card data (same structure as wizard)
    const insightCardData = assembleInsightCardFromMetadata({
      game,
      pick,
      step3,
      step4,
      step5,
      step6,
      snapshot,
      metadata
    })

    console.log('[InsightCard API] Insight card assembled successfully')

    return NextResponse.json({
      success: true,
      data: insightCardData
    })

  } catch (error) {
    console.error('Error fetching insight card:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insight card', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Helper function to assemble insight card from metadata
function assembleInsightCardFromMetadata({ game, pick, step3, step4, step5, step6, snapshot, metadata }: any) {
  const conf7 = Number(step4?.predictions?.conf7_score ?? pick.confidence ?? 0)
  const confAdj = Number(step5?.conf_market_adj ?? 0)
  const confFinal = Number(step5?.conf_final ?? pick.confidence ?? 0)

  // Extract factor contributions from step3
  const factorContributions = step3?.factor_contributions || []

  const factors = factorContributions.map((fc: any) => {
    const weightPct = fc.weight_total_pct || fc.weight_percentage || 0
    const weightDecimal = weightPct / 100
    const parsedValues = fc.parsed_values_json || {}

    // Use weighted contributions if available, otherwise calculate from raw scores
    let overScore = 0
    let underScore = 0

    if (fc.weighted_contributions) {
      overScore = fc.weighted_contributions.overScore || 0
      underScore = fc.weighted_contributions.underScore || 0
    } else {
      overScore = (parsedValues.overScore || 0) * weightDecimal
      underScore = (parsedValues.underScore || 0) * weightDecimal
    }

    return {
      key: fc.key || fc.factor_key,
      label: fc.name || fc.factor_name || fc.key,
      icon: getFactorIcon(fc.key || fc.factor_key),
      overScore,
      underScore,
      weightAppliedPct: weightPct,
      rationale: fc.notes || 'No rationale provided'
    }
  })

  // Assemble the insight card data
  return {
    capper: 'SHIVA',
    capperIconUrl: null,
    sport: 'NBA' as const,
    gameId: game.id,
    pickId: pick.id,
    generatedAt: pick.created_at,
    matchup: {
      away: game.away_team?.name || game.away_team?.abbreviation || 'Away',
      home: game.home_team?.name || game.home_team?.abbreviation || 'Home',
      spreadText: `${game.odds?.spread_line || 'N/A'}`,
      totalText: `${game.odds?.total_line || 'N/A'}`,
      gameDateLocal: game.game_start_timestamp || `${game.game_date}T${game.game_time}Z`
    },
    pick: {
      type: pick.pick_type as 'TOTAL',
      selection: pick.selection,
      units: pick.units,
      confidence: confFinal,
      edgeRaw: metadata.predicted_total ? metadata.predicted_total - (game.odds?.total_line || 0) : 0,
      edgePct: metadata.predicted_total && game.odds?.total_line ?
        ((metadata.predicted_total - game.odds.total_line) / game.odds.total_line) * 100 : 0,
      confScore: confFinal,
      locked_odds: snapshot,
      locked_at: pick.created_at
    },
    predictedScore: {
      away: Math.floor((metadata.predicted_total || 0) / 2),
      home: Math.ceil((metadata.predicted_total || 0) / 2),
      winner: 'TBD'
    },
    writeups: {
      prediction: `Model projects ${pick.selection} with ${confFinal.toFixed(1)}/5.0 confidence.`,
      gamePrediction: `Predicted total: ${metadata.predicted_total?.toFixed(1) || 'N/A'} vs Market: ${game.odds?.total_line || 'N/A'}`,
      bold: metadata.bold_predictions?.summary || null
    },
    bold_predictions: metadata.bold_predictions || null,
    injury_summary: metadata.injury_summary || null,
    factors,
    market: {
      conf7,
      confAdj,
      confFinal,
      dominant: 'total' as const
    },
    results: {
      status: pick.status === 'won' ? 'win' : pick.status === 'lost' ? 'loss' : pick.status === 'push' ? 'push' : 'pending',
      finalScore: game.final_score ? {
        away: game.final_score.away,
        home: game.final_score.home
      } : undefined,
      postMortem: undefined
    },
    onClose: () => { }
  }
}

// Helper to get factor icons
function getFactorIcon(key: string): string {
  const iconMap: Record<string, string> = {
    edgeVsMarket: '💰',
    paceIndex: '⚡',
    offForm: '🎯',
    defErosion: '🛡️',
    threeEnv: '🏀',
    whistleEnv: '🎺',
    injuryAvailability: '🏥'
  }
  return iconMap[key] || '📊'
}
