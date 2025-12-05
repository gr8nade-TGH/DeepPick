/**
 * Test Grok Sentiment Analysis
 * 
 * Test endpoint for analyzing public sentiment on NBA games using Grok API.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGrokSentiment, type GrokSentimentRequest } from '@/lib/ai-insights/grok-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { awayTeam, homeTeam, spread, total, gameDate, betType } = body

    if (!awayTeam || !homeTeam || !betType) {
      return NextResponse.json(
        { error: 'Missing required fields: awayTeam, homeTeam, betType' },
        { status: 400 }
      )
    }

    const sentimentRequest: GrokSentimentRequest = {
      awayTeam,
      homeTeam,
      spread,
      total,
      gameDate: gameDate || new Date().toISOString().split('T')[0],
      betType
    }

    console.log('[test-grok-sentiment] Request:', sentimentRequest)
    
    const startTime = Date.now()
    const result = await getGrokSentiment(sentimentRequest)
    const duration = Date.now() - startTime

    console.log('[test-grok-sentiment] Result:', {
      success: result.success,
      duration: `${duration}ms`,
      quantified: result.quantified,
      error: result.error
    })

    return NextResponse.json({
      ...result,
      meta: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        request: sentimentRequest
      }
    })

  } catch (error) {
    console.error('[test-grok-sentiment] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// GET endpoint for quick testing with defaults
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  
  // Default test: Lakers @ Celtics spread
  const testRequest: GrokSentimentRequest = {
    awayTeam: searchParams.get('away') || 'Lakers',
    homeTeam: searchParams.get('home') || 'Celtics',
    spread: {
      away: Number(searchParams.get('awaySpread')) || 7.5,
      home: Number(searchParams.get('homeSpread')) || -7.5
    },
    gameDate: searchParams.get('date') || new Date().toISOString().split('T')[0],
    betType: 'SPREAD'
  }

  console.log('[test-grok-sentiment GET] Testing with:', testRequest)
  
  const startTime = Date.now()
  const result = await getGrokSentiment(testRequest)
  const duration = Date.now() - startTime

  return NextResponse.json({
    ...result,
    meta: {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      request: testRequest
    }
  })
}

