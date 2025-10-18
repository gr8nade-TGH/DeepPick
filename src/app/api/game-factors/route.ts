import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Factor {
  id: string
  name: string
  value: string
  impact: 'positive' | 'negative' | 'neutral'
  confidence: 'high' | 'medium' | 'low'
  description: string
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const gameId = request.nextUrl.searchParams.get('gameId')
    
    if (!gameId) {
      return NextResponse.json({ success: false, error: 'Game ID required' }, { status: 400 })
    }

    // Fetch game data
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 })
    }

    // Fetch odds history for line movement analysis
    const { data: oddsHistory, error: historyError } = await supabase
      .from('odds_history')
      .select('*')
      .eq('game_id', gameId)
      .order('captured_at', { ascending: true })

    const factors: Factor[] = []

    // FACTOR 1: Line Movement (Spread)
    if (oddsHistory && oddsHistory.length >= 2) {
      const firstOdds = oddsHistory[0].odds
      const latestOdds = oddsHistory[oddsHistory.length - 1].odds
      
      const firstSpread = getAverageSpread(firstOdds)
      const latestSpread = getAverageSpread(latestOdds)
      
      if (firstSpread !== null && latestSpread !== null) {
        const movement = latestSpread - firstSpread
        const absMovement = Math.abs(movement)
        
        if (absMovement >= 1) {
          const direction = movement > 0 ? 'toward home' : 'toward away'
          const team = movement > 0 ? game.home_team.name : game.away_team.name
          
          factors.push({
            id: 'line-movement-spread',
            name: 'Spread Line Movement',
            value: `${absMovement.toFixed(1)} points ${direction}`,
            impact: absMovement >= 3 ? 'positive' : absMovement >= 1.5 ? 'neutral' : 'negative',
            confidence: absMovement >= 3 ? 'high' : 'medium',
            description: `Line moved from ${firstSpread.toFixed(1)} to ${latestSpread.toFixed(1)}. Sharp money on ${team}.`
          })
        }
      }
    }

    // FACTOR 2: Total Line Movement (Over/Under)
    if (oddsHistory && oddsHistory.length >= 2) {
      const firstOdds = oddsHistory[0].odds
      const latestOdds = oddsHistory[oddsHistory.length - 1].odds
      
      const firstTotal = getAverageTotal(firstOdds)
      const latestTotal = getAverageTotal(latestOdds)
      
      if (firstTotal !== null && latestTotal !== null) {
        const movement = latestTotal - firstTotal
        const absMovement = Math.abs(movement)
        
        if (absMovement >= 1) {
          const direction = movement > 0 ? 'OVER' : 'UNDER'
          
          factors.push({
            id: 'line-movement-total',
            name: 'Total Line Movement',
            value: `${absMovement.toFixed(1)} points toward ${direction}`,
            impact: absMovement >= 3 ? 'positive' : 'neutral',
            confidence: absMovement >= 3 ? 'high' : 'medium',
            description: `Total moved from ${firstTotal.toFixed(1)} to ${latestTotal.toFixed(1)}. Market expects ${direction}.`
          })
        }
      }
    }

    // FACTOR 3: Odds Volatility
    if (oddsHistory && oddsHistory.length >= 3) {
      const spreadChanges = []
      for (let i = 1; i < oddsHistory.length; i++) {
        const prevSpread = getAverageSpread(oddsHistory[i - 1].odds)
        const currSpread = getAverageSpread(oddsHistory[i].odds)
        if (prevSpread !== null && currSpread !== null) {
          spreadChanges.push(Math.abs(currSpread - prevSpread))
        }
      }
      
      if (spreadChanges.length > 0) {
        const avgChange = spreadChanges.reduce((a, b) => a + b, 0) / spreadChanges.length
        
        if (avgChange >= 0.5) {
          factors.push({
            id: 'odds-volatility',
            name: 'High Odds Volatility',
            value: `${spreadChanges.length} changes, avg ${avgChange.toFixed(1)} pts`,
            impact: 'negative',
            confidence: 'medium',
            description: 'Odds are fluctuating significantly. Uncertainty in the market. Wait for line to stabilize.'
          })
        }
      }
    }

    // FACTOR 4: Bookmaker Consensus
    const currentOdds = game.odds || {}
    const bookmakers = Object.keys(currentOdds)
    
    if (bookmakers.length >= 3) {
      const spreads: number[] = []
      bookmakers.forEach(book => {
        const spread = currentOdds[book]?.spreads?.home?.point
        if (typeof spread === 'number') spreads.push(spread)
      })
      
      if (spreads.length >= 3) {
        const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length
        const maxDiff = Math.max(...spreads) - Math.min(...spreads)
        
        if (maxDiff <= 1) {
          factors.push({
            id: 'bookmaker-consensus',
            name: 'Strong Bookmaker Consensus',
            value: `All books within ${maxDiff.toFixed(1)} points`,
            impact: 'positive',
            confidence: 'high',
            description: `${bookmakers.length} bookmakers agree on the line (avg: ${avgSpread.toFixed(1)}). High confidence in market efficiency.`
          })
        } else if (maxDiff >= 3) {
          factors.push({
            id: 'bookmaker-disagreement',
            name: 'Bookmaker Disagreement',
            value: `${maxDiff.toFixed(1)} point spread between books`,
            impact: 'neutral',
            confidence: 'medium',
            description: 'Books have different opinions. Potential for line shopping and finding value.'
          })
        }
      }
    }

    // FACTOR 5: Moneyline Value
    const moneylines: Array<{ home: number; away: number }> = []
    bookmakers.forEach(book => {
      const homeML = currentOdds[book]?.h2h?.home
      const awayML = currentOdds[book]?.h2h?.away
      if (homeML && awayML) {
        moneylines.push({ home: homeML, away: awayML })
      }
    })
    
    if (moneylines.length > 0) {
      const avgHomeML = moneylines.reduce((sum, ml) => sum + ml.home, 0) / moneylines.length
      const avgAwayML = moneylines.reduce((sum, ml) => sum + ml.away, 0) / moneylines.length
      
      // Check for heavy favorite
      if (avgHomeML <= -250 || avgAwayML <= -250) {
        const favorite = avgHomeML <= -250 ? game.home_team.name : game.away_team.name
        const odds = avgHomeML <= -250 ? avgHomeML : avgAwayML
        
        factors.push({
          id: 'heavy-favorite',
          name: 'Heavy Favorite Alert',
          value: `${favorite} at ${odds.toFixed(0)}`,
          impact: 'negative',
          confidence: 'high',
          description: 'Heavy favorites often provide poor value. Consider alternative bets like spread or totals.'
        })
      }
      
      // Check for close matchup
      if (Math.abs(avgHomeML - avgAwayML) <= 50 && avgHomeML > -150 && avgAwayML > -150) {
        factors.push({
          id: 'close-matchup',
          name: 'Toss-Up Game',
          value: 'Near even odds',
          impact: 'neutral',
          confidence: 'medium',
          description: 'Market sees this as a very close game. High variance outcome expected.'
        })
      }
    }

    // FACTOR 6: Time Until Game
    const gameDate = new Date(game.game_date)
    const now = new Date()
    const hoursUntilGame = (gameDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursUntilGame <= 3 && hoursUntilGame > 0) {
      factors.push({
        id: 'game-starting-soon',
        name: 'Game Starting Soon',
        value: `${Math.floor(hoursUntilGame)}h ${Math.floor((hoursUntilGame % 1) * 60)}m`,
        impact: 'positive',
        confidence: 'high',
        description: 'Lines are typically sharpest close to game time. Late money often reflects informed betting.'
      })
    } else if (hoursUntilGame > 48) {
      factors.push({
        id: 'early-lines',
        name: 'Early Lines',
        value: `${Math.floor(hoursUntilGame / 24)} days out`,
        impact: 'neutral',
        confidence: 'low',
        description: 'Lines set early are subject to change. Wait for injury reports and more information.'
      })
    }

    // FACTOR 7: Sport-Specific Factors
    if (game.sport === 'nfl') {
      // Check for high totals (shootout potential)
      const avgTotal = getAverageTotal(currentOdds)
      if (avgTotal !== null && avgTotal >= 50) {
        factors.push({
          id: 'high-scoring-game',
          name: 'High-Scoring Potential',
          value: `O/U ${avgTotal.toFixed(1)}`,
          impact: 'positive',
          confidence: 'medium',
          description: 'Market expects a shootout. Consider OVER and high-powered offenses.'
        })
      } else if (avgTotal !== null && avgTotal <= 40) {
        factors.push({
          id: 'defensive-battle',
          name: 'Defensive Battle Expected',
          value: `O/U ${avgTotal.toFixed(1)}`,
          impact: 'neutral',
          confidence: 'medium',
          description: 'Low total suggests strong defenses or weather concerns. UNDER could have value.'
        })
      }
    }

    if (game.sport === 'nba') {
      const avgTotal = getAverageTotal(currentOdds)
      if (avgTotal !== null && avgTotal >= 230) {
        factors.push({
          id: 'fast-pace-game',
          name: 'Fast-Paced Matchup',
          value: `O/U ${avgTotal.toFixed(1)}`,
          impact: 'positive',
          confidence: 'medium',
          description: 'High total indicates up-tempo teams. Expect lots of possessions and scoring.'
        })
      }
    }

    // FACTOR 8: Data Freshness
    const lastUpdate = oddsHistory && oddsHistory.length > 0 
      ? new Date(oddsHistory[oddsHistory.length - 1].captured_at)
      : new Date(game.updated_at)
    
    const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60)
    
    if (minutesSinceUpdate <= 15) {
      factors.push({
        id: 'fresh-data',
        name: 'Fresh Odds Data',
        value: `Updated ${Math.floor(minutesSinceUpdate)} min ago`,
        impact: 'positive',
        confidence: 'high',
        description: 'Odds are current and reflect the latest market information.'
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        gameId,
        factors,
        totalFactors: factors.length,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('Error fetching game factors:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Helper functions
function getAverageSpread(odds: any): number | null {
  const spreads: number[] = []
  Object.keys(odds).forEach(book => {
    const spread = odds[book]?.spreads?.home?.point
    if (typeof spread === 'number') spreads.push(spread)
  })
  return spreads.length > 0 ? spreads.reduce((a, b) => a + b, 0) / spreads.length : null
}

function getAverageTotal(odds: any): number | null {
  const totals: number[] = []
  Object.keys(odds).forEach(book => {
    const total = odds[book]?.totals?.over?.point
    if (typeof total === 'number') totals.push(total)
  })
  return totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : null
}

