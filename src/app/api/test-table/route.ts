import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('[Test-Table] Starting table test')
    
    const supabase = getSupabase()
    console.log('[Test-Table] Supabase client created')
    
    // Test if capper_profiles table exists and is accessible
    const { data, error } = await supabase
      .from('capper_profiles')
      .select('*')
      .limit(1)
    
    console.log('[Test-Table] Query result:', { data, error })
    
    if (error) {
      console.error('[Test-Table] Database error:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        tableExists: false
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Table exists and is accessible',
      data,
      tableExists: true
    })
    
  } catch (error) {
    console.error('[Test-Table] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      tableExists: false
    }, { status: 500 })
  }
}
