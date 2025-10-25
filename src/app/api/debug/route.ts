import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
    },
    database: {
      connection: 'Unknown',
      tableExists: false,
      error: null
    }
  }

  try {
    console.log('[DEBUG] Starting comprehensive debug check')
    
    // Test Supabase connection
    const supabase = getSupabase()
    debugInfo.database.connection = 'Supabase client created'
    
    // Test table existence
    const { data, error } = await supabase
      .from('capper_profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      debugInfo.database.error = {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }
    } else {
      debugInfo.database.tableExists = true
      debugInfo.database.connection = 'Table accessible'
    }
    
    console.log('[DEBUG] Debug check completed:', debugInfo)
    
    return NextResponse.json({
      success: true,
      debug: debugInfo
    })
    
  } catch (error) {
    console.error('[DEBUG] Debug check failed:', error)
    debugInfo.database.error = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }
    
    return NextResponse.json({
      success: false,
      debug: debugInfo
    }, { status: 500 })
  }
}
