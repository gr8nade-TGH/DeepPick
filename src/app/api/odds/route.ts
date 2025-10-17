import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const sport = url.searchParams.get('sport')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Only get games that haven't started yet
    const now = new Date().toISOString()
    
    let query = supabase
      .from('games')
      .select('*')
      .gte('game_date', new Date().toISOString().split('T')[0]) // Only today and future dates
      .in('status', ['scheduled', 'live']) // Only scheduled or live games
      .order('game_date', { ascending: true })
      .range(offset, offset + limit - 1)

    if (sport && sport !== 'all') {
      query = query.eq('sport', sport)
    }

    const { data: games, error } = await query

    if (error) {
      throw new Error(`Supabase error: ${error.message}`)
    }

    // Transform the data for better display
    const transformedGames = games?.map(game => ({
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
    })) || []

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

