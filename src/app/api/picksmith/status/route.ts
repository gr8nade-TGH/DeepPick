/**
 * PICKSMITH Status API
 * 
 * GET /api/picksmith/status
 * 
 * Returns current status including:
 * - Eligible cappers (with positive unit records)
 * - Upcoming games (within 4 hours)
 * - Potential consensus opportunities
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEligibleCappers } from '@/lib/cappers/picksmith/eligibility'
import { getUpcomingGames } from '@/lib/cappers/picksmith/pick-generator'
import { getPicksForGame, analyzeConsensus, analyzeConflict } from '@/lib/cappers/picksmith/consensus'
import { calculatePicksmithUnits } from '@/lib/cappers/picksmith/units-calculator'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get eligible cappers
    const eligibleCappers = await getEligibleCappers()
    
    // Get upcoming games
    const upcomingGames = await getUpcomingGames()
    
    // Analyze consensus opportunities for each game
    const gameAnalysis = await Promise.all(
      upcomingGames.map(async (game) => {
        const picks = await getPicksForGame(game.id, eligibleCappers)
        
        // Analyze totals
        const totalGroups = analyzeConsensus(picks, 'total')
        const totalOpportunities = totalGroups.map(group => {
          const conflict = analyzeConflict(group)
          const decision = calculatePicksmithUnits(group)
          return {
            side: group.side,
            line: group.line,
            agreeing: group.agreeing.map(p => ({ capper: p.capperName, units: p.units })),
            disagreeing: group.disagreeing.map(p => ({ capper: p.capperName, units: p.units })),
            canGenerate: conflict.canGeneratePick,
            reason: conflict.reason,
            calculatedUnits: decision.calculatedUnits
          }
        })
        
        // Analyze spreads
        const spreadGroups = analyzeConsensus(picks, 'spread')
        const spreadOpportunities = spreadGroups.map(group => {
          const conflict = analyzeConflict(group)
          const decision = calculatePicksmithUnits(group)
          return {
            side: group.side,
            line: group.line,
            agreeing: group.agreeing.map(p => ({ capper: p.capperName, units: p.units })),
            disagreeing: group.disagreeing.map(p => ({ capper: p.capperName, units: p.units })),
            canGenerate: conflict.canGeneratePick,
            reason: conflict.reason,
            calculatedUnits: decision.calculatedUnits
          }
        })
        
        return {
          gameId: game.id,
          matchup: `${game.awayTeam} @ ${game.homeTeam}`,
          hoursUntilStart: game.hoursUntilStart,
          picksFromEligibleCappers: picks.length,
          totals: totalOpportunities,
          spreads: spreadOpportunities
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      eligibleCappers: eligibleCappers.map(c => ({
        id: c.id,
        name: c.name,
        netUnits: c.netUnits,
        winRate: c.winRate,
        totalPicks: c.totalPicks
      })),
      upcomingGames: gameAnalysis,
      summary: {
        eligibleCapperCount: eligibleCappers.length,
        gamesWithin4Hours: upcomingGames.length,
        potentialPicks: gameAnalysis.reduce((sum, g) => 
          sum + 
          g.totals.filter(t => t.canGenerate).length + 
          g.spreads.filter(s => s.canGenerate).length, 
        0)
      }
    })
  } catch (error: any) {
    console.error('[API:PICKSMITH:Status] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get PICKSMITH status'
    }, { status: 500 })
  }
}

