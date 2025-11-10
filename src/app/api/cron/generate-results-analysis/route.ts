/**
 * AUTO-GENERATE RESULTS ANALYSIS CRON
 * 
 * Runs every 15 minutes to generate AI post-mortem analysis for newly graded picks
 * 
 * What it does:
 * 1. Finds picks that are graded (won/lost/push) but don't have results_analysis yet
 * 2. Generates AI analysis comparing prediction vs actual results
 * 3. Analyzes factor accuracy and generates tuning suggestions
 * 4. Stores analysis in results_analysis table for display in insight cards
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { generateResultsAnalysis, ResultsAnalysisInput } from '@/lib/cappers/results-analysis-generator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

export async function GET() {
  const executionTime = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🧠 [RESULTS-ANALYSIS-CRON] EXECUTION START: ${executionTime}`)
  console.log(`${'='.repeat(80)}\n`)

  const admin = getSupabaseAdmin()
  let processedCount = 0
  let errorCount = 0

  try {
    // Find graded picks without results analysis
    console.log('🔍 [RESULTS-ANALYSIS-CRON] Finding graded picks without analysis...')
    
    const { data: picks, error: picksError } = await admin
      .from('picks')
      .select(`
        id,
        game_id,
        pick_type,
        selection,
        status,
        units,
        confidence,
        graded_at,
        result,
        run_id
      `)
      .in('status', ['won', 'lost', 'push'])
      .is('game_id', null) // Only picks with archived games (game_id is NULL)
      .order('graded_at', { ascending: false })
      .limit(10) // Process max 10 picks per run

    if (picksError) {
      console.error('❌ [RESULTS-ANALYSIS-CRON] Error fetching picks:', picksError)
      return NextResponse.json({ 
        error: 'Failed to fetch picks',
        details: picksError.message 
      }, { status: 500 })
    }

    if (!picks || picks.length === 0) {
      console.log('✅ [RESULTS-ANALYSIS-CRON] No picks need analysis')
      return NextResponse.json({
        success: true,
        message: 'No picks need analysis',
        processed: 0
      })
    }

    console.log(`📊 [RESULTS-ANALYSIS-CRON] Found ${picks.length} picks to analyze`)

    // Filter out picks that already have analysis
    const pickIds = picks.map(p => p.id)
    const { data: existingAnalysis } = await admin
      .from('results_analysis')
      .select('pick_id')
      .in('pick_id', pickIds)

    const existingPickIds = new Set(existingAnalysis?.map(a => a.pick_id) || [])
    const picksNeedingAnalysis = picks.filter(p => !existingPickIds.has(p.id))

    if (picksNeedingAnalysis.length === 0) {
      console.log('✅ [RESULTS-ANALYSIS-CRON] All picks already have analysis')
      return NextResponse.json({
        success: true,
        message: 'All picks already analyzed',
        processed: 0
      })
    }

    console.log(`🎯 [RESULTS-ANALYSIS-CRON] ${picksNeedingAnalysis.length} picks need analysis`)

    // Process each pick
    for (const pick of picksNeedingAnalysis) {
      try {
        console.log(`\n📝 [RESULTS-ANALYSIS-CRON] Processing pick ${pick.id}...`)

        // Fetch run data for this pick
        const { data: run, error: runError } = await admin
          .from('shiva_runs')
          .select('*')
          .eq('id', pick.run_id)
          .single()

        if (runError || !run) {
          console.error(`⚠️  [RESULTS-ANALYSIS-CRON] No run data for pick ${pick.id}, skipping`)
          errorCount++
          continue
        }

        // Extract data from run metadata
        const metadata = run.metadata || {}
        const step3 = metadata.steps?.step3 || {}
        const step4 = metadata.steps?.step4 || {}
        const step5 = metadata.steps?.step5 || {}

        // Get final score from pick.result
        const finalScore = pick.result?.final_score
        if (!finalScore) {
          console.error(`⚠️  [RESULTS-ANALYSIS-CRON] No final score for pick ${pick.id}, skipping`)
          errorCount++
          continue
        }

        // Build analysis input
        const betType = pick.pick_type.toUpperCase()
        const isSpread = betType === 'SPREAD'
        const isTotal = betType === 'TOTAL'

        // Extract market line from selection
        let marketLine = 0
        if (isTotal) {
          const match = pick.selection.match(/[\d.]+/)
          marketLine = match ? parseFloat(match[0]) : 0
        } else if (isSpread) {
          const match = pick.selection.match(/[-+]?[\d.]+/)
          marketLine = match ? parseFloat(match[0]) : 0
        }

        // Calculate actual total or margin
        const actualTotal = finalScore.away + finalScore.home
        const actualMargin = finalScore.home - finalScore.away

        const analysisInput: ResultsAnalysisInput = {
          pickId: pick.id,
          gameId: pick.game_id || 'archived',
          betType: betType as 'TOTAL' | 'SPREAD',
          selection: pick.selection,
          predictedValue: isTotal 
            ? (step4.predicted_total || 0)
            : (step4.predicted_margin || 0),
          marketLine,
          actualTotal: isTotal ? actualTotal : undefined,
          actualMargin: isSpread ? actualMargin : undefined,
          outcome: pick.status as 'won' | 'lost' | 'push',
          confidence: parseFloat(pick.confidence || '0'),
          factors: step3.factors || [],
          professionalAnalysis: run.professional_analysis || 'No analysis available',
          finalScore: {
            away: finalScore.away,
            home: finalScore.home
          },
          game: {
            homeTeam: metadata.game?.home_team?.name || 'Home',
            awayTeam: metadata.game?.away_team?.name || 'Away',
            gameDate: metadata.game?.game_date || new Date().toISOString().split('T')[0]
          }
        }

        console.log(`🤖 [RESULTS-ANALYSIS-CRON] Generating AI analysis for pick ${pick.id}...`)

        // Generate results analysis
        const results = await generateResultsAnalysis(analysisInput)

        // Store in database
        const { error: insertError } = await admin
          .from('results_analysis')
          .insert({
            pick_id: pick.id,
            game_id: pick.game_id || null,
            analysis: results.analysis,
            overall_accuracy: results.overallAccuracy,
            generated_at: results.generatedAt
          })

        if (insertError) {
          console.error(`❌ [RESULTS-ANALYSIS-CRON] Error storing analysis for pick ${pick.id}:`, insertError)
          errorCount++
          continue
        }

        // Store factor accuracy
        if (results.factorAccuracy && results.factorAccuracy.length > 0) {
          const factorAccuracyRecords = results.factorAccuracy.map(fa => ({
            pick_id: pick.id,
            factor_key: fa.factorKey,
            factor_name: fa.factorName,
            contribution: fa.contribution,
            was_correct: fa.wasCorrect,
            accuracy_score: fa.accuracyScore,
            impact: fa.impact,
            reasoning: fa.reasoning
          }))

          await admin.from('factor_accuracy').insert(factorAccuracyRecords)
        }

        // Store tuning suggestions
        if (results.tuningSuggestions && results.tuningSuggestions.length > 0) {
          const tuningSuggestionRecords = results.tuningSuggestions.map(ts => ({
            pick_id: pick.id,
            factor_key: ts.factorKey,
            current_weight: ts.currentWeight,
            suggested_weight: ts.suggestedWeight,
            reasoning: ts.reasoning,
            confidence: ts.confidence
          }))

          await admin.from('tuning_suggestions').insert(tuningSuggestionRecords)
        }

        console.log(`✅ [RESULTS-ANALYSIS-CRON] Analysis generated for pick ${pick.id}`)
        processedCount++

      } catch (error) {
        console.error(`❌ [RESULTS-ANALYSIS-CRON] Error processing pick ${pick.id}:`, error)
        errorCount++
      }
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`🧠 [RESULTS-ANALYSIS-CRON] EXECUTION COMPLETE`)
    console.log(`✅ Processed: ${processedCount}`)
    console.log(`❌ Errors: ${errorCount}`)
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      processed: processedCount,
      errors: errorCount,
      timestamp: executionTime
    })

  } catch (error) {
    console.error('❌ [RESULTS-ANALYSIS-CRON] Fatal error:', error)
    return NextResponse.json({
      error: 'Fatal error in results analysis cron',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

