import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Test if the capper column exists and what values are in it
 */
export async function GET() {
  try {
    // Test 1: Get all picks without filtering
    const { data: allPicks, error: allError } = await supabaseAdmin
      .from('picks')
      .select('id, capper, selection, created_at')
      .limit(10)

    // Test 2: Try to filter by capper
    const { data: deepPickPicks, error: deepPickError } = await supabaseAdmin
      .from('picks')
      .select('id, capper, selection')
      .eq('capper', 'deeppick')
      .limit(5)

    return NextResponse.json({
      success: true,
      tests: {
        allPicks: {
          success: !allError,
          error: allError?.message,
          count: allPicks?.length || 0,
          sample: allPicks?.map(p => ({ id: p.id, capper: p.capper, selection: p.selection }))
        },
        deepPickFilter: {
          success: !deepPickError,
          error: deepPickError?.message,
          count: deepPickPicks?.length || 0,
          sample: deepPickPicks
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

