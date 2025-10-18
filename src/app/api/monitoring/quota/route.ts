import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    // Get daily quota
    const { data: dailyData, error: dailyError } = await getSupabaseAdmin()
      .from('api_quota_tracking')
      .select('*')
      .eq('api_provider', 'the_odds_api')
      .eq('period_type', 'daily')
      .eq('period_start', today)
      .single()

    // Get monthly quota
    const { data: monthlyData, error: monthlyError } = await getSupabaseAdmin()
      .from('api_quota_tracking')
      .select('*')
      .eq('api_provider', 'the_odds_api')
      .eq('period_type', 'monthly')
      .eq('period_start', monthStart)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        daily: dailyData || null,
        monthly: monthlyData || null
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

