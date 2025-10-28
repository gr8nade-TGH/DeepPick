import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get active cooldowns (where cooldown_until is in the future)
    const { data: cooldowns, error } = await supabase
      .from('pick_generation_cooldowns')
      .select(`
        id,
        game_id,
        capper,
        bet_type,
        cooldown_until,
        result,
        units
      `)
      .gt('cooldown_until', new Date().toISOString())
      .order('cooldown_until', { ascending: true })

    if (error) {
      console.error('[CooldownsAPI] Error fetching cooldowns:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Fetch games to get matchup names
    const gameIds = cooldowns?.map(c => c.game_id) || []
    const { data: games } = await supabase
      .from('games')
      .select('id, home_team, away_team')
      .in('id', gameIds)

    // Create a map of game_id to matchup
    const gameMap = new Map()
    games?.forEach(game => {
      const homeTeam = typeof game.home_team === 'object' ? game.home_team?.name : game.home_team
      const awayTeam = typeof game.away_team === 'object' ? game.away_team?.name : game.away_team
      gameMap.set(game.id, `${awayTeam} @ ${homeTeam}`)
    })

    // Add matchup names to cooldowns
    const cooldownsWithMatchups = cooldowns?.map(cd => ({
      ...cd,
      matchup: gameMap.get(cd.game_id)
    })) || []

    return NextResponse.json({
      success: true,
      cooldowns: cooldownsWithMatchups,
      count: cooldownsWithMatchups.length
    })
  } catch (error: any) {
    console.error('[CooldownsAPI] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

