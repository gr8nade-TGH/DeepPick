/**
 * Test Archetype API Endpoint
 * 
 * Runs the 3-pass AI verification pipeline for a specific archetype and game.
 * Currently stubbed for Phase 1 - returns simulated results for UI testing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getArchetypeById } from '@/lib/ai-insights/archetype-definitions'

interface TestResult {
  archetypeId: string
  gameId: string
  pass1: { 
    status: 'complete' | 'error'
    data?: {
      analysis: string
      claims: Array<{ claim: string; confidence: string }>
      preliminary_score: number
    }
    error?: string
    tokens?: number
    duration?: number
  }
  pass2: { 
    status: 'complete' | 'error'
    data?: {
      verified_claims: number
      flagged_claims: number
      data_quality_score: number
      recommendation: string
    }
    error?: string
    tokens?: number
    duration?: number
  }
  pass3: { 
    status: 'complete' | 'error'
    data?: {
      X: number
      Y: number
      Z: number
      insight_score: number
      confidence: string
      direction: string
      magnitude: number
      reasoning: string
    }
    error?: string
    tokens?: number
    duration?: number
  }
  overall: {
    quality: number
    status: 'verified' | 'flagged' | 'rejected'
  }
}

export async function POST(request: NextRequest) {
  try {
    const { archetypeId, gameId } = await request.json()

    if (!archetypeId || !gameId) {
      return NextResponse.json(
        { error: 'Missing archetypeId or gameId' },
        { status: 400 }
      )
    }

    const archetype = getArchetypeById(archetypeId)
    if (!archetype) {
      return NextResponse.json(
        { error: `Archetype not found: ${archetypeId}` },
        { status: 404 }
      )
    }

    // PHASE 1: Stubbed results for UI testing
    // In Phase 2, this will actually call OpenAI for each pass
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Generate random but realistic-looking test results
    const qualityScore = 0.7 + Math.random() * 0.25 // 0.70-0.95
    const X = archetype.factorInputs.X.range.min + 
      Math.random() * (archetype.factorInputs.X.range.max - archetype.factorInputs.X.range.min)
    const Y = archetype.factorInputs.Y.range.min + 
      Math.random() * (archetype.factorInputs.Y.range.max - archetype.factorInputs.Y.range.min)
    const Z = 0.6 + Math.random() * 0.4 // 0.6-1.0 confidence

    const result: TestResult = {
      archetypeId,
      gameId,
      pass1: {
        status: 'complete',
        data: {
          analysis: `Analysis from ${archetype.name}: ${archetype.philosophy}. Based on current matchup data, this archetype identifies key signals.`,
          claims: [
            { claim: `${archetype.focusFactors[0]} differential is significant`, confidence: 'high' },
            { claim: `Recent trend supports ${archetype.betType === 'TOTAL' ? 'over/under' : 'spread'} prediction`, confidence: 'medium' }
          ],
          preliminary_score: (Math.random() * 4 - 2) // -2 to +2
        },
        tokens: 1024 + Math.floor(Math.random() * 500),
        duration: 0.8 + Math.random() * 0.5
      },
      pass2: {
        status: 'complete',
        data: {
          verified_claims: 2,
          flagged_claims: 0,
          data_quality_score: qualityScore,
          recommendation: qualityScore >= 0.85 ? 'proceed' : qualityScore >= 0.70 ? 'flag_for_review' : 'reject'
        },
        tokens: 1536 + Math.floor(Math.random() * 500),
        duration: 1.0 + Math.random() * 0.5
      },
      pass3: {
        status: 'complete',
        data: {
          X: Number(X.toFixed(2)),
          Y: Number(Y.toFixed(2)),
          Z: Number(Z.toFixed(2)),
          insight_score: Number((X * 0.4 + Y * 0.3 + Z * 3).toFixed(2)),
          confidence: Z > 0.8 ? 'high' : Z > 0.6 ? 'medium' : 'low',
          direction: archetype.betType === 'TOTAL' 
            ? (X > 0 ? 'over' : 'under')
            : (X > 0 ? 'away' : 'home'),
          magnitude: Number(Math.abs(X / 10).toFixed(2)),
          reasoning: `Based on verified data, ${archetype.name} analysis indicates a ${Z > 0.8 ? 'strong' : 'moderate'} signal. The ${archetype.focusFactors[0]} factor shows ${X > 0 ? 'positive' : 'negative'} differential.`
        },
        tokens: 892 + Math.floor(Math.random() * 300),
        duration: 1.2 + Math.random() * 0.5
      },
      overall: {
        quality: Number(qualityScore.toFixed(3)),
        status: qualityScore >= 0.85 ? 'verified' : qualityScore >= 0.70 ? 'flagged' : 'rejected'
      }
    }

    return NextResponse.json({
      success: true,
      result,
      message: `Test completed for ${archetype.name} on game ${gameId}`
    })

  } catch (error) {
    console.error('[test-archetype] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

