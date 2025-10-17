// Quick script to check Supabase database
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://xckbsyeaywrfzvcahhtk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhja2JzeWVaywrfzvcahhtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2OTk5OTQsImV4cCI6MjA3NjI3NTk5NH0.X_FRhkUhefhTeiGRRNBckxusVFurEJ_bZMy1BImaCpI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabase() {
  try {
    console.log('🔍 Checking Supabase database...')
    
    // Check what tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')
    
    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError)
      return
    }
    
    console.log('📋 Tables found:', tables?.map(t => t.table_name) || 'None')
    
    // Check what types exist
    const { data: types, error: typesError } = await supabase
      .rpc('get_custom_types')
    
    if (typesError) {
      console.log('ℹ️  Could not check custom types (this is normal)')
    } else {
      console.log('🏷️  Custom types found:', types || 'None')
    }
    
    // Try to query each table to see if they have data
    const tableNames = tables?.map(t => t.table_name) || []
    
    for (const tableName of tableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)
        
        if (error) {
          console.log(`❌ ${tableName}: Error - ${error.message}`)
        } else {
          console.log(`✅ ${tableName}: ${data?.length || 0} rows`)
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`)
      }
    }
    
  } catch (error) {
    console.error('💥 Script error:', error)
  }
}

checkDatabase()
