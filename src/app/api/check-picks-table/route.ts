import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Try to query the picks table
    const { data, error } = await supabase
      .from('picks')
      .select('count')
      .limit(1)

    if (error) {
      return NextResponse.json({
        success: false,
        tableExists: false,
        error: error.message,
        hint: 'Run the migration SQL in Supabase: supabase/migrations/004_picks_system_clean.sql'
      })
    }

    return NextResponse.json({
      success: true,
      tableExists: true,
      message: 'Picks table exists!'
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

