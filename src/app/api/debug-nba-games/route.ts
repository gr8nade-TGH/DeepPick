import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    
    // Get NBA games with detailed odds info
    const { data: games, error } = await supabase
      .from('games')
      .select('id, sport, home_team, away_team, game_date, game_time, odds')
      .eq('sport', 'nba')
      .eq('status', 'scheduled')
      .limit(5)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    if (!games || games.length === 0) {
      return NextResponse.json({ 
        message: 'No NBA games found',
        totalGames: 0 
      })
    }
    
    // Analyze the odds structure
    const gamesWithOddsAnalysis = games.map(game => {
      const oddsAnalysis = {
        hasOdds: !!game.odds,
        oddsType: typeof game.odds,
        oddsKeys: game.odds ? Object.keys(game.odds) : [],
        oddsStructure: game.odds,
        // Try to extract some odds
        extractedSpread: null,
        extractedTotal: null,
        extractedML: null
      }
      
      if (game.odds && typeof game.odds === 'object') {
        const bookmakers = Object.values(game.odds) as any[]
        
        // Try different structures
        for (const book of bookmakers) {
          if (book?.markets?.spreads?.[0]?.outcomes?.[0]?.point !== undefined) {
            oddsAnalysis.extractedSpread = book.markets.spreads[0].outcomes[0].point
            break
          }
        }
        
        for (const book of bookmakers) {
          if (book?.markets?.totals?.[0]?.outcomes?.[0]?.point !== undefined) {
            oddsAnalysis.extractedTotal = book.markets.totals[0].outcomes[0].point
            break
          }
        }
        
        for (const book of bookmakers) {
          if (book?.markets?.h2h?.[0]?.outcomes?.[0]?.price !== undefined) {
            oddsAnalysis.extractedML = book.markets.h2h[0].outcomes[0].price
            break
          }
        }
      }
      
      return {
        id: game.id,
        matchup: `${game.away_team?.name || 'Away'} @ ${game.home_team?.name || 'Home'}`,
        date: game.game_date,
        time: game.game_time,
        oddsAnalysis
      }
    })
    
    return NextResponse.json({
      success: true,
      totalGames: games.length,
      games: gamesWithOddsAnalysis,
      sampleOddsStructure: games[0]?.odds
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
