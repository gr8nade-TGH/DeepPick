/**
 * DEEP Status API
 * 
 * GET /api/deep/status
 * 
 * Returns current status including:
 * - Eligible cappers (with positive unit records)
 * - Upcoming games (within 4 hours)
 * - Potential consensus opportunities with factor confluence
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEligibleCappers } from '@/lib/cappers/deep/eligibility'
import { getUpcomingGames } from '@/lib/cappers/deep/pick-generator'
import { getPicksForGame, analyzeConsensus } from '@/lib/cappers/deep/consensus'
import { calculateDeepUnits } from '@/lib/cappers/deep/units-calculator'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get eligible cappers
    const eligibleCappers = await getEligibleCappers()
    
    // Get upcoming games
    const upcomingGames = await getUpcomingGames()
    
    // Analyze potential consensus for each game
    const gameAnalysis = []
    
    for (const game of upcomingGames.slice(0, 5)) { // Limit to 5 for performance
      const picks = await getPicksForGame(game.id, eligibleCappers)
      
      const totalGroups = analyzeConsensus(picks, 'total')
      const spreadGroups = analyzeConsensus(picks, 'spread')
      
      const totalDecisions = totalGroups.map(g => calculateDeepUnits(g))
      const spreadDecisions = spreadGroups.map(g => calculateDeepUnits(g))
      
      gameAnalysis.push({
        gameId: game.id,
        matchup: `${game.awayTeam} @ ${game.homeTeam}`,
        hoursUntilStart: game.hoursUntilStart,
        picksFromEligible: picks.length,
        totals: {
          consensus: totalDecisions.find(d => d.shouldGenerate) || null,
          factorConfluence: totalDecisions[0]?.factorConfluence?.slice(0, 3) || []
        },
        spreads: {
          consensus: spreadDecisions.find(d => d.shouldGenerate) || null,
          factorConfluence: spreadDecisions[0]?.factorConfluence?.slice(0, 3) || []
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        eligibleCappers: eligibleCappers.map(c => ({
          name: c.name,
          netUnits: c.netUnits,
          winRate: c.winRate
        })),
        upcomingGamesCount: upcomingGames.length,
        gameAnalysis
      }
    })
  } catch (error: any) {
    console.error('[API:DEEP] Status error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get DEEP status'
    }, { status: 500 })
  }
}

