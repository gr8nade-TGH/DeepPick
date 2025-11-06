/**
 * SHIVA Results Analysis API
 * 
 * Generates post-game analysis comparing predictions to actual results
 * Analyzes factor accuracy and generates tuning suggestions
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { generateResultsAnalysis, ResultsAnalysisInput } from '@/lib/cappers/results-analysis-generator'

export const runtime = 'nodejs'
export const maxDuration = 60  // Allow up to 60 seconds for analysis

const ResultsAnalysisSchema = z.object({
  pickId: z.string().uuid(),
})

/**
 * POST /api/shiva/results-analysis
 * 
 * Generate results analysis for a completed pick
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Parse request body
    const body = await request.json().catch(() => null)
    const parse = ResultsAnalysisSchema.safeParse(body)
    
    if (!parse.success) {
      return Response.json(
        { error: 'Invalid request body', issues: parse.error.issues },
        { status: 400 }
      )
    }
    
    const { pickId } = parse.data
    
    console.log('[ResultsAnalysis] Starting analysis for pick:', pickId)
    
    // Fetch pick data
    const admin = getSupabaseAdmin()
    const { data: pick, error: pickError } = await admin
      .from('picks')
      .select(`
        *,
        games (
          id,
          sport,
          home_team,
          away_team,
          game_date,
          final_score,
          status
        ),
        runs (
          professional_analysis,
          bold_predictions,
          factor_contributions,
          predicted_total,
          baseline_avg,
          market_total,
          conf_final
        )
      `)
      .eq('id', pickId)
      .single()
    
    if (pickError || !pick) {
      console.error('[ResultsAnalysis] Pick not found:', pickError)
      return Response.json(
        { error: 'Pick not found' },
        { status: 404 }
      )
    }
    
    // Verify game is completed
    if (pick.games?.status !== 'Final' && pick.games?.status !== 'Completed') {
      return Response.json(
        { error: 'Game not completed yet', status: pick.games?.status },
        { status: 400 }
      )
    }
    
    // Verify pick has been graded
    if (pick.status === 'pending') {
      return Response.json(
        { error: 'Pick not graded yet' },
        { status: 400 }
      )
    }
    
    // Check if analysis already exists
    const { data: existingAnalysis } = await admin
      .from('results_analysis')
      .select('id')
      .eq('pick_id', pickId)
      .single()
    
    if (existingAnalysis) {
      console.log('[ResultsAnalysis] Analysis already exists for pick:', pickId)
      return Response.json(
        { message: 'Analysis already exists', analysisId: existingAnalysis.id },
        { status: 200 }
      )
    }
    
    // Parse final score
    const finalScore = pick.games?.final_score || {}
    const awayScore = finalScore.away || 0
    const homeScore = finalScore.home || 0
    const actualTotal = awayScore + homeScore
    const actualMargin = homeScore - awayScore
    
    // Build analysis input
    const analysisInput: ResultsAnalysisInput = {
      pickId: pick.id,
      gameId: pick.game_id,
      betType: pick.bet_type as 'TOTAL' | 'SPREAD',
      selection: pick.selection,
      predictedValue: pick.runs?.predicted_total || 0,
      marketLine: pick.runs?.market_total || 0,
      confidence: pick.runs?.conf_final || 0,
      units: pick.units || 0,
      professionalAnalysis: pick.runs?.professional_analysis || '',
      boldPredictions: pick.runs?.bold_predictions || null,
      factors: pick.runs?.factor_contributions || [],
      finalScore: {
        away: awayScore,
        home: homeScore
      },
      actualTotal,
      actualMargin,
      outcome: pick.status as 'won' | 'lost' | 'push',
      game: {
        away_team: pick.games?.away_team || '',
        home_team: pick.games?.home_team || '',
        game_date: pick.games?.game_date || ''
      }
    }
    
    // Generate results analysis
    console.log('[ResultsAnalysis] Generating analysis...')
    const results = await generateResultsAnalysis(analysisInput)
    
    // Store results in database
    console.log('[ResultsAnalysis] Storing results in database...')
    
    // Insert results_analysis
    const { data: analysisRecord, error: analysisError } = await admin
      .from('results_analysis')
      .insert({
        pick_id: pickId,
        game_id: pick.game_id,
        analysis: results.analysis,
        overall_accuracy: results.overallAccuracy,
        generated_at: results.generatedAt
      })
      .select()
      .single()
    
    if (analysisError) {
      console.error('[ResultsAnalysis] Error storing analysis:', analysisError)
      return Response.json(
        { error: 'Failed to store analysis', details: analysisError.message },
        { status: 500 }
      )
    }
    
    // Insert factor_accuracy records
    if (results.factorAccuracy.length > 0) {
      const factorAccuracyRecords = results.factorAccuracy.map(f => ({
        results_analysis_id: analysisRecord.id,
        pick_id: pickId,
        factor_id: f.factorId,
        factor_name: f.factorName,
        contribution: f.contribution,
        was_correct: f.wasCorrect,
        accuracy_score: f.accuracyScore,
        impact: f.impact,
        reasoning: f.reasoning
      }))
      
      const { error: factorError } = await admin
        .from('factor_accuracy')
        .insert(factorAccuracyRecords)
      
      if (factorError) {
        console.error('[ResultsAnalysis] Error storing factor accuracy:', factorError)
      }
    }
    
    // Insert tuning_suggestions records
    if (results.tuningSuggestions.length > 0) {
      const tuningSuggestionRecords = results.tuningSuggestions.map(s => ({
        results_analysis_id: analysisRecord.id,
        pick_id: pickId,
        factor_id: s.factorId,
        factor_name: s.factorName,
        current_weight: s.currentWeight,
        suggested_weight: s.suggestedWeight,
        change_percent: s.changePercent,
        reason: s.reason,
        confidence: s.confidence,
        sample_size: s.sampleSize
      }))
      
      const { error: suggestionError } = await admin
        .from('tuning_suggestions')
        .insert(tuningSuggestionRecords)
      
      if (suggestionError) {
        console.error('[ResultsAnalysis] Error storing tuning suggestions:', suggestionError)
      }
    }
    
    console.log('[ResultsAnalysis] Analysis complete:', {
      pickId,
      analysisId: analysisRecord.id,
      overallAccuracy: results.overallAccuracy,
      factorCount: results.factorAccuracy.length,
      suggestionCount: results.tuningSuggestions.length,
      latencyMs: Date.now() - startTime
    })
    
    return Response.json({
      success: true,
      analysisId: analysisRecord.id,
      overallAccuracy: results.overallAccuracy,
      factorAccuracy: results.factorAccuracy,
      tuningSuggestions: results.tuningSuggestions,
      latencyMs: Date.now() - startTime
    })
    
  } catch (error) {
    console.error('[ResultsAnalysis] Error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      latencyMs: Date.now() - startTime
    })
    
    return Response.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/shiva/results-analysis?pickId=xxx
 * 
 * Retrieve results analysis for a pick
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const pickId = searchParams.get('pickId')
    
    if (!pickId) {
      return Response.json(
        { error: 'pickId parameter required' },
        { status: 400 }
      )
    }
    
    const admin = getSupabaseAdmin()
    
    // Fetch results analysis with related data
    const { data: analysis, error } = await admin
      .from('results_analysis')
      .select(`
        *,
        factor_accuracy (*),
        tuning_suggestions (*)
      `)
      .eq('pick_id', pickId)
      .single()
    
    if (error || !analysis) {
      return Response.json(
        { error: 'Analysis not found' },
        { status: 404 }
      )
    }
    
    return Response.json(analysis)
    
  } catch (error) {
    console.error('[ResultsAnalysis] GET error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

