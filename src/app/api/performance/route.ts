import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

// GET /api/performance - Get performance metrics
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams
    const period = searchParams.get('period') || 'all_time'
    const userId = searchParams.get('user_id') || '00000000-0000-0000-0000-000000000000' // Mock user for now

    // Get performance metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('period', period)
      .single()

    if (metricsError && metricsError.code !== 'PGRST116') {
      return NextResponse.json({ error: metricsError.message }, { status: 500 })
    }

    // Get recent picks for chart data
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select(`
        created_at,
        units,
        status,
        pick_results(net_units)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (picksError) {
      return NextResponse.json({ error: picksError.message }, { status: 500 })
    }

    // Calculate cumulative profit for chart
    let cumulativeProfit = 0
    const chartData = picks?.map(pick => {
      const netUnits = pick.pick_results?.[0]?.net_units || 0
      cumulativeProfit += netUnits
      return {
        date: pick.created_at.split('T')[0],
        profit: netUnits,
        cumulative_profit: cumulativeProfit
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        metrics: metrics || {
          total_picks: 0,
          wins: 0,
          losses: 0,
          pushes: 0,
          win_rate: 0,
          units_bet: 0,
          units_won: 0,
          units_lost: 0,
          net_units: 0,
          roi: 0
        },
        chartData
      }
    })

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to fetch performance data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
