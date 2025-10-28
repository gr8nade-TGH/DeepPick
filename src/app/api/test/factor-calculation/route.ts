/**
 * Test individual factor calculations
 * POST /api/test/factor-calculation
 */

import { getTeamFormData } from '@/lib/data-sources/mysportsfeeds-stats'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { factorName, teamAbbrev } = await request.json()
    
    console.log(`[Factor Test] Testing ${factorName} for team ${teamAbbrev}...`)
    
    // Get form data
    const formData = await getTeamFormData(teamAbbrev)
    
    // Return the specific factor value
    let factorValue
    let formula
    
    switch (factorName) {
      case 'Pace':
        factorValue = formData.pace
        formula = 'Poss = FGA + 0.44 * FTA - OREB + TOV | Pace = avg(Poss_team, Poss_opp)'
        break
      case 'ORtg':
        factorValue = formData.ortg
        formula = 'ORtg = (PTS / Poss) * 100'
        break
      case 'DRtg':
        factorValue = formData.drtg
        formula = 'DRtg = (OppPTS / OppPoss) * 100'
        break
      case '3P%':
        factorValue = formData.threeP_pct
        formula = '3P% = 3PM / 3PA'
        break
      case '3PAR':
        factorValue = formData.threeP_rate
        formula = '3PAR = 3PA / FGA'
        break
      case 'FTr':
        factorValue = formData.ft_rate
        formula = 'FTr = FTA / FGA'
        break
      default:
        throw new Error(`Unknown factor: ${factorName}`)
    }
    
    return NextResponse.json({
      success: true,
      factorName,
      formula,
      team: teamAbbrev,
      data: {
        value: factorValue,
        allFactors: formData
      }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Factor Test] Error:', errorMessage)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

