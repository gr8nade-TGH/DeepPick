import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

// Mark this route as dynamic (uses request parameters)
export const dynamic = 'force-dynamic'

// GET /api/performance - Get performance metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const period = searchParams.get('period') || 'all_time'
    const userId = searchParams.get('user_id') || '00000000-0000-0000-0000-000000000000' // Mock user for now
    const capper = searchParams.get('capper')

    // Get all picks to calculate metrics
    let query = supabase
      .from('picks')
      .select('*')
      .order('created_at', { ascending: true })

    // Filter by capper if specified
    if (capper && capper !== 'all') {
      query = query.eq('capper', capper)
    }

    const { data: picks, error: picksError } = await query

    if (picksError) {
      console.error('❌ Performance query error:', picksError)
      return NextResponse.json({ 
        error: picksError.message,
        details: picksError,
        capper: capper
      }, { status: 500 })
    }

    // Calculate metrics from picks
    const totalPicks = picks?.length || 0
    const wins = picks?.filter(p => p.status === 'won').length || 0
    const losses = picks?.filter(p => p.status === 'lost').length || 0
    const pushes = picks?.filter(p => p.status === 'push').length || 0
    const unitsBet = picks?.reduce((sum, p) => sum + (parseFloat(p.units.toString()) || 0), 0) || 0
    const netUnits = picks?.reduce((sum, p) => sum + (parseFloat(p.net_units?.toString() || '0') || 0), 0) || 0
    const roi = unitsBet > 0 ? (netUnits / unitsBet) * 100 : 0
    const winRate = totalPicks > 0 ? (wins / totalPicks) * 100 : 0

    // Calculate cumulative profit for chart - GROUP BY DATE
    // ONLY include completed picks (won/lost/push) that have actual results
    const profitByDate = new Map<string, number>()
    
    // Group COMPLETED picks by date and sum profits
    picks?.forEach(pick => {
      // Only include picks that have been graded (won, lost, or push)
      if (pick.status === 'won' || pick.status === 'lost' || pick.status === 'push') {
        const date = pick.created_at.split('T')[0]
        const netUnitsValue = parseFloat(pick.net_units?.toString() || '0') || 0
        profitByDate.set(date, (profitByDate.get(date) || 0) + netUnitsValue)
      }
    })
    
    // Convert to array and calculate cumulative profit
    let cumulativeProfit = 0
    const chartData = Array.from(profitByDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // Sort by date
      .map(([date, profit]) => {
        cumulativeProfit += profit
        return {
          date,
          profit,
          cumulative_profit: cumulativeProfit
        }
      })

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          total_picks: totalPicks,
          wins,
          losses,
          pushes,
          win_rate: winRate,
          units_bet: unitsBet,
          units_won: netUnits > 0 ? netUnits : 0,
          units_lost: netUnits < 0 ? Math.abs(netUnits) : 0,
          net_units: netUnits,
          roi
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
