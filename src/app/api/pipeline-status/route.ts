import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Get recent picks count
    const { count: recentPicks } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    // Get recent games count
    const { count: recentGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    // Get algorithm performance
    const { data: picks } = await supabase
      .from('picks')
      .select('status, confidence, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days

    const totalPicks = picks?.length || 0
    const wonPicks = picks?.filter(p => p.status === 'won').length || 0
    const winRate = totalPicks > 0 ? (wonPicks / totalPicks) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        recent_picks: recentPicks || 0,
        recent_games: recentGames || 0,
        total_picks_7d: totalPicks,
        win_rate_7d: winRate.toFixed(1),
        last_updated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Error getting pipeline status:', error)
    return NextResponse.json({ 
      error: 'Failed to get pipeline status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
