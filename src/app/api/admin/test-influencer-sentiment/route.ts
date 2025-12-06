/**
 * Test endpoint for The Influencer archetype
 * POST /api/admin/test-influencer-sentiment
 */

import { NextRequest, NextResponse } from 'next/server'
import { getInfluencerSentiment, InfluencerSentimentRequest } from '@/lib/ai-insights/grok-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as InfluencerSentimentRequest

    if (!body.awayTeam || !body.homeTeam) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: awayTeam, homeTeam' },
        { status: 400 }
      )
    }

    const result = await getInfluencerSentiment({
      awayTeam: body.awayTeam,
      homeTeam: body.homeTeam,
      spread: body.spread,
      total: body.total,
      gameDate: body.gameDate || new Date().toISOString().split('T')[0],
      betType: body.betType || 'SPREAD',
      minFollowers: body.minFollowers || 10000
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Test Influencer] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

