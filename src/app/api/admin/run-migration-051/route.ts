/**
 * API endpoint to run migration 051: Add pick_mode to user_cappers
 * Call with: GET /api/admin/run-migration-051
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  console.log('[MIGRATION-051] Starting migration...')

  const supabase = getSupabaseAdmin()

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '051_add_pick_mode_to_user_cappers.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('[MIGRATION-051] Executing SQL...')

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    })

    if (error) {
      console.error('[MIGRATION-051] SQL execution error:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    console.log('[MIGRATION-051] ✅ Migration executed successfully')

    // Verify the columns were added
    const { data: cappers, error: verifyError } = await supabase
      .from('user_cappers')
      .select('capper_id, pick_mode, auto_generate_hours_before, excluded_teams')
      .limit(5)

    if (verifyError) {
      console.error('[MIGRATION-051] Verification error:', verifyError)
      return NextResponse.json({
        success: false,
        error: `Migration executed but verification failed: ${verifyError.message}`
      }, { status: 500 })
    }

    console.log('[MIGRATION-051] ✅ Columns verified:', cappers)

    return NextResponse.json({
      success: true,
      message: 'Migration 051 completed successfully',
      columns_added: ['pick_mode', 'auto_generate_hours_before', 'excluded_teams'],
      sample_data: cappers
    })

  } catch (error) {
    console.error('[MIGRATION-051] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

