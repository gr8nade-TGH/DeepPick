import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    // Check picks table
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('id, game_id, capper, pick_type, status, created_at')
      .eq('capper', 'shiva')
      .order('created_at', { ascending: false })
    
    if (picksError) {
      console.error('Error fetching picks:', picksError)
    }
    
    // Check cooldowns table
    const { data: cooldowns, error: cooldownsError } = await supabase
      .from('pick_generation_cooldowns')
      .select('id, game_id, capper, bet_type, cooldown_until, created_at')
      .eq('capper', 'shiva')
      .order('created_at', { ascending: false })
    
    if (cooldownsError) {
      console.error('Error fetching cooldowns:', cooldownsError)
    }
    
    // Check games table for today
    const today = new Date().toISOString().split('T')[0]
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, game_date, game_time, status')
      .eq('sport', 'nba')
      .eq('game_date', today)
      .order('game_time', { ascending: true })
    
    if (gamesError) {
      console.error('Error fetching games:', gamesError)
    }
    
    return NextResponse.json({ 
      success: true,
      picks: picks || [],
      cooldowns: cooldowns || [],
      games: games || [],
      counts: {
        picks: picks?.length || 0,
        cooldowns: cooldowns?.length || 0,
        games: games?.length || 0
      },
      today
    })
    
  } catch (e) {
    console.error('[check-database] API error:', e)
    return NextResponse.json(
      { success: false, error: (e as Error).message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
