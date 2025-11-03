import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0 // Disable caching completely

/**
 * GET /api/shiva/runs/history
 * Returns history of SHIVA runs with their outcomes
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const betType = searchParams.get('betType') // 'TOTAL' or 'SPREAD'

    const supabase = getSupabaseAdmin()

    // Fetch runs from the runs table
    // Production schema (033_fix_runs_table.sql): id, run_id, game_id, state, metadata
    const { data: runsData, error: runsError } = await supabase
      .from('runs')
      .select('id, run_id, game_id, state, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    console.log('[Run History] Fetched', runsData?.length || 0, 'runs from database')

    // Filter for SHIVA runs only (capper is in metadata)
    let shivaRuns = (runsData || []).filter((run: any) => run.metadata?.capper === 'shiva')

    // Filter by betType if provided
    if (betType) {
      const betTypeLower = betType === 'TOTAL' ? 'total' : 'spread'
      shivaRuns = shivaRuns.filter((run: any) => run.metadata?.betType === betTypeLower || run.metadata?.pick_type === betTypeLower)
      console.log('[Run History] Filtered to', shivaRuns.length, 'SHIVA runs with betType:', betType)
    } else {
      console.log('[Run History] Filtered to', shivaRuns.length, 'SHIVA runs (all bet types)')
    }

    // Log sample of first run to debug factor data
    if (shivaRuns.length > 0) {
      console.log('[Run History] Sample run:', {
        run_id: shivaRuns[0].run_id,
        metadata: shivaRuns[0].metadata
      })
    }

    if (runsError) {
      console.error('[Run History] Error fetching runs:', runsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch runs',
        details: runsError.message
      }, { status: 500 })
    }

    // Extract unique game IDs (excluding 'unknown')
    const gameIds = [...new Set(shivaRuns.map((run: any) => run.game_id).filter((id: string) => id && id !== 'unknown'))]

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
    const runs = shivaRuns.map((run: any, idx: number) => {
      const cooldown = cooldownMap.get(run.run_id)
      const metadata = run.metadata || {}

      // Debug: Log first run to inspect metadata
      if (idx === 0) {
        console.log('[Run History] First run from DB:', {
          run_id: run.run_id,
          metadata
        })
      }

      // Format matchup from game data or metadata
      let matchup = run.game_id
      const game = gamesMap.get(run.game_id)
      if (game && game.home_team && game.away_team) {
        const homeName = typeof game.home_team === 'string' ? game.home_team : game.home_team.name
        const awayName = typeof game.away_team === 'string' ? game.away_team : game.away_team.name
        matchup = `${awayName} @ ${homeName}`
      } else if (metadata.game?.home_team && metadata.game?.away_team) {
        matchup = `${metadata.game.away_team} @ ${metadata.game.home_team}`
      }

      return {
        id: run.id,
        run_id: run.run_id,
        game_id: run.game_id,
        capper: metadata.capper || 'shiva',
        pick_type: metadata.pick_type,
        selection: metadata.selection,
        units: cooldown?.units !== undefined ? cooldown.units : metadata.units,
        confidence: cooldown?.confidence_score !== undefined ? cooldown.confidence_score : metadata.confidence,
        created_at: run.created_at,
        factor_contributions: metadata.factor_contributions || [],
        predicted_total: metadata.predicted_total,
        baseline_avg: metadata.baseline_avg,
        market_total: metadata.market_total,
        matchup,
        cooldown_result: cooldown?.result || null,
        state: run.state
      }
    })

    const response = NextResponse.json({
      success: true,
      runs: runs,
      count: runs.length
    })

    // Add explicit no-cache headers to prevent stale data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response

  } catch (error: any) {
    console.error('[Run History] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

