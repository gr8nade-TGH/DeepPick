/**
 * Sync MySportsFeeds games and odds to database
 * POST /api/sync/mysportsfeeds-games
 */

import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { fetchOddsGameLines } from '@/lib/data-sources/mysportsfeeds-api'
import { resolveTeamName } from '@/lib/data-sources/team-mappings'
import { getNBASeasonForDateString, formatDateForAPI } from '@/lib/data-sources/season-utils'

/**
 * Convert decimal odds to American odds
 * Decimal >= 2.0: American = (decimal - 1) * 100
 * Decimal < 2.0: American = -100 / (decimal - 1)
 */
function decimalToAmerican(decimal: number): number {
  if (!decimal || decimal <= 1) return 0

  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100)
  } else {
    return Math.round(-100 / (decimal - 1))
  }
}


export async function POST(request: Request) {
  try {
    console.log(`[Sync Games] Starting...`)

    const supabase = getSupabase()

    // Get date from request body or use today
    let dateStr: string
    let seasonInfo: any

    try {
      const body = await request.json()
      if (body.date) {
        dateStr = body.date
        seasonInfo = getNBASeasonForDateString(dateStr)
        console.log(`[Sync Games] Using provided date: ${dateStr}`)
      } else {
        const today = new Date()
        dateStr = formatDateForAPI(today)
        seasonInfo = getNBASeasonForDateString(dateStr)
        console.log(`[Sync Games] Using today's date: ${dateStr}`)
      }
    } catch {
      // No body or invalid JSON - use today
      const today = new Date()
      dateStr = formatDateForAPI(today)
      seasonInfo = getNBASeasonForDateString(dateStr)
      console.log(`[Sync Games] No date provided, using today: ${dateStr}`)
    }

    console.log(`[Sync Games] Date: ${dateStr}`)
    console.log(`[Sync Games] Season: ${seasonInfo.season} (${seasonInfo.displayName})`)
    console.log(`[Sync Games] Fetching MySportsFeeds odds data...`)

    // Fetch odds (which includes game information)
    // Use 'current' season for live data
    let odds
    try {
      odds = await fetchOddsGameLines(dateStr, true)
      console.log(`[Sync Games] API Response received`)
      console.log(`[Sync Games] lastUpdatedOn: ${odds.lastUpdatedOn}`)
      console.log(`[Sync Games] gameLines count: ${odds.gameLines?.length || 0}`)

      if (!odds.gameLines || odds.gameLines.length === 0) {
        console.warn(`[Sync Games] No games found for ${dateStr}`)
        console.warn(`[Sync Games] Possible reasons:`)
        console.warn(`  1. No NBA games scheduled for this date`)
        console.warn(`  2. Date is outside the regular season (${seasonInfo.displayName})`)
        console.warn(`  3. MySportsFeeds subscription doesn't include odds data`)
        console.warn(`  4. Season format mismatch`)

        return NextResponse.json({
          success: true,
          message: `No games found for ${dateStr}`,
          date: dateStr,
          season: seasonInfo.season,
          gamesProcessed: 0,
          gamesSynced: 0,
          errors: [],
          warning: 'No games available for this date. This may be normal if no games are scheduled.'
        })
      }
    } catch (fetchError) {
      console.error('[Sync Games] Error fetching odds:', fetchError)
      return NextResponse.json({
        success: false,
        error: `Failed to fetch odds: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        date: dateStr,
        season: seasonInfo.season
      }, { status: 500 })
    }

    // Process games from odds data
    const games = odds.gameLines || []
    let synced = 0

    const errors: string[] = []
    const warnings: string[] = []

    for (const gameLine of games) {
      try {
        const gameData = gameLine.game
        const gameId = gameData?.id?.toString()
        const homeTeamAbbrev = gameData?.homeTeamAbbreviation
        const awayTeamAbbrev = gameData?.awayTeamAbbreviation
        const startTime = gameData?.startTime

        if (!gameId || !homeTeamAbbrev || !awayTeamAbbrev || !startTime) {
          errors.push(`Skipping game ${gameId} - missing required fields (id: ${!!gameId}, home: ${!!homeTeamAbbrev}, away: ${!!awayTeamAbbrev}, time: ${!!startTime})`)
          continue
        }

        // Resolve team names using mapping
        let homeTeamInfo, awayTeamInfo
        try {
          homeTeamInfo = resolveTeamName(homeTeamAbbrev)
          awayTeamInfo = resolveTeamName(awayTeamAbbrev)
        } catch (teamError) {
          errors.push(`Skipping game ${gameId} - ${teamError instanceof Error ? teamError.message : String(teamError)}`)
          continue
        }

        // Parse game odds if available
        let oddsData: any = null

        if (gameLine.lines && gameLine.lines.length > 0) {
          // Extract lines from the first available sportsbook
          const lines = gameLine.lines[0]
          oddsData = {} as any

          // Add spread, total, moneylines if available
          // Convert decimal odds to American odds for consistency
          if (lines.pointSpreads && lines.pointSpreads.length > 0) {
            // Get the most recent FULL game segment spread
            const fullSpread = lines.pointSpreads.find((s: any) => s.pointSpread?.gameSegment === 'FULL')
            if (fullSpread) {
              const homeDecimal = fullSpread.pointSpread?.homeLine?.decimal
              const awayDecimal = fullSpread.pointSpread?.awayLine?.decimal

              oddsData.spread = {
                home: homeDecimal ? decimalToAmerican(homeDecimal) : 0,
                away: awayDecimal ? decimalToAmerican(awayDecimal) : 0,
                line: fullSpread.pointSpread?.homeSpread || -(fullSpread.pointSpread?.awaySpread || 0)
              }
            }
          }

          if (lines.overUnders && lines.overUnders.length > 0) {
            // Get the most recent FULL game segment total
            const fullOverUnder = lines.overUnders.find((o: any) => o.overUnder?.gameSegment === 'FULL')
            if (fullOverUnder) {
              const overDecimal = fullOverUnder.overUnder?.overLine?.decimal
              const underDecimal = fullOverUnder.overUnder?.underLine?.decimal

              oddsData.total = {
                over: overDecimal ? decimalToAmerican(overDecimal) : 0,
                under: underDecimal ? decimalToAmerican(underDecimal) : 0,
                line: fullOverUnder.overUnder?.overUnder || 0
              }
            }
          }

          if (lines.moneyLines && lines.moneyLines.length > 0) {
            // Get the most recent FULL game segment moneyline
            const fullML = lines.moneyLines.find((m: any) => m.moneyLine?.gameSegment === 'FULL')
            if (fullML) {
              const homeDecimal = fullML.moneyLine?.homeLine?.decimal
              const awayDecimal = fullML.moneyLine?.awayLine?.decimal

              oddsData.moneyline = {
                home: homeDecimal ? decimalToAmerican(homeDecimal) : 0,
                away: awayDecimal ? decimalToAmerican(awayDecimal) : 0
              }
            }
          }

          // Add sportsbook name for reference
          oddsData.source = lines.sportsbook || 'MySportsFeeds'
        }

        // Upsert game to database with resolved team names
        // Use api_event_id for conflict resolution (not id)
        const { error } = await supabase
          .from('games')
          .upsert({
            api_event_id: `msf_${gameId}`, // MySportsFeeds game ID for deduplication
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
            game_start_timestamp: startTime, // Store complete ISO-8601 timestamp in UTC
            status: 'scheduled',
            venue: '', // MySportsFeeds doesn't provide venue in odds endpoint
            odds: oddsData || {},
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'api_event_id', // Use api_event_id for deduplication
            ignoreDuplicates: false // Update existing records
          })

        if (error) {
          errors.push(`Error upserting game ${gameId} (${awayTeamInfo.abbrev} @ ${homeTeamInfo.abbrev}): ${error.message}`)
        } else {
          synced++
          console.log(`[Sync Games] Synced: ${awayTeamInfo.full} @ ${homeTeamInfo.full} (${gameId})`)
        }
      } catch (error) {
        errors.push(`Error processing game: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Provide detailed summary
    const summary = {
      success: true,
      message: synced > 0
        ? `Successfully synced ${synced} game${synced !== 1 ? 's' : ''} from MySportsFeeds`
        : 'No games were synced',
      date: dateStr,
      season: seasonInfo.season,
      seasonDisplay: seasonInfo.displayName,
      gamesProcessed: games.length,
      gamesSynced: synced,
      errors: errors,
      warnings: warnings,
      timestamp: new Date().toISOString()
    }

    if (errors.length > 0) {
      console.error(`[Sync Games] Completed with ${errors.length} error(s)`)
      errors.forEach(err => console.error(`  - ${err}`))
    }

    if (synced === 0 && errors.length === 0) {
      console.warn(`[Sync Games] No games synced - this may be normal if no games are scheduled`)
    } else {
      console.log(`[Sync Games] Successfully synced ${synced}/${games.length} games`)
    }

    return NextResponse.json(summary)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Sync Games] Error:', errorMessage)

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}

