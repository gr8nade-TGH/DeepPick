import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// Disable caching for this endpoint - cooldowns change frequently
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const betType = searchParams.get('betType') // 'TOTAL' or 'SPREAD'

    const supabase = getSupabaseAdmin()

    // Get ALL cooldowns (both active and expired) for visibility
    // CHANGED: Removed .gt('cooldown_until', ...) filter to show all cooldowns including expired ones
    // This allows the Run Log to display cooldown history, not just active cooldowns
    let query = supabase
      .from('pick_generation_cooldowns')
      .select(`
        id,
        game_id,
        capper,
        bet_type,
        cooldown_until,
        result,
        units,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(50) // Limit to most recent 50 cooldowns

    // Filter by betType if provided
    if (betType) {
      const betTypeLower = betType === 'TOTAL' ? 'total' : 'spread'
      query = query.eq('bet_type', betTypeLower)
    }

    const { data: cooldowns, error } = await query

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

    console.log('[CooldownsAPI] Fetching cooldowns:', {
      count: cooldownsWithMatchups.length,
      ids: cooldownsWithMatchups.map(c => c.id)
    })

    const response = NextResponse.json({
      success: true,
      cooldowns: cooldownsWithMatchups,
      count: cooldownsWithMatchups.length
    })

    // Add explicit no-cache headers to prevent stale data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error: any) {
    console.error('[CooldownsAPI] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

