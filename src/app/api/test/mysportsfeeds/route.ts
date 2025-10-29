/**
 * Test MySportsFeeds API Connection
 * GET /api/test/mysportsfeeds
 */

import { fetchOddsGameLines } from '@/lib/data-sources/mysportsfeeds-api'
import { formatDateForAPI, getNBASeason, getNBASeasonForDateString } from '@/lib/data-sources/season-utils'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Get date from query parameter or use today
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    let dateStr: string
    let seasonInfo: any

    if (dateParam) {
      // Use provided date (should be in YYYYMMDD format)
      dateStr = dateParam
      seasonInfo = getNBASeasonForDateString(dateStr)
      console.log(`[MySportsFeeds Test] Testing with provided date: ${dateStr}`)
    } else {
      // Use today's date
      dateStr = formatDateForAPI(new Date())
      seasonInfo = getNBASeason()
      console.log(`[MySportsFeeds Test] Testing with today's date: ${dateStr}`)
    }

    console.log(`[MySportsFeeds Test] Season: ${seasonInfo.season} (${seasonInfo.displayName})`)

    // Try to fetch odds game lines (use 'current' season for live data)
    const oddsData = await fetchOddsGameLines(dateStr, true)

    const gamesCount = oddsData.gameLines?.length || 0

    return NextResponse.json({
      success: true,
      message: gamesCount > 0
        ? `MySportsFeeds API working! Found ${gamesCount} game${gamesCount !== 1 ? 's' : ''}.`
        : 'MySportsFeeds API connected, but no games found for this date.',
      testDate: dateStr,
      season: seasonInfo.season,
      seasonDisplay: seasonInfo.displayName,
      lastUpdatedOn: oddsData.lastUpdatedOn,
      gamesWithOdds: gamesCount,
      sampleGame: gamesCount > 0 ? {
        id: oddsData.gameLines[0]?.game?.id,
        away: oddsData.gameLines[0]?.game?.awayTeamAbbreviation,
        home: oddsData.gameLines[0]?.game?.homeTeamAbbreviation,
        startTime: oddsData.gameLines[0]?.game?.startTime
      } : null,
      apiMessage: oddsData.message,
      timestamp: new Date().toISOString(),
      hint: gamesCount === 0 ? 'Try a different date with ?date=YYYYMMDD (e.g., ?date=20250115)' : null
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[MySportsFeeds Test] Error:', errorMessage)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      helpfulInfo: {
        possibleCauses: [
          'API key not configured or invalid',
          'No games scheduled for today',
          'Date is outside the NBA season',
          'MySportsFeeds subscription issue'
        ],
        nextSteps: [
          'Check MYSPORTSFEEDS_API_KEY environment variable',
          'Verify your MySportsFeeds subscription is active',
          'Try a different date during the NBA season'
        ]
      },
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
