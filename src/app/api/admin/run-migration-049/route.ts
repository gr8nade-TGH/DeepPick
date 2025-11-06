/**
 * API endpoint to run migration 049: Create user_cappers table
 * Call with: GET /api/admin/run-migration-049
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  console.log('[MIGRATION-049] Starting migration...')

  const supabase = getSupabaseAdmin()

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '049_create_user_cappers.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('[MIGRATION-049] Executing SQL...')

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    })

    if (error) {
      console.error('[MIGRATION-049] Error:', error)
      
      // If exec_sql doesn't exist, try direct query
      console.log('[MIGRATION-049] Trying direct query...')
      const { error: directError } = await supabase.from('_migrations').select('*').limit(1)
      
      if (directError) {
        console.log('[MIGRATION-049] Using Supabase Management API...')
        
        // Use Supabase Management API
        const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        
        if (!projectRef || !serviceKey) {
          throw new Error('Missing Supabase credentials')
        }

        const response = await fetch(
          `https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`
            },
            body: JSON.stringify({ sql_query: migrationSQL })
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Supabase API error: ${errorText}`)
        }

        console.log('[MIGRATION-049] ✅ Migration executed via Management API')
      }
    } else {
      console.log('[MIGRATION-049] ✅ Migration executed successfully')
    }

    // Verify the table was created
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_cappers')
      .select('*')
      .limit(1)

    if (tableError) {
      console.error('[MIGRATION-049] Table verification failed:', tableError)
      return NextResponse.json({
        success: false,
        error: 'Migration executed but table verification failed',
        details: tableError
      }, { status: 500 })
    }

    console.log('[MIGRATION-049] ✅ Table verified')

    return NextResponse.json({
      success: true,
      message: 'Migration 049 completed successfully',
      table_created: 'user_cappers',
      triggers_created: [
        'trigger_update_user_cappers_updated_at',
        'trigger_create_capper_schedules',
        'trigger_delete_capper_schedules'
      ]
    })

  } catch (error) {
    console.error('[MIGRATION-049] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

