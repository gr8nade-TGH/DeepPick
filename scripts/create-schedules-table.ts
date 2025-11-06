/**
 * Script to create capper_execution_schedules table
 * Run with: npx tsx scripts/create-schedules-table.ts
 */

import { getSupabaseAdmin } from '../src/lib/supabase/server'

async function createTable() {
  console.log('🚀 Creating capper_execution_schedules table...')

  const supabase = getSupabaseAdmin()

  // Create the table
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

  const { error: tableError } = await supabase.rpc('exec_sql', { sql: createTableSQL })

  if (tableError) {
    console.error('❌ Error creating table:', tableError)
    
    // Try direct approach
    console.log('Trying direct SQL execution...')
    const { error: directError } = await supabase
      .from('capper_execution_schedules')
      .select('id')
      .limit(1)
    
    if (directError && directError.code === '42P01') {
      console.error('❌ Table does not exist. Please run the SQL manually in Supabase SQL Editor.')
      console.log('\n📋 Copy this SQL to Supabase SQL Editor:\n')
      console.log(createTableSQL)
      process.exit(1)
    }
  }

  console.log('✅ Table created (or already exists)')

  // Insert initial schedules
  const { data: existing } = await supabase
    .from('capper_execution_schedules')
    .select('*')

  if (existing && existing.length > 0) {
    console.log('✅ Schedules already exist:', existing.length)
    console.table(existing)
    return
  }

  // Insert SHIVA schedules
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

  const { data, error } = await supabase
    .from('capper_execution_schedules')
    .insert(schedules)
    .select()

  if (error) {
    console.error('❌ Error inserting schedules:', error)
    process.exit(1)
  }

  console.log('✅ Inserted initial schedules:')
  console.table(data)
}

createTable().catch(console.error)

