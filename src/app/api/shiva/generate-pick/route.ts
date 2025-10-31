import { NextResponse } from 'next/server'
import { analyzeBatch } from '@/lib/cappers/shiva-algorithm'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for full pick generation

/**
 * Simplified SHIVA pick generation endpoint for cron jobs
 * 
 * This endpoint runs the complete pick generation flow for a single game:
 * 1. Validate the selected game
 * 2. Run Shiva algorithm (baseline + AI + vegas comparison)
 * 3. Generate pick if confidence >= threshold
 * 4. Save to database
 * 
 * Usage: POST /api/shiva/generate-pick
 * Body: { selectedGame: { id, home_team, away_team, game_date, game_time, total_line, spread_line, odds, status } }
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    console.log('🎯 [SHIVA:GeneratePick] Starting pick generation...')
    
    const body = await request.json()
    const { selectedGame } = body
    
    if (!selectedGame || !selectedGame.id) {
      return NextResponse.json({
        success: false,
        error: 'Missing selectedGame in request body',
        decision: 'ERROR'
      }, { status: 400 })
    }
    
    console.log(`🎮 [SHIVA:GeneratePick] Processing game: ${selectedGame.away_team?.name || selectedGame.away_team} @ ${selectedGame.home_team?.name || selectedGame.home_team}`)
    
    // Get Supabase client
    const supabase = getSupabaseAdmin()
    
    // Fetch the full game data from database
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', selectedGame.id)
      .single()
    
    if (gameError || !game) {
      console.error('[SHIVA:GeneratePick] Game not found:', gameError)
      return NextResponse.json({
        success: false,
        error: 'Game not found',
        decision: 'ERROR'
      }, { status: 404 })
    }
    
    console.log('[SHIVA:GeneratePick] Running Shiva algorithm...')
    
    // Prepare game for analysis
    const maxPicks = 1
    const existingPicksByGame = new Map<string, Set<string>>()
    
    // Run Shiva algorithm
    const results = await analyzeBatch([game], maxPicks, existingPicksByGame, { skipTimeValidation: true })
    
    const duration = Date.now() - startTime
    
    if (!results || results.length === 0) {
      console.log('[SHIVA:GeneratePick] No results from algorithm')
      return NextResponse.json({
        success: false,
        decision: 'PASS',
        message: 'Algorithm returned no results',
        duration: `${duration}ms`
      })
    }
    
    const result = results[0]
    
    if (!result.pick) {
      console.log('[SHIVA:GeneratePick] Algorithm decided to PASS')
      return NextResponse.json({
        success: false,
        decision: 'PASS',
        message: 'Algorithm decided not to pick this game',
        confidence: result.log?.confidence || 0,
        duration: `${duration}ms`
      })
    }
    
    const pick = result.pick
    
    console.log(`✅ [SHIVA:GeneratePick] Pick generated: ${pick.selection} (${pick.units} units, ${pick.confidence}% confidence)`)
    
    // Save pick to database
    const { data: savedPick, error: saveError } = await supabase
      .from('picks')
      .insert({
        game_id: game.id,
        capper: 'shiva',
        pick_type: pick.pickType.toLowerCase(),
        selection: pick.selection,
        odds: pick.odds || 0,
        units: pick.units,
        confidence: pick.confidence,
        game_snapshot: {
          home_team: game.home_team,
          away_team: game.away_team,
          game_date: game.game_date,
          game_time: game.game_time,
          total_line: game.total_line,
          spread_line: game.spread_line,
          odds: game.odds
        },
        status: 'pending'
      })
      .select()
      .single()
    
    if (saveError) {
      console.error('[SHIVA:GeneratePick] Error saving pick:', saveError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save pick',
        details: saveError.message,
        decision: 'ERROR'
      }, { status: 500 })
    }
    
    console.log(`💾 [SHIVA:GeneratePick] Pick saved to database: ${savedPick.id}`)
    
    return NextResponse.json({
      success: true,
      decision: 'PICK',
      message: 'Pick generated successfully',
      pick: {
        id: savedPick.id,
        game_id: game.id,
        pick_type: pick.pickType,
        selection: pick.selection,
        units: pick.units,
        confidence: pick.confidence,
        odds: pick.odds
      },
      duration: `${duration}ms`
    })
    
  } catch (error) {
    console.error('❌ [SHIVA:GeneratePick] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      decision: 'ERROR'
    }, { status: 500 })
  }
}

