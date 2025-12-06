import { NextRequest, NextResponse } from 'next/server'
import { getGrokSentiment, getInfluencerSentiment, getInterpreterAnalysis, getDevilsAdvocate, getMathematicianAnalysis } from '@/lib/ai-insights/grok-client'

/**
 * POST: Test archetype baseline adjustment for a game
 * Returns the full prompt, response, and baseline adjustment values
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { awayTeam, homeTeam, spread, total, betType, archetype } = body

  if (!awayTeam || !homeTeam || !archetype) {
    return NextResponse.json({ success: false, error: 'Missing required fields: awayTeam, homeTeam, archetype' }, { status: 400 })
  }

  const validArchetypes = ['pulse', 'influencer', 'interpreter', 'devils-advocate', 'mathematician']
  if (!validArchetypes.includes(archetype)) {
    return NextResponse.json({ success: false, error: `Invalid archetype. Must be one of: ${validArchetypes.join(', ')}` }, { status: 400 })
  }

  try {
    const baseRequest = {
      awayTeam,
      homeTeam,
      spread: spread || { away: 0, home: 0 },
      total: total || 220,
      gameDate: new Date().toISOString().split('T')[0],
      betType: betType || 'TOTAL'
    }

    let result: any = null
    let archetypeName = ''

    switch (archetype) {
      case 'pulse':
        archetypeName = 'The Pulse'
        result = await getGrokSentiment(baseRequest)
        break
      
      case 'influencer':
        archetypeName = 'The Influencer'
        result = await getInfluencerSentiment({ ...baseRequest, minFollowers: 10000 })
        break
      
      case 'interpreter':
        archetypeName = 'The Interpreter'
        result = await getInterpreterAnalysis(baseRequest)
        break
      
      case 'devils-advocate':
        archetypeName = "The Devil's Advocate"
        result = await getDevilsAdvocate({
          ...baseRequest,
          ourPick: betType === 'TOTAL' ? 'OVER' : awayTeam,
          ourConfidence: 65
        })
        break
      
      case 'mathematician':
        archetypeName = 'The Mathematician'
        // Mathematician needs stats - use defaults for testing
        result = await getMathematicianAnalysis({
          awayTeam,
          homeTeam,
          total: total || 220,
          gameDate: new Date().toISOString().split('T')[0],
          stats: {
            away: { pace: 100, ortg: 112, drtg: 110, ppg: 110, oppPpg: 108, threeP_pct: 0.36, threeP_rate: 0.38, ft_rate: 0.25, ftPct: 0.78, turnovers: 13, offReb: 10, defReb: 34, restDays: 1 },
            home: { pace: 98, ortg: 114, drtg: 108, ppg: 112, oppPpg: 106, threeP_pct: 0.37, threeP_rate: 0.40, ft_rate: 0.26, ftPct: 0.80, turnovers: 12, offReb: 9, defReb: 35, restDays: 2 }
          }
        })
        break
    }

    if (!result || !result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result?.error || 'Archetype returned no result',
        archetype: archetypeName
      }, { status: 500 })
    }

    // Extract the baseline adjustment
    const baselineAdjustment = result.baselineAdjustment || null

    // Build response with all relevant data
    return NextResponse.json({
      success: true,
      archetype: archetypeName,
      archetypeKey: archetype,
      betType,
      game: { awayTeam, homeTeam, spread, total },
      baselineAdjustment,
      // Include the raw analysis for prompt inspection
      rawAnalysis: extractRawAnalysis(result, archetype),
      // Include score/points info
      score: extractScore(result, archetype),
      usage: result.usage
    })

  } catch (error) {
    console.error('[archetype-baseline-test] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

function extractRawAnalysis(result: any, archetype: string): string {
  switch (archetype) {
    case 'pulse':
      return result.sentiment?.rawAnalysis || 'No raw analysis available'
    case 'influencer':
      return result.sentiment?.rawAnalysis || 'No raw analysis available'
    case 'interpreter':
      return result.analysis?.rawAnalysis || 'No raw analysis available'
    case 'devils-advocate':
      return result.analysis?.rawAnalysis || 'No raw analysis available'
    case 'mathematician':
      return result.analysis?.rawAnalysis || 'No raw analysis available'
    default:
      return 'Unknown archetype'
  }
}

function extractScore(result: any, archetype: string): any {
  switch (archetype) {
    case 'pulse':
      return result.pulseScore
    case 'influencer':
      return result.influencerScore
    case 'interpreter':
      return result.interpreterScore
    case 'devils-advocate':
      return result.devilsScore
    case 'mathematician':
      return result.mathScore
    default:
      return null
  }
}

