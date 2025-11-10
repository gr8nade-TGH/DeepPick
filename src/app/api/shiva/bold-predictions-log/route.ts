import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/shiva/bold-predictions-log
 *
 * Fetches all runs that have bold_predictions populated (ALL CAPPERS)
 * Returns a log of AI-generated player predictions
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin()

    // Fetch runs with bold_predictions (not null)
    // NOTE: This works for ALL cappers (SHIVA, IFRIT, etc.), not just SHIVA
    // We need to use raw SQL because game_id is TEXT in runs but UUID in games
    const { data: runs, error } = await admin.rpc('get_bold_predictions_log', {})

    // Fallback to manual query if RPC doesn't exist
    if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
      console.log('[BoldPredictionsLog] RPC not found, using manual query')

      // Manual query with UUID casting
      const { data: manualRuns, error: manualError } = await admin
        .from('runs')
        .select('run_id, created_at, capper, pick_type, selection, bold_predictions, game_id')
        .not('bold_predictions', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (manualError) {
        console.error('[BoldPredictionsLog] Manual query error:', manualError)
        return NextResponse.json(
          { error: 'Failed to fetch bold predictions' },
          { status: 500 }
        )
      }

      // Fetch games separately
      const gameIds = manualRuns.map(r => r.game_id)
      const { data: games, error: gamesError } = await admin
        .from('games')
        .select('id, away_team, home_team')
        .in('id', gameIds)

      if (gamesError) {
        console.error('[BoldPredictionsLog] Games query error:', gamesError)
      }

      // Map games by ID
      const gamesMap = new Map(games?.map(g => [g.id, g]) || [])

      // Format entries
      const entries = manualRuns.map(run => {
        const game = gamesMap.get(run.game_id)
        const awayTeam = game?.away_team as any
        const homeTeam = game?.home_team as any
        const matchup = game
          ? `${awayTeam?.name || 'Away'} @ ${homeTeam?.name || 'Home'}`
          : 'Unknown Game'

        return {
          run_id: run.run_id,
          created_at: run.created_at,
          matchup,
          capper: run.capper || 'SHIVA',
          bet_type: run.pick_type || 'total',
          selection: run.selection || 'N/A',
          bold_predictions: run.bold_predictions
        }
      })

      return NextResponse.json({
        success: true,
        count: entries.length,
        entries
      })
    }

    if (error) {
      console.error('[BoldPredictionsLog] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bold predictions' },
        { status: 500 }
      )
    }

    // Format entries from RPC
    const entries = runs.map((run: any) => ({
      run_id: run.run_id,
      created_at: run.created_at,
      matchup: run.matchup,
      capper: run.capper || 'SHIVA',
      bet_type: run.pick_type || 'total',
      selection: run.selection || 'N/A',
      bold_predictions: run.bold_predictions
    }))

    return NextResponse.json({
      success: true,
      count: entries.length,
      entries
    })

  } catch (error) {
    console.error('[BoldPredictionsLog] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

