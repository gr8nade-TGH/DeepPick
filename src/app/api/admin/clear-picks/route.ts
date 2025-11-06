import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * ADMIN ENDPOINT: Clear EVERYTHING for testing
 * POST /api/admin/clear-picks
 *
 * This resets the entire SHIVA system to start fresh:
 * - Clears all picks (including locked insight card snapshots)
 * - Clears all cooldowns
 * - Clears all runs (both runs and shiva_runs tables)
 * - Clears all pick_generation_cooldowns
 */
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin()

    console.log('[ADMIN] 🧹 CLEARING EVERYTHING - Full system reset...')

    // Step 1: Clear locked insight card snapshots from ALL picks
    console.log('[ADMIN] Step 1: Clearing locked insight card snapshots...')
    const { error: snapshotError, count: snapshotCount } = await supabase
      .from('picks')
      .update({
        insight_card_snapshot: null,
        insight_card_locked_at: null
      })
      .not('insight_card_snapshot', 'is', null)

    if (snapshotError) {
      console.error('[ADMIN] Error clearing snapshots:', snapshotError)
    } else {
      console.log(`[ADMIN] ✅ Cleared ${snapshotCount || 0} locked insight card snapshots`)
    }

    // Step 2: Delete all picks
    console.log('[ADMIN] Step 2: Deleting all picks...')
    const { error: picksError, count: picksCount } = await supabase
      .from('picks')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (picksError) {
      console.error('[ADMIN] Error deleting picks:', picksError)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete picks',
        details: picksError.message
      }, { status: 500 })
    }
    console.log(`[ADMIN] ✅ Deleted ${picksCount || 0} picks`)

    // Step 3: Delete all shiva_cooldowns (legacy table)
    console.log('[ADMIN] Step 3: Deleting shiva_cooldowns...')
    const { error: cooldownsError, count: cooldownsCount } = await supabase
      .from('shiva_cooldowns')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (cooldownsError) {
      console.error('[ADMIN] Error deleting shiva_cooldowns:', cooldownsError)
    } else {
      console.log(`[ADMIN] ✅ Deleted ${cooldownsCount || 0} shiva_cooldowns`)
    }

    // Step 4: Delete all pick_generation_cooldowns (new table)
    console.log('[ADMIN] Step 4: Deleting pick_generation_cooldowns...')
    const { error: newCooldownsError, count: newCooldownsCount } = await supabase
      .from('pick_generation_cooldowns')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (newCooldownsError) {
      console.error('[ADMIN] Error deleting pick_generation_cooldowns:', newCooldownsError)
    } else {
      console.log(`[ADMIN] ✅ Deleted ${newCooldownsCount || 0} pick_generation_cooldowns`)
    }

    // Step 5: Delete all SHIVA runs from shiva_runs table
    console.log('[ADMIN] Step 5: Deleting shiva_runs...')
    const { error: shivaRunsError, count: shivaRunsCount } = await supabase
      .from('shiva_runs')
      .delete({ count: 'exact' })
      .neq('run_id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (shivaRunsError) {
      console.error('[ADMIN] Error deleting shiva_runs:', shivaRunsError)
    } else {
      console.log(`[ADMIN] ✅ Deleted ${shivaRunsCount || 0} shiva_runs`)
    }

    // Step 6: Delete all runs from runs table (parent table)
    console.log('[ADMIN] Step 6: Deleting runs...')
    const { error: runsError, count: runsCount } = await supabase
      .from('runs')
      .delete({ count: 'exact' })
      .neq('run_id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (runsError) {
      console.error('[ADMIN] Error deleting runs:', runsError)
    } else {
      console.log(`[ADMIN] ✅ Deleted ${runsCount || 0} runs`)
    }

    console.log('[ADMIN] 🎉 Successfully cleared EVERYTHING!')

    return NextResponse.json({
      success: true,
      message: '🧹 FULL SYSTEM RESET COMPLETE - All data cleared',
      cleared: {
        locked_snapshots: snapshotCount || 0,
        picks: picksCount || 0,
        shiva_cooldowns: cooldownsCount || 0,
        pick_generation_cooldowns: newCooldownsCount || 0,
        shiva_runs: shivaRunsCount || 0,
        runs: runsCount || 0
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[ADMIN] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

