import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('[Test-DB] Starting database test')
    
    const supabase = getSupabase()
    console.log('[Test-DB] Supabase client created')
    
    // Test basic connection
    const { data, error } = await supabase
      .from('capper_profiles')
      .select('count')
      .limit(1)
    
    console.log('[Test-DB] Query result:', { data, error })
    
    if (error) {
      console.error('[Test-DB] Database error:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data
    })
    
  } catch (error) {
    console.error('[Test-DB] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
