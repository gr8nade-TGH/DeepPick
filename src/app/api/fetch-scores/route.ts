import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// Map API sport keys to database enum values
function mapSportKey(apiSportKey: string): string {
  const sportMap: Record<string, string> = {
    'americanfootball_nfl': 'nfl',
    'basketball_nba': 'nba',
    'baseball_mlb': 'mlb',
    'icehockey_nhl': 'nhl',
    'soccer_epl': 'soccer',
  }
  return sportMap[apiSportKey] || apiSportKey
}

export async function POST() {
  try {
    console.log('🏆 Starting score fetch process...')
    
    const oddsApiKey = process.env.THE_ODDS_API_KEY

    if (!oddsApiKey) {
      return NextResponse.json({
        success: false,
        error: 'THE_ODDS_API_KEY not found'
      }, { status: 500 })
    }

    // Only fetch scores for sports that are currently in season
    // MLB season typically ends in October, NBA starts in October, NFL runs Sep-Feb
    const sports = [
      { key: 'baseball_mlb', name: 'MLB' },
      { key: 'basketball_nba', name: 'NBA' },
      { key: 'americanfootball_nfl', name: 'NFL' }
    ]

    let updatedCount = 0
    let totalScores = 0
    const errors: string[] = []

    for (const sport of sports) {
      try {
        console.log(`📊 Fetching scores for ${sport.name}...`)
        
        // Fetch scores from last 3 days (daysFrom=3 is the max)
        const url = `https://api.the-odds-api.com/v4/sports/${sport.key}/scores?apiKey=${oddsApiKey}&daysFrom=3`
        console.log(`🔗 Calling: ${url.replace(oddsApiKey, 'API_KEY')}`)
        
        const response = await fetch(url)

        if (!response.ok) {
          let errorText = ''
          try {
            errorText = await response.text()
          } catch (e) {
            errorText = 'Could not read error response'
          }
          console.error(`❌ ${sport.name} error:`, response.status, errorText)
          errors.push(`Failed to fetch ${sport.name} scores: ${response.status} - ${errorText}`)
          continue
        }

        let scores
        try {
          scores = await response.json()
        } catch (e) {
          errors.push(`Failed to parse ${sport.name} scores JSON`)
          continue
        }
        console.log(`Found ${scores.length} ${sport.name} score records`)
        totalScores += scores.length

        for (const scoreData of scores) {
          try {
            const gameDate = scoreData.commence_time.split('T')[0]
            const homeTeamName = scoreData.home_team
            const awayTeamName = scoreData.away_team

            // Find matching game in our database
            const { data: games, error: findError } = await getSupabaseAdmin()
              .from('games')
              .select('*')
              .eq('sport', mapSportKey(sport.key))
              .eq('game_date', gameDate)

            if (findError) {
              errors.push(`Error finding game: ${findError.message}`)
              continue
            }

            // Match by team names
            const matchingGame = games?.find(game => 
              game.home_team.name === homeTeamName && 
              game.away_team.name === awayTeamName
            )

            if (!matchingGame) {
              console.log(`⚠️ No match found for: ${awayTeamName} @ ${homeTeamName} on ${gameDate}`)
              continue
            }

            // Extract scores
            const homeScore = scoreData.scores?.find((s: any) => s.name === homeTeamName)
            const awayScore = scoreData.scores?.find((s: any) => s.name === awayTeamName)

            if (!homeScore || !awayScore) {
              // No scores available yet, skip
              continue
            }

            // Determine winner (only for completed games)
            const homePoints = parseInt(homeScore.score)
            const awayPoints = parseInt(awayScore.score)
            let winner = 'tie'
            
            if (scoreData.completed) {
              if (homePoints > awayPoints) {
                winner = 'home'
              } else if (awayPoints > homePoints) {
                winner = 'away'
              }
            }

            // Determine game status
            const gameStatus = scoreData.completed ? 'final' : 'live'

            // Update game with score and status
            const { error: updateError } = await getSupabaseAdmin()
              .from('games')
              .update({
                final_score: {
                  home: homePoints,
                  away: awayPoints,
                  winner: winner,
                  margin: Math.abs(homePoints - awayPoints)
                },
                status: gameStatus,
                completed_at: scoreData.completed ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
              })
              .eq('id', matchingGame.id)

            if (updateError) {
              errors.push(`Error updating game ${matchingGame.id}: ${updateError.message}`)
            } else {
              updatedCount++
              const statusEmoji = gameStatus === 'live' ? '🔴' : '✅'
              console.log(`${statusEmoji} Updated: ${awayTeamName} ${awayPoints} @ ${homeTeamName} ${homePoints} (${gameStatus})`)
            }
          } catch (err) {
            errors.push(`Exception processing score: ${err}`)
          }
        }
      } catch (err) {
        errors.push(`Exception fetching ${sport.name} scores: ${err}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} games with final scores`,
      updatedCount,
      totalScoresFound: totalScores,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('❌ Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

