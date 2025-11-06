import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/shiva/bold-predictions-log
 * 
 * Fetches all runs that have bold_predictions populated
 * Returns a log of AI-generated player predictions
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin()

    // Fetch runs with bold_predictions (not null)
    const { data: runs, error } = await admin
      .from('runs')
      .select('run_id, created_at, matchup, capper, pick_type, selection, bold_predictions')
      .not('bold_predictions', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[BoldPredictionsLog] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bold predictions' },
        { status: 500 }
      )
    }

    // Format entries
    const entries = runs.map(run => ({
      run_id: run.run_id,
      created_at: run.created_at,
      matchup: run.matchup || 'Unknown Game',
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

