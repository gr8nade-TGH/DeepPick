import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/shiva/runs/clear
 * Clears all SHIVA runs from the runs table
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()

    console.log('[ClearRuns] Starting clear operation...')

    // CRITICAL: The 'capper' field is inside metadata JSONB column, not a direct column
    // We need to fetch all runs and filter in JavaScript, just like the history endpoint does

    // Step 1: Fetch ALL runs with metadata
    const { data: allRuns, error: fetchError } = await supabase
      .from('runs')
      .select('run_id, metadata')

    if (fetchError) {
      console.error('[ClearRuns] Error fetching runs:', fetchError)
      return NextResponse.json({
        success: false,
        error: fetchError.message,
        details: 'Failed to fetch runs from database'
      }, { status: 500 })
    }

    // Step 2: Filter for SHIVA runs in JavaScript (capper is in metadata)
    const shivaRuns = (allRuns || []).filter((run: any) => run.metadata?.capper === 'shiva')
    const runIds = shivaRuns.map(r => r.run_id)

    console.log(`[ClearRuns] Found ${runIds.length} SHIVA runs to delete (out of ${allRuns?.length || 0} total runs)`)

    if (runIds.length === 0) {
      console.log('[ClearRuns] No SHIVA runs found to delete')
      return NextResponse.json({
        success: true,
        message: 'No SHIVA runs found to delete',
        deletedCount: 0,
        beforeCount: 0,
        shivaRunsDeleted: 0,
        cooldownsDeleted: 0
      })
    }

    // CRITICAL: Delete picks FIRST (child records) before deleting runs (parent records)
    // This respects the foreign key constraint: picks.run_id REFERENCES runs.run_id ON DELETE RESTRICT

    // Step 3: Delete all picks associated with these runs
    const { error: deletePicksError, count: deletedPicksCount } = await supabase
      .from('picks')
      .delete({ count: 'exact' })
      .in('run_id', runIds)

    if (deletePicksError) {
      console.error('[ClearRuns] Error deleting picks:', deletePicksError)
      return NextResponse.json({
        success: false,
        error: deletePicksError.message,
        details: 'Failed to delete picks from database'
      }, { status: 500 })
    }

    console.log(`[ClearRuns] Successfully deleted ${deletedPicksCount || 0} picks`)

    // Step 4: Now delete all SHIVA runs (parent records) by run_id
    const { error: deleteError, count: deletedCount } = await supabase
      .from('runs')
      .delete({ count: 'exact' })
      .in('run_id', runIds)

    if (deleteError) {
      console.error('[ClearRuns] Error deleting runs:', deleteError)
      return NextResponse.json({
        success: false,
        error: deleteError.message,
        details: 'Failed to delete runs from database'
      }, { status: 500 })
    }

    console.log(`[ClearRuns] Successfully deleted ${deletedCount || 0} SHIVA runs from runs table`)

    // Step 5: Also clear shiva_runs table (SHIVA-specific run log)
    const { error: shivaRunsError, count: shivaRunsCount } = await supabase
      .from('shiva_runs')
      .delete({ count: 'exact' })
      .neq('run_id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (shivaRunsError) {
      console.error('[ClearRuns] Error deleting shiva_runs:', shivaRunsError)
      // Don't fail the whole operation, just log the error
    } else {
      console.log(`[ClearRuns] Successfully deleted ${shivaRunsCount || 0} entries from shiva_runs table`)
    }

    // Step 6: Clear shiva_cooldowns table
    const { error: cooldownsError, count: cooldownsCount } = await supabase
      .from('shiva_cooldowns')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (cooldownsError) {
      console.error('[ClearRuns] Error deleting shiva_cooldowns:', cooldownsError)
      // Don't fail the whole operation, just log the error
    } else {
      console.log(`[ClearRuns] Successfully deleted ${cooldownsCount || 0} cooldowns`)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully cleared ${deletedCount || 0} runs, ${shivaRunsCount || 0} shiva_runs, and ${cooldownsCount || 0} cooldowns`,
      deletedCount: deletedCount || 0,
      beforeCount: runIds.length, // Use the count we found before deletion
      shivaRunsDeleted: shivaRunsCount || 0,
      cooldownsDeleted: cooldownsCount || 0
    })

  } catch (error: any) {
    console.error('[ClearRuns] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Unexpected error occurred'
    }, { status: 500 })
  }
}

