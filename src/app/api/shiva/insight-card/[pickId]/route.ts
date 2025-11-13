import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Generate professional analyst-style writeup for TOTAL picks
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

/**
 * Generate professional analyst-style writeup for SPREAD picks
 */
function generateSpreadWriteup(
  pick: any,
  confidence: number,
  factors: any[],
  edgeRaw: number,
  awayTeam: string,
  homeTeam: string
): string {
  const selection = pick.selection
  const edge = Math.abs(edgeRaw)
  const favoredTeam = edgeRaw > 0 ? awayTeam : homeTeam
  const edgeDirection = edgeRaw > 0 ? 'favors the away team' : 'favors the home team'

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
  const intro = `Our advanced analytics model has identified ${confidenceTier} value on ${selection} in the ${awayTeam} at ${homeTeam} matchup.`

  const edgeAnalysis = `The model's predicted point differential ${edgeDirection} by ${edge.toFixed(1)} points more than the current market spread. This ${edge.toFixed(1)}-point edge represents a significant market inefficiency that we ${actionVerb}.`

  const factorSummary = factors.length > 0
    ? `This projection is supported by ${factors.length} key factors, including ${factors.slice(0, 3).map(f => f.label.toLowerCase()).join(', ')}${factors.length > 3 ? ', and others' : ''}.`
    : 'This projection is based on comprehensive statistical analysis.'

  const confidenceStatement = `With a confidence score of ${confidence.toFixed(1)}/10.0, this represents a ${confidenceTier}-conviction play in our spread betting model.`

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

    // Step 1.5: Get results analysis if pick is graded
    let resultsAnalysis: string | undefined = undefined
    let factorAccuracy: any[] = []
    let tuningSuggestions: any[] = []
    let overallAccuracy: number | undefined = undefined

    if (pick.status === 'won' || pick.status === 'lost' || pick.status === 'push') {
      console.log('[InsightCard] Pick is graded, fetching results analysis...')

      // Fetch results analysis
      const { data: analysis, error: analysisError } = await supabase
        .from('results_analysis')
        .select('id, analysis, overall_accuracy')
        .eq('pick_id', pickId)
        .single()

      if (!analysisError && analysis) {
        resultsAnalysis = analysis.analysis
        overallAccuracy = analysis.overall_accuracy
        console.log('[InsightCard] Results analysis found')

        // Fetch factor accuracy
        const { data: factors, error: factorsError } = await supabase
          .from('factor_accuracy')
          .select('*')
          .eq('pick_id', pickId)
          .order('accuracy_score', { ascending: false })

        if (!factorsError && factors) {
          factorAccuracy = factors
          console.log(`[InsightCard] Found ${factors.length} factor accuracy records`)
        }

        // Fetch tuning suggestions
        const { data: suggestions, error: suggestionsError } = await supabase
          .from('tuning_suggestions')
          .select('*')
          .eq('pick_id', pickId)
          .order('confidence', { ascending: false })

        if (!suggestionsError && suggestions) {
          tuningSuggestions = suggestions
          console.log(`[InsightCard] Found ${suggestions.length} tuning suggestions`)
        }
      } else {
        console.log('[InsightCard] No results analysis found (will be generated by cron)')
      }
    }

    console.log('[InsightCard] Pick found:', {
      pickId: pick.id,
      runId: pick.run_id,
      selection: pick.selection,
      hasGame: !!pick.games,
      hasInsightCardSnapshot: !!pick.insight_card_snapshot,
      insightCardLockedAt: pick.insight_card_locked_at
    })

    // CRITICAL: If insight card snapshot exists AND has factors, return it directly (immutable record)
    // This ensures transparency and prevents retroactive changes to pick rationale
    // BUGFIX: Only use snapshot if it has factors - otherwise fall through to rebuild from runs table
    if (pick.insight_card_snapshot && pick.insight_card_snapshot.factors && pick.insight_card_snapshot.factors.length > 0) {
      console.log('[InsightCard] 🔒 Returning LOCKED insight card snapshot from:', pick.insight_card_locked_at)

      // The snapshot is already stored in a structured format
      // We need to transform it to match the InsightCardProps interface
      const snapshot = pick.insight_card_snapshot

      // Extract pick type from snapshot
      const pickType = (snapshot.pick?.type || snapshot.metadata?.pick_type || pick.pick_type || 'TOTAL').toUpperCase()
      const isSpread = pickType === 'SPREAD'

      // Extract team names
      const awayTeamName = snapshot.matchup?.away?.name || snapshot.matchup?.away || 'Away'
      const homeTeamName = snapshot.matchup?.home?.name || snapshot.matchup?.home || 'Home'

      // Extract predicted scores from snapshot
      const predictedHomeScore = snapshot.predictions?.predicted_home_score || 0
      const predictedAwayScore = snapshot.predictions?.predicted_away_score || 0
      const predictedTotal = snapshot.predictions?.predicted_total || 0
      const marketTotal = snapshot.predictions?.market_total || 0

      // Extract confidence values from snapshot
      const conf7 = snapshot.confidence?.conf7 || 0
      const confMarketAdj = snapshot.confidence?.conf_market_adj || 0
      const confFinal = snapshot.confidence?.conf_final || snapshot.pick?.confidence || pick.confidence

      // Format totalText based on pick type
      const totalText = isSpread
        ? snapshot.pick?.selection || pick.selection  // e.g., "Phoenix Suns -5.5"
        : `O/U ${marketTotal.toFixed(1)}`

      // Map factors to insight card format
      const factors = (snapshot.factors || []).map((factor: any) => {
        // Get scores based on pick type
        let overScore = 0
        let underScore = 0

        // Check weighted_contributions first, then fall back to parsed_values_json
        const contributions = factor.weighted_contributions || factor.parsed_values_json || {}

        if (isSpread) {
          // SPREAD: Use awayScore/homeScore (NOT overScore/underScore)
          overScore = contributions.awayScore || 0
          underScore = contributions.homeScore || 0
        } else {
          // TOTAL: Use overScore/underScore
          overScore = contributions.overScore || 0
          underScore = contributions.underScore || 0
        }

        return {
          key: factor.key || factor.factor_key,
          label: factor.name || factor.factor_name || factor.key,
          icon: getFactorIcon(factor.key || factor.factor_key),
          overScore,
          underScore,
          weightAppliedPct: factor.weight_percentage || factor.weight_total_pct || 0,
          rationale: factor.notes || 'No rationale provided'
        }
      })

      // Extract bold predictions, professional analysis, and injury summary from snapshot
      const boldPredictions = snapshot.bold_predictions || null
      const professionalAnalysis = snapshot.professional_analysis || ''
      const injurySummary = snapshot.injury_summary || null

      // Generate professional writeup (use snapshot analysis if available, otherwise generate from data)
      let writeup = professionalAnalysis
      if (!writeup) {
        // Fallback to template-based generation
        if (isSpread) {
          const edge = Math.abs(predictedTotal)
          writeup = generateSpreadWriteup(snapshot.pick, confFinal, factors, predictedTotal, awayTeamName, homeTeamName)
        } else {
          writeup = generateProfessionalWriteup(snapshot.pick, confFinal, factors, predictedTotal, marketTotal, awayTeamName, homeTeamName)
        }
      }

      // Build the insight card data from the locked snapshot
      const lockedInsightCard = {
        capper: 'SHIVA',
        sport: 'NBA',
        gameId: pick.game_id,
        pickId: pick.id,
        generatedAt: pick.created_at,
        matchup: {
          away: awayTeamName,
          home: homeTeamName,
          spreadText: `${awayTeamName} @ ${homeTeamName}`,
          totalText,
          gameDateLocal: snapshot.matchup?.game_date || pick.created_at
        },
        pick: {
          type: pickType as 'SPREAD' | 'TOTAL',
          selection: snapshot.pick?.selection || pick.selection,
          units: snapshot.pick?.units || pick.units,
          confidence: snapshot.pick?.confidence || pick.confidence,
          locked_odds: snapshot.odds || null,
          locked_at: pick.insight_card_locked_at
        },
        predictedScore: {
          away: Math.round(predictedAwayScore || Math.floor(predictedTotal / 2)),
          home: Math.round(predictedHomeScore || Math.ceil(predictedTotal / 2)),
          winner: 'TBD'
        },
        factors,
        writeups: {
          prediction: writeup,
          gamePrediction: isSpread
            ? `Predicted margin: ${predictedTotal > 0 ? 'Away' : 'Home'} by ${Math.abs(predictedTotal).toFixed(1)} pts`
            : `Predicted total: ${predictedTotal.toFixed(1)} vs Market: ${marketTotal.toFixed(1)}`,
          bold: boldPredictions?.summary || null
        },
        bold_predictions: boldPredictions,
        injury_summary: injurySummary,
        market: {
          conf7,
          confAdj: confMarketAdj,
          confFinal,
          dominant: isSpread ? pick.selection : 'total' as const
        },
        results: {
          status: 'pending'
        },
        metadata: {
          ...snapshot.metadata,
          isLocked: true,
          lockedAt: pick.insight_card_locked_at
        }
      }

      return NextResponse.json({
        success: true,
        data: lockedInsightCard
      })
    } else if (pick.insight_card_snapshot) {
      console.warn('[InsightCard] ⚠️ Insight card snapshot exists but has NO FACTORS - falling back to rebuild from runs table')
      console.warn('[InsightCard] Snapshot factors:', pick.insight_card_snapshot.factors)
    }

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

    // Step 3: Extract data from run columns AND metadata (CRITICAL FIX)
    // PRIORITY: Check separate columns FIRST (new format), then fall back to metadata JSONB (old format)
    const metadata = run.metadata || {}
    const game = pick.games || {}

    // CRITICAL DEBUG: Log the full run structure to see what's available
    console.log('[InsightCard] 🔍 FULL RUN STRUCTURE:', {
      pickId,
      runId: run.run_id,
      hasMetadata: !!metadata,
      metadataKeys: metadata ? Object.keys(metadata) : [],
      hasFactorContributionsColumn: !!run.factor_contributions,
      factorContributionsCount: run.factor_contributions?.length || 0,
      hasPredictedTotal: !!run.predicted_total,
      hasBaselineAvg: !!run.baseline_avg,
      hasMarketTotal: !!run.market_total,
      runColumnsSample: {
        factor_contributions: run.factor_contributions,
        predicted_total: run.predicted_total,
        baseline_avg: run.baseline_avg,
        market_total: run.market_total
      }
    })

    // Extract all data - PRIORITY: separate columns FIRST, then metadata JSONB
    // CRITICAL FIX: The data is stored in separate columns (factor_contributions, predicted_total, etc.)
    // NOT in metadata JSONB! This is why insight cards were missing factor scores!
    const factorContributions = run.factor_contributions  // NEW: Separate column (PRIORITY)
      || metadata.factor_contributions                     // OLD: Top-level in metadata
      || metadata.steps?.step4?.confidence?.factorContributions  // OLDEST: Nested in steps
      || []

    const predictedTotal = run.predicted_total  // NEW: Separate column (PRIORITY)
      || metadata.predicted_total                // OLD: Top-level in metadata
      || metadata.steps?.step4?.predictions?.total_pred_points  // OLDEST: Nested in steps
      || 0

    const baselineAvg = run.baseline_avg  // NEW: Separate column (PRIORITY)
      || metadata.baseline_avg             // OLD: Top-level in metadata
      || metadata.steps?.step3?.baseline_avg  // OLDEST: Nested in steps
      || 220

    const marketTotal = run.market_total  // NEW: Separate column (PRIORITY)
      || metadata.market_total             // OLD: Top-level in metadata
      || metadata.steps?.step2?.snapshot?.total?.line  // OLDEST: Nested in steps
      || 0

    // Extract predicted scores from metadata (NO separate columns exist in runs table)
    const predictedHomeScore = metadata.predicted_home_score                    // Top-level in metadata
      || metadata.steps?.step4?.predictions?.scores?.home // Nested in steps
      || 0

    const predictedAwayScore = metadata.predicted_away_score                    // Top-level in metadata
      || metadata.steps?.step4?.predictions?.scores?.away // Nested in steps
      || 0

    // Extract bold predictions, professional analysis, and injury summary
    // PRIORITY: Use dedicated columns from runs table (NEW)
    // FALLBACK: Use metadata (OLD)
    const boldPredictions = run.bold_predictions  // NEW: Separate column (PRIORITY)
      || metadata.bold_predictions
      || metadata.steps?.step6?.bold_predictions
      || metadata.steps?.step5_5?.bold_predictions
      || metadata.steps?.['step5.5']?.bold_predictions
      || null

    const professionalAnalysis = run.professional_analysis  // NEW: Separate column (PRIORITY)
      || metadata.professional_analysis
      || ''

    const injurySummary = run.injury_summary  // NEW: Separate column (PRIORITY)
      || metadata.injury_summary
      || null

    // Extract confidence values
    const conf7 = metadata.steps?.step4?.predictions?.conf7_score || run.conf7 || 0
    const confMarketAdj = metadata.steps?.step5?.conf_market_adj || 0
    const confFinal = metadata.steps?.step5?.conf_final || run.conf_final || pick.confidence || 0

    console.log('[InsightCard] ✅ Data extracted:', {
      pickId,
      runId: run.run_id,
      factorCount: factorContributions.length,
      factorSample: factorContributions.length > 0 ? factorContributions[0] : 'NO FACTORS',
      predictedTotal,
      marketTotal,
      conf7,
      confMarketAdj,
      confFinal,
      hasBoldPredictions: !!boldPredictions,
      hasProfessionalAnalysis: !!professionalAnalysis,
      hasInjurySummary: !!injurySummary,
      boldPredictionsSource: run.bold_predictions ? 'runs.bold_predictions' : metadata.bold_predictions ? 'metadata' : 'null',
      professionalAnalysisSource: run.professional_analysis ? 'runs.professional_analysis' : 'null',
      injurySummarySource: run.injury_summary ? 'runs.injury_summary' : 'null'
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
      professionalAnalysis,
      injurySummary,
      conf7,
      confMarketAdj,
      confFinal,
      resultsAnalysis,
      factorAccuracy,
      tuningSuggestions,
      overallAccuracy
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
function buildInsightCard({ pick, game, run, factorContributions, predictedTotal, baselineAvg, marketTotal, predictedHomeScore, predictedAwayScore, boldPredictions, professionalAnalysis, injurySummary, conf7, confMarketAdj, confFinal, resultsAnalysis, factorAccuracy, tuningSuggestions, overallAccuracy }: any) {

  // Detect pick type from pick.pick_type
  const pickType = pick.pick_type?.toUpperCase() || 'TOTAL'
  const isSpread = pickType === 'SPREAD'
  const isTotal = pickType === 'TOTAL'

  console.log('[buildInsightCard] Pick type detected:', pickType)

  // Map factors to insight card format
  const baseFactors = factorContributions.map((factor: any) => {
    // Get weight percentage
    const weightPct = factor.weight_percentage || factor.weight_total_pct || 0
    const weightDecimal = weightPct / 100

    // Get scores based on pick type
    let overScore = 0
    let underScore = 0

    if (factor.weighted_contributions) {
      if (isSpread) {
        // SPREAD: Use awayScore/homeScore
        overScore = factor.weighted_contributions.awayScore || 0
        underScore = factor.weighted_contributions.homeScore || 0
      } else {
        // TOTAL: Use overScore/underScore
        overScore = factor.weighted_contributions.overScore || 0
        underScore = factor.weighted_contributions.underScore || 0
      }
    } else if (factor.parsed_values_json) {
      // Calculate from parsed values
      const parsed = factor.parsed_values_json
      if (isSpread) {
        // SPREAD: Use awayScore/homeScore
        overScore = (parsed.awayScore || 0) * weightDecimal
        underScore = (parsed.homeScore || 0) * weightDecimal
      } else {
        // TOTAL: Use overScore/underScore
        overScore = (parsed.overScore || 0) * weightDecimal
        underScore = (parsed.underScore || 0) * weightDecimal
      }
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

  // Calculate edge based on pick type
  let edgeRaw = 0
  let edgePct = confMarketAdj || 0

  if (isSpread) {
    // SPREAD: Edge = predicted margin vs market spread
    const predictedMargin = run.metadata?.steps?.step4?.predictions?.spread_pred_points || 0
    const marketSpread = run.metadata?.steps?.step2?.snapshot?.spread?.line || 0
    edgeRaw = predictedMargin - (-marketSpread) // Convert market spread to away perspective
    console.log('[buildInsightCard] SPREAD edge:', { predictedMargin, marketSpread, edgeRaw })
  } else {
    // TOTAL: Edge = predicted total vs market total
    edgeRaw = predictedTotal - marketTotal
    console.log('[buildInsightCard] TOTAL edge:', { predictedTotal, marketTotal, edgeRaw })
  }

  // Check if "Edge vs Market" factor already exists in baseFactors
  const hasEdgeFactor = baseFactors.some((f: any) => f.key === 'edgeVsMarket' || f.key === 'edgeVsMarketSpread')

  // Only add "Edge vs Market" factor if it doesn't already exist
  const factors = hasEdgeFactor ? baseFactors : [
    ...baseFactors,
    {
      key: isSpread ? 'edgeVsMarketSpread' : 'edgeVsMarket',
      label: isSpread ? 'Edge vs Market Spread' : 'Edge vs Market',
      icon: '💰',
      overScore: edgeRaw > 0 ? confMarketAdj : 0,
      underScore: edgeRaw < 0 ? Math.abs(confMarketAdj) : 0,
      weightAppliedPct: 100,
      rationale: isSpread
        ? `Edge: ${edgeRaw > 0 ? '+' : ''}${edgeRaw.toFixed(1)} pts spread advantage`
        : `Edge: ${edgeRaw > 0 ? '+' : ''}${edgeRaw.toFixed(1)} pts (Pred: ${predictedTotal.toFixed(1)} vs Mkt: ${marketTotal.toFixed(1)})`
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

  // Format totalText based on pick type
  // For SPREAD: Just show the predicted spread from selection (e.g., "Suns -5.5")
  // For TOTAL: Show the locked market total (e.g., "O/U 227.5")
  const totalText = isSpread
    ? pick.selection  // e.g., "Phoenix Suns -5.5"
    : `O/U ${marketTotal.toFixed(1)}`

  // Generate writeup: Use professionalAnalysis if available, otherwise fallback to template
  let writeup = professionalAnalysis
  if (!writeup) {
    // Fallback to template-based generation
    writeup = isSpread
      ? generateSpreadWriteup(pick, confFinal, factors, edgeRaw, awayTeamName, homeTeamName)
      : generateProfessionalWriteup(pick, confFinal, factors, predictedTotal, marketTotal, awayTeamName, homeTeamName)
  }

  // Generate game prediction text based on pick type
  const gamePrediction = isSpread
    ? `Predicted margin: ${edgeRaw > 0 ? 'Away' : 'Home'} by ${Math.abs(edgeRaw).toFixed(1)} pts`
    : `Predicted total: ${predictedTotal.toFixed(1)} vs Market: ${marketTotal.toFixed(1)}`

  // Build the insight card
  return {
    capper: 'SHIVA',
    capperIconUrl: null,
    sport: 'NBA' as const,
    gameId: game.id,
    pickId: pick.id,
    generatedAt: pick.created_at,
    is_system_pick: pick.is_system_pick !== false,  // Default to true if not specified
    matchup: {
      away: awayTeamName,
      home: homeTeamName,
      spreadText,
      totalText,
      gameDateLocal: game.game_start_timestamp || game.game_date || new Date().toISOString()
    },
    pick: {
      type: pickType as 'SPREAD' | 'TOTAL',
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
      prediction: writeup,
      gamePrediction,
      bold: boldPredictions?.summary || null
    },
    bold_predictions: boldPredictions,
    injury_summary: injurySummary,
    factors,
    market: {
      conf7: conf7,
      confAdj: confMarketAdj,
      confFinal: confFinal,
      dominant: isSpread ? 'spread' as const : 'total' as const
    },
    results: {
      status: pick.status === 'won' ? 'win'
        : pick.status === 'lost' ? 'loss'
          : pick.status === 'push' ? 'push'
            : 'pending',
      // Try game.final_score first, then fall back to pick.result.final_score
      finalScore: game.final_score ? {
        away: game.final_score.away,
        home: game.final_score.home
      } : pick.result?.final_score ? {
        away: pick.result.final_score.away,
        home: pick.result.final_score.home
      } : undefined,
      postMortem: resultsAnalysis,
      factorAccuracy: factorAccuracy || [],
      tuningSuggestions: tuningSuggestions || [],
      overallAccuracy: overallAccuracy
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
