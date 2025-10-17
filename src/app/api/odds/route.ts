import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('games')
      .select('*')
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
      odds_summary: getOddsSummary(game.odds)
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
  return `${minutes}m`
}

function getOddsSummary(odds: any): string {
  const parts = []
  
  if (odds.moneyline) {
    parts.push(`ML: ${odds.moneyline.home}/${odds.moneyline.away}`)
  }
  if (odds.spread) {
    parts.push(`Spread: ${odds.spread.line}`)
  }
  if (odds.total) {
    parts.push(`Total: ${odds.total.line}`)
  }
  if (odds.player_props && odds.player_props.length > 0) {
    parts.push(`${odds.player_props.length} props`)
  }
  
  return parts.join(' • ')
}
