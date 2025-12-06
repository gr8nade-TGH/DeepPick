import { NextRequest, NextResponse } from 'next/server'
import { getDevilsAdvocate, DevilsAdvocateRequest } from '@/lib/ai-insights/grok-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const devilsRequest: DevilsAdvocateRequest = {
      awayTeam: body.awayTeam,
      homeTeam: body.homeTeam,
      spread: body.spread,
      total: body.total,
      gameDate: body.gameDate || new Date().toISOString().split('T')[0],
      betType: body.betType || 'SPREAD',
      ourPick: body.ourPick,
      ourConfidence: body.ourConfidence || 65
    }

    // Validate ourPick is provided
    if (!devilsRequest.ourPick) {
      return NextResponse.json(
        { success: false, error: 'ourPick is required for Devil\'s Advocate analysis' },
        { status: 400 }
      )
    }

    const result = await getDevilsAdvocate(devilsRequest)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Test Devils Advocate API] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

