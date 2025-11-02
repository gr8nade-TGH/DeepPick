import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Generate professional analyst-style writeup for the pick
 */
function generateProfessionalWriteup(
  pick: any,
  confidence: number,
  factors: any[],
  predictedTotal: number,
  marketTotal: number,
  awayTeam: string,
  homeTeam: string
): string {
  const selection = pick.selection
  const edge = Math.abs(predictedTotal - marketTotal)
  const edgeDirection = predictedTotal > marketTotal ? 'higher' : 'lower'

  // Confidence tier messaging
  let confidenceTier = ''
  let actionVerb = ''
  if (confidence >= 9) {
    confidenceTier = 'exceptional'
    actionVerb = 'strongly recommend'
  } else if (confidence >= 8) {
    confidenceTier = 'high'
    actionVerb = 'recommend'
  } else if (confidence >= 7) {
    confidenceTier = 'strong'
    actionVerb = 'favor'
  } else if (confidence >= 6) {
    confidenceTier = 'moderate'
    actionVerb = 'lean toward'
  } else {
    confidenceTier = 'developing'
    actionVerb = 'identify value in'
  }

  // Build narrative
  const intro = `Our advanced analytics model has identified ${confidenceTier} value on the ${selection} ${marketTotal.toFixed(1)} in the ${awayTeam} at ${homeTeam} matchup.`

  const edgeAnalysis = `The model projects a total of ${predictedTotal.toFixed(1)} points, which is ${edge.toFixed(1)} points ${edgeDirection} than the current market line. This ${edge.toFixed(1)}-point edge represents a significant market inefficiency that we ${actionVerb}.`

  const factorSummary = factors.length > 0
    ? `This projection is supported by ${factors.length} key factors, including ${factors.slice(0, 3).map(f => f.label.toLowerCase()).join(', ')}${factors.length > 3 ? ', and others' : ''}.`
    : 'This projection is based on comprehensive statistical analysis.'

  const confidenceStatement = `With a confidence score of ${confidence.toFixed(1)}/10.0, this represents a ${confidenceTier}-conviction play in our betting model.`

  return `${intro} ${edgeAnalysis} ${factorSummary} ${confidenceStatement}`
}

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

    // Check if run_id is null
    if (!pick.run_id) {
      console.error('[InsightCard] Pick has NULL run_id - this is a data integrity issue:', {
        pickId: pick.id,
        createdAt: pick.created_at,
        selection: pick.selection
      })
      return NextResponse.json(
        {
          error: 'Pick has no associated run data',
          details: 'The pick was created without a run_id. This is a bug in pick generation.'
        },
        { status: 500 }
      )
    }

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

    // Extract all data from metadata - check both top-level and nested in steps
    const factorContributions = metadata.factor_contributions
      || metadata.steps?.step4?.confidence?.factorContributions
      || []

    const predictedTotal = metadata.predicted_total
      || metadata.steps?.step4?.predictions?.total_pred_points
      || 0

    const baselineAvg = metadata.baseline_avg
      || metadata.steps?.step3?.baseline_avg
      || 220

    const marketTotal = metadata.market_total
      || metadata.steps?.step2?.snapshot?.total?.line
      || 0

    const predictedHomeScore = metadata.predicted_home_score
      || metadata.steps?.step4?.predictions?.scores?.home
      || 0

    const predictedAwayScore = metadata.predicted_away_score
      || metadata.steps?.step4?.predictions?.scores?.away
      || 0

    const boldPredictions = metadata.bold_predictions
      || metadata.steps?.step6?.bold_predictions
      || metadata.steps?.step5_5?.bold_predictions
      || metadata.steps?.['step5.5']?.bold_predictions
      || null

    // Extract confidence values
    const conf7 = metadata.steps?.step4?.predictions?.conf7_score || run.conf7 || 0
    const confMarketAdj = metadata.steps?.step5?.conf_market_adj || 0
    const confFinal = metadata.steps?.step5?.conf_final || run.conf_final || pick.confidence || 0

    console.log('[InsightCard] Data extracted:', {
      pickId,
      runId: run.run_id,
      factorCount: factorContributions.length,
      predictedTotal,
      marketTotal,
      conf7,
      confMarketAdj,
      confFinal,
      hasBoldPredictions: !!boldPredictions,
      boldPredictionsSource: boldPredictions ? 'found' : 'null',
      metadataStepKeys: metadata.steps ? Object.keys(metadata.steps) : [],
      step6Keys: metadata.steps?.step6 ? Object.keys(metadata.steps.step6) : [],
      step5_5Keys: metadata.steps?.step5_5 ? Object.keys(metadata.steps.step5_5) : []
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
      boldPredictions,
      conf7,
      confMarketAdj,
      confFinal
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
function buildInsightCard({ pick, game, run, factorContributions, predictedTotal, baselineAvg, marketTotal, predictedHomeScore, predictedAwayScore, boldPredictions, conf7, confMarketAdj, confFinal }: any) {

  // Map factors to insight card format
  const baseFactors = factorContributions.map((factor: any) => {
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

  // Calculate edge in points
  const edgeRaw = predictedTotal - marketTotal

  // Calculate edge percentage properly:
  // Edge % = (Our implied probability - Market implied probability)
  // For totals: Convert point difference to probability difference
  // Simplified: Use the confidence adjustment as the edge percentage
  const edgePct = confMarketAdj || 0

  // Check if "Edge vs Market" factor already exists in baseFactors
  const hasEdgeFactor = baseFactors.some((f: any) => f.key === 'edgeVsMarket')

  // Only add "Edge vs Market" factor if it doesn't already exist
  const factors = hasEdgeFactor ? baseFactors : [
    ...baseFactors,
    {
      key: 'edgeVsMarket',
      label: 'Edge vs Market',
      icon: '💰',
      overScore: edgeRaw > 0 ? confMarketAdj : 0,
      underScore: edgeRaw < 0 ? Math.abs(confMarketAdj) : 0,
      weightAppliedPct: 100,
      rationale: `Edge: ${edgeRaw > 0 ? '+' : ''}${edgeRaw.toFixed(1)} pts (Pred: ${predictedTotal.toFixed(1)} vs Mkt: ${marketTotal.toFixed(1)})`
    }
  ]

  // Extract team names from game_snapshot or game object
  const awayTeamName = pick.game_snapshot?.away_team?.name
    || pick.game_snapshot?.away_team
    || game.away_team?.name
    || game.away_team
    || 'Away'

  const homeTeamName = pick.game_snapshot?.home_team?.name
    || pick.game_snapshot?.home_team
    || game.home_team?.name
    || game.home_team
    || 'Home'

  // Format spread text: "Away Team @ Home Team" or "Away +7.5 @ Home -7.5"
  const spreadData = pick.game_snapshot?.spread || game.spread || null
  const spreadLine = spreadData?.line || game.spread_line || null
  const favTeam = spreadData?.fav_team || null

  let spreadText = `${awayTeamName} @ ${homeTeamName}`
  if (spreadLine && favTeam) {
    // Determine which team is favored
    const isFavHome = favTeam === homeTeamName || favTeam.includes(homeTeamName)
    const awaySpread = isFavHome ? `+${Math.abs(spreadLine)}` : `-${Math.abs(spreadLine)}`
    const homeSpread = isFavHome ? `-${Math.abs(spreadLine)}` : `+${Math.abs(spreadLine)}`
    spreadText = `${awayTeamName} ${awaySpread} @ ${homeTeamName} ${homeSpread}`
  }

  // Build the insight card
  return {
    capper: 'SHIVA',
    capperIconUrl: null,
    sport: 'NBA' as const,
    gameId: game.id,
    pickId: pick.id,
    generatedAt: pick.created_at,
    matchup: {
      away: awayTeamName,
      home: homeTeamName,
      spreadText,
      totalText: `Locked O/U ${marketTotal.toFixed(1)}`,
      gameDateLocal: game.game_start_timestamp || game.game_date || new Date().toISOString()
    },
    pick: {
      type: 'TOTAL' as const,
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
      away: Math.round(predictedAwayScore || Math.floor(predictedTotal / 2)),
      home: Math.round(predictedHomeScore || Math.ceil(predictedTotal / 2)),
      winner: 'TBD'
    },
    writeups: {
      prediction: generateProfessionalWriteup(pick, confFinal, factors, predictedTotal, marketTotal, awayTeamName, homeTeamName),
      gamePrediction: `Predicted total: ${predictedTotal.toFixed(1)} vs Market: ${marketTotal.toFixed(1)}`,
      bold: boldPredictions?.summary || null
    },
    bold_predictions: boldPredictions,
    injury_summary: null,
    factors,
    market: {
      conf7: conf7,
      confAdj: confMarketAdj,
      confFinal: confFinal,
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
