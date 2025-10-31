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

    // Count runs before deletion
    const { count: beforeCount, error: countError } = await supabase
      .from('runs')
      .select('*', { count: 'exact', head: true })
      .eq('capper', 'shiva')

    if (countError) {
      console.error('[ClearRuns] Error counting runs:', countError)
    }

    console.log(`[ClearRuns] Found ${beforeCount || 0} SHIVA runs to delete`)

    // CRITICAL: Delete picks FIRST (child records) before deleting runs (parent records)
    // This respects the foreign key constraint: picks.run_id REFERENCES runs.run_id ON DELETE RESTRICT

    // Step 1: Get all run_ids for SHIVA runs
    const { data: runsToDelete, error: fetchError } = await supabase
      .from('runs')
      .select('run_id')
      .eq('capper', 'shiva')

    if (fetchError) {
      console.error('[ClearRuns] Error fetching run_ids:', fetchError)
      return NextResponse.json({
        success: false,
        error: fetchError.message,
        details: 'Failed to fetch run_ids from database'
      }, { status: 500 })
    }

    const runIds = runsToDelete?.map(r => r.run_id) || []
    console.log(`[ClearRuns] Found ${runIds.length} run_ids to delete:`, runIds)

    // Step 2: Delete all picks associated with these runs
    if (runIds.length > 0) {
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
    }

    // Step 3: Now delete all SHIVA runs (parent records)
    const { error: deleteError, count: deletedCount } = await supabase
      .from('runs')
      .delete({ count: 'exact' })
      .eq('capper', 'shiva')

    if (deleteError) {
      console.error('[ClearRuns] Error deleting runs:', deleteError)
      return NextResponse.json({
        success: false,
        error: deleteError.message,
        details: 'Failed to delete runs from database'
      }, { status: 500 })
    }

    console.log(`[ClearRuns] Successfully deleted ${deletedCount || 0} SHIVA runs from runs table`)

    // Step 4: Also clear shiva_runs table (SHIVA-specific run log)
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

    // Step 5: Clear shiva_cooldowns table
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
      beforeCount: beforeCount || 0,
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

