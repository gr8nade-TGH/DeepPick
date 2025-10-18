import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Supabase connection working',
      data
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
