import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    console.log('🔍 Checking Supabase database...')
    
    // Try to query the tables we expect to exist
    const expectedTables = ['users', 'teams', 'games', 'picks', 'pick_results', 'performance_metrics', 'notifications']
    const tableStatus = {}
    
    for (const tableName of expectedTables) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
        
        if (error) {
          tableStatus[tableName] = { 
            exists: false, 
            error: error.message, 
            count: 0 
          }
        } else {
          tableStatus[tableName] = { 
            exists: true, 
            count: count || 0, 
            error: null 
          }
        }
      } catch (err) {
        tableStatus[tableName] = { 
          exists: false, 
          error: err.message, 
          count: 0 
        }
      }
    }
    
    const existingTables = Object.entries(tableStatus)
      .filter(([_, status]) => status.exists)
      .map(([name, _]) => name)
    
    console.log('📋 Tables found:', existingTables)
    
    return NextResponse.json({
      success: true,
      existingTables,
      tableStatus,
      message: `Found ${existingTables.length} tables out of ${expectedTables.length} expected`
    })
    
  } catch (error) {
    console.error('💥 Database check error:', error)
    return NextResponse.json({ 
      error: 'Database check failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
