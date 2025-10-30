import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { fetchOddsGameLines } from '@/lib/data-sources/mysportsfeeds-api'
import { resolveTeamName } from '@/lib/data-sources/team-mappings'
import { formatDateForAPI } from '@/lib/data-sources/season-utils'

/**
 * MYSPORTSFEEDS ODDS SYNC CRON
 * 
 * Runs every 5 minutes to sync NBA odds from MySportsFeeds API
 * This replaces the old The Odds API integration
 * 
 * What it does:
 * 1. Fetches today's NBA games with odds from MySportsFeeds
 * 2. Updates existing games in the database with latest odds
 * 3. Creates new games if they don't exist yet
 */

/**
 * Convert decimal odds to American odds
 */
function decimalToAmerican(decimal: number): number {
  if (!decimal || decimal <= 1) return 0

  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100)
  } else {
    return Math.round(-100 / (decimal - 1))
  }
}

export async function GET() {
  const executionTime = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🤖 [MYSPORTSFEEDS-ODDS-SYNC] EXECUTION START: ${executionTime}`)
  console.log(`${'='.repeat(80)}\n`)

  try {
    const startTime = Date.now()
    const supabase = getSupabaseAdmin()

    // Get today's date in YYYYMMDD format
    const today = new Date()
    const dateStr = formatDateForAPI(today)
    
    console.log(`📅 [MYSPORTSFEEDS-ODDS-SYNC] Fetching odds for date: ${dateStr}`)

    // Fetch odds from MySportsFeeds (use 'current' season for live data)
    let oddsData
    try {
      oddsData = await fetchOddsGameLines(dateStr, true)
      console.log(`✅ [MYSPORTSFEEDS-ODDS-SYNC] API Response received`)
      console.log(`📊 [MYSPORTSFEEDS-ODDS-SYNC] Games with odds: ${oddsData.gameLines?.length || 0}`)
    } catch (apiError) {
      console.error('❌ [MYSPORTSFEEDS-ODDS-SYNC] MySportsFeeds API error:', apiError)
      return NextResponse.json({
        success: false,
        error: 'MySportsFeeds API error',
        details: apiError instanceof Error ? apiError.message : String(apiError),
        timestamp: executionTime
      }, { status: 500 })
    }

    const games = oddsData.gameLines || []
    let updated = 0
    let created = 0
    const errors: string[] = []

    for (const gameLine of games) {
      try {
        const gameData = gameLine.game
        const gameId = gameData?.id?.toString()
        const homeTeamAbbrev = gameData?.homeTeamAbbreviation
        const awayTeamAbbrev = gameData?.awayTeamAbbreviation
        const startTime = gameData?.startTime

        if (!gameId || !homeTeamAbbrev || !awayTeamAbbrev || !startTime) {
          errors.push(`Skipping game ${gameId} - missing required fields`)
          continue
        }

        // Resolve team names
        let homeTeamInfo, awayTeamInfo
        try {
          homeTeamInfo = resolveTeamName(homeTeamAbbrev)
          awayTeamInfo = resolveTeamName(awayTeamAbbrev)
        } catch (teamError) {
          errors.push(`Skipping game ${gameId} - ${teamError instanceof Error ? teamError.message : String(teamError)}`)
          continue
        }

        // Parse odds from MySportsFeeds format
        let oddsData: any = {}
        let totalLine = 0
        let spreadLine = 0

        if (gameLine.lines && gameLine.lines.length > 0) {
          const lines = gameLine.lines[0]
          const sportsbookName = lines.sportsbook || 'MySportsFeeds'

          // Initialize sportsbook object
          oddsData[sportsbookName] = {}

          // Parse spread
          if (lines.pointSpreads && lines.pointSpreads.length > 0) {
            const fullSpread = lines.pointSpreads.find((s: any) => s.pointSpread?.gameSegment === 'FULL')
            if (fullSpread) {
              const homeDecimal = fullSpread.pointSpread?.homeLine?.decimal
              const awayDecimal = fullSpread.pointSpread?.awayLine?.decimal
              const homeSpread = fullSpread.pointSpread?.homeSpread || 0
              const awaySpread = fullSpread.pointSpread?.awaySpread || 0

              oddsData[sportsbookName].spread = {
                home: homeDecimal ? decimalToAmerican(homeDecimal) : 0,
                away: awayDecimal ? decimalToAmerican(awayDecimal) : 0,
                line: homeSpread || -awaySpread
              }
              spreadLine = homeSpread || -awaySpread
            }
          }

          // Parse total (over/under)
          if (lines.overUnders && lines.overUnders.length > 0) {
            const fullOverUnder = lines.overUnders.find((o: any) => o.overUnder?.gameSegment === 'FULL')
            if (fullOverUnder) {
              const overDecimal = fullOverUnder.overUnder?.overLine?.decimal
              const underDecimal = fullOverUnder.overUnder?.underLine?.decimal
              const overUnderLine = fullOverUnder.overUnder?.overUnder || 0

              oddsData[sportsbookName].total = {
                over: overDecimal ? decimalToAmerican(overDecimal) : 0,
                under: underDecimal ? decimalToAmerican(underDecimal) : 0,
                line: overUnderLine
              }
              totalLine = overUnderLine
            }
          }

          // Parse moneyline
          if (lines.moneyLines && lines.moneyLines.length > 0) {
            const fullML = lines.moneyLines.find((m: any) => m.moneyLine?.gameSegment === 'FULL')
            if (fullML) {
              const homeDecimal = fullML.moneyLine?.homeLine?.decimal
              const awayDecimal = fullML.moneyLine?.awayLine?.decimal

              oddsData[sportsbookName].moneyline = {
                home: homeDecimal ? decimalToAmerican(homeDecimal) : 0,
                away: awayDecimal ? decimalToAmerican(awayDecimal) : 0
              }
            }
          }
        }

        // Upsert game to database
        const { error } = await supabase
          .from('games')
          .upsert({
            api_event_id: `msf_${gameId}`,
            sport: 'nba',
            league: 'NBA',
            home_team: {
              name: homeTeamInfo.full,
              abbreviation: homeTeamInfo.abbrev
            },
            away_team: {
              name: awayTeamInfo.full,
              abbreviation: awayTeamInfo.abbrev
            },
            game_date: startTime.split('T')[0],
            game_time: startTime.split('T')[1].split('.')[0],
            status: 'scheduled',
            venue: '',
            odds: oddsData,
            total_line: totalLine,
            spread_line: spreadLine,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'api_event_id',
            ignoreDuplicates: false
          })

        if (error) {
          errors.push(`Error upserting game ${gameId}: ${error.message}`)
        } else {
          // Check if this was an update or insert by querying
          const { data: existingGame } = await supabase
            .from('games')
            .select('created_at, updated_at')
            .eq('api_event_id', `msf_${gameId}`)
            .single()

          if (existingGame && existingGame.created_at === existingGame.updated_at) {
            created++
            console.log(`➕ [MYSPORTSFEEDS-ODDS-SYNC] Created: ${awayTeamInfo.full} @ ${homeTeamInfo.full}`)
          } else {
            updated++
            console.log(`🔄 [MYSPORTSFEEDS-ODDS-SYNC] Updated: ${awayTeamInfo.full} @ ${homeTeamInfo.full}`)
          }
        }
      } catch (error) {
        errors.push(`Error processing game: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const duration = Date.now() - startTime

    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ [MYSPORTSFEEDS-ODDS-SYNC] EXECUTION COMPLETE: ${duration}ms`)
    console.log(`📊 [MYSPORTSFEEDS-ODDS-SYNC] Created: ${created}, Updated: ${updated}`)
    if (errors.length > 0) {
      console.log(`⚠️ [MYSPORTSFEEDS-ODDS-SYNC] Errors: ${errors.length}`)
    }
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      message: `MySportsFeeds odds sync completed`,
      created,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`,
      timestamp: executionTime
    })

  } catch (error) {
    console.error('❌ [MYSPORTSFEEDS-ODDS-SYNC] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: executionTime
    }, { status: 500 })
  }
}

// Also allow POST for manual triggers
export async function POST() {
  return GET()
}

