import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

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
    let query = getSupabase()
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
    // CRITICAL: Only count GRADED picks (won, lost, push) - exclude pending and cancelled
    const gradedPicks = picks?.filter(p => p.status === 'won' || p.status === 'lost' || p.status === 'push') || []
    const wins = gradedPicks.filter(p => p.status === 'won').length
    const losses = gradedPicks.filter(p => p.status === 'lost').length
    const pushes = gradedPicks.filter(p => p.status === 'push').length
    const totalPicks = gradedPicks.length

    // Calculate units from ALL picks (including pending) for total units bet
    const unitsBet = picks?.reduce((sum, p) => sum + (parseFloat(p.units.toString()) || 0), 0) || 0

    // Calculate net units from GRADED picks only (uses net_units field set by grading trigger)
    const netUnits = gradedPicks.reduce((sum, p) => sum + (parseFloat(p.net_units?.toString() || '0') || 0), 0)

    // ROI = (net units / total units bet) * 100
    const roi = unitsBet > 0 ? (netUnits / unitsBet) * 100 : 0

    // Win Rate = (wins / (wins + losses)) * 100 - EXCLUDES PUSHES
    // This is the standard sports betting win rate calculation
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0

    // Calculate cumulative profit for chart - GROUP BY DATE
    // ONLY include completed picks (won/lost/push) that have actual results
    const profitByDate = new Map<string, { profit: number, wins: number, losses: number, pushes: number, picks: number }>()

    // Group COMPLETED picks by date and sum profits
    gradedPicks.forEach(pick => {
      const date = pick.created_at.split('T')[0]
      const netUnitsValue = parseFloat(pick.net_units?.toString() || '0') || 0
      const existing = profitByDate.get(date) || { profit: 0, wins: 0, losses: 0, pushes: 0, picks: 0 }

      profitByDate.set(date, {
        profit: existing.profit + netUnitsValue,
        wins: existing.wins + (pick.status === 'won' ? 1 : 0),
        losses: existing.losses + (pick.status === 'lost' ? 1 : 0),
        pushes: existing.pushes + (pick.status === 'push' ? 1 : 0),
        picks: existing.picks + 1
      })
    })

    // Convert to array and calculate cumulative profit
    let cumulativeProfit = 0
    const chartData = Array.from(profitByDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // Sort by date
      .map(([date, data]) => {
        cumulativeProfit += data.profit
        const dayWinRate = (data.wins + data.losses) > 0 ? (data.wins / (data.wins + data.losses)) * 100 : 0
        return {
          date,
          daily_units: data.profit, // Daily profit for this date
          cumulative_units: cumulativeProfit, // Running total (matches chart dataKey)
          wins: data.wins,
          losses: data.losses,
          pushes: data.pushes,
          picks: data.picks,
          win_rate: dayWinRate
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
