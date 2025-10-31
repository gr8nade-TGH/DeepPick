import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * ADMIN ENDPOINT: Clear all picks and cooldowns
 * POST /api/admin/clear-picks
 * 
 * This resets the picks system to start fresh
 */
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin()

    console.log('[ADMIN] Clearing all picks and cooldowns...')

    // Delete all picks
    const { error: picksError } = await supabase
      .from('picks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (picksError) {
      console.error('[ADMIN] Error deleting picks:', picksError)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete picks',
        details: picksError.message
      }, { status: 500 })
    }

    // Delete all cooldowns
    const { error: cooldownsError } = await supabase
      .from('shiva_cooldowns')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (cooldownsError) {
      console.error('[ADMIN] Error deleting cooldowns:', cooldownsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete cooldowns',
        details: cooldownsError.message
      }, { status: 500 })
    }

    // Delete all SHIVA runs
    const { error: runsError } = await supabase
      .from('shiva_runs')
      .delete()
      .neq('run_id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (runsError) {
      console.error('[ADMIN] Error deleting runs:', runsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete runs',
        details: runsError.message
      }, { status: 500 })
    }

    console.log('[ADMIN] Successfully cleared all picks, cooldowns, and runs')

    return NextResponse.json({
      success: true,
      message: 'All picks, cooldowns, and runs cleared successfully',
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

