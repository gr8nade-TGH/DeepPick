import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/debug/capper-picks?capper=gr8nade
 * 
 * Debug endpoint to check a capper's picks and their grading status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const capperId = searchParams.get('capper') || 'gr8nade'

    const supabase = getSupabaseAdmin()

    // Get all picks for this capper (case-insensitive)
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select(`
        id,
        game_id,
        capper,
        pick_type,
        selection,
        units,
        status,
        net_units,
        created_at,
        graded_at,
        game_snapshot
      `)
      .ilike('capper', capperId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (picksError) {
      return NextResponse.json({ error: picksError.message }, { status: 500 })
    }

    // Get game statuses for these picks
    const gameIds = picks?.map(p => p.game_id).filter(Boolean) || []
    const { data: games } = await supabase
      .from('games')
      .select('id, status, final_score, home_team, away_team')
      .in('id', gameIds)

    // Create a map of game statuses
    const gameMap = new Map(games?.map(g => [g.id, g]) || [])

    // Analyze picks
    const pickAnalysis = picks?.map(pick => {
      const game = gameMap.get(pick.game_id)
      const snapshot = pick.game_snapshot as any

      return {
        pickId: pick.id,
        gameId: pick.game_id,
        matchup: snapshot?.home_team && snapshot?.away_team
          ? `${snapshot.away_team.abbreviation} @ ${snapshot.home_team.abbreviation}`
          : 'Unknown',
        pickType: pick.pick_type,
        selection: pick.selection,
        units: pick.units,
        pickStatus: pick.status,
        netUnits: pick.net_units,
        createdAt: pick.created_at,
        gradedAt: pick.graded_at,
        gameStatus: game?.status || 'not_found',
        finalScore: game?.final_score || null,
        needsGrading: pick.status === 'pending' && game?.status === 'final'
      }
    }) || []

    // Calculate stats
    const stats = {
      totalPicks: picks?.length || 0,
      pending: picks?.filter(p => p.status === 'pending').length || 0,
      won: picks?.filter(p => p.status === 'won').length || 0,
      lost: picks?.filter(p => p.status === 'lost').length || 0,
      push: picks?.filter(p => p.status === 'push').length || 0,
      needsGrading: pickAnalysis.filter(p => p.needsGrading).length
    }

    return NextResponse.json({
      success: true,
      capperId,
      stats,
      picks: pickAnalysis,
      summary: {
        record: `${stats.won}-${stats.lost}-${stats.push}`,
        pendingPicks: stats.pending,
        picksNeedingGrading: stats.needsGrading,
        note: stats.needsGrading > 0
          ? 'Some picks have finished games but haven\'t been graded yet. Run /api/cron/sync-game-scores to trigger grading.'
          : stats.pending > 0
            ? 'Pending picks are waiting for games to finish.'
            : 'All picks are graded!'
      }
    })
  } catch (error) {
    console.error('[CapperPicksDebug] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

