import { NextResponse } from 'next/server'
import { getAICapperOrchestrator } from '@/lib/ai/ai-capper-orchestrator'
import type { CapperGame } from '@/lib/cappers/shared-logic'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for AI processing

/**
 * Test endpoint for AI Capper system
 * 
 * Tests the complete 2-run flow:
 * - Run 1: Perplexity + 2 StatMuse questions
 * - Run 2: ChatGPT + 2 StatMuse questions
 */
export async function POST(request: Request) {
  try {
    console.log('🧪 Testing AI Capper system...')
    
    // Check API keys
    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'PERPLEXITY_API_KEY not set',
        setup_url: 'https://www.perplexity.ai/settings/api'
      }, { status: 500 })
    }
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'OPENAI_API_KEY not set',
        setup_url: 'https://platform.openai.com/api-keys'
      }, { status: 500 })
    }
    
    // Create a mock game for testing
    const mockGame: CapperGame = {
      id: 'test-game-123',
      sport: 'nba',
      league: 'NBA',
      home_team: {
        id: 'lal',
        name: 'Lakers',
        abbreviation: 'LAL',
        city: 'Los Angeles'
      },
      away_team: {
        id: 'bos',
        name: 'Celtics',
        abbreviation: 'BOS',
        city: 'Boston'
      },
      game_date: new Date().toISOString().split('T')[0],
      game_time: '19:30:00',
      status: 'scheduled',
      odds: {
        moneyline: { home: -150, away: +130 },
        spread: { 
          home: -3.5, 
          away: +3.5,
          home_line: -110,
          away_line: -110
        },
        total: { 
          line: 225.5, 
          over: -110, 
          under: -110 
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const shivaPersonality = {
      name: 'SHIVA',
      style: 'Multi-model destroyer',
      run1_focus: [
        'Recent form and momentum',
        'Head-to-head history',
        'Scoring trends and matchup efficiency'
      ],
      run2_focus: [
        'Latest injuries and lineup changes',
        'Betting market trends',
        'Score prediction validation'
      ]
    }
    
    console.log('📊 Running AI research...')
    const orchestrator = getAICapperOrchestrator()
    const result = await orchestrator.researchGame(mockGame, shivaPersonality)
    
    console.log('✅ AI research complete!')
    console.log(`💰 Total cost: $${result.totalCost.toFixed(4)}`)
    
    return NextResponse.json({
      success: true,
      message: 'AI Capper test successful',
      test_game: {
        matchup: `${mockGame.away_team.name} @ ${mockGame.home_team.name}`,
        sport: mockGame.sport
      },
      results: {
        run1: {
          provider: result.run1.aiProvider,
          statmuse_questions: result.run1.statmuseQuestions,
          statmuse_answers: result.run1.statmuseAnswers.map(a => ({
            question: a.question,
            answer: a.answer,
            confidence: a.confidence
          })),
          factors_found: Object.keys(result.run1.aiAnalysis.factors || {}).length,
          cost: result.run1.cost
        },
        run2: {
          provider: result.run2.aiProvider,
          statmuse_questions: result.run2.statmuseQuestions,
          statmuse_answers: result.run2.statmuseAnswers.map(a => ({
            question: a.question,
            answer: a.answer,
            confidence: a.confidence
          })),
          factors_found: Object.keys(result.run2.aiAnalysis.factors || {}).length,
          score_prediction: result.scorePrediction,
          cost: result.run2.cost
        },
        total_cost: result.totalCost,
        writeup_preview: result.writeup?.substring(0, 200) + '...',
        bold_prediction: result.boldPrediction
      }
    })
    
  } catch (error) {
    console.error('❌ AI Capper test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

