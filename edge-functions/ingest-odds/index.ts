import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OddsAPIEvent {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: Array<{
    key: string
    title: string
    last_update: string
    markets: Array<{
      key: string
      last_update: string
      outcomes: Array<{
        name: string
        price: number
        point?: number
        description?: string
      }>
    }>
  }>
}

interface InternalOddsData {
  game_id: string
  sport: string
  league: string
  home_team: string
  away_team: string
  game_date: string
  game_time: string
  sportsbooks: {
    [bookmaker: string]: {
      moneyline?: { home: number; away: number }
      spread?: { home: number; away: number; line: number }
      total?: { over: number; under: number; line: number }
      last_update: string
    }
  }
  last_updated: string
  source: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY')

    if (!oddsApiKey) {
      throw new Error('THE_ODDS_API_KEY not found in environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch odds from The Odds API - only upcoming games
    const sports = ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb']
    const allOddsData: InternalOddsData[] = []
    const today = new Date().toISOString().split('T')[0]

    for (const sport of sports) {
      try {
        // Only fetch games for today and the next 7 days with multiple sportsbooks
        const response = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso&commenceTimeFrom=${today}T00:00:00Z&commenceTimeTo=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T23:59:59Z&bookmakers=draftkings,fanduel,caesars,betmgm,pointsbet`
        )

        if (!response.ok) {
          console.error(`Failed to fetch ${sport} odds:`, response.statusText)
          continue
        }

        const events: OddsAPIEvent[] = await response.json()
        
        for (const event of events) {
          const oddsData = convertToInternalFormat(event)
          allOddsData.push(oddsData)
        }

        console.log(`Fetched ${events.length} ${sport} events`)
      } catch (error) {
        console.error(`Error fetching ${sport} odds:`, error)
      }
    }

    // Store odds data in Supabase
    let storedCount = 0
    for (const data of allOddsData) {
      try {
          const { error: gameError } = await supabase
            .from('games')
            .upsert({
              id: data.game_id,
              sport: data.sport,
              league: data.league,
              home_team: { 
                name: data.home_team, 
                abbreviation: data.home_team.substring(0, 3).toUpperCase() 
              },
              away_team: { 
                name: data.away_team, 
                abbreviation: data.away_team.substring(0, 3).toUpperCase() 
              },
              game_date: data.game_date.split('T')[0],
              game_time: data.game_date.split('T')[1].substring(0, 8),
              status: 'scheduled',
              odds: data.sportsbooks, // Store sportsbooks data
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' })

        if (gameError) {
          console.error(`Error upserting game ${data.game_id}:`, gameError.message)
        } else {
          storedCount++
        }
      } catch (error) {
        console.error(`Error processing game ${data.game_id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully ingested ${storedCount} games with odds data`,
        total_fetched: allOddsData.length,
        stored: storedCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in ingest-odds function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

function convertToInternalFormat(event: OddsAPIEvent): InternalOddsData {
  const sportsbooks: InternalOddsData['sportsbooks'] = {}

  for (const bookmaker of event.bookmakers) {
    const bookmakerOdds: any = {
      last_update: bookmaker.last_update
    }

    for (const market of bookmaker.markets) {
      if (market.key === 'h2h') {
        const homeOutcome = market.outcomes.find(o => o.name === event.home_team)
        const awayOutcome = market.outcomes.find(o => o.name === event.away_team)
        if (homeOutcome && awayOutcome) {
          bookmakerOdds.moneyline = { home: homeOutcome.price, away: awayOutcome.price }
        }
      } else if (market.key === 'spreads') {
        const homeOutcome = market.outcomes.find(o => o.name === event.home_team)
        const awayOutcome = market.outcomes.find(o => o.name === event.away_team)
        if (homeOutcome && awayOutcome && homeOutcome.point !== undefined && awayOutcome.point !== undefined) {
          bookmakerOdds.spread = { home: homeOutcome.price, away: awayOutcome.price, line: homeOutcome.point }
        }
      } else if (market.key === 'totals') {
        const overOutcome = market.outcomes.find(o => o.name === 'Over')
        const underOutcome = market.outcomes.find(o => o.name === 'Under')
        if (overOutcome && underOutcome && overOutcome.point !== undefined) {
          bookmakerOdds.total = { over: overOutcome.price, under: underOutcome.price, line: overOutcome.point }
        }
      }
    }

    sportsbooks[bookmaker.key] = bookmakerOdds
  }

  return {
    game_id: event.id,
    sport: event.sport_key,
    league: event.sport_title,
    home_team: event.home_team,
    away_team: event.away_team,
    game_date: event.commence_time,
    game_time: event.commence_time,
    sportsbooks,
    last_updated: new Date().toISOString(),
    source: 'the-odds-api',
  }
}
