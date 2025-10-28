import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/shiva/runs/history
 * Returns history of SHIVA runs with their outcomes
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = getSupabaseAdmin()

    // Fetch runs from the runs table
    const { data: runsData, error: runsError } = await supabase
      .from('runs')
      .select('id, run_id, game_id, capper, pick_type, selection, units, confidence, created_at')
      .eq('capper', 'shiva') // Filter for SHIVA only
      .order('created_at', { ascending: false })
      .limit(limit)
    
    console.log('[Run History] Fetched', runsData?.length || 0, 'SHIVA runs from database')

    if (runsError) {
      console.error('[Run History] Error fetching runs:', runsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch runs',
        details: runsError.message
      }, { status: 500 })
    }

    // Extract unique game IDs (excluding 'unknown')
    const gameIds = [...new Set((runsData || []).map(run => run.game_id).filter(id => id && id !== 'unknown'))]
    
    // Fetch games data
    let gamesMap = new Map()
    if (gameIds.length > 0) {
      const { data: gamesData } = await supabase
        .from('games')
        .select('id, home_team, away_team')
        .in('id', gameIds)
      
      gamesData?.forEach(game => {
        gamesMap.set(game.id, game)
      })
    }

    // Fetch cooldown records to get PASS/PICK_GENERATED outcomes
    const { data: cooldownsData } = await supabase
      .from('pick_generation_cooldowns')
      .select('run_id, result, units, confidence_score')
      .eq('capper', 'shiva')

    // Create a map of run_id -> cooldown data
    const cooldownMap = new Map()
    cooldownsData?.forEach(cd => {
      cooldownMap.set(cd.run_id, cd)
    })

    // Merge cooldown data into runs and format matchup
    const runs = (runsData || []).map((run: any) => {
      const cooldown = cooldownMap.get(run.run_id)
      
      // Format matchup from game data
      let matchup = run.game_id
      const game = gamesMap.get(run.game_id)
      if (game && game.home_team && game.away_team) {
        const homeName = typeof game.home_team === 'string' ? game.home_team : game.home_team.name
        const awayName = typeof game.away_team === 'string' ? game.away_team : game.away_team.name
        matchup = `${awayName} @ ${homeName}`
      }
      
      return {
        ...run,
        matchup: matchup,
        cooldown_result: cooldown?.result || null,
        // Override units and confidence if cooldown has more accurate data
        units: cooldown?.units !== undefined ? cooldown.units : run.units,
        confidence: cooldown?.confidence_score !== undefined ? cooldown.confidence_score : run.confidence,
      }
    })

    return NextResponse.json({
      success: true,
      runs: runs,
      count: runs.length
    })

  } catch (error: any) {
    console.error('[Run History] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

