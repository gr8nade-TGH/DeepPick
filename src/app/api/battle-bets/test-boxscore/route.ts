import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Test endpoint to fetch a real boxscore and inspect the structure
 *
 * Usage: GET /api/battle-bets/test-boxscore
 *
 * This will fetch a completed game from the database and get its boxscore
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Test Boxscore] Finding a completed game...')

    const supabase = getSupabaseAdmin()

    // Find a recently completed game
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, game_date, status, final_score')
      .eq('sport', 'nba')
      .eq('status', 'final')
      .order('game_date', { ascending: false })
      .limit(1)

    if (gamesError) {
      console.error('[Test Boxscore] Error fetching games:', gamesError)
      return NextResponse.json({
        success: false,
        error: `Database error: ${gamesError.message}`
      }, { status: 500 })
    }

    if (!games || games.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No completed games found in database'
      }, { status: 404 })
    }

    const game = games[0]
    console.log('[Test Boxscore] Found game:', {
      id: game.id,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      gameDate: game.game_date,
      status: game.status
    })

    // Construct MySportsFeeds game ID: YYYYMMDD-AWAY-HOME
    const gameDate = game.game_date.replace(/-/g, '') // Convert 2025-01-15 to 20250115
    const awayAbbrev = game.away_team.abbreviation
    const homeAbbrev = game.home_team.abbreviation
    const gameId = `${gameDate}-${awayAbbrev}-${homeAbbrev}`

    console.log('[Test Boxscore] Constructed game ID:', gameId)

    // Use the existing MySportsFeeds integration
    const { fetchMySportsFeeds } = await import('@/lib/data-sources/mysportsfeeds-api')

    const url = `games/${gameId}/boxscore.json`
    console.log('[Test Boxscore] Fetching from MySportsFeeds:', url)

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader
      }
    })

    console.log('[Test Boxscore] Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Test Boxscore] Error response:', errorText)
      return NextResponse.json({
        success: false,
        error: `MySportsFeeds API error: ${response.status} ${response.statusText}`,
        details: errorText
      }, { status: response.status })
    }

    console.log('[Test Boxscore] Response received, analyzing structure...')

    // Extract key structures for inspection
    const inspection = {
      success: true,
      gameId,
      gameInfo: {
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        gameDate: game.game_date,
        finalScore: game.final_score
      },
      structure: {
        hasPeriodSummary: !!data.periodSummary,
        periodCount: data.periodSummary?.period?.length || 0,
        periods: data.periodSummary?.period?.map((p: any) => ({
          number: p['@number'],
          awayScore: p.awayScore,
          homeScore: p.homeScore
        })) || [],
        hasAwayTeam: !!data.awayTeam,
        hasHomeTeam: !!data.homeTeam,
        awayPlayerCount: data.awayTeam?.awayPlayers?.playerEntry?.length || 0,
        homePlayerCount: data.homeTeam?.homePlayers?.playerEntry?.length || 0,
        sampleAwayPlayer: data.awayTeam?.awayPlayers?.playerEntry?.[0] ? {
          name: data.awayTeam.awayPlayers.playerEntry[0].player?.lastName,
          statsKeys: Object.keys(data.awayTeam.awayPlayers.playerEntry[0].stats || {})
        } : null,
        sampleHomePlayer: data.homeTeam?.homePlayers?.playerEntry?.[0] ? {
          name: data.homeTeam.homePlayers.playerEntry[0].player?.lastName,
          statsKeys: Object.keys(data.homeTeam.homePlayers.playerEntry[0].stats || {})
        } : null
      },
      fullData: data
    }

    console.log('[Test Boxscore] Structure analysis complete')
    console.log('[Test Boxscore] Period count:', inspection.structure.periodCount)
    console.log('[Test Boxscore] Player counts:', {
      away: inspection.structure.awayPlayerCount,
      home: inspection.structure.homePlayerCount
    })

    return NextResponse.json(inspection, { status: 200 })
  } catch (error) {
    console.error('[Test Boxscore] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

