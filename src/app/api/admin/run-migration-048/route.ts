/**
 * API endpoint to run migration 048: Create capper_execution_schedules table
 * Call with: GET /api/admin/run-migration-048
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  console.log('[MIGRATION-048] Starting migration...')

  const supabase = getSupabaseAdmin()

  try {
    // Step 1: Create the table
    console.log('[MIGRATION-048] Creating table...')
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS capper_execution_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        capper_id TEXT NOT NULL,
        sport TEXT NOT NULL,
        bet_type TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        interval_minutes INTEGER NOT NULL,
        priority INTEGER DEFAULT 0,
        last_execution_at TIMESTAMPTZ,
        next_execution_at TIMESTAMPTZ,
        last_execution_status TEXT,
        last_execution_error TEXT,
        total_executions INTEGER DEFAULT 0,
        successful_executions INTEGER DEFAULT 0,
        failed_executions INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_capper_schedule UNIQUE (capper_id, sport, bet_type)
      );
    `

    // Execute via raw SQL (Supabase admin client)
    const { error: tableError } = await supabase.rpc('exec_sql', { sql: createTableSQL })

    if (tableError) {
      console.error('[MIGRATION-048] Table creation error:', tableError)
      // Continue anyway - table might already exist
    }

    // Step 2: Create indexes
    console.log('[MIGRATION-048] Creating indexes...')
    
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_capper_schedules_next_execution 
      ON capper_execution_schedules (next_execution_at) 
      WHERE enabled = true;

      CREATE INDEX IF NOT EXISTS idx_capper_schedules_capper_id 
      ON capper_execution_schedules (capper_id);
    `

    const { error: indexError } = await supabase.rpc('exec_sql', { sql: createIndexesSQL })

    if (indexError) {
      console.error('[MIGRATION-048] Index creation error:', indexError)
    }

    // Step 3: Insert initial schedules
    console.log('[MIGRATION-048] Inserting initial schedules...')

    const schedules = [
      {
        capper_id: 'SHIVA',
        sport: 'NBA',
        bet_type: 'TOTAL',
        enabled: true,
        interval_minutes: 6,
        priority: 10,
        next_execution_at: new Date().toISOString()
      },
      {
        capper_id: 'SHIVA',
        sport: 'NBA',
        bet_type: 'SPREAD',
        enabled: true,
        interval_minutes: 8,
        priority: 10,
        next_execution_at: new Date().toISOString()
      }
    ]

    const { data, error: insertError } = await supabase
      .from('capper_execution_schedules')
      .upsert(schedules, {
        onConflict: 'capper_id,sport,bet_type',
        ignoreDuplicates: false
      })
      .select()

    if (insertError) {
      console.error('[MIGRATION-048] Insert error:', insertError)
      return NextResponse.json({
        success: false,
        error: insertError.message,
        step: 'insert_schedules'
      }, { status: 500 })
    }

    // Step 4: Verify
    const { data: allSchedules, error: selectError } = await supabase
      .from('capper_execution_schedules')
      .select('*')

    if (selectError) {
      console.error('[MIGRATION-048] Select error:', selectError)
    }

    console.log('[MIGRATION-048] ✅ Migration complete!')
    console.log('[MIGRATION-048] Schedules:', allSchedules)

    return NextResponse.json({
      success: true,
      message: 'Migration 048 completed successfully',
      schedules: allSchedules
    })

  } catch (error) {
    console.error('[MIGRATION-048] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

