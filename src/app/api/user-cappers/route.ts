import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user-cappers
 * 
 * Fetches all active cappers from user_cappers table
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin()

    const { data: cappers, error } = await admin
      .from('user_cappers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[UserCappers] Database error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch cappers' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: cappers.length,
      cappers
    })

  } catch (error) {
    console.error('[UserCappers] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

