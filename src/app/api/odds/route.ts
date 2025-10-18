import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

// Mark this route as dynamic (uses request parameters)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const sport = searchParams.get('sport')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get all games, then filter in post-processing for complex logic
    let query = getSupabase()
      .from('games')
      .select('*')
      .gte('game_date', new Date().toISOString().split('T')[0]) // Only today and future dates
      .order('game_date', { ascending: true })
      .range(offset, offset + limit - 1)

    if (sport && sport !== 'all') {
      query = query.eq('sport', sport)
    }

    const { data: games, error } = await query

    if (error) {
      throw new Error(`Supabase error: ${error.message}`)
    }

    // Filter and transform the data
    const now = new Date()
    const filteredGames = games?.filter(game => {
      const gameDateTime = new Date(`${game.game_date}T${game.game_time}`)
      const timeSinceStart = now.getTime() - gameDateTime.getTime()
      const hoursSinceStart = timeSinceStart / (1000 * 60 * 60)
      
      // Remove games based on status and time
      if (game.status === 'final') {
        // Remove final games after 2 hours
        return hoursSinceStart <= 2
      } else if (game.status === 'live' || (game.status === 'scheduled' && hoursSinceStart > 0)) {
        // Remove games 5 hours after they start
        return hoursSinceStart <= 5
      }
      
      // Keep all scheduled games that haven't started
      return true
    }) || []

    const transformedGames = filteredGames.map(game => ({
      id: game.id,
      sport: game.sport,
      league: game.league,
      home_team: game.home_team,
      away_team: game.away_team,
      game_date: game.game_date,
      game_time: game.game_time,
      status: game.status,
      venue: game.venue,
      odds: game.odds,
      created_at: game.created_at,
      updated_at: game.updated_at,
      // Add computed fields
      time_until_game: getTimeUntilGame(game.game_date, game.game_time),
      sportsbooks: game.odds ? Object.keys(game.odds) : []
    }))

    return NextResponse.json({
      success: true,
      data: transformedGames,
      pagination: {
        limit,
        offset,
        total: transformedGames.length
      }
    })

  } catch (error) {
    console.error('Error fetching odds:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

function getTimeUntilGame(gameDate: string, gameTime: string): string {
  const gameDateTime = new Date(`${gameDate}T${gameTime}`)
  const now = new Date()
  const diffMs = gameDateTime.getTime() - now.getTime()
  
  if (diffMs < 0) return 'Started'
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return 'Starting soon'
}

