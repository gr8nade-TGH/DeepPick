import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    // Get daily quota
    const { data: dailyData, error: dailyError } = await supabase
      .from('api_quota_tracking')
      .select('*')
      .eq('api_provider', 'the_odds_api')
      .eq('period_type', 'daily')
      .eq('period_start', today)
      .single()

    // Get monthly quota
    const { data: monthlyData, error: monthlyError } = await supabase
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

