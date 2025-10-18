/**
 * ORACLE - The AI-Powered Seer
 * 
 * Philosophy: "Let artificial intelligence research and decide."
 * 
 * Oracle's Strategy:
 * 1. Deep web research on the matchup
 * 2. AI analyzes all data and generates prediction
 * 3. Compares prediction to Vegas odds
 * 4. Only bets when confidence is 7+ and AI sees value
 * 5. Units scale with confidence
 */

import {
  type CapperGame,
  type CapperPick,
  getAverageOdds,
  getTotalLine,
  getSpreadLine,
} from './shared-logic'
import { getPerplexityClient, type MatchupResearch } from '@/lib/ai/perplexity-client'

export interface OraclePredictionLog {
  timestamp: string
  capper: string
  game: string
  aiModel: string
  research: {
    summary: string
    keyInsights: string[]
    injuries: any[]
    sources: Array<{ url: string; title: string }>
  }
  aiDecision: {
    recommendation: string
    selection: string
    confidence: number
    units: number
    scorePrediction: { home: number; away: number }
    reasoning: string
    factors: Record<string, { value: number; weight: number; impact: string }>
  }
  vegasComparison: {
    totalLine: number | null
    spreadLine: number | null
    ourPredictedTotal: number
    ourPredictedSpread: number
    valueFound: string
  }
  decision: {
    passed: boolean
    reason: string
    finalConfidence: number
    unitsAllocated: number
  }
}

async function researchAndAnalyzeGame(
  game: CapperGame,
  existingPickTypes: Set<string>
): Promise<{ pick: CapperPick | null; log: OraclePredictionLog }> {
  const log: OraclePredictionLog = {
    timestamp: new Date().toISOString(),
    capper: 'ORACLE',
    game: `${game.away_team.name} @ ${game.home_team.name}`,
    aiModel: 'perplexity-sonar-pro',
    research: {
      summary: '',
      keyInsights: [],
      injuries: [],
      sources: []
    },
    aiDecision: {
      recommendation: 'pass',
      selection: 'PASS',
      confidence: 0,
      units: 0,
      scorePrediction: { home: 0, away: 0 },
      reasoning: '',
      factors: {}
    },
    vegasComparison: {
      totalLine: null,
      spreadLine: null,
      ourPredictedTotal: 0,
      ourPredictedSpread: 0,
      valueFound: 'None'
    },
    decision: {
      passed: true,
      reason: '',
      finalConfidence: 0,
      unitsAllocated: 0
    }
  }

  try {
    const perplexity = getPerplexityClient()
    
    console.log(`🔮 Oracle researching: ${log.game}`)

    // Step 1: Deep web research
    const research = await perplexity.researchMatchup(
      game.home_team.name,
      game.away_team.name,
      game.sport,
      game.game_date,
      {
        useProSearch: true, // Use pro search for better quality
        recencyFilter: 'week'
      }
    )

    log.research = {
      summary: research.summary,
      keyInsights: research.keyInsights,
      injuries: research.injuries,
      sources: research.sources
    }

    console.log(`✅ Research complete: ${research.keyInsights.length} insights found`)

    // Step 2: Get current odds
    const vegasTotal = getTotalLine(game)
    const vegasSpread = getSpreadLine(game)
    
    const currentOdds = {
      moneyline: game.odds?.moneyline || { home: -110, away: -110 },
      spread: {
        line: vegasSpread || 0,
        home: game.odds?.spread?.home_line || -110,
        away: game.odds?.spread?.away_line || -110
      },
      total: {
        line: vegasTotal || 0,
        over: game.odds?.total?.over || -110,
        under: game.odds?.total?.under || -110
      }
    }

    // Step 3: Get AI betting recommendation
    const recommendation = await perplexity.getBettingRecommendation(
      game.home_team.name,
      game.away_team.name,
      game.sport,
      game.game_date,
      currentOdds,
      research,
      {
        name: 'Oracle',
        style: 'AI-powered data analyst',
        riskTolerance: 'Calculated and strategic - only bets when clear value exists',
        specialties: ['Pattern recognition', 'Data synthesis', 'Value betting', 'Injury impact analysis']
      }
    )

    log.aiDecision = recommendation

    // Step 4: Calculate comparisons
    const predictedTotal = recommendation.scorePrediction.home + recommendation.scorePrediction.away
    const predictedSpread = recommendation.scorePrediction.home - recommendation.scorePrediction.away

    log.vegasComparison = {
      totalLine: vegasTotal,
      spreadLine: vegasSpread,
      ourPredictedTotal: predictedTotal,
      ourPredictedSpread: predictedSpread,
      valueFound: recommendation.recommendation !== 'pass' ? `${recommendation.recommendation}: ${recommendation.selection}` : 'None'
    }

    // Step 5: Validate recommendation
    if (recommendation.recommendation === 'pass') {
      log.decision = {
        passed: true,
        reason: 'AI recommended PASS - confidence below threshold or no value found',
        finalConfidence: recommendation.confidence,
        unitsAllocated: 0
      }
      return { pick: null, log }
    }

    if (recommendation.confidence < 7.0) {
      log.decision = {
        passed: true,
        reason: `Confidence ${recommendation.confidence.toFixed(1)} below required 7.0`,
        finalConfidence: recommendation.confidence,
        unitsAllocated: 0
      }
      return { pick: null, log }
    }

    // Check if this pick type already exists
    const pickTypeMap: Record<string, string> = {
      'moneyline': 'moneyline',
      'spread': 'spread',
      'total': recommendation.selection.includes('OVER') ? 'total_over' : 'total_under'
    }

    const pickType = pickTypeMap[recommendation.recommendation] || 'moneyline'
    
    if (existingPickTypes.has(pickType)) {
      log.decision = {
        passed: true,
        reason: `Already have a ${pickType} pick for this game`,
        finalConfidence: recommendation.confidence,
        unitsAllocated: 0
      }
      return { pick: null, log }
    }

    // Step 6: Get odds for the selected bet
    let betOdds = -110
    let market: 'moneyline' | 'spread' | 'total' = 'moneyline'
    let side: 'home' | 'away' | 'over' | 'under' = 'home'

    if (recommendation.recommendation === 'moneyline') {
      market = 'moneyline'
      side = recommendation.selection === game.home_team.abbreviation ? 'home' : 'away'
    } else if (recommendation.recommendation === 'spread') {
      market = 'spread'
      side = recommendation.selection.includes(game.home_team.abbreviation) ? 'home' : 'away'
    } else if (recommendation.recommendation === 'total') {
      market = 'total'
      side = recommendation.selection.includes('OVER') ? 'over' : 'under'
    }

    betOdds = getAverageOdds(game, market, side) || -110

    // Step 7: Create the pick
    log.decision = {
      passed: false,
      reason: 'AI found value - making pick',
      finalConfidence: recommendation.confidence,
      unitsAllocated: recommendation.units
    }

    const pick: CapperPick = {
      gameId: game.id,
      selection: recommendation.selection,
      confidence: recommendation.confidence,
      units: recommendation.units,
      pickType: pickType as any,
      odds: betOdds,
      reasoning: [
        `🔮 ORACLE AI ANALYSIS`,
        ``,
        `Score Prediction: ${game.home_team.name} ${recommendation.scorePrediction.home}, ${game.away_team.name} ${recommendation.scorePrediction.away}`,
        `Confidence: ${recommendation.confidence.toFixed(1)}/10`,
        `Units: ${recommendation.units}`,
        ``,
        `${recommendation.reasoning}`,
        ``,
        `=== KEY FACTORS ===`,
        ...Object.entries(recommendation.factors).map(([factor, data]) =>
          `${factor.toUpperCase()} (${data.weight}%): ${data.value}/100 - ${data.impact}`
        ),
        ``,
        `=== RESEARCH INSIGHTS ===`,
        ...log.research.keyInsights.map(insight => `• ${insight}`),
        ``,
        `=== SOURCES ===`,
        ...log.research.sources.slice(0, 5).map(s => `• ${s.title}: ${s.url}`)
      ],
      scorePrediction: {
        homeScore: recommendation.scorePrediction.home,
        awayScore: recommendation.scorePrediction.away,
        totalPoints: predictedTotal,
        marginOfVictory: predictedSpread,
        winner: predictedSpread > 0 ? 'home' : 'away',
        reasoning: []
      },
      dataPoints: {
        avgOdds: betOdds,
        totalLine: vegasTotal ?? undefined,
        spreadLine: vegasSpread ?? undefined,
      }
    }

    console.log(`✅ Oracle recommends: ${recommendation.selection} (${recommendation.confidence}/10 confidence)`)

    return { pick, log }

  } catch (error) {
    console.error('❌ Oracle error:', error)
    log.decision = {
      passed: true,
      reason: `Error during AI analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      finalConfidence: 0,
      unitsAllocated: 0
    }
    return { pick: null, log }
  }
}

export async function analyzeBatch(
  games: CapperGame[],
  maxPicks: number,
  existingPicksByGame: Map<string, Set<string>>
): Promise<Array<{ pick: CapperPick; log: OraclePredictionLog }>> {
  const results: Array<{ pick: CapperPick; log: OraclePredictionLog }> = []
  
  // Oracle analyzes games one at a time (due to API rate limits and cost)
  for (const game of games.slice(0, Math.min(games.length, maxPicks * 2))) {
    // Skip if no odds
    if (!game.odds || Object.keys(game.odds).length === 0) {
      console.log(`⏭️  Skipping ${game.away_team.name} @ ${game.home_team.name} - no odds`)
      continue
    }

    const existingPickTypes = existingPicksByGame.get(game.id) || new Set()
    const result = await researchAndAnalyzeGame(game, existingPickTypes)
    
    if (result.pick) {
      results.push({ pick: result.pick, log: result.log })
      
      // Stop if we have enough picks
      if (results.length >= maxPicks) {
        break
      }
    }

    // Small delay to avoid rate limits (Perplexity has rate limits)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  return results
}

