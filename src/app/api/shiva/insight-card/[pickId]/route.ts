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

    // Fetch the pick and its associated run data from runs table (not shiva_runs)
    const { data: pick, error: pickError } = await supabase
      .from('picks')
      .select(`
        *,
        games(*)
      `)
      .eq('id', pickId)
      .single()

    if (pickError || !pick) {
      console.error('[InsightCard API] Pick not found:', pickError)
      return NextResponse.json(
        { error: 'Pick not found' },
        { status: 404 }
      )
    }

    console.log('[InsightCard API] Pick found:', pick.id)
    console.log('[InsightCard API] Pick.run_id:', pick.run_id)

    // Fetch the run data separately using run_id
    const { data: run, error: runError } = await supabase
      .from('runs')
      .select('*')
      .eq('run_id', pick.run_id)
      .maybeSingle()

    if (runError) {
      console.error('[InsightCard API] Error fetching run:', runError)
    }

    console.log('[InsightCard API] Run data:', run ? 'found' : 'not found')
    if (run) {
      console.log('[InsightCard API] Run columns:', {
        has_factor_contributions: !!run.factor_contributions,
        factor_contributions_length: Array.isArray(run.factor_contributions) ? run.factor_contributions.length : 'not array',
        has_predicted_total: !!run.predicted_total,
        predicted_total: run.predicted_total,
        has_baseline_avg: !!run.baseline_avg,
        baseline_avg: run.baseline_avg,
        has_market_total: !!run.market_total,
        market_total: run.market_total,
        has_metadata: !!run.metadata,
        metadata_keys: run.metadata ? Object.keys(run.metadata) : []
      })
    }

    const game = pick.games || {}

    // The runs table can have data in TWO formats:
    // 1. NEW format: separate columns (factor_contributions, predicted_total, baseline_avg, market_total)
    // 2. OLD format: metadata JSONB column with steps.step3, steps.step4, etc.

    let factorContributions = []
    let predictedTotal = 0
    let baselineAvg = 220
    let marketTotal = 0

    // Try NEW format first (separate columns)
    if (run?.factor_contributions && Array.isArray(run.factor_contributions) && run.factor_contributions.length > 0) {
      console.log('[InsightCard API] Using NEW format (separate columns)')
      factorContributions = run.factor_contributions
      predictedTotal = run.predicted_total || 0
      baselineAvg = run.baseline_avg || 220
      marketTotal = run.market_total || 0
    }
    // Fall back to OLD format (metadata.steps)
    else if (run?.metadata?.steps) {
      console.log('[InsightCard API] Using OLD format (metadata.steps)')
      const steps = run.metadata.steps

      // Extract factor contributions from step3 or step5
      if (steps.step5?.confidenceResult?.factorContributions) {
        factorContributions = steps.step5.confidenceResult.factorContributions
      } else if (steps.step3?.factorContributions) {
        factorContributions = steps.step3.factorContributions
      }

      // Extract predicted total from step4
      if (steps.step4?.predictions?.total) {
        predictedTotal = steps.step4.predictions.total
      }

      // Extract baseline from step2
      if (steps.step2?.baseline?.total) {
        baselineAvg = steps.step2.baseline.total
      }

      // Extract market total from metadata or game snapshot
      if (run.metadata.market_total) {
        marketTotal = run.metadata.market_total
      } else if (pick.game_snapshot?.total_line) {
        marketTotal = pick.game_snapshot.total_line
      }
    }
    // Last resort: try to extract from pick.game_snapshot
    else {
      console.log('[InsightCard API] No run data found, using pick.game_snapshot fallback')
      if (pick.game_snapshot?.total_line) {
        marketTotal = pick.game_snapshot.total_line
      }
    }

    console.log('[InsightCard API] Extracted data:', {
      format: run?.factor_contributions ? 'NEW (columns)' : run?.metadata?.steps ? 'OLD (metadata)' : 'FALLBACK',
      factorContributions: factorContributions.length,
      predictedTotal,
      baselineAvg,
      marketTotal
    })

    // Assemble insight card data from runs table columns
    const insightCardData = assembleInsightCardFromRun({
      game,
      pick,
      run,
      factorContributions,
      predictedTotal,
      baselineAvg,
      marketTotal
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

// Helper function to assemble insight card from runs table data
function assembleInsightCardFromRun({ game, pick, run, factorContributions, predictedTotal, baselineAvg, marketTotal }: any) {
  // Get confidence values from pick or run
  const confFinal = Number(pick.confidence ?? run?.confidence ?? 0)

  // Map factor contributions to insight card format
  const factors = (factorContributions || []).map((fc: any) => {
    // Factor contributions from runs table have this structure:
    // { key, name, overScore, underScore, weight, notes, weighted_contributions, weight_percentage, parsed_values_json }

    const weightPct = fc.weight_percentage ? Math.round(fc.weight_percentage) : (fc.weight_total_pct || 0)
    const weightDecimal = weightPct / 100
    const parsedValues = fc.parsed_values_json || {}

    // Use weighted contributions if available, otherwise calculate from raw scores
    let overScore = 0
    let underScore = 0

    if (fc.weighted_contributions) {
      overScore = Number(fc.weighted_contributions.overScore || 0)
      underScore = Number(fc.weighted_contributions.underScore || 0)
    } else if (parsedValues.overScore !== undefined || parsedValues.underScore !== undefined) {
      overScore = (parsedValues.overScore || 0) * weightDecimal
      underScore = (parsedValues.underScore || 0) * weightDecimal
    } else {
      // Fallback to direct scores
      overScore = Number(fc.overScore || 0)
      underScore = Number(fc.underScore || 0)
    }

    return {
      key: fc.key || fc.factor_key,
      label: fc.name || fc.factor_name || fc.key,
      icon: getFactorIcon(fc.key || fc.factor_key),
      overScore,
      underScore,
      weightAppliedPct: weightPct,
      rationale: fc.notes || fc.rationale || 'No rationale provided'
    }
  })

  // Calculate edge from predicted total vs market total
  const edgeRaw = predictedTotal && marketTotal ? predictedTotal - marketTotal : 0
  const edgePct = predictedTotal && marketTotal ? ((predictedTotal - marketTotal) / marketTotal) * 100 : 0

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
      totalText: `Current O/U ${marketTotal || game.odds?.total_line || 'N/A'}`,
      gameDateLocal: game.game_start_timestamp || `${game.game_date}T${game.game_time}Z`
    },
    pick: {
      type: (pick.pick_type?.toUpperCase() || 'TOTAL') as 'TOTAL',
      selection: pick.selection,
      units: pick.units,
      confidence: confFinal,
      edgeRaw,
      edgePct,
      confScore: confFinal,
      locked_odds: pick.game_snapshot || null,
      locked_at: pick.created_at
    },
    predictedScore: {
      away: Math.floor((predictedTotal || 0) / 2),
      home: Math.ceil((predictedTotal || 0) / 2),
      winner: 'TBD'
    },
    writeups: {
      prediction: `Model projects ${pick.selection} with ${confFinal.toFixed(1)}/5.0 confidence based on ${factors.length} factors.`,
      gamePrediction: `Predicted total: ${predictedTotal?.toFixed(1) || 'N/A'} vs Market: ${marketTotal?.toFixed(1) || game.odds?.total_line || 'N/A'}`,
      bold: null
    },
    bold_predictions: null,
    injury_summary: null,
    factors,
    market: {
      conf7: confFinal, // We don't have separate conf7 in runs table
      confAdj: 0, // We don't have separate confAdj in runs table
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
