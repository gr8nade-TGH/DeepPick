/**
 * Script to run migration 048: Create capper_execution_schedules table
 * Run with: npx tsx scripts/run-migration-048.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🚀 Running migration 048: Create capper_execution_schedules table...')

  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '048_create_capper_execution_schedules.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  try {
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    }

    console.log('✅ Migration 048 completed successfully!')
    console.log('✅ Created table: capper_execution_schedules')
    console.log('✅ Inserted initial schedules for SHIVA (TOTAL and SPREAD)')

    // Verify the table was created
    const { data, error: selectError } = await supabase
      .from('capper_execution_schedules')
      .select('*')

    if (selectError) {
      console.error('❌ Error verifying table:', selectError)
      process.exit(1)
    }

    console.log('\n📊 Current schedules:')
    console.table(data)

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  }
}

runMigration()

